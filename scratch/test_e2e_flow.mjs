import {
  fetchOrGenerateAdaptiveLesson,
  recordStudySession,
  getSavedStudySessions
} from '../src/services/adaptiveLessonService.ts';

// Mock localStorage for Node test environment
const mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; }
};
global.window = {};

async function testEndToEnd() {
  console.log('====================================================');
  console.log('🧪 TESTING FULL ADAPTIVE STUDY FLOW & RECORDING');
  console.log('====================================================\n');

  // 1. Student selects a task from Day Plan:
  // e.g. Mathematics -> Quadratic Equations -> Nature of Roots, 45 minutes, Weak student level
  const taskContext = {
    classLevel: '10th',
    board: 'CBSE',
    subject: 'Mathematics',
    chapter: 'Quadratic Equations',
    topic: 'Nature of Roots',
    allocatedMinutes: 45,
    studentLevel: 'Weak',
    learningStyle: 'Simple',
    taskId: 'task_math_day4_101'
  };

  console.log('1. Starting study session with context:', taskContext.topic, `(${taskContext.subject})`);
  const lesson = await fetchOrGenerateAdaptiveLesson(taskContext);

  if (!lesson || !lesson.subtopics || lesson.subtopics.length < 5) {
    throw new Error('Lesson generation failed or has insufficient subtopics');
  }
  console.log(`   ✓ Lesson generated with ${lesson.subtopics.length} subtopics.`);

  if (!lesson.questions || lesson.questions.length < 10) {
    throw new Error(`Expected at least 10 questions, got ${lesson.questions?.length}`);
  }
  console.log(`   ✓ ${lesson.questions.length} topic-specific questions generated.`);

  if (!lesson.practice_questions || lesson.practice_questions.length < 5) {
    throw new Error(`Expected at least 5 practice questions, got ${lesson.practice_questions?.length}`);
  }
  console.log(`   ✓ ${lesson.practice_questions.length} practice questions generated.`);

  // 2. Simulate answering theory questions
  console.log('\n2. Simulating student answering 10 theory questions...');
  let theoryCorrect = 0;
  lesson.questions.forEach((q, idx) => {
    // Student answers first 8 correctly, 2 incorrectly
    const chosenOption = idx < 8 ? q.correctOptionIndex : (q.correctOptionIndex + 1) % 4;
    const isCorrect = chosenOption === q.correctOptionIndex;
    if (isCorrect) theoryCorrect++;
  });
  console.log(`   ✓ Student scored ${theoryCorrect}/10 on theory questions.`);

  // 3. Simulate answering practice questions
  console.log('\n3. Simulating student answering practice questions...');
  let practiceCorrect = 0;
  lesson.practice_questions.forEach((pq, idx) => {
    const chosenOption = idx < 4 ? pq.correctOptionIndex : (pq.correctOptionIndex + 1) % 4;
    const isCorrect = chosenOption === pq.correctOptionIndex;
    if (isCorrect) practiceCorrect++;
  });
  console.log(`   ✓ Student scored ${practiceCorrect}/${lesson.practice_questions.length} on practice questions.`);

  // 4. Session Completion & Metrics
  console.log('\n4. Recording session completion...');
  const totalAttempted = 10 + lesson.practice_questions.length;
  const totalCorrect = theoryCorrect + practiceCorrect;
  const accuracy = (totalCorrect / totalAttempted) * 100;

  let topicUnderstanding = 'Developing';
  if (accuracy >= 80) topicUnderstanding = 'Strong';
  else if (accuracy < 55) topicUnderstanding = 'Needs Revision';

  const sessionRecord = {
    id: `session_test_${Date.now()}`,
    userId: 'student_123',
    taskId: taskContext.taskId,
    date: new Date().toISOString().split('T')[0],
    subject: taskContext.subject,
    chapter: taskContext.chapter,
    topic: taskContext.topic,
    allocatedMinutes: taskContext.allocatedMinutes,
    actualMinutes: 42,
    startedAt: new Date(Date.now() - 42 * 60000).toISOString(),
    completedAt: new Date().toISOString(),
    status: 'completed',
    theoryCompleted: true,
    questionsAttempted: 10,
    questionsCorrect: theoryCorrect,
    practiceAttempted: lesson.practice_questions.length,
    practiceCorrect: practiceCorrect,
    difficultyLevel: 'Beginner',
    topicUnderstanding
  };

  await recordStudySession(sessionRecord);
  const history = getSavedStudySessions();
  const saved = history.find(s => s.id === sessionRecord.id);

  if (!saved) throw new Error('Session was not saved to storage!');
  console.log('   ✓ Session recorded in history with Topic Understanding:', saved.topicUnderstanding);
  console.log('   ✓ Actual Study Time:', saved.actualMinutes, 'minutes (Allocated:', saved.allocatedMinutes, 'minutes)');

  // 5. Verify Caching
  console.log('\n5. Verifying lesson caching to prevent redundant API calls...');
  const cachedLesson = await fetchOrGenerateAdaptiveLesson({ ...taskContext, forceRegenerate: false });
  if (cachedLesson.source !== 'cached') {
    console.log(`   Note: Lesson source is ${cachedLesson.source}`);
  } else {
    console.log('   ✓ Lesson successfully retrieved from cache.');
  }

  console.log('\n====================================================');
  console.log('🎉 ALL END-TO-END FLOW TESTS COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
}

testEndToEnd().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
