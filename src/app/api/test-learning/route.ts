/**
 * POST /api/test-learning
 *
 * Debug endpoint for Phase 2 verification.
 * Creates a minimal test spec point if none exist, processes a fake attempt,
 * then returns the updated mastery state and next recommended topic.
 *
 * Body (all optional):
 *   { specPointId?: string, correct?: boolean, responseTime?: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { processAttempt } from '@/lib/updateMastery'
import { getNextTopic, computeLearningState } from '@/lib/scheduler'

const TEST_SPEC_POINT_ID = 'test-sp-001'

async function ensureTestSpecPoint() {
  const existing = await prisma.specPoint.findUnique({
    where: { id: TEST_SPEC_POINT_ID },
  })
  if (existing) return existing

  return prisma.specPoint.create({
    data: {
      id:           TEST_SPEC_POINT_ID,
      title:        'Test: Basic Arithmetic',
      topic:        'Number',
      description:  'Placeholder spec point for Phase 2 testing.',
      edexcel_ref:  null,
      prerequisites: '[]',
      difficulty:    3,
      status:        'unverified',
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const specPointId  = (body.specPointId  as string)  || TEST_SPEC_POINT_ID
    const correct      = typeof body.correct === 'boolean' ? body.correct : true
    const responseTime = typeof body.responseTime === 'number' ? body.responseTime : 4000

    // Ensure the target spec point exists
    if (specPointId === TEST_SPEC_POINT_ID) {
      await ensureTestSpecPoint()
    } else {
      const sp = await prisma.specPoint.findUnique({ where: { id: specPointId } })
      if (!sp) {
        return NextResponse.json({ error: `SpecPoint '${specPointId}' not found` }, { status: 404 })
      }
    }

    // Process attempt and get updated state
    const [result, nextTopic, learningState] = await Promise.all([
      processAttempt({ specPointId, correct, responseTime }),
      getNextTopic(),
      computeLearningState(),
    ])

    return NextResponse.json({
      attempt:       result,
      nextTopic,
      learningState,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const [nextTopic, learningState] = await Promise.all([
      getNextTopic(),
      computeLearningState(),
    ])
    return NextResponse.json({ nextTopic, learningState })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
