/**
 * examEngine.ts
 *
 * Generates structured exams and manages timed session state.
 * Uses Phase 3 questionGenerator; distributes questions per paperStructure.
 *
 * Exam types:
 *   MINI        — 15 questions, 30 min, mixed topics
 *   FULL        — 25 questions, 80 min, one Edexcel paper simulation
 *   BOSS_BATTLE — 10 questions, 20 min, single topic stress test
 *
 * Adaptive weighting: when adaptToUser=true, topics with lower mastery
 * receive up to 2× sampling weight so the exam stresses weak areas.
 */

import { randomUUID } from 'crypto'
import { prisma }     from './db'
import { generateQuestion, type GeneratedQuestion } from './questionGenerator'
import { buildProgressMap } from './graph'
import {
  PAPER_CONFIGS,
  effectiveTopicWeights,
  expectedSeconds,
} from './paperStructure'
import type { SpecPoint } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────

export type ExamType = 'MINI' | 'FULL' | 'BOSS_BATTLE'

export interface ExamConfig {
  type:         ExamType
  focusTopic?:  string          // required for BOSS_BATTLE
  adaptToUser?: boolean
  paperNumber?: 1 | 2 | 3      // for FULL type
}

export interface ExamQuestion {
  id:                   string
  generated:            GeneratedQuestion
  specPointId:          string
  specPointTitle:       string
  topic:                string
  allocatedSeconds:     number
}

export interface GeneratedExam {
  examId:             string
  type:               ExamType
  title:              string
  durationMinutes:    number
  totalMarks:         number
  calculator:         boolean
  questions:          ExamQuestion[]
  specPointCoverage:  string[]
  topicDistribution:  Record<string, number>   // topic → proportion of marks
}

// ─── Timed session (client uses these types) ──────────────

export interface ExamAnswer {
  questionId:   string
  answer:       string
  timeTakenMs:  number
  skipped:      boolean
}

export interface SubmittedExam {
  examId:  string
  answers: ExamAnswer[]
}

// ─── Exam spec-point seeding ──────────────────────────────

const SEED_SPEC_POINTS: Array<Omit<SpecPoint, 'createdAt' | 'updatedAt'>> = [
  { id: 'exam-N-E', title: 'Fractions and Percentages',     topic: 'Number',      description: 'Calculate with fractions and percentages',         edexcel_ref: 'N2/N12', prerequisites: '[]', difficulty: 3, status: 'unverified' },
  { id: 'exam-N-M', title: 'Standard Form',                 topic: 'Number',      description: 'Standard form and indices',                        edexcel_ref: 'N9',     prerequisites: '["exam-N-E"]', difficulty: 5, status: 'unverified' },
  { id: 'exam-N-H', title: 'Surds and Bounds',              topic: 'Number',      description: 'Surds, rationalising, bounds of accuracy',         edexcel_ref: 'N8/N16', prerequisites: '["exam-N-M"]', difficulty: 8, status: 'unverified' },
  { id: 'exam-A-E', title: 'Linear Equations',              topic: 'Algebra',     description: 'Solve linear equations in one variable',           edexcel_ref: 'A17',    prerequisites: '[]', difficulty: 3, status: 'unverified' },
  { id: 'exam-A-M', title: 'Quadratic Factorisation',       topic: 'Algebra',     description: 'Factorise and solve quadratic expressions',        edexcel_ref: 'A18',    prerequisites: '["exam-A-E"]', difficulty: 6, status: 'unverified' },
  { id: 'exam-A-H', title: 'Simultaneous Equations',        topic: 'Algebra',     description: 'Solve linear and quadratic simultaneously',        edexcel_ref: 'A19',    prerequisites: '["exam-A-M"]', difficulty: 8, status: 'unverified' },
  { id: 'exam-R-E', title: 'Ratio and Sharing',             topic: 'Ratio',       description: 'Divide quantities in a given ratio',               edexcel_ref: 'R5',     prerequisites: '[]', difficulty: 3, status: 'unverified' },
  { id: 'exam-R-M', title: 'Percentage Change',             topic: 'Ratio',       description: 'Percentage increase, decrease, reverse percentage',edexcel_ref: 'R10',    prerequisites: '["exam-R-E"]', difficulty: 5, status: 'unverified' },
  { id: 'exam-R-H', title: 'Direct and Inverse Proportion', topic: 'Ratio',       description: 'Direct/inverse proportion equations and graphs',   edexcel_ref: 'R14',    prerequisites: '["exam-R-M"]', difficulty: 8, status: 'unverified' },
  { id: 'exam-G-E', title: 'Area and Perimeter',            topic: 'Geometry',    description: 'Area of 2D shapes including circles',              edexcel_ref: 'G16',    prerequisites: '[]', difficulty: 3, status: 'unverified' },
  { id: 'exam-G-M', title: 'Pythagoras and Trigonometry',   topic: 'Geometry',    description: 'Pythagoras theorem and basic trigonometry',         edexcel_ref: 'G20',    prerequisites: '["exam-G-E"]', difficulty: 6, status: 'unverified' },
  { id: 'exam-G-H', title: 'Sine and Cosine Rules',         topic: 'Geometry',    description: 'Non-right-angled triangles and area formula',      edexcel_ref: 'G22',    prerequisites: '["exam-G-M"]', difficulty: 9, status: 'unverified' },
  { id: 'exam-P-E', title: 'Basic Probability',             topic: 'Probability', description: 'Simple probability and complementary events',      edexcel_ref: 'P4',     prerequisites: '[]', difficulty: 3, status: 'unverified' },
  { id: 'exam-P-H', title: 'Combined Events',               topic: 'Probability', description: 'Independent and dependent combined events',        edexcel_ref: 'P8',     prerequisites: '["exam-P-E"]', difficulty: 7, status: 'unverified' },
  { id: 'exam-S-E', title: 'Averages and Range',            topic: 'Statistics',  description: 'Mean, median, mode from lists and tables',         edexcel_ref: 'S4',     prerequisites: '[]', difficulty: 3, status: 'unverified' },
  { id: 'exam-S-H', title: 'Statistical Diagrams',          topic: 'Statistics',  description: 'Cumulative frequency, box plots, histograms',      edexcel_ref: 'S3',     prerequisites: '["exam-S-E"]', difficulty: 7, status: 'unverified' },
]

