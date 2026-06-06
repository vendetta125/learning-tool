/**
 * tutor.ts
 *
 * Explanation engine — generates structured, multi-mode explanations
 * anchored to a specific SpecPoint and a diagnosed misconception.
 *
 * 4 explanation modes (all template-based, no LLM required):
 *   PROCEDURAL  — numbered step-by-step method
 *   CONCEPTUAL  — why the method works
 *   VISUAL      — described visual/geometric reasoning
 *   ANALOGY     — real-world mental model
 *
 * Designed so each `generate*()` body can be replaced by an Ollama
 * prompt call later without changing the interface.
 */

import type { SpecPoint } from '@prisma/client'
import type { MisconceptionResult, MisconceptionType } from './misconceptions'
import type { GeneratedQuestion } from './questionGenerator'

// ─── Types ────────────────────────────────────────────────

export type ExplanationMode = 'procedural' | 'conceptual' | 'visual' | 'analogy'

export interface AlternativeExplanation {
  mode:    ExplanationMode
  content: string
}

export interface TutorResponse {
  diagnosis:               string
  misconception:           string | null
  explanation:             string                     // primary (procedural)
  alternativeExplanations: AlternativeExplanation[]  // modes 2–4
  nextQuestion:            GeneratedQuestion
  specPointLinks:          string[]                   // related specPoint IDs
}

// ─── Explanation generation ───────────────────────────────

function generateProcedural(sp: SpecPoint, type: MisconceptionType): string {
  const steps = PROCEDURAL_STEPS[sp.topic]?.[type] ?? PROCEDURAL_STEPS['default'][type]
  return `**Step-by-step approach for: ${sp.title}**\n\n${steps}\n\n*Spec reference: ${sp.edexcel_ref ?? sp.title}*`
}

function generateConceptual(sp: SpecPoint): string {
  const concept = CONCEPTUAL_WHY[sp.topic] ?? CONCEPTUAL_WHY['default']
  return `**Why this works — ${sp.topic}:**\n\n${concept}\n\nApplied to "${sp.title}": ${sp.description}`
}

function generateVisual(sp: SpecPoint): string {
  const visual = VISUAL_HINTS[sp.topic] ?? VISUAL_HINTS['default']
  return `**Visual approach for ${sp.title}:**\n\n${visual}`
}

function generateAnalogy(sp: SpecPoint): string {
  const analogy = ANALOGIES[sp.topic] ?? ANALOGIES['default']
  return `**Real-world analogy for ${sp.topic}:**\n\n${analogy}\n\nNow apply this thinking to: "${sp.title}"`
}

// ─── Main export ─────────────────────────────────────────

export function buildTutorResponse(
  sp:           SpecPoint,
  misconception: MisconceptionResult,
  question:      GeneratedQuestion,
  prereqIds:     string[],
): TutorResponse {
  const primary = generateProcedural(sp, misconception.type)

  const alternatives: AlternativeExplanation[] = [
    { mode: 'conceptual', content: generateConceptual(sp) },
    { mode: 'visual',     content: generateVisual(sp) },
    { mode: 'analogy',    content: generateAnalogy(sp) },
  ]

  return {
    diagnosis:               misconception.description,
    misconception:           MISCONCEPTION_LABELS[misconception.type],
    explanation:             primary,
    alternativeExplanations: alternatives,
    nextQuestion:            question,
    specPointLinks:          prereqIds,
  }
}

// ─── Content tables ───────────────────────────────────────

const MISCONCEPTION_LABELS: Record<MisconceptionType, string> = {
  prerequisite: 'Missing prerequisite knowledge',
  conceptual:   'Conceptual misunderstanding',
  procedural:   'Procedural error',
  careless:     'Careless mistake',
}

