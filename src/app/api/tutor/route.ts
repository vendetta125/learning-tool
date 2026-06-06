/**
 * POST /api/tutor
 *
 * Accepts an attempt and returns the full tutor engine output:
 * mastery update, diagnosis, explanation (4 modes), next question,
 * next recommended topic, and learning state snapshot.
 *
 * Body:
 *   {
 *     specPointId:  string   (required)
 *     correct:      boolean  (required)
 *     responseTime: number   (ms, required)
 *     userAnswer?:  string
 *     errorType?:   string
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { runTutorEngine } from '@/lib/tutorEngine'
import { generateQuestion } from '@/lib/questionGenerator'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const specPointId  = body.specPointId  as string  | undefined
    const correct      = body.correct      as boolean | undefined
    const responseTime = body.responseTime as number  | undefined

    if (!specPointId || correct === undefined || responseTime === undefined) {
      return NextResponse.json(
        { error: 'Required fields: specPointId (string), correct (boolean), responseTime (number ms)' },
        { status: 400 },
      )
    }

    const output = await runTutorEngine({
      specPointId,
      correct,
      responseTime,
      userAnswer: body.userAnswer,
      errorType:  body.errorType,
    })

    return NextResponse.json(output)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status  = message.includes('No SpecPoint') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * GET /api/tutor?specPointId=xxx
 * Returns a practice question for a spec point without recording an attempt.
 */
export async function GET(req: NextRequest) {
  try {
    const specPointId = req.nextUrl.searchParams.get('specPointId')

    if (!specPointId) {
      return NextResponse.json(
        { error: 'Query param required: specPointId' },
        { status: 400 },
      )
    }

    const sp = await prisma.specPoint.findUniqueOrThrow({ where: { id: specPointId } })
    const question = generateQuestion(sp)

    return NextResponse.json({ question })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status  = message.includes('No SpecPoint') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
