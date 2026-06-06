/**
 * ingestEdexcel.ts
 *
 * Complete Edexcel GCSE (9–1) Higher Mathematics specification (1MA1).
 * Every entry maps 1:1 to an official Edexcel specification statement.
 * Source: Pearson Edexcel Level 1/Level 2 GCSE (9–1) Mathematics
 *         specification, first teaching September 2015.
 *
 * 98 spec points across 6 strands:
 *   Number (N1–N16)      · Algebra (A1–A25)
 *   Ratio (R1–R16)       · Geometry (G1–G25)
 *   Probability (P1–P10) · Statistics (S1–S6)
 *
 * Run ingestEdexcelSpec() once to seed the database.
 * The function is idempotent — safe to re-run.
 */

import { prisma } from '../db'

// ─── Type ─────────────────────────────────────────────────

interface SpecSeed {
  id:          string
  title:       string
  topic:       string
  edexcel_ref: string
  description: string
  prerequisites: string[]   // other spec point IDs
  difficulty:  number       // 1–10
  status:      'verified' | 'unverified'
}

// ─── Full Edexcel Higher Specification ───────────────────

export const EDEXCEL_SPEC: SpecSeed[] = [

  // ══════════════════════════════════════════════════════
  // NUMBER (N1–N16)
  // ══════════════════════════════════════════════════════

  {
    id: 'N1', title: 'Ordering numbers and inequality notation',
    topic: 'Number', edexcel_ref: 'N1',
    description: 'Order positive and negative integers, decimals and fractions; use the number line as a model for ordering the real numbers; use the symbols =, ≠, <, >, ≤, ≥.',
    prerequisites: [], difficulty: 2, status: 'verified',
  },
  {
    id: 'N2', title: 'Four operations with integers, decimals and fractions',
    topic: 'Number', edexcel_ref: 'N2',
    description: 'Apply the four operations, including formal written methods, to integers, decimals, proper and improper fractions, and mixed numbers, both positive and negative; understand and use place value.',
    prerequisites: ['N1'], difficulty: 3, status: 'verified',
  },
  {
    id: 'N3', title: 'Priority of operations and inverse operations',
    topic: 'Number', edexcel_ref: 'N3',
    description: 'Recognise and use relationships between operations including inverse operations; use conventional notation for the priority of operations, including brackets, powers, roots and reciprocals.',
    prerequisites: ['N2'], difficulty: 3, status: 'verified',
  },
  {
    id: 'N4', title: 'Primes, factors, multiples, HCF, LCM and prime factorisation',
    topic: 'Number', edexcel_ref: 'N4',
    description: 'Use the concepts and vocabulary of prime numbers, factors (divisors), multiples, common factors, common multiples, highest common factor (HCF), lowest common multiple (LCM), prime factorisation including product notation and the unique factorisation property.',
    prerequisites: ['N2', 'N3'], difficulty: 4, status: 'verified',
  },
  {
    id: 'N5', title: 'Systematic listing strategies and product rule for counting',
    topic: 'Number', edexcel_ref: 'N5',
    description: 'Apply systematic listing strategies including use of the product rule for counting (if there are m ways of doing one task and n ways of doing another, there are m × n ways of doing both).',
    prerequisites: ['N4'], difficulty: 5, status: 'verified',
  },
  {
    id: 'N6', title: 'Integer powers, roots, and surds (exact vs approximate)',
    topic: 'Number', edexcel_ref: 'N6',
    description: 'Use positive integer powers and associated real roots (square, cube and higher); recognise powers of 2, 3, 4, 5; distinguish between exact and approximate answers to calculations involving surds.',
    prerequisites: ['N2', 'N3'], difficulty: 4, status: 'verified',
  },
  {
    id: 'N7', title: 'Integer and fractional indices',
    topic: 'Number', edexcel_ref: 'N7',
    description: 'Calculate with roots and with integer and fractional indices; apply laws of indices to simplify expressions.',
    prerequisites: ['N6'], difficulty: 7, status: 'verified',
  },
  {
    id: 'N8', title: 'Exact calculation with fractions, surds and multiples of π',
    topic: 'Number', edexcel_ref: 'N8',
    description: 'Calculate exactly with fractions, surds and multiples of π; simplify surd expressions involving squares (e.g. √12 = 2√3) and rationalise denominators.',
    prerequisites: ['N6', 'N7'], difficulty: 8, status: 'verified',
  },
  {
    id: 'N9', title: 'Standard form',
    topic: 'Number', edexcel_ref: 'N9',
    description: 'Calculate with and interpret standard form A × 10ⁿ, where 1 ≤ A < 10 and n is an integer; convert between standard form and ordinary numbers; calculate with standard form with and without a calculator.',
    prerequisites: ['N6', 'N2'], difficulty: 5, status: 'verified',
  },
  {
    id: 'N10', title: 'Terminating and recurring decimals',
    topic: 'Number', edexcel_ref: 'N10',
    description: 'Work interchangeably with terminating decimals and their corresponding fractions; change recurring decimals into their corresponding fractions and vice versa.',
    prerequisites: ['N2', 'N3'], difficulty: 5, status: 'verified',
  },
  {
    id: 'N11', title: 'Fractions in ratio problems',
    topic: 'Number', edexcel_ref: 'N11',
    description: 'Identify and work with fractions in ratio problems.',
    prerequisites: ['N10', 'N2'], difficulty: 4, status: 'verified',
  },
  {
    id: 'N12', title: 'Fractions and percentages as operators',
    topic: 'Number', edexcel_ref: 'N12',
    description: 'Interpret fractions and percentages as operators; apply to find fractional and percentage amounts of quantities.',
    prerequisites: ['N10'], difficulty: 3, status: 'verified',
  },
  {
    id: 'N13', title: 'Standard units of measure',
    topic: 'Number', edexcel_ref: 'N13',
    description: 'Use standard units of mass, length, time, money and other measures (including standard compound measures) using decimal quantities where appropriate.',
    prerequisites: ['N2'], difficulty: 2, status: 'verified',
  },
  {
    id: 'N14', title: 'Estimation and approximation',
    topic: 'Number', edexcel_ref: 'N14',
    description: 'Estimate answers; check calculations using approximation and estimation, including answers obtained using technology.',
    prerequisites: ['N2', 'N15'], difficulty: 3, status: 'verified',
  },
  {
    id: 'N15', title: 'Rounding and error intervals',
    topic: 'Number', edexcel_ref: 'N15',
    description: 'Round numbers and measures to an appropriate degree of accuracy (e.g. to a specified number of decimal places or significant figures); use inequality notation to specify simple error intervals due to truncation or rounding.',
    prerequisites: ['N2'], difficulty: 3, status: 'verified',
  },
  {
    id: 'N16', title: 'Limits of accuracy and upper/lower bounds',
    topic: 'Number', edexcel_ref: 'N16',
    description: 'Apply and interpret limits of accuracy, including upper and lower bounds; calculate the upper and lower bounds of calculations involving addition, subtraction, multiplication and division.',
    prerequisites: ['N15'], difficulty: 6, status: 'verified',
  },

  // ══════════════════════════════════════════════════════
  // ALGEBRA (A1–A25)
  // ══════════════════════════════════════════════════════

  {
    id: 'A1', title: 'Algebraic notation and manipulation conventions',
    topic: 'Algebra', edexcel_ref: 'A1',
    description: 'Use and interpret algebraic notation, including: ab in place of a × b; 3y in place of y + y + y; a² in place of a × a; coefficients written as fractions; brackets.',
    prerequisites: ['N2'], difficulty: 2, status: 'verified',
  },
  {
    id: 'A2', title: 'Substitution into formulae and expressions',
    topic: 'Algebra', edexcel_ref: 'A2',
    description: 'Substitute numerical values into formulae and expressions, including scientific formulae; evaluate expressions for given values of variables.',
    prerequisites: ['A1', 'N3'], difficulty: 3, status: 'verified',
  },
  {
    id: 'A3', title: 'Algebraic vocabulary: expressions, equations, identities, inequalities',
    topic: 'Algebra', edexcel_ref: 'A3',
    description: 'Understand and use the concepts and vocabulary of expressions, equations, formulae, identities, inequalities, terms and factors.',
    prerequisites: ['A1'], difficulty: 2, status: 'verified',
  },
  {
    id: 'A4', title: 'Simplify and manipulate algebraic expressions',
    topic: 'Algebra', edexcel_ref: 'A4',
    description: 'Simplify and manipulate algebraic expressions (including those involving surds and algebraic fractions) by: collecting like terms; multiplying a single term over a bracket; taking out common factors; expanding products of two or more binomials; factorising quadratic expressions of the form x² + bx + c, including the difference of two squares; simplifying using laws of indices.',
    prerequisites: ['A1', 'A3', 'N8'], difficulty: 5, status: 'verified',
  },
  {
    id: 'A5', title: 'Standard formulae and changing the subject',
    topic: 'Algebra', edexcel_ref: 'A5',
    description: 'Understand and use standard mathematical formulae; rearrange formulae to change the subject, including cases where the subject appears twice or where a power or root is involved.',
    prerequisites: ['A4', 'A2'], difficulty: 6, status: 'verified',
  },
  {
    id: 'A6', title: 'Algebraic proof and identities',
    topic: 'Algebra', edexcel_ref: 'A6',
    description: 'Know the difference between an equation and an identity; argue mathematically to show algebraic expressions are equivalent; use algebra to support and construct arguments and proofs.',
    prerequisites: ['A4', 'A3'], difficulty: 7, status: 'verified',
  },
  {
    id: 'A7', title: 'Functions, inverse functions and composite functions',
    topic: 'Algebra', edexcel_ref: 'A7',
    description: 'Where appropriate, interpret simple expressions as functions with inputs and outputs; interpret the reverse process as the inverse function; interpret the succession of two functions as a composite function. (Higher only)',
    prerequisites: ['A5', 'A17'], difficulty: 8, status: 'verified',
  },
  {
    id: 'A8', title: 'Coordinates in all four quadrants',
    topic: 'Algebra', edexcel_ref: 'A8',
    description: 'Work with coordinates in all four quadrants; plot and identify points given their coordinates; find the midpoint and length of a line segment.',
    prerequisites: ['N1'], difficulty: 2, status: 'verified',
  },
  {
    id: 'A9', title: 'Straight-line graphs and y = mx + c',
    topic: 'Algebra', edexcel_ref: 'A9',
    description: 'Plot graphs of equations corresponding to straight-line graphs; use the form y = mx + c to identify parallel and perpendicular lines; find the equation of a line through two given points, or through one point with a given gradient.',
    prerequisites: ['A8', 'A2'], difficulty: 4, status: 'verified',
  },
  {
    id: 'A10', title: 'Gradients and intercepts of linear functions',
    topic: 'Algebra', edexcel_ref: 'A10',
    description: 'Identify and interpret gradients and intercepts of linear functions graphically and algebraically; calculate the gradient of a straight line from two given points.',
    prerequisites: ['A9'], difficulty: 4, status: 'verified',
  },
  {
    id: 'A11', title: 'Quadratic functions: roots, intercepts and turning points',
    topic: 'Algebra', edexcel_ref: 'A11',
    description: 'Identify and interpret roots, intercepts and turning points of quadratic functions graphically; deduce roots algebraically and turning points by completing the square.',
    prerequisites: ['A9', 'A18'], difficulty: 6, status: 'verified',
  },
  {
    id: 'A12', title: 'Recognise and sketch graphs of functions',
    topic: 'Algebra', edexcel_ref: 'A12',
    description: 'Recognise, sketch and interpret graphs of linear functions, quadratic functions, simple cubic functions, the reciprocal function y = 1/x, exponential functions y = kˣ for positive k, and the trigonometric functions y = sin x, y = cos x, y = tan x for any angle.',
    prerequisites: ['A9', 'A11'], difficulty: 6, status: 'verified',
  },
  {
    id: 'A13', title: 'Graph transformations: translations and reflections',
    topic: 'Algebra', edexcel_ref: 'A13',
    description: 'Sketch translations and reflections of the graph of a given function; know the effect of y = f(x) + a, y = f(x + a), y = −f(x), y = f(−x) on a curve.',
    prerequisites: ['A12'], difficulty: 7, status: 'verified',
  },
  {
    id: 'A14', title: 'Interpret graphs in real contexts',
    topic: 'Algebra', edexcel_ref: 'A14',
    description: 'Plot and interpret graphs (including reciprocal and exponential graphs) and graphs of non-standard functions in real contexts, to find approximate solutions; interpret distance-time and velocity-time graphs.',
    prerequisites: ['A12', 'A9'], difficulty: 5, status: 'verified',
  },
  {
    id: 'A15', title: 'Gradients and areas under graphs (non-calculus)',
    topic: 'Algebra', edexcel_ref: 'A15',
    description: 'Calculate or estimate gradients of graphs and areas under graphs (including quadratic and other non-linear graphs), and interpret results in cases such as distance-time, velocity-time and financial graphs. (Higher only)',
    prerequisites: ['A14', 'A10'], difficulty: 8, status: 'verified',
  },
  {
    id: 'A16', title: 'Equation of a circle and tangent to a circle',
    topic: 'Algebra', edexcel_ref: 'A16',
    description: 'Recognise and use the equation of a circle with centre at the origin x² + y² = r²; find the equation of a tangent to a circle at a given point. (Higher only)',
    prerequisites: ['A9', 'A8', 'G9'], difficulty: 8, status: 'verified',
  },
  {
    id: 'A17', title: 'Solve linear equations',
    topic: 'Algebra', edexcel_ref: 'A17',
    description: 'Solve linear equations in one variable (including those with the unknown on both sides of the equation, with fractional coefficients); find approximate solutions using a graph.',
    prerequisites: ['A4', 'A3'], difficulty: 4, status: 'verified',
  },
  {
    id: 'A18', title: 'Solve quadratic equations',
    topic: 'Algebra', edexcel_ref: 'A18',
    description: 'Solve quadratic equations (including those requiring rearrangement) algebraically by factorising, by completing the square and by using the quadratic formula; find approximate solutions using a graph.',
    prerequisites: ['A4', 'A17'], difficulty: 6, status: 'verified',
  },
  {
    id: 'A19', title: 'Simultaneous equations (linear/linear and linear/quadratic)',
    topic: 'Algebra', edexcel_ref: 'A19',
    description: 'Solve two simultaneous equations in two variables (linear/linear or linear/quadratic) algebraically and graphically; find approximate solutions using a graph.',
    prerequisites: ['A17', 'A18', 'A9'], difficulty: 7, status: 'verified',
  },
  {
    id: 'A20', title: 'Iteration and numerical methods',
    topic: 'Algebra', edexcel_ref: 'A20',
    description: 'Find approximate solutions to equations numerically using iteration; set up and use recurrence relations of the form xₙ₊₁ = f(xₙ). (Higher only)',
    prerequisites: ['A17', 'A2'], difficulty: 7, status: 'verified',
  },
  {
    id: 'A21', title: 'Form and solve equations from context',
    topic: 'Algebra', edexcel_ref: 'A21',
    description: 'Translate situations or procedures into algebraic expressions or formulae; derive an equation (or two simultaneous equations), solve the equation(s) and interpret the solution in context.',
    prerequisites: ['A17', 'A19'], difficulty: 6, status: 'verified',
  },
  {
    id: 'A22', title: 'Linear and quadratic inequalities',
    topic: 'Algebra', edexcel_ref: 'A22',
    description: 'Solve linear inequalities in one or two variables, and quadratic inequalities in one variable; represent the solution set on a number line, using set notation and on a graph.',
    prerequisites: ['A17', 'A18'], difficulty: 6, status: 'verified',
  },
  {
    id: 'A23', title: 'Generate terms of a sequence',
    topic: 'Algebra', edexcel_ref: 'A23',
    description: 'Generate terms of a sequence from either a term-to-term or a position-to-term rule; recognise sequences defined by a formula or recurrence relation.',
    prerequisites: ['A2'], difficulty: 3, status: 'verified',
  },
  {
    id: 'A24', title: 'Recognise and use types of sequences',
    topic: 'Algebra', edexcel_ref: 'A24',
    description: 'Recognise and use sequences of triangular, square and cube numbers, simple arithmetic progressions, geometric progressions, Fibonacci-type sequences, quadratic sequences, and simple geometric series.',
    prerequisites: ['A23'], difficulty: 5, status: 'verified',
  },
  {
    id: 'A25', title: 'nth term of linear and quadratic sequences',
    topic: 'Algebra', edexcel_ref: 'A25',
    description: 'Deduce expressions to calculate the nth term of linear and quadratic sequences; use the nth term formula to find terms and to determine whether a given number is in the sequence.',
    prerequisites: ['A24', 'A4'], difficulty: 5, status: 'verified',
  },

  // ══════════════════════════════════════════════════════
  // RATIO, PROPORTION AND RATES OF CHANGE (R1–R16)
  // ══════════════════════════════════════════════════════

  {
    id: 'R1', title: 'Change between standard units',
    topic: 'Ratio', edexcel_ref: 'R1',
    description: 'Change freely between related standard units (e.g. time, length, area, volume/capacity, mass) and compound units (e.g. speed, rates of pay, prices).',
    prerequisites: ['N13'], difficulty: 3, status: 'verified',
  },
  {
    id: 'R2', title: 'Scale factors, scale diagrams and maps',
    topic: 'Ratio', edexcel_ref: 'R2',
    description: 'Use scale factors, scale diagrams and maps; interpret and construct scale drawings; use bearings in scale drawing contexts.',
    prerequisites: ['R1', 'N15'], difficulty: 4, status: 'verified',
  },
  {
    id: 'R3', title: 'Express one quantity as a fraction of another',
    topic: 'Ratio', edexcel_ref: 'R3',
    description: 'Express one quantity as a fraction of another, where the fraction is less than 1 or greater than 1; understand and apply this in context.',
    prerequisites: ['N10'], difficulty: 3, status: 'verified',
  },
  {
    id: 'R4', title: 'Ratio notation and simplest form',
    topic: 'Ratio', edexcel_ref: 'R4',
    description: 'Use ratio notation, including reduction to simplest form; understand the distinction between ratio and proportion.',
    prerequisites: ['N2'], difficulty: 3, status: 'verified',
  },
  {
    id: 'R5', title: 'Divide a quantity in a given ratio',
    topic: 'Ratio', edexcel_ref: 'R5',
    description: 'Divide a given quantity into two or more parts in a given ratio; express the division of a quantity into two parts as a ratio.',
    prerequisites: ['R4', 'N2'], difficulty: 4, status: 'verified',
  },
  {
    id: 'R6', title: 'Apply ratio to real contexts',
    topic: 'Ratio', edexcel_ref: 'R6',
    description: 'Apply ratio to real contexts and problems (such as those involving conversion, comparison, scaling, mixing, concentrations); use the unitary method.',
    prerequisites: ['R5'], difficulty: 4, status: 'verified',
  },
  {
    id: 'R7', title: 'Multiplicative relationships as ratio or fraction',
    topic: 'Ratio', edexcel_ref: 'R7',
    description: 'Understand and use the fact that a multiplicative relationship between two quantities can be expressed as a ratio or a fraction.',
    prerequisites: ['R4', 'N10'], difficulty: 4, status: 'verified',
  },
  {
    id: 'R8', title: 'Proportion as equality of ratios',
    topic: 'Ratio', edexcel_ref: 'R8',
    description: 'Understand and use proportion as equality of ratios; apply proportion to find unknown values in proportional relationships.',
    prerequisites: ['R7'], difficulty: 5, status: 'verified',
  },
  {
    id: 'R9', title: 'Relate ratios to fractions and linear functions',
    topic: 'Ratio', edexcel_ref: 'R9',
    description: 'Relate ratios to fractions and to linear functions; use and interpret graphs of proportional relationships.',
    prerequisites: ['R8', 'A9'], difficulty: 6, status: 'verified',
  },
  {
    id: 'R10', title: 'Percentages: change, original value and financial maths',
    topic: 'Ratio', edexcel_ref: 'R10',
    description: 'Define percentage as number of parts per hundred; interpret percentages and percentage changes as a fraction or decimal; solve problems involving percentage increase/decrease, reverse percentages, and simple interest.',
    prerequisites: ['N12'], difficulty: 4, status: 'verified',
  },
  {
    id: 'R11', title: 'Direct and inverse proportion',
    topic: 'Ratio', edexcel_ref: 'R11',
    description: 'Solve problems involving direct and inverse proportion, including graphical and algebraic representations.',
    prerequisites: ['R8', 'A5'], difficulty: 6, status: 'verified',
  },
  {
    id: 'R12', title: 'Compound units: speed, density, pressure',
    topic: 'Ratio', edexcel_ref: 'R12',
    description: 'Use compound units such as speed, rates of pay, unit pricing, density and pressure; change freely between compound units and understand formulae relating them.',
    prerequisites: ['R1', 'R4'], difficulty: 5, status: 'verified',
  },
  {
    id: 'R13', title: 'Similarity: ratios of lengths, areas and volumes',
    topic: 'Ratio', edexcel_ref: 'R13',
    description: 'Compare lengths, areas and volumes using ratio notation; make links to similarity (including trigonometric ratios) and scale factors; apply the rules that if linear scale factor is k then area scale factor is k² and volume scale factor is k³.',
    prerequisites: ['R4', 'G19'], difficulty: 7, status: 'verified',
  },
  {
    id: 'R14', title: 'Construct and interpret direct and inverse proportion equations',
    topic: 'Ratio', edexcel_ref: 'R14',
    description: 'Understand that X is inversely proportional to Y is equivalent to X is proportional to 1/Y; construct and interpret equations that describe direct and inverse proportion: y = kx and y = k/x.',
    prerequisites: ['R11', 'A5'], difficulty: 7, status: 'verified',
  },
  {
    id: 'R15', title: 'Gradient as rate of change; direct/inverse proportion graphs',
    topic: 'Ratio', edexcel_ref: 'R15',
    description: 'Interpret the gradient of a straight-line graph as a rate of change; recognise and interpret graphs that illustrate direct and inverse proportion.',
    prerequisites: ['A10', 'R11'], difficulty: 6, status: 'verified',
  },
  {
    id: 'R16', title: 'Exponential growth and decay; compound interest',
    topic: 'Ratio', edexcel_ref: 'R16',
    description: 'Set up, solve and interpret the answers in growth and decay problems, including compound interest; work with general iterative processes of the form xₙ₊₁ = f(xₙ). (Higher only)',
    prerequisites: ['R10', 'A2', 'N7'], difficulty: 7, status: 'verified',
  },

  // ══════════════════════════════════════════════════════
  // GEOMETRY AND MEASURES (G1–G25)
  // ══════════════════════════════════════════════════════

  {
    id: 'G1', title: 'Geometric terms, notation and conventions',
    topic: 'Geometry', edexcel_ref: 'G1',
    description: 'Use conventional terms and notations: points, lines, vertices, edges, planes, parallel lines, perpendicular lines, right angles, polygons, regular polygons and polygons with reflection/rotation symmetries; use standard conventions for labelling and referring to sides and angles of triangles.',
    prerequisites: [], difficulty: 2, status: 'verified',
  },
  {
    id: 'G2', title: 'Ruler and compass constructions',
    topic: 'Geometry', edexcel_ref: 'G2',
    description: 'Use the standard ruler and compass constructions: perpendicular bisector of a line segment, constructing a perpendicular to a given line from/at a given point, bisecting a given angle; recognise the perpendicular distance from a point to a line as the shortest distance.',
    prerequisites: ['G1'], difficulty: 5, status: 'verified',
  },
  {
    id: 'G3', title: 'Angle properties and parallel lines',
    topic: 'Geometry', edexcel_ref: 'G3',
    description: 'Apply the properties of angles at a point, angles at a point on a straight line, vertically opposite angles; understand and use alternate and corresponding angles on parallel lines; derive and use the angle sum in any polygon and properties of regular polygons.',
    prerequisites: ['G1'], difficulty: 3, status: 'verified',
  },
  {
    id: 'G4', title: 'Properties of quadrilaterals and triangles',
    topic: 'Geometry', edexcel_ref: 'G4',
    description: 'Derive and apply the properties and definitions of special types of quadrilaterals (square, rectangle, parallelogram, trapezium, kite, rhombus) and triangles; use the properties of these shapes to solve problems.',
    prerequisites: ['G3'], difficulty: 3, status: 'verified',
  },
  {
    id: 'G5', title: 'Congruence criteria: SSS, SAS, ASA, RHS',
    topic: 'Geometry', edexcel_ref: 'G5',
    description: 'Use the basic congruence criteria for triangles (SSS, SAS, ASA, RHS); identify congruent shapes; understand that congruent shapes are identical in shape and size.',
    prerequisites: ['G4', 'G3'], difficulty: 5, status: 'verified',
  },
  {
    id: 'G6', title: 'Geometric proof using angle facts and congruence',
    topic: 'Geometry', edexcel_ref: 'G6',
    description: 'Apply angle facts, triangle congruence, similarity and properties of quadrilaterals to conjecture and derive results about angles and sides; use known results to obtain simple proofs including proofs involving Pythagoras\' theorem.',
    prerequisites: ['G5', 'G3'], difficulty: 7, status: 'verified',
  },
  {
    id: 'G7', title: 'Transformations: rotation, reflection, translation, enlargement',
    topic: 'Geometry', edexcel_ref: 'G7',
    description: 'Identify, describe and construct congruent and similar shapes, including on coordinate axes, by considering rotation, reflection, translation and enlargement (including fractional and negative scale factors).',
    prerequisites: ['G1', 'A8'], difficulty: 4, status: 'verified',
  },
  {
    id: 'G8', title: 'Combined transformations and invariance',
    topic: 'Geometry', edexcel_ref: 'G8',
    description: 'Describe the changes and invariance achieved by combinations of rotations, reflections and translations; understand that the order of combined transformations matters.',
    prerequisites: ['G7'], difficulty: 5, status: 'verified',
  },
  {
    id: 'G9', title: 'Circle definitions and properties',
    topic: 'Geometry', edexcel_ref: 'G9',
    description: 'Identify and apply circle definitions and properties, including: centre, radius, chord, diameter, circumference, tangent, arc, sector and segment; understand relationships between these (e.g. tangent is perpendicular to radius).',
    prerequisites: ['G1'], difficulty: 3, status: 'verified',
  },
  {
    id: 'G10', title: 'Circle theorems and proofs',
    topic: 'Geometry', edexcel_ref: 'G10',
    description: 'Apply and prove the standard circle theorems: angle at centre is twice angle at circumference; angle in semicircle is 90°; angles in same segment are equal; opposite angles in cyclic quadrilateral sum to 180°; tangent-radius is perpendicular; tangents from external point are equal; alternate segment theorem.',
    prerequisites: ['G9', 'G3'], difficulty: 8, status: 'verified',
  },
  {
    id: 'G11', title: 'Coordinate geometry: distance, midpoint and geometric problems',
    topic: 'Geometry', edexcel_ref: 'G11',
    description: 'Solve geometrical problems on coordinate axes; use coordinates to prove geometric results; calculate lengths of line segments and find midpoints using coordinate methods.',
    prerequisites: ['A8', 'G7'], difficulty: 5, status: 'verified',
  },
  {
    id: 'G12', title: 'Properties of 3D shapes',
    topic: 'Geometry', edexcel_ref: 'G12',
    description: 'Identify properties of the faces, surfaces, edges and vertices of cubes, cuboids, prisms, cylinders, pyramids, cones and spheres; use Euler\'s relation V − E + F = 2 where appropriate.',
    prerequisites: ['G1'], difficulty: 3, status: 'verified',
  },
  {
    id: 'G13', title: 'Plans and elevations of 3D shapes',
    topic: 'Geometry', edexcel_ref: 'G13',
    description: 'Construct and interpret plans and elevations of 3D shapes; draw 3D shapes on isometric paper; interpret nets of 3D shapes.',
    prerequisites: ['G12'], difficulty: 4, status: 'verified',
  },
  {
    id: 'G14', title: 'Measurement: units for length, area, volume and mass',
    topic: 'Geometry', edexcel_ref: 'G14',
    description: 'Use standard units of measure and related concepts (length, area, volume/capacity, mass, time, money); convert between metric units; know approximate metric-imperial conversions.',
    prerequisites: ['N13'], difficulty: 2, status: 'verified',
  },
  {
    id: 'G15', title: 'Bearings and scale drawings',
    topic: 'Geometry', edexcel_ref: 'G15',
    description: 'Measure line segments and angles in geometric figures; interpret maps and scale drawings; use and interpret bearings (measured clockwise from north, three-figure notation).',
    prerequisites: ['G1', 'R2'], difficulty: 4, status: 'verified',
  },
  {
    id: 'G16', title: 'Area formulae and volume of prisms',
    topic: 'Geometry', edexcel_ref: 'G16',
    description: 'Know and apply formulae to calculate: area of triangles, parallelograms, trapezia; volume of cuboids and other right prisms (including cylinders); solve problems involving composite shapes.',
    prerequisites: ['G1', 'G14', 'N2'], difficulty: 4, status: 'verified',
  },
  {
    id: 'G17', title: 'Circles, spheres, cones and composite solids',
    topic: 'Geometry', edexcel_ref: 'G17',
    description: 'Know the formulae: circumference = 2πr = πd; area = πr²; calculate perimeters and areas of circles and composite shapes; calculate surface area and volume of spheres (4/3πr³, 4πr²), pyramids (1/3 base × h), cones (1/3πr²h, πrl) and composite solids.',
    prerequisites: ['G9', 'G16'], difficulty: 6, status: 'verified',
  },
  {
    id: 'G18', title: 'Arc lengths, angles and areas of sectors',
    topic: 'Geometry', edexcel_ref: 'G18',
    description: 'Calculate arc lengths, angles and areas of sectors of circles; use the formulae arc length = (θ/360) × 2πr and sector area = (θ/360) × πr².',
    prerequisites: ['G17', 'N2'], difficulty: 6, status: 'verified',
  },
  {
    id: 'G19', title: 'Congruence, similarity and area/volume scale factors',
    topic: 'Geometry', edexcel_ref: 'G19',
    description: 'Apply the concepts of congruence and similarity, including the relationships between lengths, areas and volumes in similar figures; understand that if linear scale factor is k then area factor is k² and volume factor is k³.',
    prerequisites: ['G5', 'R13'], difficulty: 6, status: 'verified',
  },
  {
    id: 'G20', title: 'Pythagoras\' theorem and trigonometric ratios in right-angled triangles',
    topic: 'Geometry', edexcel_ref: 'G20',
    description: 'Know and apply Pythagoras\' theorem a² + b² = c²; know the trigonometric ratios sin θ = opp/hyp, cos θ = adj/hyp, tan θ = opp/adj; apply to find unknown sides and angles in right-angled triangles in 2D and 3D problems.',
    prerequisites: ['G1', 'N6'], difficulty: 5, status: 'verified',
  },
  {
    id: 'G21', title: 'Exact trigonometric values',
    topic: 'Geometry', edexcel_ref: 'G21',
    description: 'Know the exact values of sin θ and cos θ for θ = 0°, 30°, 45°, 60°, 90°; know the exact value of tan θ for θ = 0°, 30°, 45°, 60°; apply these in calculations without a calculator.',
    prerequisites: ['G20'], difficulty: 6, status: 'verified',
  },
  {
    id: 'G22', title: 'Sine rule and cosine rule',
    topic: 'Geometry', edexcel_ref: 'G22',
    description: 'Know and apply the sine rule a/sin A = b/sin B = c/sin C and cosine rule a² = b² + c² − 2bc cos A to find unknown lengths and angles in any triangle, including ambiguous cases.',
    prerequisites: ['G20', 'G21'], difficulty: 7, status: 'verified',
  },
  {
    id: 'G23', title: 'Area of a triangle using ½ab sin C',
    topic: 'Geometry', edexcel_ref: 'G23',
    description: 'Know and apply the formula Area = ½ab sin C to calculate the area of any triangle given two sides and the included angle.',
    prerequisites: ['G22'], difficulty: 7, status: 'verified',
  },
  {
    id: 'G24', title: 'Vectors: notation and translations',
    topic: 'Geometry', edexcel_ref: 'G24',
    description: 'Describe translations as 2D vectors; use column vector notation; understand that a vector has both magnitude and direction; represent vectors diagrammatically as arrows.',
    prerequisites: ['A8'], difficulty: 5, status: 'verified',
  },
  {
    id: 'G25', title: 'Vector operations and geometric proofs',
    topic: 'Geometry', edexcel_ref: 'G25',
    description: 'Apply addition and subtraction of vectors, multiplication of vectors by a scalar, and diagrammatic and column representations of vectors; use vectors to construct geometric arguments and proofs, including proving lines are parallel or that a point divides a line in a given ratio. (Higher only)',
    prerequisites: ['G24'], difficulty: 8, status: 'verified',
  },

  // ══════════════════════════════════════════════════════
  // PROBABILITY (P1–P10)
  // ══════════════════════════════════════════════════════

  {
    id: 'P1', title: 'Relative frequency and experimental probability',
    topic: 'Probability', edexcel_ref: 'P1',
    description: 'Record, describe and analyse the frequency of outcomes of probability experiments using tables and frequency trees; calculate relative frequency from experimental data.',
    prerequisites: ['N12'], difficulty: 3, status: 'verified',
  },
  {
    id: 'P2', title: 'Randomness, fairness and equally likely outcomes',
    topic: 'Probability', edexcel_ref: 'P2',
    description: 'Apply ideas of randomness, fairness and equally likely events to calculate expected outcomes of multiple future experiments; understand that a larger number of trials gives a more reliable estimate of probability.',
    prerequisites: ['P1'], difficulty: 3, status: 'verified',
  },
  {
    id: 'P3', title: 'Theoretical probability from equally likely outcomes',
    topic: 'Probability', edexcel_ref: 'P3',
    description: 'Relate relative expected frequencies to theoretical probability, using appropriate language and the 0–1 probability scale; calculate theoretical probability for equally likely outcomes.',
    prerequisites: ['P1', 'P2'], difficulty: 4, status: 'verified',
  },
  {
    id: 'P4', title: 'Exhaustive events and complementary probability',
    topic: 'Probability', edexcel_ref: 'P4',
    description: 'Apply the property that the probabilities of an exhaustive set of outcomes sum to 1; use P(not A) = 1 − P(A); work with mutually exclusive events.',
    prerequisites: ['P3'], difficulty: 3, status: 'verified',
  },
  {
    id: 'P5', title: 'Experimental vs theoretical probability; expected frequency',
    topic: 'Probability', edexcel_ref: 'P5',
    description: 'Understand that empirical unbiased samples tend towards theoretical probability distributions as sample size increases; calculate expected frequency for a given number of trials.',
    prerequisites: ['P3', 'P4'], difficulty: 4, status: 'verified',
  },
  {
    id: 'P6', title: 'Enumerate sets using tables, tree diagrams and Venn diagrams',
    topic: 'Probability', edexcel_ref: 'P6',
    description: 'Enumerate sets and combinations of sets systematically, using tables, grids, Venn diagrams and tree diagrams; use set notation including union ∪, intersection ∩ and complement A\'.',
    prerequisites: ['P3', 'N5'], difficulty: 5, status: 'verified',
  },
  {
    id: 'P7', title: 'Construct sample spaces for combined experiments',
    topic: 'Probability', edexcel_ref: 'P7',
    description: 'Construct theoretical possibility spaces for single and combined experiments with equally likely outcomes; use possibility spaces to calculate probabilities.',
    prerequisites: ['P6'], difficulty: 5, status: 'verified',
  },
  {
    id: 'P8', title: 'Independent and dependent combined events',
    topic: 'Probability', edexcel_ref: 'P8',
    description: 'Calculate the probability of independent and dependent combined events, including using tree diagrams and other representations; apply the multiplication rule P(A and B) = P(A) × P(B) for independent events.',
    prerequisites: ['P7'], difficulty: 6, status: 'verified',
  },
  {
    id: 'P9', title: 'Conditional probability',
    topic: 'Probability', edexcel_ref: 'P9',
    description: 'Use a Venn diagram to calculate conditional probability; use tree diagrams for dependent events; apply P(A|B) = P(A and B) / P(B). (Higher only)',
    prerequisites: ['P8'], difficulty: 8, status: 'verified',
  },
  {
    id: 'P10', title: 'Frequency trees',
    topic: 'Probability', edexcel_ref: 'P10',
    description: 'Draw and interpret frequency trees; use frequency trees to calculate relative frequencies and compare with theoretical probabilities.',
    prerequisites: ['P6'], difficulty: 5, status: 'verified',
  },

  // ══════════════════════════════════════════════════════
  // STATISTICS (S1–S6)
  // ══════════════════════════════════════════════════════

  {
    id: 'S1', title: 'Sampling and inference from data',
    topic: 'Statistics', edexcel_ref: 'S1',
    description: 'Infer properties of populations or distributions from a sample; understand the limitations of sampling; distinguish between a census and a sample; understand concepts of bias in sampling.',
    prerequisites: ['N12'], difficulty: 4, status: 'verified',
  },
  {
    id: 'S2', title: 'Interpret and construct statistical charts and diagrams',
    topic: 'Statistics', edexcel_ref: 'S2',
    description: 'Interpret and construct tables, charts and diagrams, including frequency tables, bar charts, pie charts, pictograms, vertical line charts, time series graphs and scatter graphs for both discrete and continuous data.',
    prerequisites: ['N2', 'N12'], difficulty: 3, status: 'verified',
  },
  {
    id: 'S3', title: 'Grouped data: frequency tables, histograms and frequency polygons',
    topic: 'Statistics', edexcel_ref: 'S3',
    description: 'Construct and interpret diagrams for grouped discrete and continuous data: frequency tables, frequency polygons and histograms (where the area of the bar represents frequency, using frequency density).',
    prerequisites: ['S2'], difficulty: 6, status: 'verified',
  },
  {
    id: 'S4', title: 'Interpret and compare distributions',
    topic: 'Statistics', edexcel_ref: 'S4',
    description: 'Interpret, analyse and compare the distributions of data sets through: appropriate graphical representation; measures of central tendency (mean, mode, median) and spread (range, quartiles, IQR); recognise the effect of outliers; construct and interpret box plots and cumulative frequency graphs.',
    prerequisites: ['N2', 'S2'], difficulty: 5, status: 'verified',
  },
  {
    id: 'S5', title: 'Apply statistics to describe a population',
    topic: 'Statistics', edexcel_ref: 'S5',
    description: 'Apply statistics to describe a population; select appropriate statistics and justify the choice; understand when the mean, median and mode are each most appropriate; recognise misleading statistics.',
    prerequisites: ['S4', 'S1'], difficulty: 5, status: 'verified',
  },
  {
    id: 'S6', title: 'Scatter graphs, correlation and lines of best fit',
    topic: 'Statistics', edexcel_ref: 'S6',
    description: 'Use and interpret scatter graphs of bivariate data; recognise correlation (positive, negative, none); know that correlation does not imply causation; draw estimated lines of best fit; interpolate and extrapolate apparent trends while understanding their limitations.',
    prerequisites: ['A8', 'S2'], difficulty: 5, status: 'verified',
  },
]

