/**
 * learningEngine.ts
 *
 * Mastery scoring, confidence, and decay — all deterministic, no randomness.
 *
 * Mastery formula:
 *   - Attempts sorted newest-first, weighted by RECENCY_ALPHA^rank
 *   - Incorrect answers carry INCORRECT_PENALTY × weight in the denominator
 *     so they hurt proportionally more than correct ones help
 *   - Final ratio is decayed with e^(-rate * days) since last review
 *   - Output: integer 0–1000
 *
 * 50/50 performance → mastery ~400 (below grade-5 threshold of 500).
 * 100% correct     → mastery 1000 (before decay).
 * 100% incorrect   → mastery 0.
 */

import { prisma } from './db'
import type { AttemptLog, UserProgress } from '@prisma/client'

const RECENCY_ALPHA      = 0.8   // weight decay per attempt rank (newest = rank 0)
const INCORRECT_PENALTY  = 1.5   // incorrect attempt weighs 1.5× in denominator
const CONFIDENCE_WINDOW  = 6     // recent attempts used for confidence

// ─── Pure functions (no DB) ──────────────────────────────

export function computeMastery(
  attempts: AttemptLog[],
  progress: UserProgress,
): number {
  if (attempts.length === 0) return 0

  const sorted = [...attempts].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  )

  let numerator   = 0
  let denominator = 0

  sorted.forEach((attempt, rank) => {
    const w = Math.pow(RECENCY_ALPHA, rank)
    if (attempt.correct) {
      numerator   += w
      denominator += w
    } else {
      denominator += w * INCORRECT_PENALTY
    }
  })

  const rawRatio = denominator === 0 ? 0 : numerator / denominator
  const decayed  = applyDecay(rawRatio, progress.lastReviewed, progress.decayRate)

  return clamp(Math.round(decayed * 1000), 0, 1000)
}

export function applyDecay(
  score: number,
  lastReviewed: Date | null,
  decayRate: number,
): number {
  if (!lastReviewed || decayRate === 0) return score
  const days = (Date.now() - lastReviewed.getTime()) / 86_400_000
  return score * Math.exp(-decayRate * days)
}

/**
 * Confidence ∈ [0, 1].
 * High accuracy + low variance → high confidence.
 * Formula: accuracy × (1 − 2 × stdDev)  clamped to [0,1].
 * stdDev of binary outcomes maxes at 0.5 (50/50), so factor ≤ 1.
 */
export function computeConfidence(attempts: AttemptLog[]): number {
  if (attempts.length < 2) return 0

  const values = [...attempts]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, CONFIDENCE_WINDOW)
    .map((a): number => (a.correct ? 1.0 : 0.0))

  const mean     = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  const stdDev   = Math.sqrt(variance)

  return clamp(mean * (1 - stdDev * 2), 0, 1)
}

// ─── DB-integrated ───────────────────────────────────────

export async function getMasteryForSpecPoint(specPointId: string): Promise<{
  mastery: number
  confidence: number
}> {
  const [progress, attempts] = await Promise.all([
    prisma.userProgress.findUnique({ where: { specPointId } }),
    prisma.attemptLog.findMany({
      where: { specPointId },
      orderBy: { timestamp: 'desc' },
    }),
  ])

  if (!progress) return { mastery: 0, confidence: 0 }

  return {
    mastery:    computeMastery(attempts, progress),
    confidence: computeConfidence(attempts),
  }
}

// ─── Helpers ─────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
