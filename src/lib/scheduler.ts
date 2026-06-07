/**
 * scheduler.ts
 *
 * Decides what the student studies next and computes the overall learning state.
 *
 * Selection priority (strict order):
 *  1. Weakest prerequisite that is blocking another topic
 *  2. Lowest mastery among unlocked topics
 *  3. Highest decay (longest unreviewed unlocked topic)
 *  4. Recently incorrect unlocked topics
 *  5. New (never attempted) unlocked topics
 *
 * A topic is only eligible if all its prerequisites have mastery ≥ 500.
 * This prevents students from "jumping ahead".
 */

import { prisma } from './db'
import {
  buildProgressMap,
  parsePrerequisites,
  PREREQUISITE_MASTERY_THRESHOLD,
} from './graph'
import type { SpecPoint } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────

export interface NextTopic {
  specPointId: string
  title:       string
  topic:       string
  reason:      string
  mastery:     number
}

export interface LearningState {
  weakTopics:      SpecPointSummary[]
  readyTopics:     SpecPointSummary[]
  forgottenTopics: SpecPointSummary[]
  blockedTopics:   SpecPointSummary[]
  totalSpecPoints: number
  masteredCount:   number
  averageMastery:  number
}

export interface SpecPointSummary {
  id:            string
  title:         string
  topic:         string
  mastery:       number
  daysSinceReview: number | null
}

const MASTERED_THRESHOLD  = 800  // consider "mastered" for counting

// ─── Priority scoring ─────────────────────────────────────

function scorePriority(
  sp:          SpecPoint,
  mastery:     number,
  progress:    { lastReviewed: Date | null; mastery: number } | null,
  recentErrors: number,
): number {
  let score = 0

  // Core: low mastery = high priority
  score += (1000 - mastery) * 0.5

  // Decay bonus: days since last review (capped)
  if (progress?.lastReviewed) {
    const days = (Date.now() - progress.lastReviewed.getTime()) / 86_400_000
    score += Math.min(days * 15, 300)
  }

  // Error bonus: recent incorrect attempts
  score += recentErrors * 150

  // New topic bonus (never attempted)
  if (!progress) score += 50

  return score
}

// ─── Main scheduler ───────────────────────────────────────

export async function getNextTopic(): Promise<NextTopic | null> {
  const [progressMap, specPoints, allProgress, allAttempts] = await Promise.all([
    buildProgressMap(),
    prisma.specPoint.findMany(),
    prisma.userProgress.findMany(),
    prisma.attemptLog.findMany({ orderBy: { timestamp: 'desc' }, take: 200 }),
  ])

  if (specPoints.length === 0) return null

  const progressBySpecPoint = new Map(allProgress.map(p => [p.specPointId, p]))

  // Recent errors per spec point (last 5 attempts each)
  const recentErrorMap = new Map<string, number>()
  for (const sp of specPoints) {
    const attempts = allAttempts
      .filter(a => a.specPointId === sp.id)
      .slice(0, 5)
    recentErrorMap.set(sp.id, attempts.filter(a => !a.correct).length)
  }

  // ── Rule 1: weakest blocking prerequisite ─────────────────
  const blockingPrereqs: { sp: SpecPoint; mastery: number }[] = []

  for (const sp of specPoints) {
    const spMastery = progressMap.get(sp.id) ?? 0
    if (spMastery >= PREREQUISITE_MASTERY_THRESHOLD) continue

    // Is this sp a prerequisite of anything?
    const dependents = specPoints.filter(d =>
      parsePrerequisites(d).includes(sp.id),
    )
    if (dependents.length > 0) {
      blockingPrereqs.push({ sp, mastery: spMastery })
    }
  }

  if (blockingPrereqs.length > 0) {
    blockingPrereqs.sort((a, b) => a.mastery - b.mastery)
    const { sp, mastery } = blockingPrereqs[0]
    return {
      specPointId: sp.id,
      title:       sp.title,
      topic:       sp.topic,
      reason:      'Weakest prerequisite blocking progression',
      mastery,
    }
  }

  // ── Rules 2–5: score all unlocked topics ──────────────────
  type Candidate = { sp: SpecPoint; mastery: number; score: number }
  const candidates: Candidate[] = []

  for (const sp of specPoints) {
    const mastery  = progressMap.get(sp.id) ?? 0
    if (mastery >= MASTERED_THRESHOLD) continue

    const prereqs  = parsePrerequisites(sp)
    const unlocked = prereqs.every(
      id => (progressMap.get(id) ?? 0) >= PREREQUISITE_MASTERY_THRESHOLD,
    )
    if (!unlocked) continue

    const progress    = progressBySpecPoint.get(sp.id) ?? null
    const recentErrors = recentErrorMap.get(sp.id) ?? 0
    const priority    = scorePriority(sp, mastery, progress, recentErrors)

    candidates.push({ sp, mastery, score: priority })
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]

  const mastery = best.mastery
  let reason = 'Lowest mastery unlocked topic'
  if (!progressBySpecPoint.has(best.sp.id)) reason = 'New unlocked topic'
  else if ((recentErrorMap.get(best.sp.id) ?? 0) > 2) reason = 'Recent errors detected'

  return {
    specPointId: best.sp.id,
    title:       best.sp.title,
    topic:       best.sp.topic,
    reason,
    mastery,
  }
}

