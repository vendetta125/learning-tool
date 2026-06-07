/**
 * tutorEngine.ts
 *
 * Orchestrator — the single entry point for all tutor interactions.
 *
 * Pipeline (per attempt):
 *  1. processAttempt    → update AttemptLog + UserProgress (Phase 2)
 *  2. diagnoseMisconception → classify the error
 *  3. buildTutorResponse   → generate explanation + alternative modes
 *  4. generateQuestion     → next practice question
 *  5. getNextTopic         → scheduler recommendation (Phase 2)
 *  6. computeLearningState → full state snapshot (Phase 2)
 *
 * Returns one structured object. No side-effects beyond Phase 2 DB writes.
 */

import { prisma } from './db'
import { processAttempt, type AttemptResult } from './updateMastery'
import { diagnoseMisconception }               from './misconceptions'
import { buildTutorResponse, type TutorResponse } from './tutor'
import { generateQuestion }                    from './questionGenerator'
import { getNextTopic, computeLearningState, type NextTopic, type LearningState } from './scheduler'
import { getPrerequisites }                    from './graph'

// ─── Types ────────────────────────────────────────────────

export interface TutorEngineInput {
  specPointId:  string
  correct:      boolean
  responseTime: number
  userAnswer?:  string
  errorType?:   string
}

export interface TutorEngineOutput {
  masteryUpdate: AttemptResult
  tutorResponse: TutorResponse
  nextTopic:     NextTopic | null
  learningState: LearningState
}

// ─── Orchestrator ─────────────────────────────────────────

export async function runTutorEngine(
  input: TutorEngineInput,
): Promise<TutorEngineOutput> {
  const { specPointId, correct, responseTime, errorType } = input

  // 1. Validate spec point exists
  const sp = await prisma.specPoint.findUniqueOrThrow({ where: { id: specPointId } })

  // 2. Load recent attempts BEFORE writing, for misconception context
  const recentAttempts = await prisma.attemptLog.findMany({
    where:   { specPointId },
    orderBy: { timestamp: 'desc' },
    take:    10,
  })

  // 3. Update mastery (Phase 2 pipeline)
  const masteryUpdate = await processAttempt({
    specPointId,
    correct,
    responseTime,
    errorType,
  })

  // 4. Diagnose (only meaningful on incorrect — still runs on correct for consistency)
  const misconception = await diagnoseMisconception(specPointId, recentAttempts)

  // 5. Resolve prerequisite links for the tutor response
  const prereqIds = await getPrerequisites(specPointId)

  // 6. Build structured tutor response
  const tutorResponse = buildTutorResponse(sp, misconception, generateQuestion(sp), prereqIds)

  // 7. Get scheduler recommendation and full learning state in parallel
  const [nextTopic, learningState] = await Promise.all([
    getNextTopic(),
    computeLearningState(),
  ])

  return {
    masteryUpdate,
    tutorResponse,
    nextTopic,
    learningState,
  }
}
