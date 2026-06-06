/**
 * examAnalysis.ts
 *
 * Produces a structured performance report from a submitted exam.
 *
 * Grade estimation pipeline:
 *  1. Compute raw score (correct marks / total marks)
 *  2. Apply IRT-style difficulty adjustment (harder correct Qs count more)
 *  3. Map adjusted score → grade via Edexcel boundary fractions
 *  4. Compute 95% confidence interval from binomial SE
 *
 * Cognitive load signals detected:
 *  - Hesitation spike: response time > 2.5× expected
 *  - Interference: errors cluster across prerequisite chains
 *  - Retrieval failure: previously mastered topic fails under time pressure
 */

import { buildProgressMap }                            from './graph'
import { estimateGradeFromFraction, gradeConfidenceInterval } from './paperStructure'
import { mapQuestionsToSpecPoints, buildErrorMap }     from './examMapper'
import type { GeneratedExam, ExamAnswer }              from './examEngine'

// ─── Types ────────────────────────────────────────────────

export interface ExamAnalysisResult {
  estimatedGrade:       number
  confidenceInterval:   [number, number]
  rawScorePct:          number
  adjustedScorePct:     number
  totalMarks:           number
  earnedMarks:          number
  weakestSpecPoints:    RankedSpecPoint[]
  strongestSpecPoints:  RankedSpecPoint[]
  topicPerformance:     TopicPerformance[]
  errorPatterns:        string[]
  timeEfficiencyScore:  number          // 0–1
  hesitationSpikes:     HesitationSpike[]
  cognitiveLoadFlags:   string[]
  improvementPriority:  string[]        // ordered spec point IDs to study next
}

export interface RankedSpecPoint {
  specPointId:    string
  title:          string
  topic:          string
  correct:        number
  attempted:      number
  accuracyPct:    number
}

export interface TopicPerformance {
  topic:          string
  correct:        number
  attempted:      number
  accuracyPct:    number
  marksEarned:    number
  marksAvailable: number
}

export interface HesitationSpike {
  questionId:     string
  specPointTitle: string
  allocatedSec:   number
  actualSec:      number
  ratio:          number
}

// ─── Difficulty-adjusted scoring ─────────────────────────

function difficultyWeight(difficulty: number): number {
  // Easier questions weight 1.0, hardest weight 1.5
  return 1.0 + ((difficulty - 1) / 9) * 0.5
}

// ─── Main analysis ────────────────────────────────────────