async function ensureExamSpecPoints(): Promise<SpecPoint[]> {
  const existing = await prisma.specPoint.findMany()
  if (existing.length >= 6) return existing  // enough real data exists

  // Seed minimal exam spec points
  await prisma.$transaction(
    SEED_SPEC_POINTS.map(sp =>
      prisma.specPoint.upsert({
        where:  { id: sp.id },
        update: {},
        create: sp,
      }),
    ),
  )
  return prisma.specPoint.findMany()
}

// ─── Adaptive weighting ───────────────────────────────────

function buildAdaptiveAdjustment(
  progressMap:     Map<string, number>,
  specPointsByTopic: Map<string, SpecPoint[]>,
): Record<string, number> {
  const adj: Record<string, number> = {}
  for (const [topic, sps] of Array.from(specPointsByTopic.entries())) {
    if (sps.length === 0) { adj[topic] = 1.0; continue }
    const avgMastery = sps.reduce((s, sp) => s + (progressMap.get(sp.id) ?? 0), 0) / sps.length
    // Inverse mastery → weight: mastery 0 → 2.0×, mastery 500 → 1.0×, mastery 1000 → 0.5×
    adj[topic] = Math.max(0.5, 2.0 - avgMastery / 500)
  }
  return adj
}

// ─── Question sampling ────────────────────────────────────

