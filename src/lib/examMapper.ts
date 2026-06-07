/**
 * examMapper.ts
 *
 * Maps every exam question back to its spec point, prerequisite chain,
 * and misconception category.  Used by the analysis engine to cluster
 * errors at the knowledge-graph level rather than just counting wrong answers.
 */

import { prisma }           from './db'
import { getPrerequisites } from './graph'
import type { GeneratedExam, ExamAnswer } from './examEngine'
import type { MisconceptionType }         from './misconceptions'

// ─── Types ────────────────────────────────────────────────

export interface QuestionMapping {
  questionId:          string
  specPointId:         string
  specPointTitle:      string
  topic:               string
  difficulty:          number
  marks:               number
  linkedPrerequisites: string[]   // full chain, not just direct
}

export interface ExamErrorEntry {
  questionId:     string
  specPointId:    string
  topic:          string
  difficulty:     number
  timeTakenMs:    number
  errorCategory:  MisconceptionType
}

export interface ExamErrorMap {
  errors:           ExamErrorEntry[]
  byTopic:          Record<string, ExamErrorEntry[]>
  bySpecPoint:      Record<string, ExamErrorEntry[]>
  slowQuestions:    string[]           // questionIds where time > 2× allocated
  skippedQuestions: string[]
}

// ─── Prerequisite chain (depth-limited BFS) ───────────────

export async function getPrerequisiteChain(
  specPointId: string,
  maxDepth:    number = 3,
): Promise<string[]> {
  const visited = new Set<string>()
  const queue   = [{ id: specPointId, depth: 0 }]

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (visited.has(id) || depth > maxDepth) continue
    if (id !== specPointId) visited.add(id)   // exclude self

    if (depth < maxDepth) {
      const prereqs = await getPrerequisites(id)
      for (const p of prereqs) {
        if (!visited.has(p)) queue.push({ id: p, depth: depth + 1 })
      }
    }
  }

  return Array.from(visited)
}

// ─── Build question mappings ──────────────────────────────

export async function mapQuestionsToSpecPoints(
  exam: GeneratedExam,
): Promise<QuestionMapping[]> {
  const mappings = await Promise.all(
    exam.questions.map(async q => {
      const sp      = await prisma.specPoint.findUnique({ where: { id: q.specPointId } })
      const prereqs = await getPrerequisiteChain(q.specPointId)

      return {
        questionId:          q.id,
        specPointId:         q.specPointId,
        specPointTitle:      sp?.title    ?? q.specPointTitle,
        topic:               sp?.topic    ?? q.topic,
        difficulty:          q.generated.difficulty,
        marks:               q.generated.marks,
        linkedPrerequisites: prereqs,
      } satisfies QuestionMapping
    }),
  )
  return mappings
}

// ─── Classify a single error ──────────────────────────────

function classifyError(
  timeTakenMs:      number,
  allocatedSeconds: number,
  difficulty:       number,
  recentMastery:    number,
): MisconceptionType {
  const timeRatio = timeTakenMs / (allocatedSeconds * 1_000)

  if (recentMastery >= 600 && timeTakenMs < 3_000) return 'careless'
  if (timeRatio > 2.5) return 'conceptual'          // struggled for a long time
  if (difficulty >= 7)  return 'procedural'
  return 'prerequisite'
}

// ─── Build error map ──────────────────────────────────────

export async function buildErrorMap(
  exam:         GeneratedExam,
  answers:      ExamAnswer[],
  mappings:     QuestionMapping[],
  progressMap:  Map<string, number>,
): Promise<ExamErrorMap> {
  const answerMap = new Map(answers.map(a => [a.questionId, a]))
  const mMap      = new Map(mappings.map(m => [m.questionId, m]))

  const errors:      ExamErrorEntry[] = []
  const byTopic:     Record<string, ExamErrorEntry[]> = {}
  const bySpecPoint: Record<string, ExamErrorEntry[]> = {}
  const slow:        string[] = []
  const skipped:     string[] = []

  for (const q of exam.questions) {
    const answer  = answerMap.get(q.id)
    const mapping = mMap.get(q.id)
    if (!answer || !mapping) continue

    if (answer.skipped) { skipped.push(q.id); continue }

    const isCorrect = answer.answer.trim().toLowerCase() === q.generated.answer.toLowerCase()
    const ratio     = answer.timeTakenMs / (q.allocatedSeconds * 1_000)

    if (ratio > 2.0) slow.push(q.id)

    if (!isCorrect) {
      const mastery  = progressMap.get(q.specPointId) ?? 0
      const category = classifyError(answer.timeTakenMs, q.allocatedSeconds, q.generated.difficulty, mastery)

      const entry: ExamErrorEntry = {
        questionId:    q.id,
        specPointId:   q.specPointId,
        topic:         q.topic,
        difficulty:    q.generated.difficulty,
        timeTakenMs:   answer.timeTakenMs,
        errorCategory: category,
      }

      errors.push(entry)
      byTopic[q.topic]          = [...(byTopic[q.topic]          ?? []), entry]
      bySpecPoint[q.specPointId] = [...(bySpecPoint[q.specPointId] ?? []), entry]
    }
  }

  return { errors, byTopic, bySpecPoint, slowQuestions: slow, skippedQuestions: skipped }
}
