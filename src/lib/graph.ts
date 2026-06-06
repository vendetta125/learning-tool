/**
 * graph.ts
 *
 * Knowledge graph engine.
 * Spec points are nodes; prerequisites are directed edges.
 * A topic is "unlocked" only when all its prerequisites are mastered (≥ threshold).
 */

import { prisma } from './db'
import type { SpecPoint } from '@prisma/client'

export const PREREQUISITE_MASTERY_THRESHOLD = 500

// ─── Prerequisite parsing ─────────────────────────────────

export function parsePrerequisites(sp: SpecPoint): string[] {
  try {
    const parsed = JSON.parse(sp.prerequisites)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

// ─── Graph queries ────────────────────────────────────────

/** Direct prerequisites of a spec point. */
export async function getPrerequisites(specPointId: string): Promise<string[]> {
  const sp = await prisma.specPoint.findUnique({ where: { id: specPointId } })
  return sp ? parsePrerequisites(sp) : []
}

/** Spec points that directly depend on this one. */
export async function getDependents(specPointId: string): Promise<string[]> {
  const all = await prisma.specPoint.findMany()
  return all
    .filter(sp => parsePrerequisites(sp).includes(specPointId))
    .map(sp => sp.id)
}

/**
 * A topic is unlocked when every prerequisite has mastery ≥ threshold.
 * Topics with no prerequisites are always unlocked.
 */
export function isUnlocked(
  sp: SpecPoint,
  progressMap: Map<string, number>,
): boolean {
  const prereqs = parsePrerequisites(sp)
  if (prereqs.length === 0) return true
  return prereqs.every(
    id => (progressMap.get(id) ?? 0) >= PREREQUISITE_MASTERY_THRESHOLD,
  )
}

/**
 * Build a full in-memory graph snapshot.
 * Used by the scheduler and the (future) visual graph explorer.
 */
export async function buildGraphSnapshot(progressMap: Map<string, number>) {
  const specPoints = await prisma.specPoint.findMany()

  const nodes = specPoints.map(sp => ({
    id:           sp.id,
    title:        sp.title,
    topic:        sp.topic,
    difficulty:   sp.difficulty,
    status:       sp.status,
    mastery:      progressMap.get(sp.id) ?? 0,
    unlocked:     isUnlocked(sp, progressMap),
    prerequisites: parsePrerequisites(sp),
  }))

  const edges = specPoints.flatMap(sp =>
    parsePrerequisites(sp).map(prereqId => ({
      from: prereqId,
      to:   sp.id,
    })),
  )

  return { nodes, edges }
}

/** Load all current mastery scores into a Map for fast lookup. */
export async function buildProgressMap(): Promise<Map<string, number>> {
  const rows = await prisma.userProgress.findMany()
  return new Map(rows.map(r => [r.specPointId, r.mastery]))
}
