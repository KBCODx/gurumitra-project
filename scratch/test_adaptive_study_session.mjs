// Using global fetch available in Node.js

async function runTests() {
  console.log('====================================================');
  console.log('🧪 TESTING ADAPTIVE STUDY SESSION & API GENERATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function testCase(name, fn) {
    try {
      process.stdout.write(`• ${name}... `);
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err) {
      console.log('❌ FAILED:', err.message);
      failed++;
    }
  }

  const BASE_URL = 'http://localhost:3009';

  // Test 1: Math Nature of Roots Generation
  await testCase('Generate lesson for Math - Nature of Roots (Weak student)', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/adaptive-lesson/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classLevel: '10th',
        board: 'CBSE',
        subject: 'Mathematics',
        chapter: 'Quadratic Equations',
        topic: 'Nature of Roots',
        studentLevel: 'Weak',
        allocatedMinutes: 45
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json?.lesson) throw new Error('No lesson object in response');

    const lesson = json.lesson;
    if (lesson.topic !== 'Nature of Roots') throw new Error(`Unexpected topic: ${lesson.topic}`);
    if (lesson.subject !== 'Mathematics') throw new Error(`Unexpected subject: ${lesson.subject}`);
    if (lesson.subtopics.length < 5) throw new Error(`Expected at least 5 subtopics, got ${lesson.subtopics.length}`);
    if (lesson.questions.length < 10) throw new Error(`Expected >= 10 questions, got ${lesson.questions.length}`);
    if (lesson.summary.length < 3) throw new Error(`Expected >= 3 summary items, got ${lesson.summary.length}`);
    if (lesson.practice_questions.length < 4) throw new Error(`Expected >= 4 practice questions, got ${lesson.practice_questions.length}`);

    // Verify 10 questions have valid options and explanations
    for (let i = 0; i < lesson.questions.length; i++) {
      const q = lesson.questions[i];
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`Question ${i + 1} has invalid options format`);
      }
      if (typeof q.correctOptionIndex !== 'number' || q.correctOptionIndex < 0 || q.correctOptionIndex > 3) {
        throw new Error(`Question ${i + 1} has invalid correctOptionIndex: ${q.correctOptionIndex}`);
      }
      if (!q.explanation || q.explanation.length < 10) {
        throw new Error(`Question ${i + 1} missing detailed explanation`);
      }
    }
  });

  // Test 2: Difficulty adaptation (Strong vs Weak)
  await testCase('Differentiate pedagogical depth between Weak and Strong student', async () => {
    const resWeak = await fetch(`${BASE_URL}/api/ai/adaptive-lesson/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classLevel: '10th',
        board: 'CBSE',
        subject: 'Mathematics',
        chapter: 'Quadratic Equations',
        topic: 'Nature of Roots',
        studentLevel: 'Weak'
      })
    });
    const jsonWeak = await resWeak.json();

    const resStrong = await fetch(`${BASE_URL}/api/ai/adaptive-lesson/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classLevel: '10th',
        board: 'CBSE',
        subject: 'Mathematics',
        chapter: 'Quadratic Equations',
        topic: 'Nature of Roots',
        studentLevel: 'Strong'
      })
    });
    const jsonStrong = await resStrong.json();

    if (jsonWeak.lesson.difficulty_level !== 'Beginner') {
      throw new Error(`Expected Weak level to map to Beginner, got ${jsonWeak.lesson.difficulty_level}`);
    }
    if (jsonStrong.lesson.difficulty_level !== 'Advanced') {
      throw new Error(`Expected Strong level to map to Advanced, got ${jsonStrong.lesson.difficulty_level}`);
    }
  });

  // Test 3: Science Topic Generation (Chemical Reactions and Equations)
  await testCase('Generate lesson for Science - Chemical Reactions and Equations', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/adaptive-lesson/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classLevel: '10th',
        board: 'CBSE',
        subject: 'Science',
        chapter: 'Chemical Reactions and Equations',
        topic: 'Chemical Reactions and Equations',
        studentLevel: 'Average',
        allocatedMinutes: 30
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const lesson = json.lesson;
    if (lesson.subject !== 'Science') throw new Error(`Unexpected subject: ${lesson.subject}`);
    if (lesson.subtopics.length < 5) throw new Error(`Too few subtopics: ${lesson.subtopics.length}`);
    if (lesson.questions.length < 10) throw new Error(`Expected >= 10 questions, got ${lesson.questions.length}`);
  });

  // Test 4: English Topic Generation (Tenses)
  await testCase('Generate lesson for English - Tenses', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/adaptive-lesson/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classLevel: '10th',
        board: 'CBSE',
        subject: 'English',
        chapter: 'Tenses',
        topic: 'Tenses',
        studentLevel: 'Average',
        allocatedMinutes: 30
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const lesson = json.lesson;
    if (lesson.subject !== 'English') throw new Error(`Unexpected subject: ${lesson.subject}`);
    if (lesson.questions.length < 10) throw new Error(`Expected >= 10 questions, got ${lesson.questions.length}`);
  });

  // Test 5: Question Difficulty Distribution
  await testCase('Verify question difficulty distribution across 10 questions', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/adaptive-lesson/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classLevel: '10th',
        board: 'CBSE',
        subject: 'Mathematics',
        chapter: 'Quadratic Equations',
        topic: 'Nature of Roots',
        studentLevel: 'Average'
      })
    });
    const json = await res.json();
    const questions = json.lesson.questions;
    const easy = questions.filter(q => q.difficulty === 'easy').length;
    const moderate = questions.filter(q => q.difficulty === 'moderate').length;
    const hard = questions.filter(q => q.difficulty === 'hard').length;

    console.log(`\n    Distribution: ${easy} Easy, ${moderate} Moderate, ${hard} Hard (Total ${questions.length})`);
    if (easy < 2) throw new Error('Too few easy questions');
    if (moderate < 2) throw new Error('Too few moderate questions');
    if (hard < 1) throw new Error('Too few hard questions');
  });

  console.log('\n====================================================');
  console.log(`📊 SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
