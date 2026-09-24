import assert from 'node:assert';
import { cleanExtractedText, extractChaptersFromText, cleanChapterTitle } from '../src/lib/aiSyllabusParser.ts';
import { generateDeterministicStudyPlan } from '../src/services/deterministicSchedulingService.ts';

console.log('🧪 Starting Maths Syllabus & Topic Ingestion Test Suite...');

// ============================================================================
// TEST 1: Maths Syllabus Chapter Extraction with Periods, Units, Marks
// ============================================================================
const mathsSyllabusText = `
CBSE MATHEMATICS (CODE No. 041)
COURSE STRUCTURE CLASS X
Units Unit Name Marks
I NUMBER SYSTEMS 06
II ALGEBRA 20
III COORDINATE GEOMETRY 06
IV GEOMETRY 15
V TRIGONOMETRY 12
VI MENSURATION 10
VII STATISTICS & PROBABILITY 11
Total 80

UNIT I: NUMBER SYSTEMS
1. REAL NUMBERS (15) Periods
Fundamental Theorem of Arithmetic - statements after reviewing work done earlier and after illustrating and motivating through examples, Proofs of irrationality of √2, √3, √5.

UNIT II: ALGEBRA
1. POLYNOMIALS (10) Periods
Zeros of a polynomial. Relationship between zeros and coefficients of quadratic polynomials.
2. PAIR OF LINEAR EQUATIONS IN TWO VARIABLES (15) Periods
Pair of linear equations in two variables and graphical method of their solution, consistency/inconsistency.
3. QUADRATIC EQUATIONS (15 Periods)
Standard form of a quadratic equation ax² + bx + c = 0, (a ≠ 0). Solutions of quadratic equations.
4. ARITHMETIC PROGRESSIONS (10 Periods)
Motivation for studying Arithmetic Progression, nth term and sum of the first n terms of A.P.

UNIT III: COORDINATE GEOMETRY
Coordinate Geometry (15 Periods)
Review: Concepts of coordinate geometry, graphs of linear equations. Distance formula. Section formula.

UNIT IV: GEOMETRY
1. TRIANGLES (15 Periods)
Definitions, examples, counter examples of similar triangles.
2. CIRCLES (10 Periods)
Tangent to a circle at, point of contact.

UNIT V: TRIGONOMETRY
1. INTRODUCTION TO TRIGONOMETRY (10 Periods)
Trigonometric ratios of an acute angle of a right-angled triangle.
2. TRIGONOMETRIC IDENTITIES (15 Periods)
Proof and applications of the identity sin²A + cos²A = 1.
3. HEIGHTS AND DISTANCES (10 Periods)
Simple problems on heights and distances.

UNIT VI: MENSURATION
1. AREAS RELATED TO CIRCLES (10 Periods)
Area of sectors and segments of a circle.
2. SURFACE AREAS AND VOLUMES (12 Periods)
Surface areas and volumes of combinations of any two of cubes, cuboids, spheres.

UNIT VII: STATISTICS AND PROBABILITY
1. STATISTICS (18 Periods)
Mean, median and mode of grouped data.
2. PROBABILITY (10 Periods)
Classical definition of probability.
`;

const cleanedMaths = cleanExtractedText(mathsSyllabusText);
const extractedMathChapters = extractChaptersFromText(cleanedMaths, 'Mathematics');

console.log('Extracted Maths Chapters count:', extractedMathChapters.length);
console.log('Extracted Maths Chapters:', extractedMathChapters);

assert.ok(extractedMathChapters.length >= 7, `Expected at least 7 Maths chapters, got ${extractedMathChapters.length}`);

// Verify core chapters are detected
const mathNamesLower = extractedMathChapters.map(c => c.toLowerCase());
assert.ok(mathNamesLower.some(c => c.includes('real number')), 'Missing Real Numbers chapter');
assert.ok(mathNamesLower.some(c => c.includes('polynomial')), 'Missing Polynomials chapter');
assert.ok(mathNamesLower.some(c => c.includes('quadratic equation')), 'Missing Quadratic Equations chapter');
assert.ok(mathNamesLower.some(c => c.includes('arithmetic progression')), 'Missing Arithmetic Progressions chapter');
assert.ok(mathNamesLower.some(c => c.includes('triangle')), 'Missing Triangles chapter');
assert.ok(mathNamesLower.some(c => c.includes('trigonometr')), 'Missing Trigonometry chapter');
assert.ok(mathNamesLower.some(c => c.includes('statistic') || c.includes('probability')), 'Missing Statistics/Probability chapter');

