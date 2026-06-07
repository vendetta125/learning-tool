'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// ─── Minimal types (mirrors lib types, no server imports) ──

interface SpecPoint {
  id: string; title: string; topic: string
  difficulty: number; description: string
}
interface GeneratedQuestion {
  question: string; answer: string; marks: number
  solution: string; hints: string[]
}
interface AlternativeExplanation {
  mode: 'procedural' | 'conceptual' | 'visual' | 'analogy'
  content: string
}
interface TutorResponse {
  diagnosis: string
  misconception: string | null
  explanation: string
  alternativeExplanations: AlternativeExplanation[]
  nextQuestion: GeneratedQuestion
  specPointLinks: string[]
}
interface TutorResult {
  masteryUpdate: { newMastery: number; newConfidence: number; attemptCount: number; correct: boolean }
  tutorResponse: TutorResponse
  nextTopic: { specPointId: string; title: string; topic: string; reason: string; mastery: number } | null
  learningState: { averageMastery: number; masteredCount: number }
}

// ─── Lightweight markdown-ish text renderer (the explanation ─
// ─── strings use **bold** / *italic* and \n\n paragraphs)   ──

const MODE_LABELS: Record<AlternativeExplanation['mode'], string> = {
  procedural: 'Step-by-step',
  conceptual: 'Concept',
  visual:     'Visual',
  analogy:    'Analogy',
}

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))   return <em key={i}>{part.slice(1, -1)}</em>
    return <span key={i}>{part}</span>
  })
}

function ExplanationText({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-gray-300">
      {text.split(/\n\n+/).map((para, i) => <p key={i}>{renderInline(para)}</p>)}
    </div>
  )
}

