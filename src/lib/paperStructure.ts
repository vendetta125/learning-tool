/**
 * paperStructure.ts
 *
 * Statistical model of Edexcel GCSE Higher Mathematics paper structure (1MA1).
 * Does NOT import real past papers. Replicates structure from published
 * specification guidance and AQA/Edexcel examiner report distributions.
 *
 * Paper facts (Edexcel 1MA1):
 *   Paper 1 — 80 marks, 90 min, non-calculator
 *   Paper 2 — 80 marks, 90 min, calculator
 *   Paper 3 — 80 marks, 90 min, calculator
 *   Total   — 240 marks
 *
 * Grade boundaries (2019–2023 Edexcel averages, normalised to 240 marks):
 *   Grade 4 ≈ 35%   Grade 7 ≈ 64%
 *   Grade 5 ≈ 46%   Grade 8 ≈ 76%
 *   Grade 6 ≈ 55%   Grade 9 ≈ 85%
 */

// ─── Topic weights ────────────────────────────────────────

/** Percentage of total marks per topic strand (sums to 1.0). */
export const EDEXCEL_TOPIC_WEIGHTS: Record<string, number> = {
  Number:      0.20,
  Algebra:     0.30,
  Ratio:       0.20,
  Geometry:    0.18,
  Probability: 0.06,
  Statistics:  0.06,
}

// ─── Paper configs ────────────────────────────────────────

export interface PaperConfig {
  paper:         1 | 2 | 3
  calculator:    boolean
  totalMarks:    number
  durationMins:  number
  topicBias:     Record<string, number>   // multiplicative adjustment on base weights
  markBands:     MarkBand[]              // question mark distribution
  difficultyMix: DifficultyMix
}

export interface MarkBand {
  marks:       number
  proportion:  number    // fraction of questions with this mark value
}

export interface DifficultyMix {
  low:  number    // difficulty 1–4  (grade 4–5 style questions)
  mid:  number    // difficulty 4–7  (grade 6–7)
  high: number    // difficulty 7–10 (grade 8–9)
}

export const PAPER_CONFIGS: Record<1 | 2 | 3, PaperConfig> = {
  1: {
    paper:        1,
    calculator:   false,
    totalMarks:   80,
    durationMins: 90,
    topicBias: {
      Number:      1.3,   // non-calc: higher number & algebra weighting
      Algebra:     1.1,
      Ratio:       0.9,
      Geometry:    0.8,
      Probability: 0.8,
      Statistics:  0.8,
    },
    markBands: [
      { marks: 1, proportion: 0.12 },
      { marks: 2, proportion: 0.22 },
      { marks: 3, proportion: 0.28 },
      { marks: 4, proportion: 0.20 },
      { marks: 5, proportion: 0.10 },
      { marks: 6, proportion: 0.08 },
    ],
    difficultyMix: { low: 0.35, mid: 0.40, high: 0.25 },
  },
  2: {
    paper:        2,
    calculator:   true,
    totalMarks:   80,
    durationMins: 90,
    topicBias: {
      Number:      0.9,
      Algebra:     1.0,
      Ratio:       1.1,
      Geometry:    1.2,
      Probability: 1.1,
      Statistics:  1.1,
    },
    markBands: [
      { marks: 1, proportion: 0.08 },
      { marks: 2, proportion: 0.18 },
      { marks: 3, proportion: 0.25 },
      { marks: 4, proportion: 0.25 },
      { marks: 5, proportion: 0.14 },
      { marks: 6, proportion: 0.10 },
    ],
    difficultyMix: { low: 0.30, mid: 0.40, high: 0.30 },
  },
  3: {
    paper:        3,
    calculator:   true,
    totalMarks:   80,
    durationMins: 90,
    topicBias: {
      Number:      0.8,
      Algebra:     0.9,
      Ratio:       1.1,
      Geometry:    1.1,
      Probability: 1.2,
      Statistics:  1.2,
    },
    markBands: [
      { marks: 1, proportion: 0.08 },
      { marks: 2, proportion: 0.15 },
      { marks: 3, proportion: 0.22 },
      { marks: 4, proportion: 0.28 },
      { marks: 5, proportion: 0.15 },
      { marks: 6, proportion: 0.12 },
    ],
    difficultyMix: { low: 0.25, mid: 0.40, high: 0.35 },
  },
}

// ─── Grade boundary model ─────────────────────────────────

/**
 * Grade boundary thresholds as fraction of total marks.
 * Derived from Edexcel 1MA1 published boundaries 2019–2023 (averaged).
 */
export const GRADE_BOUNDARY_FRACTIONS: Record<number, number> = {
  4: 0.35,
  5: 0.46,
  6: 0.55,
  7: 0.64,
  8: 0.76,
  9: 0.85,
}

/** Estimate grade from a raw percentage score (0–1). */
export function estimateGradeFromFraction(fraction: number): number {
  const grades = [9, 8, 7, 6, 5, 4]
  for (const g of grades) {
    if (fraction >= GRADE_BOUNDARY_FRACTIONS[g]) return g
  }
  return 3
}

/** Return the [low, high] confidence interval grade range for a score. */
export function gradeConfidenceInterval(
  fraction:      number,
  questionCount: number,
): [number, number] {
  // Standard error on a proportion shrinks with more questions
  const se = Math.sqrt((fraction * (1 - fraction)) / Math.max(1, questionCount))
  const low  = estimateGradeFromFraction(Math.max(0, fraction - 1.96 * se))
  const high = estimateGradeFromFraction(Math.min(1, fraction + 1.96 * se))
  return [low, high]
}

// ─── Effective topic weights for a given paper ────────────

/** Compute topic weights for a paper, normalised to sum to 1. */
export function effectiveTopicWeights(
  config:    PaperConfig,
  adaptive?: Record<string, number>,   // optional adaptive override from user weakness
): Record<string, number> {
  const weights: Record<string, number> = {}

  for (const [topic, base] of Object.entries(EDEXCEL_TOPIC_WEIGHTS)) {
    const bias     = config.topicBias[topic]    ?? 1.0
    const userAdj  = adaptive?.[topic]          ?? 1.0
    weights[topic] = base * bias * userAdj
  }

  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  return Object.fromEntries(
    Object.entries(weights).map(([k, v]) => [k, v / total]),
  )
}

// ─── Time allocation ──────────────────────────────────────

/** Expected seconds to spend on a question given its marks. Edexcel: ~1 min/mark. */
export function expectedSeconds(marks: number, difficulty: number): number {
  const baseSecs = marks * 60
  const difficultyBonus = ((difficulty - 1) / 9) * 30  // up to 30s extra for hardest
  return Math.round(baseSecs + difficultyBonus)
}