// Verify metadata boilerplate was not added as chapters
assert.ok(!mathNamesLower.some(c => c.includes('course structure')), 'Course structure should not be a chapter');
assert.ok(!mathNamesLower.some(c => c.includes('total 80')), 'Marks summary should not be a chapter');
assert.ok(!mathNamesLower.some(c => c.includes('periods')), 'Periods should have been stripped from chapter title');

console.log('✅ TEST 1 PASSED: Maths syllabus successfully extracted without errors.');

// ============================================================================
// TEST 2: Chapter-Wise Topic Ingestion & Daily Study Plan Scheduling
// ============================================================================
const customMathTopics = [
  'Proofs of irrationality of root 2 and root 3',
  'Euclid division lemma applications',
  'Decimal representation of rational numbers'
];

const customScienceTopics = [
  'Balancing redox reactions',
  'Corrosion and rancidity mechanisms',
  'Exothermic vs endothermic energy diagrams'
];

const customEnglishTopics = [
  'Lencho faith and irony analysis',
  'Formal letter to the editor format',
  'Metaphor and personification in Dust of Snow'
];

const planInput = {
  student: {
    id: 'student_test_1',
    name: 'Aarav Sharma',
    grade: 'Class 10',
    board: 'CBSE',
    academicYear: '2026-27'
  },
  examDate: '2026-11-20',
  startDate: '2026-10-01',
  selectedSubjects: ['Mathematics', 'Science', 'English'],
  selectedCurriculum: [
    {
      subject: 'Mathematics',
      chapters: [
        {
          chapterName: 'Real Numbers',
          topics: customMathTopics
        }
      ]
    },
    {
      subject: 'Science',
      chapters: [
        {
          chapterName: 'Chemical Reactions and Equations',
          topics: customScienceTopics
        }
      ]
    },
    {
      subject: 'English',
      chapters: [
        {
          chapterName: 'A Letter to God',
          topics: customEnglishTopics
        }
      ]
    }
  ],
  dailyMinutesBudget: 150
};

const generatedPlan = generateDeterministicStudyPlan(planInput);

assert.ok(generatedPlan, 'Plan should be generated');
assert.ok(generatedPlan.dailyPlans.length > 10, 'Should generate multiple days of study');

// Verify that the daily study plan tasks actually contain the custom chapter topics
const scheduledTopics = new Set();
generatedPlan.dailyPlans.forEach(dp => {
  dp.tasks.forEach(t => {
    scheduledTopics.add(t.topic);
  });
});

console.log('Sample scheduled task topics:', Array.from(scheduledTopics).slice(0, 8));

// Check custom topics in plan
customMathTopics.forEach(top => {
  assert.ok(scheduledTopics.has(top), `Plan must schedule custom topic: "${top}"`);
});

customScienceTopics.forEach(top => {
  assert.ok(scheduledTopics.has(top), `Plan must schedule custom topic: "${top}"`);
});

customEnglishTopics.forEach(top => {
  assert.ok(scheduledTopics.has(top), `Plan must schedule custom topic: "${top}"`);
});

console.log('✅ TEST 2 PASSED: Daily study plan scheduled exact custom chapter topics.');

// ============================================================================
// TEST 3: 3 Distinct Subjects Scheduled Daily with Custom Topics
// ============================================================================
const studyDays = generatedPlan.dailyPlans.filter(dp => !dp.isRestDay && !dp.isWeeklyTestDay && dp.tasks.length > 0);
assert.ok(studyDays.length > 0, 'Should have active study days');

studyDays.slice(0, 10).forEach(day => {
  const subjectsOnDay = new Set(day.tasks.map(t => t.subject));
  assert.strictEqual(
    subjectsOnDay.size,
    3,
    `Day ${day.date} must have 3 distinct subjects. Found: ${Array.from(subjectsOnDay).join(', ')}`
  );
});

console.log('✅ TEST 3 PASSED: Regular study days strictly contain 3 distinct subjects.');
console.log('🎉 All Maths syllabus & Chapter-wise Topic Ingestion tests passed cleanly!');
