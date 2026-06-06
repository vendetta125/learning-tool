/**
 * misconceptions.ts
 *
 * Maps incorrect answers to specific knowledge-graph gaps.
 * All diagnosis is evidence-based — no guessing without data.
 *
 * Classification logic (strict priority):
 *  1. PREREQUISITE — weakest prerequisite has mastery < 400
 *  2. CONCEPTUAL   — consistent failure (≥3 attempts, correctRate < 0.35)
 *  3. CARELESS     — fast response (<3 s) on a topic with mastery ≥ 600
 *  4. PROCEDURAL   — default when no stronger signal
 */

import { prisma } from './db'
import { getPrerequisites } from './graph'
import { getMasteryForSpecPoint } from './learningEngine'
import type { AttemptLog } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────

export type MisconceptionType = 'procedural' | 'conceptual' | 'prerequisite' | 'careless'

export interface MisconceptionResult {
  rootCauseSpecPointId: string
  type:                 MisconceptionType
  confidence:           number            // 0–1
  description:          string
  suggestedAction:      string
}

// ─── Main diagnosis ───────────────────────────────────────

export async function diagnoseMisconception(
  specPointId:    string,
  recentAttempts: AttemptLog[],
): Promise<MisconceptionResult> {

  // ── 1. Prerequisite gap? ──────────────────────────────────
  const prereqIds = await getPrerequisites(specPointId)

  if (prereqIds.length > 0) {
    const prereqMasteries = await Promise.all(
      prereqIds.map(async id => ({
        id,
        mastery: (await getMasteryForSpecPoint(id)).mastery,
      })),
    )

    const weakest = prereqMasteries.sort((a, b) => a.mastery - b.mastery)[0]

    if (weakest.mastery < 400) {
      const prereq = await prisma.specPoint.findUnique({ where: { id: weakest.id } })
      return {
        rootCauseSpecPointId: weakest.id,
        type:            'prerequisite',
        confidence:      0.85,
        description:     `Missing prerequisite: "${prereq?.title ?? weakest.id}" (mastery: ${weakest.mastery}/1000)`,
        suggestedAction: `Study "${prereq?.title ?? weakest.id}" before returning to this topic`,
      }
    }
  }

  // ── 2. Conceptual misunderstanding? ──────────────────────
  const allAttempts = await prisma.attemptLog.findMany({
    where:   { specPointId },
    orderBy: { timestamp: 'desc' },
    take:    10,
  })

  if (allAttempts.length >= 3) {
    const correctRate = allAttempts.filter(a => a.correct).length / allAttempts.length
    if (correctRate < 0.35) {
      return {
        rootCauseSpecPointId: specPointId,
        type:            'conceptual',
        confidence:      0.80,
        description:     `Systematic errors across ${allAttempts.length} attempts (${Math.round(correctRate * 100)}% correct) suggest a conceptual gap`,
        suggestedAction: 'Review the core concept from first principles',
      }
    }
  }

  // ── 3. Careless mistake? ─────────────────────────────────
  const { mastery } = await getMasteryForSpecPoint(specPointId)
  const avgResponseMs = recentAttempts.length
    ? recentAttempts.reduce((s, a) => s + a.responseTime, 0) / recentAttempts.length
    : Infinity

  if (mastery >= 600 && avgResponseMs < 3_000) {
    return {
      rootCauseSpecPointId: specPointId,
      type:            'careless',
      confidence:      0.70,
      description:     `High mastery (${mastery}/1000) but fast response (${Math.round(avgResponseMs / 1000)}s) — likely a careless slip`,
      suggestedAction: 'Slow down and check your working',
    }
  }

  // ── 4. Procedural default ─────────────────────────────────
  return {
    rootCauseSpecPointId: specPointId,
    type:            'procedural',
    confidence:      0.60,
    description:     'Error in executing the procedure — method known but steps incorrect',
    suggestedAction: 'Review each step of the method carefully',
  }
}
