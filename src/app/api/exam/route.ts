/**
 * GET  /api/exam?type=MINI|FULL|BOSS_BATTLE&adapt=true&topic=Algebra&paper=2
 *   → Generates and returns a new exam.
 *
 * POST /api/exam
 *   Body: { exam: GeneratedExam, answers: ExamAnswer[] }
 *   → Grades the exam, runs analysis, triggers mastery updates via tutorEngine.
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateExam, type ExamType, type ExamAnswer, type GeneratedExam } from '@/lib/examEngine'
import { analyzeExamResults }                                                from '@/lib/examAnalysis'
import { mapQuestionsToSpecPoints }                                          from '@/lib/examMapper'
import { processAttempt }                                                    from '@/lib/updateMastery'

// ─── GET — generate exam ──────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const type  = (sp.get('type')  ?? 'MINI').toUpperCase() as ExamType
    const adapt = sp.get('adapt') === 'true'
    const topic = sp.get('topic') ?? undefined
    const paper = parseInt(sp.get('paper') ?? '2', 10) as 1 | 2 | 3

    const validTypes: ExamType[] = ['MINI', 'FULL', 'BOSS_BATTLE']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 })
    }

    const exam = await generateExam({
      type,
      focusTopic:   topic,
      adaptToUser:  adapt,
      paperNumber:  paper,
    })

    return NextResponse.json(exam)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ─── POST — grade exam + return analysis ─────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const exam:    GeneratedExam = body.exam
    const answers: ExamAnswer[]  = body.answers

    if (!exam || !answers) {
      return NextResponse.json(
        { error: 'Body must contain { exam: GeneratedExam, answers: ExamAnswer[] }' },
        { status: 400 },
      )
    }

    // Grade each answer and feed into mastery engine
    const answerMap    = new Map(answers.map(a => [a.questionId, a]))
    const masteryUpdates = []

    for (const q of exam.questions) {
      const answer = answerMap.get(q.id)
      if (!answer || answer.skipped) continue

      const isCorrect =
        answer.answer.trim().toLowerCase() === q.generated.answer.toLowerCase()

      try {
        const update = await processAttempt({
          specPointId:  q.specPointId,
          correct:      isCorrect,
          responseTime: answer.timeTakenMs,
        })
        masteryUpdates.push(update)
      } catch {
        // SpecPoint may not exist; skip mastery update for that question
      }
    }

    // Full performance analysis
    const [analysis, mappings] = await Promise.all([
      analyzeExamResults(exam, answers),
      mapQuestionsToSpecPoints(exam),
    ])

    return NextResponse.json({
      analysis,
      questionMappings: mappings,
      masteryUpdates,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
