'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Minimal types ─────────────────────────────────────────

type ExamType = 'MINI' | 'FULL' | 'BOSS_BATTLE'

interface GeneratedQuestion {
  question: string; marks: number; difficulty: number
  hint?: string; solution: string; answer: string
}
interface ExamQuestion {
  id: string; generated: GeneratedQuestion
  specPointId: string; specPointTitle: string
  topic: string; allocatedSeconds: number
}
interface GeneratedExam {
  examId: string; type: ExamType; title: string
  durationMinutes: number; totalMarks: number
  calculator: boolean; questions: ExamQuestion[]
  specPointCoverage: string[]; topicDistribution: Record<string, number>
}
interface ExamAnswer {
  questionId: string; answer: string; timeTakenMs: number; skipped: boolean
}
interface TopicPerformance {
  topic: string; correct: number; attempted: number
  accuracyPct: number; marksEarned: number; marksAvailable: number
}
interface ExamAnalysisResult {
  estimatedGrade: number; confidenceInterval: [number, number]
  rawScorePct: number; adjustedScorePct: number
  totalMarks: number; earnedMarks: number
  topicPerformance: TopicPerformance[]
  errorPatterns: string[]; cognitiveLoadFlags: string[]
  timeEfficiencyScore: number
  weakestSpecPoints: { specPointId: string; title: string; accuracyPct: number }[]
  improvementPriority: string[]
}

const EXAM_META: Record<ExamType, { label: string; duration: string; questions: number; desc: string }> = {
  MINI:        { label: 'Mini Exam',    duration: '30 min', questions: 15, desc: 'Mixed topics, great for a daily check-in.' },
  FULL:        { label: 'Full Paper',   duration: '80 min', questions: 25, desc: 'Simulates an Edexcel 1MA1 paper session.' },
  BOSS_BATTLE: { label: 'Boss Battle',  duration: '20 min', questions: 10, desc: 'Stress-test a single topic at high difficulty.' },
}

const TOPICS = ['Number', 'Algebra', 'Ratio', 'Geometry', 'Probability', 'Statistics']