function sampleSpecPoints(
  specPointsByTopic: Map<string, SpecPoint[]>,
  targetWeights:     Record<string, number>,
  totalQuestions:    number,
  diffMix:           { low: number; mid: number; high: number },
  focusTopic?:       string,
): SpecPoint[] {
  const selected: SpecPoint[] = []
  const nLow  = Math.round(totalQuestions * diffMix.low)
  const nMid  = Math.round(totalQuestions * diffMix.mid)
  const nHigh = totalQuestions - nLow - nMid

  function pickFromTopic(topic: string, diffRange: [number, number]): SpecPoint | null {
    const pool = (specPointsByTopic.get(topic) ?? []).filter(
      sp => sp.difficulty >= diffRange[0] && sp.difficulty <= diffRange[1],
    )
    if (pool.length === 0) return null
    // Deterministic pick: use hash of topic+difficulty+count to avoid randomness
    const idx = (topic.charCodeAt(0) + diffRange[0] + selected.length) % pool.length
    return pool[idx]
  }

  const tiers: Array<{ range: [number, number]; count: number }> = [
    { range: [1, 4], count: nLow },
    { range: [4, 7], count: nMid },
    { range: [7, 10], count: nHigh },
  ]

  for (const { range, count } of tiers) {
    let added = 0
    // Weighted topic cycling
    const topicOrder = focusTopic
      ? [focusTopic, ...Object.keys(targetWeights).filter(t => t !== focusTopic)]
      : Object.entries(targetWeights)
          .sort((a, b) => b[1] - a[1])
          .map(([t]) => t)

    let ti = 0
    while (added < count) {
      const topic = topicOrder[ti % topicOrder.length]
      const sp    = pickFromTopic(topic, range)
      if (sp && !selected.find(s => s.id === sp.id)) {
        selected.push(sp)
        added++
      }
      ti++
      if (ti > topicOrder.length * 3) break  // guard against infinite loop
    }
  }

  return selected
}

// ─── Main export ─────────────────────────────────────────

export async function generateExam(config: ExamConfig): Promise<GeneratedExam> {
  const specPoints   = await ensureExamSpecPoints()
  const progressMap  = await buildProgressMap()

  // Group spec points by topic
  const byTopic = new Map<string, SpecPoint[]>()
  for (const sp of specPoints) {
    const existing = byTopic.get(sp.topic) ?? []
    byTopic.set(sp.topic, [...existing, sp])
  }

  // Config per exam type
  const examMeta = EXAM_TYPE_META[config.type]
  const paperCfg = PAPER_CONFIGS[config.paperNumber ?? 2]

  // Compute effective weights
  const adaptive    = config.adaptToUser ? buildAdaptiveAdjustment(progressMap, byTopic) : undefined
  const topicWts    = effectiveTopicWeights(paperCfg, adaptive)

  // Sample spec points
  const sampledSPs  = sampleSpecPoints(
    byTopic,
    topicWts,
    examMeta.questionCount,
    paperCfg.difficultyMix,
    config.focusTopic,
  )

  // Build exam questions
  const questions: ExamQuestion[] = sampledSPs.map(sp => {
    const gen = generateQuestion(sp)
    return {
      id:               `eq-${sp.id}-${Date.now()}`,
      generated:        gen,
      specPointId:      sp.id,
      specPointTitle:   sp.title,
      topic:            sp.topic,
      allocatedSeconds: expectedSeconds(gen.marks, sp.difficulty),
    }
  })

  // Compute coverage + distribution
  const coverage   = Array.from(new Set(questions.map(q => q.specPointId)))
  const marksByTopic: Record<string, number> = {}
  let totalMarks = 0
  for (const q of questions) {
    marksByTopic[q.topic]  = (marksByTopic[q.topic] ?? 0) + q.generated.marks
    totalMarks            += q.generated.marks
  }
  const topicDist = Object.fromEntries(
    Object.entries(marksByTopic).map(([t, m]) => [t, Math.round((m / totalMarks) * 100) / 100]),
  )

  return {
    examId:            randomUUID(),
    type:              config.type,
    title:             examMeta.title(config.focusTopic),
    durationMinutes:   examMeta.durationMinutes,
    totalMarks,
    calculator:        paperCfg.calculator,
    questions,
    specPointCoverage: coverage,
    topicDistribution: topicDist,
  }
}

// ─── Exam type metadata ───────────────────────────────────

const EXAM_TYPE_META: Record<ExamType, {
  questionCount:   number
  durationMinutes: number
  title:           (topic?: string) => string
}> = {
  MINI:        { questionCount: 15, durationMinutes: 30, title: () => 'Mini Exam (30 min)' },
  FULL:        { questionCount: 25, durationMinutes: 80, title: () => 'Full Paper Simulation (80 min)' },
  BOSS_BATTLE: { questionCount: 10, durationMinutes: 20, title: (t) => `Boss Battle — ${t ?? 'Mixed'}` },
}
