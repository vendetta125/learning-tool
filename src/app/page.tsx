import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { getCoreMetrics } from '@/lib/analytics/coreMetrics'
import { getNextTopic, computeLearningState } from '@/lib/scheduler'
import { isCurriculumComplete } from '@/lib/curriculum/graphState'

async function seedCurriculum() {
  'use server'
  const { ingestEdexcelSpec } = await import('@/lib/curriculum/ingestEdexcel')
  await ingestEdexcelSpec()
  revalidatePath('/')
}

function gradeColour(g: number) {
  if (g >= 8) return 'text-emerald-400'
  if (g >= 6) return 'text-yellow-400'
  if (g >= 4) return 'text-orange-400'
  return 'text-red-400'
}

const DIST_COLOURS: Record<string, string> = {
  unstarted:  'bg-gray-700',
  learning:   'bg-red-800',
  developing: 'bg-orange-700',
  proficient: 'bg-yellow-600',
  mastered:   'bg-emerald-600',
}

export default async function DashboardPage() {
  const ready = await isCurriculumComplete()

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <h1 className="text-3xl font-bold">Welcome to Math Ascension</h1>
        <p className="max-w-md text-gray-400">
          Load the full Edexcel 1MA1 Higher curriculum (98 spec points) to get started.
        </p>
        <form action={seedCurriculum}>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold hover:bg-indigo-500 transition-colors"
          >
            Initialise Curriculum
          </button>
        </form>
      </div>
    )
  }

  const [metrics, nextTopic, state] = await Promise.all([
    getCoreMetrics(),
    getNextTopic(),
    computeLearningState(),
  ])

  return (
    <div className="space-y-8">
      {/* Title row */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-gray-400">
            {state.totalSpecPoints} spec points · {state.masteredCount} mastered
          </p>
        </div>
        <div className="text-right">
          <div className={`text-6xl font-black leading-none ${gradeColour(metrics.estimatedGrade)}`}>
            {metrics.estimatedGrade}
          </div>
          <div className="mt-1 text-xs uppercase tracking-wider text-gray-400">
            Est. grade · {metrics.overallMasteryPct}% proficient
          </div>
        </div>
      </div>

      {/* Next recommended topic */}
      {nextTopic ? (
        <div className="rounded-xl border border-indigo-700 bg-indigo-950/50 p-5">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-indigo-400">
            Up next
          </div>
          <div className="text-xl font-semibold">{nextTopic.title}</div>
          <div className="mt-1 text-sm text-gray-400">
            {nextTopic.topic} · Mastery {nextTopic.mastery} · {nextTopic.reason}
          </div>
          <Link
            href={`/study?specPointId=${nextTopic.specPointId}`}
            className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 transition-colors"
          >
            Study now
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-700 bg-emerald-950/40 p-5 text-emerald-300">
          All topics mastered — take a full exam to confirm your grade.
        </div>
      )}

      {/* Mastery distribution */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Mastery distribution</h2>
        <div className="grid grid-cols-5 gap-3">
          {(Object.entries(metrics.masteryDistribution) as [string, number][]).map(([label, count]) => (
            <div
              key={label}
              className={`rounded-lg p-4 ${DIST_COLOURS[label]} bg-opacity-30 border border-white/5`}
            >
              <div className="text-2xl font-bold">{count}</div>
              <div className="mt-1 text-xs capitalize text-gray-300">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Topic performance bars */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Topic performance</h2>
        <div className="space-y-3">
          {metrics.topicMetrics.map(t => (
            <div key={t.topic} className="rounded-lg bg-gray-900 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{t.topic}</span>
                <span className="text-sm text-gray-400">
                  {t.masteredCount}/{t.specPointCount} mastered
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${t.masteryPct}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-gray-500">{t.masteryPct}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Weak clusters */}
      {metrics.weakClusters.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Weak areas</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {metrics.weakClusters.map(c => {
              const cls =
                c.urgency === 'critical' ? 'border-red-700 bg-red-950/40 text-red-400' :
                c.urgency === 'high'     ? 'border-orange-700 bg-orange-950/40 text-orange-400' :
                                           'border-yellow-700 bg-yellow-950/40 text-yellow-400'
              return (
                <div key={c.topic} className={`rounded-lg border p-4 ${cls}`}>
                  <div className="font-semibold text-gray-100">{c.topic}</div>
                  <div className="mt-1 text-sm text-gray-400">
                    {c.specPointIds.length} spec points · avg mastery {c.avgMastery}
                  </div>
                  <span className="text-xs font-semibold uppercase">{c.urgency}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-800">
        <Link
          href="/exam"
          className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm hover:bg-gray-800 transition-colors"
        >
          Take an exam
        </Link>
        <Link
          href="/curriculum"
          className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm hover:bg-gray-800 transition-colors"
        >
          Browse curriculum
        </Link>
      </div>
    </div>
  )
}