// ─── Learning state ───────────────────────────────────────

export async function computeLearningState(): Promise<LearningState> {
  const [specPoints, allProgress, progressMap] = await Promise.all([
    prisma.specPoint.findMany(),
    prisma.userProgress.findMany(),
    buildProgressMap(),
  ])

  const progressBySpecPoint = new Map(allProgress.map(p => [p.specPointId, p]))

  const toSummary = (sp: SpecPoint): SpecPointSummary => {
    const p = progressBySpecPoint.get(sp.id)
    const days = p?.lastReviewed
      ? (Date.now() - p.lastReviewed.getTime()) / 86_400_000
      : null
    return {
      id:              sp.id,
      title:           sp.title,
      topic:           sp.topic,
      mastery:         progressMap.get(sp.id) ?? 0,
      daysSinceReview: days !== null ? Math.round(days * 10) / 10 : null,
    }
  }

  // Weak: mastery < 500 and at least 1 attempt
  const weakTopics = specPoints
    .filter(sp => progressBySpecPoint.has(sp.id) && (progressMap.get(sp.id) ?? 0) < 500)
    .map(toSummary)

  // Ready: unlocked (prereqs ≥ 500) and mastery < mastered threshold
  const readyTopics = specPoints
    .filter(sp => {
      const mastery = progressMap.get(sp.id) ?? 0
      if (mastery >= MASTERED_THRESHOLD) return false
      const prereqs = parsePrerequisites(sp)
      return prereqs.every(id => (progressMap.get(id) ?? 0) >= PREREQUISITE_MASTERY_THRESHOLD)
    })
    .map(toSummary)

  // Forgotten: mastery has decayed significantly (lastReviewed exists but mastery < 300)
  const forgottenTopics = specPoints
    .filter(sp => {
      const p = progressBySpecPoint.get(sp.id)
      if (!p || !p.lastReviewed) return false
      const days = (Date.now() - p.lastReviewed.getTime()) / 86_400_000
      return days > 7 && (progressMap.get(sp.id) ?? 0) < 300
    })
    .map(toSummary)

  // Blocked: not unlocked (some prerequisite < 500)
  const blockedTopics = specPoints
    .filter(sp => {
      const prereqs = parsePrerequisites(sp)
      if (prereqs.length === 0) return false
      return prereqs.some(id => (progressMap.get(id) ?? 0) < PREREQUISITE_MASTERY_THRESHOLD)
    })
    .map(toSummary)

  const allMastery     = specPoints.map(sp => progressMap.get(sp.id) ?? 0)
  const averageMastery = allMastery.length
    ? allMastery.reduce((a, b) => a + b, 0) / allMastery.length
    : 0

  return {
    weakTopics,
    readyTopics,
    forgottenTopics,
    blockedTopics,
    totalSpecPoints: specPoints.length,
    masteredCount:   allMastery.filter(m => m >= MASTERED_THRESHOLD).length,
    averageMastery:  Math.round(averageMastery),
  }
}