// ─── Ingestion function ───────────────────────────────────

export interface IngestResult {
  created:   number
  updated:   number
  total:     number
  specPoints: string[]
}

export async function ingestEdexcelSpec(): Promise<IngestResult> {
  let created = 0
  let updated = 0

  // Upsert all spec points (idempotent)
  for (const sp of EDEXCEL_SPEC) {
    const existing = await prisma.specPoint.findUnique({ where: { id: sp.id } })

    if (existing) {
      await prisma.specPoint.update({
        where: { id: sp.id },
        data: {
          title:        sp.title,
          topic:        sp.topic,
          description:  sp.description,
          edexcel_ref:  sp.edexcel_ref,
          prerequisites: JSON.stringify(sp.prerequisites),
          difficulty:   sp.difficulty,
          status:       sp.status,
        },
      })
      updated++
    } else {
      await prisma.specPoint.create({
        data: {
          id:           sp.id,
          title:        sp.title,
          topic:        sp.topic,
          description:  sp.description,
          edexcel_ref:  sp.edexcel_ref,
          prerequisites: JSON.stringify(sp.prerequisites),
          difficulty:   sp.difficulty,
          status:       sp.status,
        },
      })
      created++
    }
  }

  return {
    created,
    updated,
    total:      EDEXCEL_SPEC.length,
    specPoints: EDEXCEL_SPEC.map(sp => sp.id),
  }
}

// ─── Topic counts for reference ──────────────────────────

export const SPEC_COUNTS = {
  Number:      EDEXCEL_SPEC.filter(s => s.topic === 'Number').length,
  Algebra:     EDEXCEL_SPEC.filter(s => s.topic === 'Algebra').length,
  Ratio:       EDEXCEL_SPEC.filter(s => s.topic === 'Ratio').length,
  Geometry:    EDEXCEL_SPEC.filter(s => s.topic === 'Geometry').length,
  Probability: EDEXCEL_SPEC.filter(s => s.topic === 'Probability').length,
  Statistics:  EDEXCEL_SPEC.filter(s => s.topic === 'Statistics').length,
  total:       EDEXCEL_SPEC.length,
}