const PROCEDURAL_STEPS: Record<string, Record<MisconceptionType, string>> = {
  Number: {
    prerequisite: '1. Identify which prerequisite concept you need to review first.\n2. Practise that prerequisite until mastery ≥ 500.\n3. Return to this topic.',
    conceptual:   '1. Read the question carefully and identify what is being asked.\n2. Write down the relevant rule or formula.\n3. Substitute values in one step at a time.\n4. Check your answer makes sense (estimation).',
    procedural:   '1. Write out each step explicitly — no skipping.\n2. Keep track of units throughout.\n3. Double-check arithmetic at each step.\n4. Verify: does the answer have the right magnitude?',
    careless:     '1. Re-read the question before answering.\n2. Write every step, even obvious ones.\n3. Check by working backwards or using an alternative method.',
  },
  Algebra: {
    prerequisite: '1. Review the prerequisite (linked below).\n2. Master inverse operations on numbers before applying to algebra.\n3. Return here.',
    conceptual:   '1. Write the equation/expression clearly.\n2. Identify what operation is being applied to the unknown.\n3. Apply the inverse operation to isolate the unknown.\n4. Check by substituting your answer back in.',
    procedural:   '1. Write the starting expression.\n2. Apply one operation at a time to BOTH sides.\n3. Simplify after each step.\n4. Check: substitute the answer back into the original equation.',
    careless:     '1. Check signs (+ and −) on every term.\n2. Expand brackets fully before collecting terms.\n3. Verify by substitution.',
  },
  Ratio: {
    prerequisite: '1. Review fractions and multiplication first.\n2. Ensure you can find percentages of amounts.\n3. Return to ratio work.',
    conceptual:   '1. Identify the total number of parts in the ratio.\n2. Find the value of one part.\n3. Multiply by the required number of parts.\n4. Check parts sum to the total.',
    procedural:   '1. Write the ratio clearly: a:b.\n2. Total parts = a + b.\n3. One part = total amount ÷ (a + b).\n4. Multiply each part of the ratio by the value of one part.',
    careless:     '1. Re-read which share you are being asked for.\n2. Check your ratio adds up to the original total.',
  },
  Geometry: {
    prerequisite: '1. Review the required formulae.\n2. Practise arithmetic with decimals and fractions.\n3. Return to this geometry topic.',
    conceptual:   '1. Draw and label a diagram.\n2. Write down the relevant formula.\n3. Identify which lengths/angles you know.\n4. Substitute and solve.',
    procedural:   '1. Draw a clear, labelled diagram.\n2. Write the formula first.\n3. Substitute known values.\n4. Show every arithmetic step.\n5. Include units in your answer.',
    careless:     '1. Check you are using the correct formula.\n2. Verify all units are consistent.\n3. Is your answer a reasonable size?',
  },
  Probability: {
    prerequisite: '1. Review fractions and decimals.\n2. Ensure P(event) = favourable ÷ total makes sense.\n3. Return here.',
    conceptual:   '1. List all possible outcomes (sample space).\n2. Count favourable outcomes.\n3. P(event) = favourable ÷ total.\n4. All probabilities must sum to 1.',
    procedural:   '1. Draw a tree diagram or sample space grid.\n2. Label all branches with probabilities.\n3. Multiply along branches (AND).\n4. Add probabilities for separate branches (OR).',
    careless:     '1. Check that all probabilities are between 0 and 1.\n2. Verify that all mutually exclusive outcomes sum to 1.',
  },
  Statistics: {
    prerequisite: '1. Review arithmetic: division, ordering numbers.\n2. Return to statistics.',
    conceptual:   '1. Mean = sum of all values ÷ count.\n2. Median = middle value when ordered.\n3. Mode = most frequent value.\n4. Range = largest − smallest.',
    procedural:   '1. List or organise all data values.\n2. For mean: sum then divide.\n3. For median: sort first, then find the middle.\n4. For grouped data: use midpoints of class intervals.',
    careless:     '1. Check you have included all data values.\n2. For the median, always sort first.\n3. Re-read the question — which average is asked for?',
  },
  default: {
    prerequisite: '1. Check which prerequisite concept you need to review.\n2. Master the prerequisite before returning here.',
    conceptual:   '1. Read the question carefully.\n2. Write down what you know and what you need to find.\n3. Apply the relevant method step by step.',
    procedural:   '1. Write every step explicitly.\n2. Check your arithmetic.\n3. Verify your answer.',
    careless:     '1. Slow down.\n2. Re-read the question.\n3. Check your answer.',
  },
}

