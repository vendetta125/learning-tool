/**
 * questionGenerator.ts
 *
 * Generates Edexcel-style GCSE Higher questions from SpecPoint metadata.
 * Fully deterministic: seed = djb2 hash of specPointId.
 * No LLM required; designed so LLM can replace `generate()` bodies later.
 *
 * Template format mirrors Edexcel mark schemes:
 *  - Context-first phrasing
 *  - [n marks] notation
 *  - Increasing difficulty variants per topic
 */

import type { SpecPoint } from '@prisma/client'

// ─── Output type ─────────────────────────────────────────

export interface GeneratedQuestion {
  question:     string
  answer:       string     // machine-readable expected answer for grading
  specPointId:  string
  difficulty:   number
  marks:        number
  solution:     string
  hints:        string[]
  questionType: 'calculate' | 'show_that' | 'find' | 'explain' | 'multi_part'
}

// ─── Deterministic seed helper ───────────────────────────

function djb2(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  return Math.abs(hash)
}

/** Returns a deterministic integer in [min, max] for a given seed + offset. */
function pick(seed: number, offset: number, min: number, max: number): number {
  const lcg = ((1664525 * (seed + offset * 997) + 1013904223) >>> 0)
  return min + (lcg % (max - min + 1))
}

// ─── Templates ───────────────────────────────────────────

type Template = (seed: number) => Omit<GeneratedQuestion, 'specPointId' | 'difficulty' | 'answer'>

interface TopicTemplates {
  low:    Template[]   // difficulty 1–4
  mid:    Template[]   // difficulty 4–7
  high:   Template[]   // difficulty 7–10
}

