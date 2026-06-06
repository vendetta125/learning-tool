/**
 * GET /api/curriculum/validate
 *
 * Admin/debug endpoint.  Returns:
 *  - curriculum completeness (vs expected 98 Edexcel spec points)
 *  - graph integrity (isolated nodes, broken prereq chains)
 *  - core analytics metrics
 *
 * Use ?ingest=true to run the Edexcel spec ingestion first.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateCurriculumCompleteness } from '@/lib/curriculum/validation'
import { isCurriculumComplete, getTopicCoverage } from '@/lib/curriculum/graphState'
import { getCoreMetrics }                          from '@/lib/analytics/coreMetrics'

export async function GET(req: NextRequest) {
  try {
    const shouldIngest = req.nextUrl.searchParams.get('ingest') === 'true'

    if (shouldIngest) {
      const { ingestEdexcelSpec } = await import('@/lib/curriculum/ingestEdexcel')
      await ingestEdexcelSpec()
    }

    const [validation, complete, topicCoverage, metrics] = await Promise.all([
      validateCurriculumCompleteness(),
      isCurriculumComplete(),
      getTopicCoverage(),
      getCoreMetrics(),
    ])

    return NextResponse.json({
      curriculumReady:  complete,
      validation,
      topicCoverage,
      analytics:        metrics,
      ingestRan:        shouldIngest,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