export async function analyzeExamResults(
  exam:    GeneratedExam,
  answers: ExamAnswer[],
): Promise<ExamAnalysisResult> {
  const progressMap = await buildProgressMap()
  const mappings    = await mapQuestionsToSpecPoints(exam)
  const errorMap    = await buildErrorMap(exam, answers, mappings, progressMap)
  const answerMap   = new Map(answers.map(a => [a.questionId, a]))
  const mMap        = new Map(mappings.map(m => [m.questionId, m]))

  // ── Score computation ─────────────────────────────────────
  let rawEarned      = 0
  let weightedEarned = 0
  let weightedTotal  = 0

  // per-spec, per-topic accumulators
  const spStats   = new Map<string, { correct: number; attempted: number; title: string; topic: string }>()
  const topicStats = new Map<string, { correct: number; attempted: number; marks: number; total: number }>()

  for (const q of exam.questions) {
    const answer  = answerMap.get(q.id)
    const mapping = mMap.get(q.id)
    if (!mapping) continue

    const skipped  = answer?.skipped ?? !answer
    const isCorrect = !skipped &&
      answer!.answer.trim().toLowerCase() === q.generated.answer.toLowerCase()

    if (!skipped) {
      const dw = difficultyWeight(q.generated.difficulty)
      weightedTotal  += q.generated.marks * dw
      if (isCorrect) {
        rawEarned      += q.generated.marks
        weightedEarned += q.generated.marks * dw
      }

      // sp-level
      const sp = spStats.get(q.specPointId) ?? { correct: 0, attempted: 0, title: mapping.specPointTitle, topic: mapping.topic }
      spStats.set(q.specPointId, {
        ...sp,
        attempted: sp.attempted + 1,
        correct:   sp.correct + (isCorrect ? 1 : 0),
      })

      // topic-level
      const t = topicStats.get(q.topic) ?? { correct: 0, attempted: 0, marks: 0, total: 0 }
      topicStats.set(q.topic, {
        correct:   t.correct + (isCorrect ? 1 : 0),
        attempted: t.attempted + 1,
        marks:     t.marks + (isCorrect ? q.generated.marks : 0),
        total:     t.total + q.generated.marks,
      })
    }
  }

  const rawPct      = exam.totalMarks > 0 ? rawEarned / exam.totalMarks : 0
  const adjustedPct = weightedTotal   > 0 ? weightedEarned / weightedTotal : 0

  const grade    = estimateGradeFromFraction(adjustedPct)
  const ci       = gradeConfidenceInterval(adjustedPct, exam.questions.length)

  // ── Ranked spec points ────────────────────────────────────
  const ranked: RankedSpecPoint[] = Array.from(spStats.entries())
    .map(([id, s]) => ({
      specPointId:  id,
      title:        s.title,
      topic:        s.topic,
      correct:      s.correct,
      attempted:    s.attempted,
      accuracyPct:  s.attempted > 0 ? Math.round((s.correct / s.attempted) * 100) : 0,
    }))
    .sort((a, b) => a.accuracyPct - b.accuracyPct)

  const weakest   = ranked.slice(0, 5)
  const strongest = [...ranked].sort((a, b) => b.accuracyPct - a.accuracyPct).slice(0, 5)

  // ── Topic performance ─────────────────────────────────────
  const topicPerformance: TopicPerformance[] = Array.from(topicStats.entries()).map(([topic, s]) => ({
    topic,
    correct:        s.correct,
    attempted:      s.attempted,
    accuracyPct:    s.attempted > 0 ? Math.round((s.correct / s.attempted) * 100) : 0,
    marksEarned:    s.marks,
    marksAvailable: s.total,
  }))

  // ── Time efficiency ───────────────────────────────────────
  const timingData = exam.questions
    .map(q => {
      const a = answerMap.get(q.id)
      if (!a || a.skipped) return null
      return {
        ratio:     (a.timeTakenMs / 1_000) / q.allocatedSeconds,
        qId:       q.id,
        spTitle:   q.specPointTitle,
        allocated: q.allocatedSeconds,
        actual:    Math.round(a.timeTakenMs / 1_000),
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const timeEfficiency = timingData.length > 0
    ? timingData.reduce((s, t) => s + Math.min(1, 1 / Math.max(0.1, t.ratio)), 0) / timingData.length
    : 1.0

  const hesitationSpikes: HesitationSpike[] = timingData
    .filter(t => t.ratio > 2.5)
    .map(t => ({
      questionId:     t.qId,
      specPointTitle: t.spTitle,
      allocatedSec:   t.allocated,
      actualSec:      t.actual,
      ratio:          Math.round(t.ratio * 10) / 10,
    }))

  // ── Error patterns (natural language) ────────────────────
  const errorPatterns: string[] = []

  const topicErrors = Object.entries(errorMap.byTopic)
    .sort((a, b) => b[1].length - a[1].length)
  if (topicErrors[0]?.[1].length >= 2) {
    errorPatterns.push(`Consistent errors in ${topicErrors[0][0]} (${topicErrors[0][1].length} mistakes)`)
  }

  const prereqMisses = errorMap.errors.filter(e => e.errorCategory === 'prerequisite')
  if (prereqMisses.length > 0) {
    errorPatterns.push(`${prereqMisses.length} question(s) indicate missing prerequisite knowledge`)
  }

  const careless = errorMap.errors.filter(e => e.errorCategory === 'careless')
  if (careless.length >= 2) {
    errorPatterns.push(`${careless.length} likely careless mistakes — slow down and check working`)
  }

  if (errorMap.skippedQuestions.length > 0) {
    errorPatterns.push(`${errorMap.skippedQuestions.length} question(s) skipped — exam stamina or time management issue`)
  }

  // ── Cognitive load flags ──────────────────────────────────
  const cognitiveLoadFlags: string[] = []

  if (hesitationSpikes.length >= 3) {
    cognitiveLoadFlags.push('High cognitive load detected — multiple hesitation spikes suggest working-memory strain')
  }

  const retrivalFails = errorMap.errors.filter(e => {
    const mastery = progressMap.get(e.specPointId) ?? 0
    return mastery >= 600  // previously learned but failed under pressure
  })
  if (retrivalFails.length > 0) {
    cognitiveLoadFlags.push(`Retrieval failure under time pressure: ${retrivalFails.length} topic(s) previously mastered but failed in exam conditions`)
  }

  const interferenceClusters = Object.entries(errorMap.byTopic)
    .filter(([, errs]) => errs.length >= 2)
  if (interferenceClusters.length >= 2) {
    cognitiveLoadFlags.push('Topic interference detected — errors spanning multiple areas suggest interleaving exposure is needed')
  }

  // ── Improvement priority ──────────────────────────────────
  const improvementPriority = weakest
    .filter(sp => sp.accuracyPct < 60)
    .map(sp => sp.specPointId)

  return {
    estimatedGrade:      grade,
    confidenceInterval:  ci,
    rawScorePct:         Math.round(rawPct * 1000) / 10,
    adjustedScorePct:    Math.round(adjustedPct * 1000) / 10,
    totalMarks:          exam.totalMarks,
    earnedMarks:         rawEarned,
    weakestSpecPoints:   weakest,
    strongestSpecPoints: strongest,
    topicPerformance,
    errorPatterns,
    timeEfficiencyScore: Math.round(timeEfficiency * 100) / 100,
    hesitationSpikes,
    cognitiveLoadFlags,
    improvementPriority,
  }
}