const TEMPLATES: Record<string, TopicTemplates> = {

  Number: {
    low: [
      s => {
        const a = pick(s, 0, 12, 49), b = pick(s, 1, 11, 49)
        return {
          question:     `Without a calculator, work out ${a} × ${b}.\nShow your working clearly.\n[3 marks]`,
          marks:        3,
          questionType: 'calculate',
          solution:     `${a} × ${b} = ${a * b}\nMethod: long multiplication`,
          hints:        [`Split ${b} into tens and units`, `${a} × ${Math.floor(b/10)*10} = ${a * Math.floor(b/10)*10}`, `Add the partial products`],
        }
      },
      s => {
        const whole = pick(s, 2, 100, 500), pct = pick(s, 3, 5, 40) * 5
        return {
          question:     `Find ${pct}% of ${whole}.\n[2 marks]`,
          marks:        2,
          questionType: 'find',
          solution:     `${pct}% of ${whole} = ${whole} ÷ 100 × ${pct} = ${whole * pct / 100}`,
          hints:        [`1% of ${whole} = ${whole / 100}`, `Multiply by ${pct}`],
        }
      },
    ],
    mid: [
      s => {
        const n1 = pick(s, 0, 1, 7), d1 = pick(s, 1, 2, 8), n2 = pick(s, 2, 1, 5), d2 = pick(s, 3, 3, 9)
        const lcm = d1 * d2 / gcd(d1, d2)
        const sumN = n1 * (lcm / d1) + n2 * (lcm / d2)
        return {
          question:     `Without a calculator, work out ${n1}/${d1} + ${n2}/${d2}.\nGive your answer as a fraction in its simplest form.\n[3 marks]`,
          marks:        3,
          questionType: 'calculate',
          solution:     `Common denominator = ${lcm}\n${n1}/${d1} = ${n1 * (lcm/d1)}/${lcm}\n${n2}/${d2} = ${n2 * (lcm/d2)}/${lcm}\nAnswer = ${sumN}/${lcm} = ${sumN/gcd(sumN, lcm)}/${lcm/gcd(sumN, lcm)}`,
          hints:        [`Find a common denominator for ${d1} and ${d2}`, 'Convert both fractions', 'Simplify your answer'],
        }
      },
      s => {
        const a = pick(s, 0, 2, 7), n = pick(s, 1, -4, 4)
        const value = a * Math.pow(10, n)
        const ordinary = n < 0 ? value.toFixed(-n) : String(value)
        return {
          question:     `Write ${a} × 10^${n} as an ordinary number.\n[1 mark]`,
          marks:        1,
          questionType: 'calculate',
          solution:     `${a} × 10^${n} = ${ordinary}`,
          hints:        [`10^${n} = ${Math.pow(10, n)}`, 'Multiply by the power of 10'],
        }
      },
    ],
    high: [
      s => {
        const a = pick(s, 0, 2, 8), b = pick(s, 1, 2, 5)
        return {
          question:     `Simplify √${a * a * b}, giving your answer in the form p√q where p and q are integers.\n[2 marks]`,
          marks:        2,
          questionType: 'calculate',
          solution:     `√${a * a * b} = √(${a * a} × ${b}) = ${a}√${b}`,
          hints:        [`Find the largest square factor of ${a * a * b}`, `√(${a * a} × ${b}) = √${a * a} × √${b}`],
        }
      },
      s => {
        const m = pick(s, 0, 10, 50) * 10, tol = pick(s, 1, 1, 5) * 0.5
        return {
          question:     `A metal rod is measured as ${m} mm, correct to the nearest ${tol} mm.\n(a) Write down the upper bound for the length of the rod.\n(b) Write down the lower bound for the length of the rod.\n[2 marks]`,
          marks:        2,
          questionType: 'multi_part',
          solution:     `(a) Upper bound = ${m + tol / 2} mm\n(b) Lower bound = ${m - tol / 2} mm`,
          hints:        ['Upper bound = measurement + half the rounding unit', 'Lower bound = measurement − half the rounding unit'],
        }
      },
    ],
  },

  Algebra: {
    low: [
      s => {
        const a = pick(s, 0, 2, 9), b = pick(s, 1, 1, 20), c = pick(s, 2, 1, 6)
        const rhs = a * c + b
        return {
          question:     `Solve ${a}x + ${b} = ${rhs}.\n[2 marks]`,
          marks:        2,
          questionType: 'find',
          solution:     `${a}x = ${rhs} − ${b} = ${rhs - b}\nx = ${(rhs - b) / a}`,
          hints:        [`Subtract ${b} from both sides`, `Divide both sides by ${a}`],
        }
      },
      s => {
        const n = pick(s, 0, 1, 8), d = pick(s, 1, 2, 6)
        return {
          question:     `Find the ${n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`} term of the sequence with nth term rule: ${d}n + ${pick(s, 2, -5, 5)}.\n[1 mark]`,
          marks:        1,
          questionType: 'find',
          solution:     `Substitute n = ${n}: ${d}(${n}) + ${pick(s, 2, -5, 5)} = ${d * n + pick(s, 2, -5, 5)}`,
          hints:        [`Replace n with ${n}`, 'Work out the arithmetic'],
        }
      },
    ],
    mid: [
      s => {
        const p = pick(s, 0, 1, 6), q = pick(s, 1, -10, 10)
        const b = -(p + q), c = p * q  // (x-p)(x-q) expanded
        const bStr = b < 0 ? `− ${Math.abs(b)}` : `+ ${b}`
        const cStr = c < 0 ? `− ${Math.abs(c)}` : `+ ${c}`
        return {
          question:     `Factorise fully: x² ${bStr}x ${cStr}.\n[2 marks]`,
          marks:        2,
          questionType: 'find',
          solution:     `(x ${p < 0 ? `+ ${Math.abs(p)}` : `− ${p}`})(x ${q < 0 ? `+ ${Math.abs(q)}` : `− ${q}`})`,
          hints:        [`Find two numbers that multiply to ${c} and add to ${-b}`, 'Write as (x + ?)(x + ?)'],
        }
      },
      s => {
        const a = pick(s, 0, 2, 5), c = pick(s, 1, 1, 4), sub = pick(s, 2, 1, 8)
        const rhs = a * sub * sub - c
        return {
          question:     `Solve ${a}x² − ${c} = ${rhs}.\nGive your answer in surd form where necessary.\n[3 marks]`,
          marks:        3,
          questionType: 'find',
          solution:     `${a}x² = ${rhs + c}\nx² = ${(rhs + c) / a}\nx = ±√${(rhs + c) / a}`,
          hints:        [`Add ${c} to both sides`, `Divide by ${a}`, 'Square root both sides (± both values)'],
        }
      },
    ],
    high: [
      s => {
        const a = pick(s, 0, 1, 3), b = pick(s, 1, -6, 6) * 2, c = pick(s, 2, -12, 12)
        const disc = b * b - 4 * a * c
        return {
          question:     `Solve ${a === 1 ? '' : a}x² ${b >= 0 ? `+ ${b}` : `${b}`}x ${c >= 0 ? `+ ${c}` : c} = 0.\nGive your answers to 2 decimal places.\n[3 marks]`,
          marks:        3,
          questionType: 'find',
          solution:     disc < 0
            ? 'No real solutions (discriminant < 0)'
            : `x = (${-b} ± √${disc}) / ${2 * a}\nx = ${round2(((-b) + Math.sqrt(disc)) / (2*a))} or x = ${round2(((-b) - Math.sqrt(disc)) / (2*a))}`,
          hints:        ['Use the quadratic formula: x = (−b ± √(b²−4ac)) / 2a', `Discriminant = ${disc}`],
        }
      },
      s => {
        const m1 = pick(s, 0, 2, 5), c1 = pick(s, 1, -8, 8), c2 = pick(s, 2, -8, 8)
        return {
          question:     `Solve the simultaneous equations:\n  y = ${m1}x + ${c1}\n  y = −x + ${c2}\n[3 marks]`,
          marks:        3,
          questionType: 'find',
          solution:     `${m1}x + ${c1} = −x + ${c2}\n${m1 + 1}x = ${c2 - c1}\nx = ${round2((c2 - c1) / (m1 + 1))}\ny = ${round2(m1 * (c2 - c1) / (m1 + 1) + c1)}`,
          hints:        ['Set the two expressions for y equal', 'Solve for x', 'Substitute x back to find y'],
        }
      },
    ],
  },

  Ratio: {
    low: [
      s => {
        const total = pick(s, 0, 100, 500) * 10, a = pick(s, 1, 1, 5), b = pick(s, 2, 1, 5)
        const shareA = Math.round((total * a) / (a + b))
        return {
          question:     `£${total} is shared in the ratio ${a}:${b}.\nHow much does the first person receive?\n[2 marks]`,
          marks:        2,
          questionType: 'find',
          solution:     `Total parts = ${a + b}\nOne part = £${total}/${a + b} = £${total / (a + b)}\nFirst share = ${a} × £${total / (a + b)} = £${shareA}`,
          hints:        [`Find the value of 1 part: £${total} ÷ ${a + b}`, `Multiply by ${a}`],
        }
      },
    ],
    mid: [
      s => {
        const orig = pick(s, 0, 200, 800) * 5, pct = pick(s, 1, 5, 30) * 5
        const inc = orig * (1 + pct / 100)
        return {
          question:     `A television costs £${orig}.\nThe price increases by ${pct}%.\nWork out the new price.\n[3 marks]`,
          marks:        3,
          questionType: 'calculate',
          solution:     `Increase = ${pct}% × £${orig} = £${orig * pct / 100}\nNew price = £${orig} + £${orig * pct / 100} = £${inc}\nOr: £${orig} × ${1 + pct / 100} = £${inc}`,
          hints:        [`Find ${pct}% of £${orig}`, 'Add to the original price', 'Or multiply by the multiplier directly'],
        }
      },
      s => {
        const p = pick(s, 0, 1000, 5000), r = pick(s, 1, 2, 8), yr = pick(s, 2, 2, 5)
        const amount = round2(p * Math.pow(1 + r / 100, yr))
        return {
          question:     `£${p} is invested at ${r}% per annum compound interest.\nWork out the value of the investment after ${yr} years.\nGive your answer to the nearest penny.\n[3 marks]`,
          marks:        3,
          questionType: 'calculate',
          solution:     `Amount = £${p} × (1 + ${r}/100)^${yr}\n= £${p} × ${round4(Math.pow(1 + r/100, yr))}\n= £${amount}`,
          hints:        [`Compound interest formula: A = P(1 + r/100)^n`, `P = £${p}, r = ${r}, n = ${yr}`],
        }
      },
    ],
    high: [
      s => {
        const k = pick(s, 0, 2, 8)
        const x1 = pick(s, 1, 2, 6), y1 = k * x1 * x1
        const x2 = pick(s, 2, 3, 10)
        return {
          question:     `y is directly proportional to x².\nWhen x = ${x1}, y = ${y1}.\n(a) Find an equation for y in terms of x.\n(b) Find the value of y when x = ${x2}.\n[4 marks]`,
          marks:        4,
          questionType: 'multi_part',
          solution:     `(a) y = kx²\n${y1} = k × ${x1}² ⟹ k = ${k}\ny = ${k}x²\n(b) y = ${k} × ${x2}² = ${k * x2 * x2}`,
          hints:        ['y ∝ x² means y = kx²', `Substitute x = ${x1}, y = ${y1} to find k`, 'Use your equation to find y'],
        }
      },
    ],
  },

  Geometry: {
    low: [
      s => {
        const l = pick(s, 0, 4, 15), w = pick(s, 1, 3, 12)
        return {
          question:     `A rectangle has length ${l} cm and width ${w} cm.\nWork out (a) the perimeter and (b) the area.\n[3 marks]`,
          marks:        3,
          questionType: 'calculate',
          solution:     `(a) Perimeter = 2(${l} + ${w}) = ${2*(l+w)} cm\n(b) Area = ${l} × ${w} = ${l*w} cm²`,
          hints:        ['Perimeter = 2(length + width)', 'Area = length × width'],
        }
      },
    ],
    mid: [
      s => {
        const a = pick(s, 0, 3, 12), b = pick(s, 1, 4, 15)
        const hyp = round2(Math.sqrt(a*a + b*b))
        return {
          question:     `A right-angled triangle has shorter sides of length ${a} cm and ${b} cm.\nWork out the length of the hypotenuse.\nGive your answer to 1 decimal place.\n[3 marks]`,
          marks:        3,
          questionType: 'calculate',
          solution:     `h² = ${a}² + ${b}² = ${a*a} + ${b*b} = ${a*a + b*b}\nh = √${a*a + b*b} = ${hyp} cm`,
          hints:        ['Use Pythagoras: a² + b² = c²', 'Square root to find the hypotenuse'],
        }
      },
      s => {
        const r = pick(s, 0, 3, 12)
        return {
          question:     `A circle has radius ${r} cm.\n(a) Work out the circumference. Give your answer in terms of π.\n(b) Work out the area. Give your answer in terms of π.\n[4 marks]`,
          marks:        4,
          questionType: 'multi_part',
          solution:     `(a) Circumference = 2πr = 2π × ${r} = ${2*r}π cm\n(b) Area = πr² = π × ${r}² = ${r*r}π cm²`,
          hints:        ['Circumference = 2πr', 'Area = πr²'],
        }
      },
    ],
    high: [
      s => {
        const a = pick(s, 0, 4, 12), b = pick(s, 1, 5, 14), angle = pick(s, 2, 25, 75)
        const area = round2(0.5 * a * b * Math.sin((angle * Math.PI) / 180))
        return {
          question:     `Triangle ABC has AB = ${a} cm, AC = ${b} cm and angle BAC = ${angle}°.\nCalculate the area of triangle ABC.\nGive your answer to 3 significant figures.\n[3 marks]`,
          marks:        3,
          questionType: 'calculate',
          solution:     `Area = ½ab sin C = ½ × ${a} × ${b} × sin ${angle}°\n= ½ × ${a} × ${b} × ${round4(Math.sin((angle*Math.PI)/180))}\n= ${area} cm²`,
          hints:        ['Area = ½ab sin C', 'Make sure your calculator is in degree mode'],
        }
      },
    ],
  },

  Probability: {
    low: [
      s => {
        const total = pick(s, 0, 10, 40) * 5
        const nA = pick(s, 1, 1, Math.floor(total/3))
        return {
          question:     `A bag contains ${total} counters. ${nA} of them are red.\nA counter is chosen at random.\nWork out the probability that it is red.\n[1 mark]`,
          marks:        1,
          questionType: 'find',
          solution:     `P(red) = ${nA}/${total} = ${simplifyFraction(nA, total)}`,
          hints:        ['Probability = favourable outcomes ÷ total outcomes'],
        }
      },
    ],
    mid: [
      s => {
        const p1 = pick(s, 0, 1, 4), q1 = pick(s, 1, p1 + 1, 7)
        const p2 = pick(s, 2, 1, 4), q2 = pick(s, 3, p2 + 1, 7)
        const pA = `${p1}/${q1}`, pB = `${p2}/${q2}`
        return {
          question:     `The probability that event A occurs is ${pA}.\nThe probability that event B occurs is ${pB}.\nA and B are independent events.\nWork out the probability that both A and B occur.\n[2 marks]`,
          marks:        2,
          questionType: 'calculate',
          solution:     `P(A and B) = P(A) × P(B) = ${p1}/${q1} × ${p2}/${q2} = ${p1*p2}/${q1*q2}`,
          hints:        ['For independent events: P(A and B) = P(A) × P(B)', 'Multiply the fractions'],
        }
      },
    ],
    high: [
      s => {
        const nR = pick(s, 0, 3, 7), nB = pick(s, 1, 2, 6)
        const total = nR + nB
        return {
          question:     `A bag contains ${nR} red and ${nB} blue balls.\nTwo balls are taken out without replacement.\nWork out the probability that both balls are the same colour.\n[4 marks]`,
          marks:        4,
          questionType: 'calculate',
          solution:     `P(RR) = ${nR}/${total} × ${nR-1}/${total-1} = ${nR*(nR-1)}/${total*(total-1)}\nP(BB) = ${nB}/${total} × ${nB-1}/${total-1} = ${nB*(nB-1)}/${total*(total-1)}\nP(same) = ${nR*(nR-1) + nB*(nB-1)}/${total*(total-1)}`,
          hints:        ['Draw a tree diagram', '"Without replacement" means the second fraction changes', 'Add both same-colour branches'],
        }
      },
    ],
  },

  Statistics: {
    low: [
      s => {
        const vals = [pick(s,0,2,9), pick(s,1,3,11), pick(s,2,1,8), pick(s,3,5,14), pick(s,4,2,10)]
        const mean = round2(vals.reduce((a,b) => a+b,0)/vals.length)
        const sorted = [...vals].sort((a,b) => a-b)
        const median = sorted[2]
        return {
          question:     `Here are five numbers: ${vals.join(', ')}\n(a) Find the mean.\n(b) Find the median.\n[3 marks]`,
          marks:        3,
          questionType: 'multi_part',
          solution:     `(a) Mean = (${vals.join(' + ')}) / 5 = ${vals.reduce((a,b)=>a+b,0)} / 5 = ${mean}\n(b) Sorted: ${sorted.join(', ')}\nMedian = ${median}`,
          hints:        ['Mean = sum ÷ count', 'To find the median, sort the values first'],
        }
      },
    ],
    mid: [
      s => {
        const a = pick(s,0,10,30), b = pick(s,1,15,35), c = pick(s,2,8,25)
        return {
          question:     `A survey records the heights of ${a+b+c} students.\n${a} students have heights in [150,160), ${b} in [160,170), ${c} in [170,180).\nEstimate the mean height.\n[4 marks]`,
          marks:        4,
          questionType: 'calculate',
          solution:     `Use midpoints: 155, 165, 175\nMean = (${a}×155 + ${b}×165 + ${c}×175) / ${a+b+c}\n= ${a*155 + b*165 + c*175} / ${a+b+c}\n= ${round2((a*155 + b*165 + c*175)/(a+b+c))} cm`,
          hints:        ['Use the midpoint of each class interval', 'Mean = Σ(f × x) / Σf'],
        }
      },
    ],
    high: [],
  },
}

// ─── Main export ─────────────────────────────────────────

export function generateQuestion(sp: SpecPoint): GeneratedQuestion {
  const seed       = djb2(sp.id)
  const difficulty = sp.difficulty  // 1–10
  const topic      = sp.topic

  const bank = TEMPLATES[topic] ?? TEMPLATES['Number']

  let pool: Template[]
  if (difficulty <= 4)       pool = [...bank.low, ...bank.mid]
  else if (difficulty <= 7)  pool = [...bank.mid, ...bank.high]
  else                       pool = [...bank.high, ...bank.mid]

  if (pool.length === 0) pool = bank.low.length > 0 ? bank.low : TEMPLATES['Number'].low

  const template = pool[seed % pool.length]
  const generated = template(seed)

  return { ...generated, answer: extractAnswer(generated.solution), specPointId: sp.id, difficulty }
}

/** Extract a machine-readable answer from the last '= ...' in the solution string. */
function extractAnswer(solution: string): string {
  const lines = solution.split('\n').map(l => l.trim()).filter(Boolean)
  // Walk backwards so multi-part / "show working" solutions resolve to their
  // final line, and within that line anchor on the LAST '=' so trailing
  // working (e.g. "Area = ½ × 5 × 3 = 7.5 cm²") yields just the final value.
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(/=\s*([^=]+)$/)
    if (match) return match[1].trim()
  }
  return lines[lines.length - 1] ?? ''
}

// ─── Math helpers ─────────────────────────────────────────

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b)
}

function simplifyFraction(n: number, d: number): string {
  const g = gcd(n, d)
  return g === d ? String(n / g) : `${n / g}/${d / g}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
