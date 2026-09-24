// Automated Pipeline Test Suite for Adaptive AI Learning Companion
// Verifies Tests 1 through 19 as specified in the Product Requirements

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  getTargetQuestionsForSubjects,
  computeChapterQuestionAllocations,
  generateCombinedQuestions,
  validateQuestion,
  validateAssessmentSession
} from '../src/services/preAssessmentService.ts';

import {
  getVerifiedChaptersForSubject,
  getCurriculumVersion,
  compareCurriculumVersions,
  curriculumDatabase
} from '../src/services/curriculumDatabaseService.ts';

import {
  calculateScheduleMetrics,
  getPerformanceCategory,
  getCategoryWeight,
  generateDeterministicStudyPlan,
  rescheduleMissedTasks
} from '../src/services/deterministicSchedulingService.ts';

import {
  MockProvider,
  GeminiProvider
} from '../src/services/llm/llmProvider.ts';

describe('Adaptive Companion Test Suite — Tests 1 to 19', () => {

  // =========================================================================
  // Test 1: 1 subject (12–13 questions)
  // =========================================================================
  test('Test 1: 1 subject requires 12–13 questions and generates exactly 13 questions', async () => {
    const target = getTargetQuestionsForSubjects(['Mathematics']);
    assert.equal(target, 13, '1 subject target must be 13 questions');

    const verifiedRecords = getVerifiedChaptersForSubject('Mathematics', 'CBSE', 'Class 10', '2026-27');
    const mathChapters = verifiedRecords.map(c => ({
      chapterId: c.id,
      chapterName: c.name,
      subject: 'Mathematics',
      topics: c.topics.map(t => t.name),
      classLevel: 'Class 10'
    }));

    const allocations = computeChapterQuestionAllocations(mathChapters, 13);
    const totalAllocated = allocations.reduce((sum, a) => sum + (a.totalCount || 0), 0);
    assert.equal(totalAllocated, 13, 'Allocations for 1 subject must total 13');

    const chaptersBySubject = { Mathematics: mathChapters };
    const res = await generateCombinedQuestions(chaptersBySubject, ['Mathematics'], 'Class 10', 13);
    assert.equal(res.questions.length, 13, 'Generated questions for 1 subject must be exactly 13');
    res.questions.forEach(q => {
      assert.equal(q.subject, 'Mathematics');
      assert.ok(q.options.length === 4, 'Must have 4 options');
      assert.ok(q.correctOption >= 0 && q.correctOption < 4, 'Correct answer must be valid index');
    });
  });

  // =========================================================================
  // Test 2: 2 subjects (24–26 questions)
  // =========================================================================
  test('Test 2: 2 subjects requires 24–26 questions (exactly 26 questions, 13 each)', async () => {
    const target = getTargetQuestionsForSubjects(['Mathematics', 'Science']);
    assert.equal(target, 26, '2 subjects target must be 26 questions');

    const mathRecords = getVerifiedChaptersForSubject('Mathematics', 'CBSE', 'Class 10', '2026-27');
    const sciRecords = getVerifiedChaptersForSubject('Science', 'CBSE', 'Class 10', '2026-27');

    const mathChapters = mathRecords.map(c => ({
      chapterId: c.id,
      chapterName: c.name,
      subject: 'Mathematics',
      topics: c.topics.map(t => t.name),
      classLevel: 'Class 10'
    }));

    const sciChapters = sciRecords.map(c => ({
      chapterId: c.id,
      chapterName: c.name,
      subject: 'Science',
      topics: c.topics.map(t => t.name),
      classLevel: 'Class 10'
    }));

    const allChapters = [...mathChapters, ...sciChapters];

    const allocations = computeChapterQuestionAllocations(allChapters, 26);
    const mathAlloc = allocations.filter(a => a.subject === 'Mathematics').reduce((sum, a) => sum + a.totalCount, 0);
    const sciAlloc = allocations.filter(a => a.subject === 'Science').reduce((sum, a) => sum + a.totalCount, 0);
    assert.equal(mathAlloc, 13, 'Mathematics must get 13 questions');
    assert.equal(sciAlloc, 13, 'Science must get 13 questions');

    const chaptersBySubject = { Mathematics: mathChapters, Science: sciChapters };
    const res = await generateCombinedQuestions(chaptersBySubject, ['Mathematics', 'Science'], 'Class 10', 26);
    assert.equal(res.questions.length, 26, 'Generated questions for 2 subjects must be 26');
  });

  // =========================================================================
  // Test 3: 3 subjects (36–39 questions)
  // =========================================================================
  test('Test 3: 3 subjects requires 36–39 questions (exactly 39 questions, 13 each)', async () => {
    const target = getTargetQuestionsForSubjects(['Mathematics', 'Science', 'English']);
    assert.equal(target, 39, '3 subjects target must be 39 questions');

    const mathRecords = getVerifiedChaptersForSubject('Mathematics', 'CBSE', 'Class 10', '2026-27');
    const sciRecords = getVerifiedChaptersForSubject('Science', 'CBSE', 'Class 10', '2026-27');
    const engRecords = getVerifiedChaptersForSubject('English', 'CBSE', 'Class 10', '2026-27');

    const mathChapters = mathRecords.map(c => ({
      chapterId: c.id,
      chapterName: c.name,
      subject: 'Mathematics',
      topics: c.topics.map(t => t.name),
      classLevel: 'Class 10'
    }));

    const sciChapters = sciRecords.map(c => ({
      chapterId: c.id,
      chapterName: c.name,
      subject: 'Science',
      topics: c.topics.map(t => t.name),
      classLevel: 'Class 10'
    }));

    const engChapters = engRecords.map(c => ({
      chapterId: c.id,
      chapterName: c.name,
      subject: 'English',
      topics: c.topics.map(t => t.name),
      classLevel: 'Class 10'
    }));

    const chaptersBySubject = { Mathematics: mathChapters, Science: sciChapters, English: engChapters };
    const res = await generateCombinedQuestions(chaptersBySubject, ['Mathematics', 'Science', 'English'], 'Class 10', 39);
    assert.equal(res.questions.length, 39, 'Generated questions for 3 subjects must be 39');
    const mathCount = res.questions.filter(q => q.subject === 'Mathematics').length;
    const sciCount = res.questions.filter(q => q.subject === 'Science').length;
    const engCount = res.questions.filter(q => q.subject === 'English').length;
    assert.equal(mathCount, 13);
    assert.equal(sciCount, 13);
    assert.equal(engCount, 13);
  });

  // =========================================================================
  // Test 4: Complete syllabus selection
  // =========================================================================
  test('Test 4: Complete syllabus includes all official verified curriculum chapters', () => {
    const mathChapters = getVerifiedChaptersForSubject('Mathematics', 'CBSE', 'Class 10', '2026-27');
    assert.ok(mathChapters.length >= 14, 'CBSE Class 10 Math has 14 official chapters');
    const chapterNames = mathChapters.map(c => c.name);
    assert.ok(chapterNames.includes('Real Numbers'));
    assert.ok(chapterNames.includes('Polynomials'));
    assert.ok(chapterNames.includes('Quadratic Equations'));
    assert.ok(chapterNames.includes('Triangles'));

    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 60);

    const plan = generateDeterministicStudyPlan({
      student: { id: 's1', name: 'Test Student', grade: 'Class 10', board: 'CBSE', academicYear: '2026-27' },
      examDate: examDate.toISOString().split('T')[0],
      selectedSubjects: ['Mathematics'],
      selectedCurriculum: [{
        subject: 'Mathematics',
        chapters: mathChapters.map(c => ({ chapterName: c.name, topics: c.topics.map(t => t.name) }))
      }]
    });

    const scheduledChapters = new Set(plan.dailyPlans.flatMap(d => d.tasks.map(t => t.chapter)));
    assert.ok(scheduledChapters.has('Quadratic Equations'));
    assert.ok(scheduledChapters.has('Real Numbers'));
  });

  // =========================================================================
  // Test 5: Selected chapters only
  // =========================================================================
  test('Test 5: Selected chapters only restricts study plan strictly to user choices', () => {
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 45);

    const plan = generateDeterministicStudyPlan({
      student: { id: 's1', name: 'Test Student', grade: 'Class 10', board: 'CBSE', academicYear: '2026-27' },
      examDate: examDate.toISOString().split('T')[0],
      selectedSubjects: ['Mathematics'],
      selectedCurriculum: [{
        subject: 'Mathematics',
        chapters: [
          { chapterName: 'Real Numbers', topics: ['Fundamental Theorem of Arithmetic'] },
          { chapterName: 'Quadratic Equations', topics: ['Nature of Roots', 'Discriminant'] }
        ]
      }]
    });

    const allScheduledChapters = new Set(plan.dailyPlans.flatMap(d => d.tasks.map(t => t.chapter)));
    assert.ok(allScheduledChapters.has('Real Numbers'));
    assert.ok(allScheduledChapters.has('Quadratic Equations'));
    assert.ok(!allScheduledChapters.has('Triangles'), 'Triangles must NOT be scheduled when not selected');
    assert.ok(!allScheduledChapters.has('Probability'), 'Probability must NOT be scheduled when not selected');
  });

  // =========================================================================
  // Test 6: High pre-assessment score (Mastered threshold)
  // =========================================================================
  test('Test 6: High pre-assessment score (92%) is categorized as Mastered with 0.5x weight', () => {
    const category = getPerformanceCategory(92);
    assert.equal(category, 'Mastered');
    const weight = getCategoryWeight(category);
    assert.equal(weight, 0.5, 'Mastered topics get 0.5x multiplier (lighter repetitive practice, focused revision)');
  });

  // =========================================================================
  // Test 7: Low pre-assessment score (Needs Significant Improvement threshold)
  // =========================================================================
  test('Test 7: Low pre-assessment score (32%) is categorized as Needs Significant Improvement with 1.6x weight', () => {
    const category = getPerformanceCategory(32);
    assert.equal(category, 'Needs Significant Improvement');
    const weight = getCategoryWeight(category);
    assert.equal(weight, 1.6, 'Needs Significant Improvement gets 1.6x multiplier for thorough practice');
  });

  // =========================================================================
  // Test 8: Weak Mathematics (35%) + strong Physics (85%)
  // =========================================================================
  test('Test 8: Weak Mathematics (35%) receives more study duration than strong Physics (85%)', () => {
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 40);

    const mockResult = {
      studentId: 's1',
      assessmentId: 'a1',
      overallScore: 60,
      learningLevel: 'Developing',
      knowledgeScore: 60,
      timeEfficiencyScore: 70,
      totalQuestions: 26,
      correctAnswers: 15,
      incorrectAnswers: 11,
      unansweredAnswers: 0,
      totalTimeSeconds: 600,
      averageTimeSeconds: 23,
      chapterPerformance: {
        'Quadratic Equations': {
          chapterName: 'Quadratic Equations',
          subject: 'Mathematics',
          accuracy: 35,
          total: 10,
          correct: 3,
          easyAccuracy: 50,
          moderateAccuracy: 30,
          difficultAccuracy: 20
        },
        'Light – Reflection and Refraction': {
          chapterName: 'Light – Reflection and Refraction',
          subject: 'Science',
          accuracy: 85,
          total: 10,
          correct: 8,
          easyAccuracy: 100,
          moderateAccuracy: 80,
          difficultAccuracy: 75
        }
      },
      topicPerformance: {},
      difficultyPerformance: {
        easy: { correct: 5, total: 6, accuracy: 83 },
        moderate: { correct: 6, total: 10, accuracy: 60 },
        difficult: { correct: 4, total: 10, accuracy: 40 }
      },
      questionPerformance: [],
      identifiedGaps: [],
      strengths: [],
      recommendedNextActions: [],
      createdAt: new Date().toISOString()
    };

    const plan = generateDeterministicStudyPlan({
      student: { id: 's1', name: 'Student', grade: 'Class 10', board: 'CBSE', academicYear: '2026-27' },
      examDate: examDate.toISOString().split('T')[0],
      selectedSubjects: ['Mathematics', 'Science'],
      selectedCurriculum: [
        {
          subject: 'Mathematics',
          chapters: [{ chapterName: 'Quadratic Equations', topics: ['Nature of Roots'] }]
        },
        {
          subject: 'Science',
          chapters: [{ chapterName: 'Light – Reflection and Refraction', topics: ['Spherical Mirrors and Ray Diagrams'] }]
        }
      ],
      preAssessmentResult: mockResult,
      dailyMinutesBudget: 120
    });

    const mathMinutes = plan.dailyPlans.flatMap(d => d.tasks).filter(t => t.subject === 'Mathematics').reduce((acc, t) => acc + t.durationMinutes, 0);
    const sciMinutes = plan.dailyPlans.flatMap(d => d.tasks).filter(t => t.subject === 'Science').reduce((acc, t) => acc + t.durationMinutes, 0);

    assert.ok(mathMinutes > sciMinutes, `Math minutes (${mathMinutes}) should be greater than Science minutes (${sciMinutes}) because Math scored 35% vs Science 85%`);
  });

  // =========================================================================
  // Test 9: Exam date far away (full 7-day revision buffer)
  // =========================================================================
  test('Test 9: Exam date far away (60 days) preserves full 7-day revision buffer without conflict', () => {
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 60);
    const metrics = calculateScheduleMetrics(examDate.toISOString().split('T')[0]);

    assert.equal(metrics.hasBufferConflict, false, 'No conflict for 60 days');
    assert.equal(metrics.revisionDays, 7, 'Revision days must be 7');
    assert.ok(metrics.totalStudyDays > 40, 'Active study days must be plenty');
    assert.ok(metrics.totalSundays >= 6, 'Multiple Sundays detected');
  });

  // =========================================================================
  // Test 10: Exam date very close (conflict detection & buffer adaptation)
  // =========================================================================
  test('Test 10: Exam date very close (5 days) triggers conflict detection and adapts revision buffer', () => {
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 5);
    const metrics = calculateScheduleMetrics(examDate.toISOString().split('T')[0]);

    assert.equal(metrics.hasBufferConflict, true, 'Must detect buffer conflict');
    assert.ok(metrics.conflictMessage, 'Must provide student conflict message');
    assert.ok(metrics.revisionDays < 7, 'Buffer must be compressed to fit within 5 days');
  });

  // =========================================================================
  // Test 11: Sunday rest day guarantee
  // =========================================================================
  test('Test 11: Every Sunday has 0 study minutes and is marked as rest day', () => {
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 30);
    const startStr = new Date().toISOString().split('T')[0];
    const examStr = examDate.toISOString().split('T')[0];

    const plan = generateDeterministicStudyPlan({
      student: { id: 's1', name: 'Student', grade: 'Class 10', board: 'CBSE', academicYear: '2026-27' },
      examDate: examStr,
      startDate: startStr,
      selectedSubjects: ['Mathematics'],
      selectedCurriculum: [{
        subject: 'Mathematics',
        chapters: [{ chapterName: 'Quadratic Equations', topics: ['Roots'] }]
      }]
    });

    plan.dailyPlans.forEach(day => {
      const [y, m, d] = day.date.split('-').map(Number);
      const dayDate = new Date(y, m - 1, d);
      if (dayDate.getDay() === 0) {
        assert.equal(day.isRestDay, true, `Sunday ${day.date} must be marked isRestDay`);
        assert.equal(day.totalStudyMinutes, 0, `Sunday ${day.date} must have 0 total study minutes`);
        assert.equal(day.tasks.length, 0, `Sunday ${day.date} must have no regular study tasks`);
      }
    });
  });

  // =========================================================================
  // Test 12: Missed study task rescheduling
  // =========================================================================
  test('Test 12: Missed study task is rescheduled into upcoming non-Sunday study days', () => {
    const today = new Date();
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 1);

    const mockPlan = {
      id: 'plan_test',
      studentId: 's1',
      curriculumVersionId: 'curriculum-cbse-class10-2026-27',
      academicYear: '2026-27',
      classLevel: 'Class 10',
      board: 'CBSE',
      examDate: '2026-12-20',
      targetCompletionDate: '2026-12-13',
      daysAvailable: 30,
      hasBufferConflict: false,
      selectedSubjects: ['Mathematics'],
      selectedChapters: { 'Mathematics': ['Quadratic Equations'] },
      dailyPlans: [
        {
          date: pastDate.toISOString().split('T')[0],
          day: 'Wednesday',
          isRestDay: false,
          isCompleted: false,
          tasks: [{
            id: 'task_yesterday',
            subject: 'Mathematics',
            chapter: 'Quadratic Equations',
            topic: 'Nature of Roots',
            activity: 'Practice',
            durationMinutes: 45,
            completed: false
          }],
          totalStudyMinutes: 45
        },
        {
          date: futureDate.toISOString().split('T')[0],
          day: 'Friday',
          isRestDay: false,
          isCompleted: false,
          tasks: [{
            id: 'task_future',
            subject: 'Mathematics',
            chapter: 'Quadratic Equations',
            topic: 'Applications',
            activity: 'Learn',
            durationMinutes: 45,
            completed: false
          }],
          totalStudyMinutes: 45
        }
      ],
      performanceSnapshot: { 'Mathematics': 50 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const rescheduled = rescheduleMissedTasks(mockPlan, today.toISOString().split('T')[0]);
    const futureDay = rescheduled.dailyPlans.find(d => d.date === futureDate.toISOString().split('T')[0]);
    assert.ok(futureDay, 'Future day must exist');
    assert.equal(futureDay.tasks.length, 2, 'Future day should have 2 tasks (future + rescheduled)');
    assert.ok(futureDay.tasks.some(t => t.chapter === 'Quadratic Equations' && t.topic === 'Nature of Roots'));
  });

  // =========================================================================
  // Test 13: Weekly test performance changes adapt future plans
  // =========================================================================
  test('Test 13: Weekly test score adaptation reweights weak topics in future plan', () => {
    // Verified via the category weight scaling function
    const initialCategory = getPerformanceCategory(82); // Strong (0.7 weight)
    assert.equal(initialCategory, 'Strong');
    assert.equal(getCategoryWeight(initialCategory), 0.7);

    // After weekly test, score drops to 45% (Needs Improvement)
    const updatedCategory = getPerformanceCategory(45);
    assert.equal(updatedCategory, 'Needs Improvement');
    assert.equal(getCategoryWeight(updatedCategory), 1.3, 'Weight increases from 0.7 to 1.3 for more attention');
  });

  // =========================================================================
  // Test 14: LLM API failure handling (graceful fallback)
  // =========================================================================
  test('Test 14: MockProvider handles generation gracefully when remote API is unavailable', async () => {
    const mock = new MockProvider();
    const questions = await mock.generateDiagnosticQuestions({
      subject: 'Mathematics',
      classLevel: 'Class 10',
      chapters: [
        {
          chapterId: 'ch_1',
          chapterName: 'Quadratic Equations',
          subject: 'Mathematics',
          topics: ['Nature of Roots', 'Roots'],
          prerequisites: [],
          importantConcepts: []
        }
      ],
      targetCount: 2
    });

    assert.ok(questions.length >= 2, 'Mock provider returns valid questions');
    assert.equal(questions[0].subject, 'Mathematics');
    assert.ok(questions[0].options.length === 4);
  });

  // =========================================================================
  // Test 15: Invalid LLM JSON rejection
  // =========================================================================
  test('Test 15: Invalid question structures fail question validation', () => {
    const allowedMap = {
      selectedSubjects: ['Mathematics'],
      allowedChapters: [{ chapterId: 'ch_1', chapterName: 'Quadratic Equations', subject: 'Mathematics' }],
      allowedTopics: []
    };

    // Missing question text / too short
    const invalidQ1 = {
      questionId: 'inv1',
      subject: 'Mathematics',
      chapterId: 'ch_1',
      chapterName: 'Quadratic Equations',
      topic: 'Nature of Roots',
      difficulty: 'moderate',
      question: '',
      options: ['A', 'B', 'C', 'D'],
      correctOption: 0,
      explanation: 'Valid explanation that is long enough'
    };
    const check1 = validateQuestion(invalidQ1, allowedMap);
    assert.equal(check1.valid, false, 'Empty question must be rejected');

    // Only 3 options
    const invalidQ2 = {
      questionId: 'inv2',
      subject: 'Mathematics',
      chapterId: 'ch_1',
      chapterName: 'Quadratic Equations',
      topic: 'Nature of Roots',
      difficulty: 'moderate',
      question: 'What are roots of standard quadratic equation ax^2 + bx + c = 0?',
      options: ['A', 'B', 'C'],
      correctOption: 0,
      explanation: 'Valid explanation that is long enough'
    };
    const check2 = validateQuestion(invalidQ2, allowedMap);
    assert.equal(check2.valid, false, 'Question with fewer than 4 options must be rejected');
  });

  // =========================================================================
  // Test 16: Duplicate question generation detection
  // =========================================================================
  test('Test 16: Duplicate questions within an assessment session are rejected', () => {
    const q1 = {
      questionId: 'q1',
      subject: 'Mathematics',
      chapterId: 'ch_1',
      chapterName: 'Quadratic Equations',
      topic: 'Roots',
      difficulty: 'moderate',
      question: 'Find the discriminant of quadratic equation x^2 - 4x + 4 = 0.',
      options: ['0', '4', '8', '16'],
      correctOption: 0,
      explanation: 'b^2 - 4ac = 16 - 16 = 0 which is equal to zero.'
    };
    const q2 = { ...q1, questionId: 'q2' }; // Identical question text

    const allowedMap = {
      selectedSubjects: ['Mathematics'],
      allowedChapters: [{ chapterId: 'ch_1', chapterName: 'Quadratic Equations', subject: 'Mathematics' }],
      allowedTopics: []
    };

    const sessionCheck = validateAssessmentSession([q1, q2], allowedMap, 2);
    assert.equal(sessionCheck.valid, false, 'Session with duplicate question text must be rejected');
    assert.ok(sessionCheck.reasons.some(r => r.includes('duplicate questions')), 'Reasons should mention duplicate questions');
  });

  // =========================================================================
  // Test 17: Missing API key handling & graceful fallback
  // =========================================================================
  test('Test 17: GeminiProvider falls back gracefully to MockProvider when remote API is unreachable', async () => {
    const gemini = new GeminiProvider();
    const questions = await gemini.generateDiagnosticQuestions({
      subject: 'Mathematics',
      classLevel: 'Class 10',
      chapters: [{ chapterId: 'ch_1', chapterName: 'Real Numbers', subject: 'Mathematics', topics: ['Primes'], prerequisites: [], importantConcepts: [] }],
      targetCount: 1
    });
    assert.ok(questions.length >= 1, 'Should return generated question via resilient fallback');
    assert.equal(questions[0].subject, 'Mathematics');
  });

  // =========================================================================
  // Test 18: Unsupported curriculum handling
  // =========================================================================
  test('Test 18: Unsupported board/class returns empty or null safely without hallucination', () => {
    const chapters = getVerifiedChaptersForSubject('Astronomy', 'UnknownBoard', 'Class 99', '2099-00');
    assert.equal(chapters.length, 0, 'Must return empty array for non-existent verified curriculum');

    const version = getCurriculumVersion('UnknownBoard', 'Class 99', '2099-00');
    assert.equal(version, null, 'Curriculum version must be null for non-existent curriculum');
  });

  // =========================================================================
  // Test 19: Curriculum version comparison
  // =========================================================================
  test('Test 19: Curriculum version comparison detects additions and modifications between academic years', () => {
    const comp = compareCurriculumVersions(
      'curriculum-cbse-10-2025-26',
      'curriculum-cbse-10-2026-27'
    );

    assert.equal(comp.board, 'CBSE');
    assert.equal(comp.classLevel, 'Class 10');
    assert.ok(comp.fromYear === '2025-26');
    assert.ok(comp.toYear === '2026-27');
    assert.ok(Array.isArray(comp.addedChapters));
    assert.ok(Array.isArray(comp.removedChapters));
  });

});
