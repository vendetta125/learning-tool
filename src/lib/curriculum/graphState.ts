/**
 * graphState.ts
 *
 * High-level curriculum graph state — wraps the lower-level graph.ts
 * primitives and surfaces curriculum-wide queries used by the UI,
 * analytics layer, and validation endpoint.
 */

import { prisma }                          from '../db'
import { buildGraphSnapshot, buildProgressMap } from '../graph'
import { EXPECTED_TOTAL }                  from './validation'
import type { SpecPoint }                  from '@prisma/client'

// ─── Types ────────────────────────────────────────────────

export interface CurriculumGraphState {
  specPoints:        SpecPoint[]
  progressMap:       Map<string, number>
  graphSnapshot:     ReturnType<typeof buildGraphSnapshot> extends Promise<infer T> ? T : never
  topicCoverage:     Record<string, number>    // topic → count of loaded spec points
  curriculumPct:     number                    // % of expected 98 loaded
  masteredCount:     number
  averageMastery:    number
}

export interface SpecPointWithMastery extends SpecPoint {
  mastery:    number
  unlocked:   boolean
}

// ─── Queries ──────────────────────────────────────────────

export async function getAllSpecPoints(): Promise<SpecPoint[]> {
  return prisma.specPoint.findMany({ orderBy: [{ topic: 'asc' }, { id: 'asc' }] })
}

export async function getMissingSpecPoints(): Promise<string[]> {
  const { validateCurriculumCompleteness } = await import('./validation')
  const result = await validateCurriculumCompleteness()
  return Object.values(result.missingByTopic).flat()
}

export async function getTopicCoverage(): Promise<Record<string, number>> {
  const sps     = await getAllSpecPoints()
  const counts: Record<string, number> = {}
  for (const sp of sps) {
    counts[sp.topic] = (counts[sp.topic] ?? 0) + 1
  }
  return counts
}

export async function isCurriculumComplete(): Promise<boolean> {
  const count = await prisma.specPoint.count()
  return count >= EXPECTED_TOTAL
}

export async function getCurriculumGraphState(): Promise<CurriculumGraphState> {
  const [specPoints, progressMap] = await Promise.all([
    getAllSpecPoints(),
    buildProgressMap(),
  ])

  const graphSnapshot = await buildGraphSnapshot(progressMap)

  const topicCoverage: Record<string, number> = {}
  for (const sp of specPoints) {
    topicCoverage[sp.topic] = (topicCoverage[sp.topic] ?? 0) + 1
  }

  const masteries      = Array.from(progressMap.values())
  const masteredCount  = masteries.filter(m => m >= 800).length
  const averageMastery = masteries.length > 0
    ? Math.round(masteries.reduce((s, m) => s + m, 0) / masteries.length)
    : 0

  const curriculumPct  = Math.round((specPoints.length / EXPECTED_TOTAL) * 100)

  return {
    specPoints,
    progressMap,
    graphSnapshot,
    topicCoverage,
    curriculumPct,
    masteredCount,
    averageMastery,
  }
}

export async function getSpecPointsWithMastery(): Promise<SpecPointWithMastery[]> {
  const [sps, progressMap] = await Promise.all([
    getAllSpecPoints(),
    buildProgressMap(),
  ])

  // Build prereq mastery checker
  async function checkUnlocked(sp: SpecPoint): Promise<boolean> {
    const { parsePrerequisites } = await import('../graph')
    const prereqs = parsePrerequisites(sp)
    return prereqs.every(pid => (progressMap.get(pid) ?? 0) >= 500)
  }

  return Promise.all(
    sps.map(async sp => ({
      ...sp,
      mastery:  progressMap.get(sp.id) ?? 0,
      unlocked: await checkUnlocked(sp),
    })),
  )
}
