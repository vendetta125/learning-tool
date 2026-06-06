import Link from 'next/link'
import { getSpecPointsWithMastery } from '@/lib/curriculum/graphState'
import type { SpecPointWithMastery } from '@/lib/curriculum/graphState'

function masteryColour(m: number) {
  if (m >= 800) return 'bg-emerald-600'
  if (m >= 600) return 'bg-yellow-500'
  if (m >= 400) return 'bg-orange-500'
  if (m > 0)   return 'bg-red-600'
  return 'bg-gray-700'
}

function masteryLabel(m: number) {
  if (m >= 800) return { text: 'Mastered', cls: 'text-emerald-400' }
  if (m >= 600) return { text: 'Proficient', cls: 'text-yellow-400' }
  if (m >= 400) return { text: 'Developing', cls: 'text-orange-400' }
  if (m > 0)   return { text: 'Learning', cls: 'text-red-400' }
  return { text: 'Unstarted', cls: 'text-gray-500' }
}

function difficultyDots(d: number) {
  return Array.from({ length: 10 }, (_, i) => (
    <span key={i} className={`inline-block h-1.5 w-1.5 rounded-full ${i < d ? 'bg-indigo-400' : 'bg-gray-700'}`} />
  ))
}

function SpecCard({ sp }: { sp: SpecPointWithMastery }) {
  const label = masteryLabel(sp.mastery)
  const pct   = sp.mastery / 10  // 0–100

  return (
    <Link href={`/study?specPointId=${sp.id}`} className="block rounded-lg bg-gray-900 p-4 hover:bg-gray-800 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm leading-snug">{sp.title}</div>
          <div className="mt-0.5 text-xs text-gray-500">{sp.edexcel_ref}</div>
        </div>
        <div className="text-right shrink-0">
          <span className={`text-xs font-medium ${label.cls}`}>{label.text}</span>
          {!sp.unlocked && (
            <div className="mt-0.5 text-xs text-gray-600">Locked</div>
          )}
        </div>
      </div>

      {/* Mastery bar */}
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-800">
        <div
          className={`h-full rounded-full ${masteryColour(sp.mastery)} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Difficulty dots */}
      <div className="mt-2 flex items-center gap-0.5">
        {difficultyDots(sp.difficulty)}
        <span className="ml-2 text-xs text-gray-600">d{sp.difficulty}</span>
      </div>
    </Link>
  )
}

export default async function CurriculumPage() {
  let specPoints: SpecPointWithMastery[] = []
  let error = ''

  try {
    specPoints = await getSpecPointsWithMastery()
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load curriculum'
  }

  if (error) {
    return <div className="text-red-400 rounded-lg bg-red-950/40 p-4">{error}</div>
  }

  if (specPoints.length === 0) {
    return (
      <div className="rounded-lg border border-gray-700 p-8 text-center">
        <p className="text-gray-400">Curriculum not loaded yet.</p>
        <Link href="/" className="mt-4 inline-block text-indigo-400 hover:underline">
          Go to Dashboard to initialise
        </Link>
      </div>
    )
  }

  // Group by topic
  const byTopic = specPoints.reduce<Record<string, SpecPointWithMastery[]>>((acc, sp) => {
    if (!acc[sp.topic]) acc[sp.topic] = []
    acc[sp.topic].push(sp)
    return acc
  }, {})

  const topicOrder = ['Number', 'Algebra', 'Ratio', 'Geometry', 'Probability', 'Statistics']
  const orderedTopics = [
    ...topicOrder.filter(t => byTopic[t]),
    ...Object.keys(byTopic).filter(t => !topicOrder.includes(t)),
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Curriculum</h1>
        <span className="text-sm text-gray-400">{specPoints.length} spec points</span>
      </div>

      {orderedTopics.map(topic => {
        const sps      = byTopic[topic]
        const mastered = sps.filter(s => s.mastery >= 800).length
        const avgPct   = Math.round(sps.reduce((s, sp) => s + sp.mastery / 10, 0) / sps.length)

        return (
          <section key={topic}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{topic}</h2>
              <span className="text-sm text-gray-400">
                {mastered}/{sps.length} mastered · {avgPct}% avg
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sps.map(sp => <SpecCard key={sp.id} sp={sp} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}