function ExplanationBlock({ tutorResponse }: { tutorResponse: TutorResponse }) {
  return (
    <div className="space-y-4">
      <ExplanationText text={tutorResponse.explanation} />
      {tutorResponse.alternativeExplanations.length > 0 && (
        <div className="space-y-2 border-t border-gray-800 pt-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Other ways to see it</div>
          {tutorResponse.alternativeExplanations.map(alt => (
            <details key={alt.mode} className="text-sm">
              <summary className="cursor-pointer text-indigo-400 hover:text-indigo-300">{MODE_LABELS[alt.mode]}</summary>
              <div className="mt-2"><ExplanationText text={alt.content} /></div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main study component ─────────────────────────────────

function StudySession() {
  const searchParams     = useSearchParams()
  const initialSPId      = searchParams.get('specPointId') ?? undefined
  const startTimeRef     = useRef<number>(0)

  const [phase, setPhase]         = useState<'loading' | 'question' | 'answered' | 'error'>('loading')
  const [specPoint, setSpecPoint] = useState<SpecPoint | null>(null)
  const [question, setQuestion]   = useState<GeneratedQuestion | null>(null)
  const [answer, setAnswer]       = useState('')
  const [result, setResult]       = useState<TutorResult | null>(null)
  const [errMsg, setErrMsg]       = useState('')

  async function loadQuestion(spId?: string) {
    setPhase('loading')
    setAnswer('')
    setResult(null)

    try {
      let specPointId = spId
      if (!specPointId) {
        const res  = await fetch('/api/test-learning')
        const data = await res.json()
        specPointId = data.nextTopic?.specPointId
        if (!specPointId) { setErrMsg('No topics available — initialise the curriculum first.'); setPhase('error'); return }
      }

      const res  = await fetch(`/api/tutor?specPointId=${specPointId}`)
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed to load question') }
      const data = await res.json()

      setSpecPoint(data.specPoint)
      setQuestion(data.question)
      startTimeRef.current = Date.now()
      setPhase('question')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Failed to load question')
      setPhase('error')
    }
  }

  async function submitAnswer(rawAnswer: string) {
    if (!specPoint || !question) return
    const userAnswer   = rawAnswer.trim()
    const responseTime = Date.now() - startTimeRef.current
    const correct      = userAnswer.length > 0 && userAnswer.toLowerCase() === question.answer.trim().toLowerCase()

    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specPointId: specPoint.id, correct, responseTime, userAnswer }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Submit failed') }
      const data = await res.json() as TutorResult
      setResult(data)
      setPhase('answered')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Submit failed')
      setPhase('error')
    }
  }

  useEffect(() => { loadQuestion(initialSPId) }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const isCorrect = result?.masteryUpdate.correct ?? false

  if (phase === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-gray-400">
        Loading question…
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-red-950/40 border border-red-700 p-4 text-red-300">{errMsg}</div>
        <button onClick={() => loadQuestion()} className="rounded-lg bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700 transition-colors">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Spec point badge */}
      {specPoint && (
        <div className="flex items-center gap-3">
          <div>
            <div className="font-semibold">{specPoint.title}</div>
            <div className="text-sm text-gray-400">{specPoint.topic} · Difficulty {specPoint.difficulty}/10</div>
          </div>
          {result && (
            <div className="ml-auto text-right">
              <div className="text-xs text-gray-500">Mastery</div>
              <div className="font-mono font-bold">{result.masteryUpdate.newMastery}</div>
            </div>
          )}
        </div>
      )}

      {/* Question card */}
      {question && (
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-base leading-relaxed">{question.question}</p>
            <span className="shrink-0 rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
              {question.marks} mark{question.marks !== 1 ? 's' : ''}
            </span>
          </div>

          {question.hints.length > 0 && phase === 'question' && (
            <details className="text-sm">
              <summary className="cursor-pointer text-indigo-400 hover:text-indigo-300">
                Hint{question.hints.length > 1 ? 's' : ''}
              </summary>
              <ul className="mt-2 space-y-1 text-gray-400 list-disc list-inside">
                {question.hints.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </details>
          )}

          {phase === 'question' && (
            <div className="space-y-3 pt-2">
              <input
                type="text"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && answer.trim() && submitAnswer(answer)}
                placeholder="Your answer…"
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => submitAnswer(answer)}
                  disabled={!answer.trim()}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40 transition-colors"
                >
                  Submit
                </button>
                <button
                  onClick={() => submitAnswer('')}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* Result */}
          {phase === 'answered' && result && (
            <div className="space-y-4 pt-2 border-t border-gray-800">
              <div className={`flex items-center gap-2 font-semibold ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                <span>{isCorrect ? 'Correct' : 'Incorrect'}</span>
                {!isCorrect && <span className="font-normal text-gray-400">· Answer: {question.answer}</span>}
              </div>

              {/* Explanation */}
              <div className="rounded-lg bg-gray-950 p-4">
                <ExplanationBlock tutorResponse={result.tutorResponse} />
              </div>

              {/* Solution */}
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-400 hover:text-gray-300">Full solution</summary>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-gray-400 bg-gray-950 rounded p-3">
                  {question.solution}
                </pre>
              </details>

              {/* Misconception — only meaningful when the attempt was wrong */}
              {!isCorrect && result.tutorResponse.misconception && (
                <div className="text-sm text-orange-300 bg-orange-950/30 rounded p-3">
                  <span className="font-semibold">{result.tutorResponse.misconception}:</span>{' '}
                  {result.tutorResponse.diagnosis}
                </div>
              )}

              {/* Next actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => loadQuestion(result.nextTopic?.specPointId)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 transition-colors"
                >
                  Next question
                </button>
                <button
                  onClick={() => loadQuestion(specPoint?.id)}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 transition-colors"
                >
                  Retry this topic
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Learning state bar */}
      {result && (
        <div className="flex gap-6 text-sm text-gray-500 border-t border-gray-800 pt-4">
          <span>Avg mastery <strong className="text-gray-300">{result.learningState.averageMastery}</strong></span>
          <span>Mastered <strong className="text-gray-300">{result.learningState.masteredCount}</strong></span>
          {result.nextTopic && (
            <span>Next: <strong className="text-gray-300">{result.nextTopic.title}</strong></span>
          )}
        </div>
      )}
    </div>
  )
}

export default function StudyPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Study Session</h1>
      <Suspense fallback={<div className="text-gray-400">Loading…</div>}>
        <StudySession />
      </Suspense>
    </div>
  )
}