const CONCEPTUAL_WHY: Record<string, string> = {
  Number:      'Number rules are consistent and universal. Every operation has an inverse: addition ↔ subtraction, multiplication ↔ division, powers ↔ roots. Understanding why each rule holds lets you reconstruct it even if you forget it.',
  Algebra:     'Algebra is generalised arithmetic. An equation is a balance: whatever you do to one side, you must do to the other. The goal is always to isolate the unknown using inverse operations.',
  Ratio:       'A ratio describes a multiplicative relationship. Scaling all parts of a ratio by the same factor keeps the relationship equal — this is why you can always reduce to simplest form and scale back up.',
  Geometry:    'Geometry formulae are derived from first principles. Area of a triangle is half a rectangle; volume of a cone is ⅓ of a cylinder. Understanding the derivation means you never truly forget the formula.',
  Probability: 'Probability is a fraction: favourable ÷ total. All probabilities in an exhaustive list must sum to 1. Combined events multiply (AND) or add (OR) — this follows from counting principles.',
  Statistics:  'Measures of average describe the "centre" of a distribution. The mean uses all values; the median is positionally central; the mode is most common. Different measures suit different data types.',
  default:     'Every mathematical rule follows from simpler principles. Understanding the underlying structure — not just the procedure — enables you to adapt to unfamiliar questions.',
}

const VISUAL_HINTS: Record<string, string> = {
  Number:      'Draw a number line. Place your values on it. Operations move you left (subtract) or right (add). Multiplication is repeated jumps. Division is splitting into equal groups.',
  Algebra:     'Imagine a balance scale. Both sides must stay level. Every operation must be applied to both pans simultaneously. The unknown is a covered weight — your goal is to uncover it.',
  Ratio:       'Imagine a bar divided into parts. If the ratio is 2:3, draw 5 equal sections, colour 2 one colour and 3 another. Scaling just changes the size of each section, not their relative sizes.',
  Geometry:    'Always draw a labelled diagram. Shade the region you are finding. Mark every known measurement. For 3D problems, draw the cross-section you need.',
  Probability: 'Draw a tree diagram: each branch is an outcome, each branch is labelled with its probability. Multiply along branches (AND). To combine branches (OR), add the end probabilities.',
  Statistics:  'Draw a dot plot of your data. The mean is the "balance point". The median is the value at the physical midpoint. Visualise how outliers pull the mean but not the median.',
  default:     'Sketch the problem. Label all given information. Mark what you are trying to find. Often the visual structure suggests the method.',
}

const ANALOGIES: Record<string, string> = {
  Number:      'Think of numbers as distances on a road. Adding is driving forward. Subtracting is reversing. Multiplying is making n trips. Dividing is sharing the journey equally.',
  Algebra:     'An equation is like a set of scales in a market. The shopkeeper (you) must keep the scales balanced while removing weights one at a time until only the unknown weight remains.',
  Ratio:       'Think of ratio as a recipe. If a recipe for 4 people needs 2 cups of flour, for 6 people you need 3 cups — same ratio, scaled up. The proportional relationship never changes.',
  Geometry:    'Geometry is the mathematics of the physical world. Area is how much carpet you need. Volume is how much water fills a container. Angles are how far you turn.',
  Probability: 'Probability is like forecasting weather. A 70% chance of rain means: if this situation repeated 100 times, it would rain about 70 times. It tells you how often to expect an outcome in the long run.',
  Statistics:  'Statistics is like describing a crowd of people using just a few numbers. The mean is the "average person." The range tells you how spread out they are. No single number captures everything — that\'s why we use several.',
  default:     'Mathematics is a language for describing patterns. Like learning to read, each rule is a word — and understanding why it exists makes the whole language feel natural rather than arbitrary.',
}
