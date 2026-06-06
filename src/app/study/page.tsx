'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// ─── Minimal types (mirrors lib types, no server imports) ──

interface SpecPoint {
  id: string; title: string; topic: string
  difficulty: number; description: string
}
interface GeneratedQuestion {
  question: string; marks: number; difficulty: number
  hint?: string; solution: string; answer: string
}
interface TutorResult {
  masteryUpdate: { newMastery: number; change: number }
  tutorResponse: {
    specPointTitle: string
    explanation: Record<string, unknown>
    confidence: number
    misconceptionDiagnosis: { type: string }
    followUpQuestion: GeneratedQuestion
  }
  nextTopic: SpecPoint | null
  learningState: { averageMastery: number; masteredCount: number }
}

// ─── Explanation renderer ──────────────────────────────────

function ExplanationBlock({ exp }: { exp: Record<string, unknown> }) {
  const type = exp.type as string
  if (type === 'procedural') {
    const steps = exp.steps as string[] | undefined
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Step-by-step</div>
        {steps?.map((s, i) => (
          <div key={i} className="flex gap-3">
            <span className="shrink-0 font-mono text-xs text-indigo-400 mt-0.5">{i + 1}.</span>
            <span className="text-sm text-gray-300">{s}</span>
          </div>
        ))}
      </div>
    )
  }
  if (type === 'analogy') {
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-purple-400">Analogy</div>
        <div className="text-sm text-gray-300 italic">&ldquo;{exp.analogy as string}&rdquo;</div>
        {exp.mapping != null && <div className="text-sm text-gray-400">{String(exp.mapping)}</div>}
      </div>
    )
  }
  if (type === 'visual') {
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-teal-400">Visual</div>
        <pre className="whitespace-pre text-xs text-gray-300 font-mono bg-gray-950 rounded p-3 overflow-auto">
          {exp.diagram as string}
        </pre>
      </div>
    )
  }
  // conceptual / fallback
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-yellow-400">Concept</div>
      <div className="text-sm text-gray-300">{(exp.coreIdea ?? exp.idea ?? '') as string}</div>
      {exp.why != null && <div className="text-sm text-gray-400">{String(exp.why)}</div>}
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
        specPointId = data.nextTopic?.id
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

  async function submitAnswer() {
    if (!specPoint || !question) return
    const timeTakenMs = Date.now() - startTimeRef.current

    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specPointId: specPoint.id, answer, timeTakenMs }),
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

  const isCorrect = result && answer.trim().toLowerCase() === question?.answer.toLowerCase()

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
              <div className="font-mono font-bold">
                {result.masteryUpdate.newMastery}
                <span className={`ml-1 text-xs ${result.masteryUpdate.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.masteryUpdate.change >= 0 ? '+' : ''}{result.masteryUpdate.change}
                </span>
              </div>
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

          {question.hint && phase === 'question' && (
            <details className="text-sm">
              <summary className="cursor-pointer text-indigo-400 hover:text-indigo-300">Hint</summary>
              <p className="mt-2 text-gray-400">{question.hint}</p>
            </details>
          )}

          {phase === 'question' && (
            <div className="space-y-3 pt-2">
              <input
                type="text"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && answer.trim() && submitAnswer()}
                placeholder="Your answer…"
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={submitAnswer}
                  disabled={!answer.trim()}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40 transition-colors"
                >
                  Submit
                </button>
                <button
                  onClick={() => { setAnswer(''); submitAnswer() }}
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
                <ExplanationBlock exp={result.tutorResponse.explanation} />
              </div>

              {/* Solution */}
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-400 hover:text-gray-300">Full solution</summary>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-gray-400 bg-gray-950 rounded p-3">
                  {question.solution}
                </pre>
              </details>

              {/* Misconception */}
              {result.tutorResponse.misconceptionDiagnosis.type !== 'none' && (
                <div className="text-sm text-orange-300 bg-orange-950/30 rounded p-3">
                  Diagnosis: <strong>{result.tutorResponse.misconceptionDiagnosis.type}</strong>
                </div>
              )}

              {/* Next actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => loadQuestion(result.nextTopic?.id)}
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
