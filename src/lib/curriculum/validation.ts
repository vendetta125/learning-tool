/**
 * validation.ts
 *
 * Validates curriculum completeness against the expected Edexcel 1MA1
 * Higher tier spec structure.  Detects missing spec points, isolated
 * nodes (no prereqs AND no dependents), and broken prerequisite chains.
 */

import { prisma }           from '../db'
import { getPrerequisites } from '../graph'

// ─── Expected spec point ID sets ─────────────────────────

const EXPECTED_IDS: Record<string, string[]> = {
  Number: [
    'N1','N2','N3','N4','N5','N6','N7','N8',
    'N9','N10','N11','N12','N13','N14','N15','N16',
  ],
  Algebra: [
    'A1','A2','A3','A4','A5','A6','A7','A8','A9','A10',
    'A11','A12','A13','A14','A15','A16','A17','A18','A19','A20',
    'A21','A22','A23','A24','A25',
  ],
  Ratio: [
    'R1','R2','R3','R4','R5','R6','R7','R8',
    'R9','R10','R11','R12','R13','R14','R15','R16',
  ],
  Geometry: [
    'G1','G2','G3','G4','G5','G6','G7','G8','G9','G10',
    'G11','G12','G13','G14','G15','G16','G17','G18','G19','G20',
    'G21','G22','G23','G24','G25',
  ],
  Probability: [
    'P1','P2','P3','P4','P5','P6','P7','P8','P9','P10',
  ],
  Statistics: [
    'S1','S2','S3','S4','S5','S6',
  ],
}

export const EXPECTED_TOTAL = Object.values(EXPECTED_IDS)
  .reduce((sum, ids) => sum + ids.length, 0)

// ─── Result types ─────────────────────────────────────────

export interface ValidationResult {
  complete:             boolean
  totalExpected:        number
  totalLoaded:          number
  missingByTopic:       Record<string, string[]>   // topic → missing IDs
  extraIds:             string[]                   // in DB but not in spec list
  isolatedNodes:        string[]                   // no prereqs AND no dependents
  brokenPrereqs:        BrokenPrereq[]
  topicCoverage:        Record<string, TopicCoverage>
}

export interface TopicCoverage {
  expected:  number
  loaded:    number
  pct:       number
  missing:   string[]
}

export interface BrokenPrereq {
  specPointId:    string
  missingPrereqs: string[]   // prereq IDs referenced but not in DB
}

// ─── Main validation function ─────────────────────────────

export async function validateCurriculumCompleteness(): Promise<ValidationResult> {
  const allSPs     = await prisma.specPoint.findMany()
  const loadedIds  = new Set(allSPs.map(sp => sp.id))

  // ── Missing by topic ──────────────────────────────────
  const missingByTopic: Record<string, string[]> = {}
  for (const [topic, ids] of Object.entries(EXPECTED_IDS)) {
    const missing = ids.filter(id => !loadedIds.has(id))
    if (missing.length > 0) missingByTopic[topic] = missing
  }

  // ── Extra IDs ─────────────────────────────────────────
  const allExpected = new Set(Object.values(EXPECTED_IDS).flat())
  const extraIds    = Array.from(loadedIds).filter(id => !allExpected.has(id))

  // ── Topic coverage ────────────────────────────────────
  const topicCoverage: Record<string, TopicCoverage> = {}
  for (const [topic, ids] of Object.entries(EXPECTED_IDS)) {
    const missing    = ids.filter(id => !loadedIds.has(id))
    const loaded     = ids.length - missing.length
    topicCoverage[topic] = {
      expected: ids.length,
      loaded,
      pct:      Math.round((loaded / ids.length) * 100),
      missing,
    }
  }

  // ── Broken prerequisites ──────────────────────────────
  const brokenPrereqs: BrokenPrereq[] = []
  for (const sp of allSPs) {
    const prereqs        = await getPrerequisites(sp.id)
    const missingPrereqs = prereqs.filter(pid => !loadedIds.has(pid))
    if (missingPrereqs.length > 0) {
      brokenPrereqs.push({ specPointId: sp.id, missingPrereqs })
    }
  }

  // ── Isolated nodes ────────────────────────────────────
  // Build dependent set: which spec points appear as prereqs of others
  const hasDependents = new Set<string>()
  for (const sp of allSPs) {
    const prereqs = await getPrerequisites(sp.id)
    for (const pid of prereqs) hasDependents.add(pid)
  }

  const isolatedNodes: string[] = []
  for (const sp of allSPs) {
    const prereqs     = await getPrerequisites(sp.id)
    const isIsolated  = prereqs.length === 0 && !hasDependents.has(sp.id)
    // Only flag truly isolated nodes from the expected spec (not seed data)
    if (isIsolated && allExpected.has(sp.id)) isolatedNodes.push(sp.id)
  }

  const complete =
    Object.keys(missingByTopic).length === 0 &&
    brokenPrereqs.length === 0

  return {
    complete,
    totalExpected: EXPECTED_TOTAL,
    totalLoaded:   loadedIds.size,
    missingByTopic,
    extraIds,
    isolatedNodes,
    brokenPrereqs,
    topicCoverage,
  }
}
