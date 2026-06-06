/**
 * updateMastery.ts
 *
 * DB update pipeline triggered after every attempt.
 * 1. Writes the AttemptLog record
 * 2. Recalculates mastery and confidence from full attempt history
 * 3. Updates UserProgress (upsert)
 *
 * No UI logic. Returns updated values for the caller to use.
 */

import { prisma } from './db'
import { computeMastery, computeConfidence } from './learningEngine'

export interface AttemptInput {
  specPointId:  string
  correct:      boolean
  responseTime: number   // milliseconds
  errorType?:   string
}

export interface AttemptResult {
  specPointId:  string
  newMastery:   number
  newConfidence: number
  attemptCount: number
  correct:      boolean
}

export async function processAttempt(input: AttemptInput): Promise<AttemptResult> {
  const { specPointId, correct, responseTime, errorType } = input

  // 1. Ensure the SpecPoint exists (throws if not)
  const sp = await prisma.specPoint.findUniqueOrThrow({ where: { id: specPointId } })

  // 2. Write the attempt
  await prisma.attemptLog.create({
    data: {
      specPointId,
      correct,
      responseTime,
      errorType: errorType ?? null,
    },
  })

  // 3. Load full attempt history for this spec point
  const attempts = await prisma.attemptLog.findMany({
    where: { specPointId },
    orderBy: { timestamp: 'desc' },
  })

  // 4. Upsert UserProgress — create with defaults if first attempt
  const existing = await prisma.userProgress.findUnique({ where: { specPointId } })

  const progress = existing ?? {
    id:           '',
    specPointId,
    mastery:      0,
    confidence:   0,
    lastReviewed: null,
    decayRate:    sp.difficulty <= 3 ? 0.03 : sp.difficulty <= 6 ? 0.05 : 0.08,
  }

  const newMastery    = computeMastery(attempts, { ...progress, lastReviewed: new Date() })
  const newConfidence = computeConfidence(attempts)

  await prisma.userProgress.upsert({
    where:  { specPointId },
    update: {
      mastery:      newMastery,
      confidence:   newConfidence,
      lastReviewed: new Date(),
    },
    create: {
      specPointId,
      mastery:      newMastery,
      confidence:   newConfidence,
      lastReviewed: new Date(),
      decayRate:    progress.decayRate,
    },
  })

  return {
    specPointId,
    newMastery,
    newConfidence,
    attemptCount: attempts.length,
    correct,
  }
}
