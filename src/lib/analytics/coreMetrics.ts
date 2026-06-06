/**
 * coreMetrics.ts
 *
 * Analytics foundation layer.  Aggregates raw UserProgress + AttemptLog
 * data into high-level metrics consumed by the dashboard and learning
 * path planner.
 *
 * All metrics are computed on-demand from the database — no cached state.
 */

import { prisma }          from '../db'
import { buildProgressMap } from '../graph'

// ─── Types ────────────────────────────────────────────────

export interface TopicMetrics {
  topic:           string
  specPointCount:  number
  masteredCount:   number
  averageMastery:  number
  weakCount:       number         // mastery < 400
  strongCount:     number         // mastery ≥ 800
  masteryPct:      number         // 0–100
}

export interface MasteryDistribution {
  unstarted:   number    // mastery = 0
  learning:    number    // 1–399
  developing:  number    // 400–599
  proficient:  number    // 600–799
  mastered:    number    // 800–1000
}

export interface WeakCluster {
  topic:          string
  specPointIds:   string[]
  avgMastery:     number
  urgency:        'critical' | 'high' | 'medium'   // critical < 200, high < 400, medium < 600
}

export interface LearningVelocity {
  attemptsLast7Days:   number
  attemptsLast30Days:  number
  correctRateLast7:    number    // 0–1
  correctRateLast30:   number    // 0–1
  masteryGainLast7:    number    // average mastery point gain per day
  activeDaysLast30:    number
}

export interface CoreMetrics {
  topicMetrics:         TopicMetrics[]
  masteryDistribution:  MasteryDistribution
  weakClusters:         WeakCluster[]
  learningVelocity:     LearningVelocity
  overallMasteryPct:    number   // 0–100
  estimatedGrade:       number   // rough grade 4–9 from mastery
}

// ─── Topic metrics ────────────────────────────────────────

export async function getTopicMetrics(): Promise<TopicMetrics[]> {
  const sps         = await prisma.specPoint.findMany()
  const progressMap = await buildProgressMap()

  const byTopic = new Map<string, { ids: string[] }>()
  for (const sp of sps) {
    const existing = byTopic.get(sp.topic) ?? { ids: [] }
    byTopic.set(sp.topic, { ids: [...existing.ids, sp.id] })
  }

  return Array.from(byTopic.entries()).map(([topic, { ids }]) => {
    const masteries    = ids.map(id => progressMap.get(id) ?? 0)
    const avg          = masteries.length > 0
      ? Math.round(masteries.reduce((s, m) => s + m, 0) / masteries.length)
      : 0
    const masteredCount = masteries.filter(m => m >= 800).length
    const weakCount     = masteries.filter(m => m < 400).length
    const strongCount   = masteries.filter(m => m >= 800).length

    return {
      topic,
      specPointCount: ids.length,
      masteredCount,
      averageMastery: avg,
      weakCount,
      strongCount,
      masteryPct: masteries.length > 0
        ? Math.round((masteredCount / masteries.length) * 100)
        : 0,
    }
  }).sort((a, b) => a.masteryPct - b.masteryPct)
}

// ─── Mastery distribution ─────────────────────────────────

export async function getMasteryDistribution(): Promise<MasteryDistribution> {
  const progressMap  = await buildProgressMap()
  const sps          = await prisma.specPoint.findMany()

  const dist: MasteryDistribution = { unstarted: 0, learning: 0, developing: 0, proficient: 0, mastered: 0 }

  for (const sp of sps) {
    const m = progressMap.get(sp.id) ?? 0
    if (m === 0)         dist.unstarted++
    else if (m < 400)    dist.learning++
    else if (m < 600)    dist.developing++
    else if (m < 800)    dist.proficient++
    else                 dist.mastered++
  }

  return dist
}

// ─── Weak clusters ────────────────────────────────────────

export async function getWeakClusters(threshold: number = 600): Promise<WeakCluster[]> {
  const sps         = await prisma.specPoint.findMany()
  const progressMap = await buildProgressMap()

  const byTopic = new Map<string, { ids: string[]; masteries: number[] }>()
  for (const sp of sps) {
    const m = progressMap.get(sp.id) ?? 0
    if (m < threshold) {
      const entry = byTopic.get(sp.topic) ?? { ids: [], masteries: [] }
      byTopic.set(sp.topic, { ids: [...entry.ids, sp.id], masteries: [...entry.masteries, m] })
    }
  }

  return Array.from(byTopic.entries())
    .filter(([, { ids }]) => ids.length >= 2)
    .map(([topic, { ids, masteries }]) => {
      const avg     = Math.round(masteries.reduce((s, m) => s + m, 0) / masteries.length)
      const urgency: WeakCluster['urgency'] =
        avg < 200 ? 'critical' :
        avg < 400 ? 'high'     : 'medium'
      return { topic, specPointIds: ids, avgMastery: avg, urgency }
    })
    .sort((a, b) => a.avgMastery - b.avgMastery)
}

// ─── Learning velocity ────────────────────────────────────

export async function getLearningVelocity(): Promise<LearningVelocity> {
  const now     = new Date()
  const day7    = new Date(now.getTime() - 7  * 86_400_000)
  const day30   = new Date(now.getTime() - 30 * 86_400_000)

  const [recent7, recent30] = await Promise.all([
    prisma.attemptLog.findMany({ where: { timestamp: { gte: day7 } } }),
    prisma.attemptLog.findMany({ where: { timestamp: { gte: day30 } } }),
  ])

  const correctRate = (attempts: typeof recent7): number =>
    attempts.length > 0
      ? Math.round((attempts.filter(a => a.correct).length / attempts.length) * 100) / 100
      : 0

  // Active days: count distinct calendar days in last 30
  const dayStrings  = new Set(recent30.map(a => a.timestamp.toISOString().slice(0, 10)))
  const activeDays  = dayStrings.size

  // Mastery gain approximation: sample 10 most recent spec points and compare
  // current mastery vs mastery 7 days ago (approximated from attempt history)
  const gainPerDay  = activeDays > 0
    ? Math.round((recent7.filter(a => a.correct).length * 50) / Math.max(1, activeDays))
    : 0

  return {
    attemptsLast7Days:  recent7.length,
    attemptsLast30Days: recent30.length,
    correctRateLast7:   correctRate(recent7),
    correctRateLast30:  correctRate(recent30),
    masteryGainLast7:   gainPerDay,
    activeDaysLast30:   activeDays,
  }
}

// ─── Estimated grade from overall mastery ────────────────

function masteryToGrade(masteryPct: number): number {
  if (masteryPct >= 85) return 9
  if (masteryPct >= 76) return 8
  if (masteryPct >= 64) return 7
  if (masteryPct >= 55) return 6
  if (masteryPct >= 46) return 5
  if (masteryPct >= 35) return 4
  return 3
}

// ─── Combined report ──────────────────────────────────────

export async function getCoreMetrics(): Promise<CoreMetrics> {
  const [topicMetrics, masteryDistribution, weakClusters, learningVelocity] =
    await Promise.all([
      getTopicMetrics(),
      getMasteryDistribution(),
      getWeakClusters(),
      getLearningVelocity(),
    ])

  const total             = Object.values(masteryDistribution).reduce((s, n) => s + n, 0)
  const proficientAndUp   = masteryDistribution.proficient + masteryDistribution.mastered
  const overallMasteryPct = total > 0 ? Math.round((proficientAndUp / total) * 100) : 0

  return {
    topicMetrics,
    masteryDistribution,
    weakClusters,
    learningVelocity,
    overallMasteryPct,
    estimatedGrade: masteryToGrade(overallMasteryPct),
  }
}