function gradeColour(g: number) {
  if (g >= 8) return 'text-emerald-400'
  if (g >= 6) return 'text-yellow-400'
  if (g >= 4) return 'text-orange-400'
  return 'text-red-400'
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ─── Results screen ────────────────────────────────────────

function ResultsScreen({
  analysis, answers,
  onRetry,
}: {
  analysis: ExamAnalysisResult
  exam?: GeneratedExam
  answers: ExamAnswer[]
  onRetry: () => void
}) {
  const skipped  = answers.filter(a => a.skipped).length
  const [ci0, ci1] = analysis.confidenceInterval

  return (
    <div className="space-y-8">
      {/* Grade headline */}
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-6 text-center">
        <div className={`text-7xl font-black ${gradeColour(analysis.estimatedGrade)}`}>
          {analysis.estimatedGrade}
        </div>
        <div className="mt-1 text-gray-400">Estimated grade · 95% CI: {ci0} – {ci1}</div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-2xl font-bold">{analysis.rawScorePct}%</div>
            <div className="text-gray-500">Raw score</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{analysis.earnedMarks}/{analysis.totalMarks}</div>
            <div className="text-gray-500">Marks</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{Math.round(analysis.timeEfficiencyScore * 100)}%</div>
            <div className="text-gray-500">Time efficiency</div>
          </div>
        </div>
        {skipped > 0 && (
          <div className="mt-3 text-sm text-orange-400">{skipped} question{skipped !== 1 ? 's' : ''} skipped</div>
        )}
      </div>

      {/* Topic performance */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Topic performance</h2>
        <div className="space-y-2">
          {analysis.topicPerformance.map(t => (
            <div key={t.topic} className="rounded-lg bg-gray-900 p-3">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span>{t.topic}</span>
                <span className="text-gray-400">{t.marksEarned}/{t.marksAvailable} marks · {t.accuracyPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    t.accuracyPct >= 70 ? 'bg-emerald-500' :
                    t.accuracyPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${t.accuracyPct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error patterns */}
      {analysis.errorPatterns.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Error patterns</h2>
          <ul className="space-y-2">
            {analysis.errorPatterns.map((p, i) => (
              <li key={i} className="rounded-lg bg-orange-950/30 border border-orange-800 px-4 py-2.5 text-sm text-orange-200">
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cognitive load flags */}
      {analysis.cognitiveLoadFlags.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Cognitive load signals</h2>
          <ul className="space-y-2">
            {analysis.cognitiveLoadFlags.map((f, i) => (
              <li key={i} className="rounded-lg bg-purple-950/30 border border-purple-800 px-4 py-2.5 text-sm text-purple-200">
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Weakest spec points */}
      {analysis.weakestSpecPoints.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Study priority</h2>
          <div className="space-y-1.5">
            {analysis.weakestSpecPoints.map((sp, i) => (
              <div key={sp.specPointId} className="flex items-center gap-3 rounded-lg bg-gray-900 px-4 py-2.5 text-sm">
                <span className="text-gray-600 font-mono w-4">{i + 1}</span>
                <span className="flex-1">{sp.title}</span>
                <span className={`font-semibold ${sp.accuracyPct < 40 ? 'text-red-400' : 'text-orange-400'}`}>
                  {sp.accuracyPct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onRetry}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500 transition-colors"
        >
          New exam
        </button>
      </div>
    </div>
  )
}

// ─── Active exam ───────────────────────────────────────────

function ActiveExam({
  exam,
  onSubmit,
}: {
  exam: GeneratedExam
  onSubmit: (answers: ExamAnswer[]) => void
}) {
  const [idx, setIdx]                   = useState(0)
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [answers, setAnswers]           = useState<ExamAnswer[]>([])
  const [showHint, setShowHint]         = useState(false)
  const questionStartRef                = useRef(Date.now())
  const [elapsed, setElapsed]           = useState(0)

  const totalSec = exam.durationMinutes * 60
  const remaining = totalSec - elapsed
  const q = exam.questions[idx]

  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    questionStartRef.current = Date.now()
    setCurrentAnswer('')
    setShowHint(false)
  }, [idx])

  function recordAnswer(skipped = false) {
    const timeTakenMs = Date.now() - questionStartRef.current
    const newAnswer: ExamAnswer = {
      questionId: q.id,
      answer:     skipped ? '' : currentAnswer,
      timeTakenMs,
      skipped,
    }
    const updated = [...answers, newAnswer]
    setAnswers(updated)

    if (idx + 1 < exam.questions.length) {
      setIdx(i => i + 1)
    } else {
      onSubmit(updated)
    }
  }

  const timeColour = remaining < 120 ? 'text-red-400' : remaining < 300 ? 'text-yellow-400' : 'text-gray-400'

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">
          Question {idx + 1} / {exam.questions.length}
        </span>
        <span className={`font-mono font-semibold ${timeColour}`}>{formatTime(remaining)}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${((idx) / exam.questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 text-xs text-gray-500">{q.topic} · {q.specPointTitle}</div>
            <p className="text-base leading-relaxed">{q.generated.question}</p>
          </div>
          <span className="shrink-0 rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
            {q.generated.marks}m
          </span>
        </div>

        {q.generated.hint && (
          <button
            onClick={() => setShowHint(h => !h)}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {showHint ? 'Hide hint' : 'Show hint'}
          </button>
        )}
        {showHint && q.generated.hint && (
          <div className="rounded-lg bg-indigo-950/40 px-4 py-3 text-sm text-gray-300">
            {q.generated.hint}
          </div>
        )}

        <div className="space-y-3 pt-1">
          <input
            type="text"
            value={currentAnswer}
            onChange={e => setCurrentAnswer(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && recordAnswer(false)}
            placeholder="Your answer…"
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => recordAnswer(false)}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500 transition-colors"
            >
              {idx + 1 < exam.questions.length ? 'Next' : 'Finish'}
            </button>
            <button
              onClick={() => recordAnswer(true)}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-600">
        Allocated: {formatTime(q.allocatedSeconds)} · Calc: {exam.calculator ? 'allowed' : 'not allowed'}
      </div>
    </div>
  )
}

// ─── Exam page ─────────────────────────────────────────────

export default function ExamPage() {
  const [phase, setPhase]         = useState<'config' | 'loading' | 'active' | 'submitting' | 'results'>('config')
  const [examType, setExamType]   = useState<ExamType>('MINI')
  const [topic, setTopic]         = useState('Algebra')
  const [exam, setExam]           = useState<GeneratedExam | null>(null)
  const [analysis, setAnalysis]   = useState<ExamAnalysisResult | null>(null)
  const [submittedAnswers, setSubmittedAnswers] = useState<ExamAnswer[]>([])
  const [errMsg, setErrMsg]       = useState('')

  async function startExam() {
    setPhase('loading')
    setErrMsg('')
    try {
      const params = new URLSearchParams({ type: examType, adapt: 'true' })
      if (examType === 'BOSS_BATTLE') params.set('topic', topic)
      const res  = await fetch(`/api/exam?${params}`)
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      setExam(await res.json())
      setPhase('active')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Failed to generate exam')
      setPhase('config')
    }
  }

  async function submitExam(answers: ExamAnswer[]) {
    if (!exam) return
    setPhase('submitting')
    setSubmittedAnswers(answers)
    try {
      const res = await fetch('/api/exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam, answers }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Submit failed') }
      const data = await res.json()
      setAnalysis(data.analysis)
      setPhase('results')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Submit failed')
      setPhase('active')
    }
  }

  function reset() {
    setPhase('config')
    setExam(null)
    setAnalysis(null)
    setSubmittedAnswers([])
    setErrMsg('')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Exam Mode</h1>

      {errMsg && (
        <div className="rounded-lg bg-red-950/40 border border-red-700 p-4 text-red-300 text-sm">{errMsg}</div>
      )}

      {phase === 'config' && (
        <div className="max-w-lg space-y-6">
          <div className="grid gap-3">
            {(Object.entries(EXAM_META) as [ExamType, typeof EXAM_META[ExamType]][]).map(([type, meta]) => (
              <button
                key={type}
                onClick={() => setExamType(type)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  examType === type
                    ? 'border-indigo-500 bg-indigo-950/50'
                    : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{meta.label}</span>
                  <span className="text-sm text-gray-400">{meta.questions}q · {meta.duration}</span>
                </div>
                <div className="mt-1 text-sm text-gray-400">{meta.desc}</div>
              </button>
            ))}
          </div>

          {examType === 'BOSS_BATTLE' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Topic</label>
              <div className="flex flex-wrap gap-2">
                {TOPICS.map(t => (
                  <button
                    key={t}
                    onClick={() => setTopic(t)}
                    className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      topic === t ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={startExam}
            className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold hover:bg-indigo-500 transition-colors"
          >
            Start exam
          </button>
        </div>
      )}

      {(phase === 'loading' || phase === 'submitting') && (
        <div className="flex min-h-[40vh] items-center justify-center text-gray-400">
          {phase === 'loading' ? 'Generating exam…' : 'Analysing results…'}
        </div>
      )}

      {phase === 'active' && exam && (
        <ActiveExam exam={exam} onSubmit={submitExam} />
      )}

      {phase === 'results' && analysis && exam && (
        <ResultsScreen
          analysis={analysis}
          exam={exam}
          answers={submittedAnswers}
          onRetry={reset}
        />
      )}
    </div>
  )
}
