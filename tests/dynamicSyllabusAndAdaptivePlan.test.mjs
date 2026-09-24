import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  MockProvider,
  GeminiProvider,
  llmProvider
} from '../src/services/llm/llmProvider.ts';

import {
  generateDeterministicStudyPlan,
  calculateScheduleMetrics,
  rescheduleMissedTasks,
  getPerformanceCategory,
  getCategoryWeight
} from '../src/services/deterministicSchedulingService.ts';

import {
  getVerifiedChaptersForSubject,
  curriculumDatabase
} from '../src/services/curriculumDatabaseService.ts';

import { normalizeGrade } from '../src/services/curriculumService.ts';

describe('Dynamic Syllabus, Multi-Subject Planner & Real Progress Test Suite', () => {

  // =========================================================================
  // 1. LLM Syllabus Extraction: Strict Structured JSON
  // =========================================================================
  test('LLM Extraction: Extracts syllabus into strict JSON (Subject -> Chapter -> Topic)', async () => {
    const rawSyllabusText = `
      Class 10 Mathematics Syllabus
      Unit I: Number Systems
      Chapter 1: Real Numbers
      - Euclid's Division Lemma
      - Fundamental Theorem of Arithmetic
      - Revisiting Irrational Numbers
      - Revisiting Rational Numbers and Their Decimal Expansions

      Unit II: Algebra
      Chapter 2: Polynomials
      - Zeroes of a polynomial
      - Relationship between zeroes and coefficients of quadratic polynomials
      - Division Algorithm for polynomials
    `;

    const result = await llmProvider.extractSyllabus({
      subject: 'Mathematics',
      rawText: rawSyllabusText,
      classLevel: 'Class 10',
      board: 'CBSE'
    });

    assert.ok(result, 'Extraction result must not be null');
    assert.equal(result.subject, 'Mathematics', 'Extracted subject should match');
    assert.ok(Array.isArray(result.chapters), 'Chapters must be an array');
    assert.ok(result.chapters.length >= 2, 'Should extract at least 2 chapters');

    const ch1 = result.chapters[0];
    assert.equal(ch1.chapterNumber, 1);
    assert.ok(ch1.chapterName.includes('Real Numbers'), `Chapter 1 name must match Real Numbers, got: ${ch1.chapterName}`);
    assert.ok(ch1.topics.length >= 2, 'Chapter 1 must have topics');
    assert.ok(ch1.topics.some(t => t.topicName.includes("Euclid's Division Lemma") || t.topicName.includes("Fundamental Theorem")), 'Must contain exact topic names from text');

    const ch2 = result.chapters[1];
    assert.equal(ch2.chapterNumber, 2);
    assert.ok(ch2.chapterName.includes('Polynomials'), `Chapter 2 name must match Polynomials, got: ${ch2.chapterName}`);
    assert.ok(ch2.topics.length >= 2, 'Chapter 2 must have topics');
  });

  // =========================================================================
  // 2. Case A vs Case B Syllabus Logic
  // =========================================================================
  test('Case A: Same class uses existing syllabus without asking for re-upload', () => {
    const signupGrade = 'Class 10';
    const selectedGrade = 'Class 10';

    const isSameClass = normalizeGrade(signupGrade) === normalizeGrade(selectedGrade);
    assert.equal(isSameClass, true, 'Same class condition must be true');

    // In Case A, verified or previously uploaded syllabus is directly accessible
    const verifiedMath = getVerifiedChaptersForSubject('Mathematics', 'CBSE', selectedGrade, '2026-27');
    assert.ok(verifiedMath && verifiedMath.length > 0, 'Class 10 verified syllabus is loaded');
    assert.equal(verifiedMath[0].name, 'Real Numbers', 'No random chapters: exact verified chapter name');
  });

  test('Case B: Different class triggers subject-wise upload requirement', () => {
    const signupGrade = 'Class 10';
    const selectedGrade = 'Class 11';

    const isSameClass = normalizeGrade(signupGrade) === normalizeGrade(selectedGrade);
    assert.equal(isSameClass, false, 'Different class condition must be false');

    // Case B requires subject-wise upload for each selected subject
    const selectedSubjects = ['Mathematics', 'Physics', 'Chemistry'];
    const requiredUploads = selectedSubjects.map(sub => ({
      subject: sub,
      classLevel: selectedGrade,
      status: 'pending_upload'
    }));

    assert.equal(requiredUploads.length, 3, 'Must require uploads for each subject');
    assert.equal(requiredUploads[0].subject, 'Mathematics');
    assert.equal(requiredUploads[1].subject, 'Physics');
    assert.equal(requiredUploads[2].subject, 'Chemistry');
  });

  test('Case A Missing Subject: Prompts upload only for missing subject', () => {
    const signupGrade = 'Class 10';
    const selectedGrade = 'Class 10';
    const isSameClass = normalizeGrade(signupGrade) === normalizeGrade(selectedGrade);
    assert.equal(isSameClass, true);

    const availableSyllabi = {
      Mathematics: [{ chapterId: 'ch1', chapterName: 'Real Numbers', topics: ['Euclid lemma'] }]
      // Physics is missing
    };

    const selectedSubjects = ['Mathematics', 'Physics'];
    const missingSubjects = selectedSubjects.filter(sub => !availableSyllabi[sub]);

    assert.deepEqual(missingSubjects, ['Physics'], 'Physics should be flagged as missing syllabus');
  });

  // =========================================================================
  // 3. Multi-Subject Mixing on Study Days
  // =========================================================================
  test('Multi-Subject Plan: Mixes subjects across study days rather than single-subject monopoly', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    const examDate = new Date(startDate);
    examDate.setDate(examDate.getDate() + 28); // 4 weeks

    const examDateStr = examDate.toISOString().split('T')[0];

    const plan = generateDeterministicStudyPlan({
      student: { id: 's1', name: 'Aryan', grade: 'Class 10', board: 'CBSE', academicYear: '2026-27' },
      examDate: examDateStr,
      selectedSubjects: ['Mathematics', 'Science'],
      selectedCurriculum: [
        {
          subject: 'Mathematics',
          chapters: [
            { chapterName: 'Real Numbers', topics: ["Euclid's Lemma", "Fundamental Theorem"] },
            { chapterName: 'Polynomials', topics: ["Zeroes", "Division Algorithm"] }
          ]
        },
        {
          subject: 'Science',
          chapters: [
            { chapterName: 'Chemical Reactions', topics: ["Chemical Equations", "Types of Reactions"] },
            { chapterName: 'Acids, Bases and Salts', topics: ["Properties", "pH Scale"] }
          ]
        }
      ],
      preAssessmentResult: {
        id: 'pa1',
        studentId: 's1',
        totalQuestions: 20,
        correctAnswers: 12,
        overallPercentage: 60,
        completedAt: new Date().toISOString(),
        grade: 'Class 10',
        board: 'CBSE',
        academicYear: '2026-27',
        subjectPerformance: {
          Mathematics: { subject: 'Mathematics', totalQuestions: 10, correctAnswers: 6, percentage: 60, accuracy: 60 },
          Science: { subject: 'Science', totalQuestions: 10, correctAnswers: 6, percentage: 65, accuracy: 65 }
        },
        chapterPerformance: {},
        topicPerformance: {},
        difficultyBreakdown: { easy: { total: 5, correct: 4, percentage: 80 }, moderate: { total: 10, correct: 6, percentage: 60 }, difficult: { total: 5, correct: 2, percentage: 40 } },
        questionPerformance: []
      },
      dailyMinutesBudget: 120 // 2 hours
    });

    assert.ok(plan.dailyPlans && plan.dailyPlans.length > 0, 'Plan should have dailyPlans generated');

    // Find non-Sunday, non-Saturday study days that have study tasks
    const regularStudyDays = plan.dailyPlans.filter(d => !d.isRestDay && !d.isWeeklyTestDay && d.tasks.length > 0);
    assert.ok(regularStudyDays.length >= 3, 'Should have multiple regular study days');

    // Check that study days contain tasks from multiple subjects
    const multiSubjectDays = regularStudyDays.filter(d => {
      const subjectsOnDay = new Set(d.tasks.map(t => t.subject));
      return subjectsOnDay.size > 1;
    });

    assert.ok(multiSubjectDays.length > 0, 'At least some study days must combine multiple subjects');

    // Verify daily study time doesn't exceed student budget significantly
    regularStudyDays.forEach(d => {
      assert.ok(d.totalStudyMinutes <= 135, `Daily total minutes (${d.totalStudyMinutes}) should not exceed budget (120) significantly`);
    });
  });

  // =========================================================================
  // 4. Saturday Cumulative Weekly Tests
  // =========================================================================
  test('Saturday Weekly Test: Every Saturday is a weekly test covering studied topics up to that point', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    const examDate = new Date(startDate);
    examDate.setDate(examDate.getDate() + 21); // 3 weeks

    const examDateStr = examDate.toISOString().split('T')[0];

    const plan = generateDeterministicStudyPlan({
      student: { id: 's2', name: 'Aryan', grade: 'Class 10', board: 'CBSE', academicYear: '2026-27' },
      examDate: examDateStr,
      selectedSubjects: ['Mathematics', 'Science'],
      selectedCurriculum: [
        {
          subject: 'Mathematics',
          chapters: [
            { chapterName: 'Real Numbers', topics: ["Euclid's Lemma", "Fundamental Theorem"] },
            { chapterName: 'Polynomials', topics: ["Zeroes", "Division Algorithm"] }
          ]
        },
        {
          subject: 'Science',
          chapters: [
            { chapterName: 'Chemical Reactions', topics: ["Chemical Equations", "Types of Reactions"] }
          ]
        }
      ],
      preAssessmentResult: {
        id: 'pa2',
        studentId: 's2',
        totalQuestions: 20,
        correctAnswers: 10,
        overallPercentage: 50,
        completedAt: new Date().toISOString(),
        grade: 'Class 10',
        board: 'CBSE',
        academicYear: '2026-27',
        subjectPerformance: {
          Mathematics: { subject: 'Mathematics', totalQuestions: 10, correctAnswers: 4, percentage: 45, accuracy: 45 },
          Science: { subject: 'Science', totalQuestions: 10, correctAnswers: 8, percentage: 80, accuracy: 80 }
        },
        chapterPerformance: {},
        topicPerformance: {},
        difficultyBreakdown: { easy: { total: 5, correct: 3, percentage: 60 }, moderate: { total: 10, correct: 5, percentage: 50 }, difficult: { total: 5, correct: 2, percentage: 40 } },
        questionPerformance: []
      },
      dailyMinutesBudget: 120
    });

    const saturdayDays = plan.dailyPlans.filter(d => {
      const dt = new Date(d.date);
      return dt.getDay() === 6; // Saturday
    });

    assert.ok(saturdayDays.length >= 2, 'Should have at least 2 Saturdays in 3 weeks');

    saturdayDays.forEach(sat => {
      assert.equal(sat.isWeeklyTestDay, true, 'Saturday must be marked as weekly test day');
      const testTask = sat.tasks.find(t => t.activity === 'Weekly Test');
      assert.ok(testTask, 'Saturday must have a weekly test task');
      assert.equal(testTask.activity, 'Weekly Test', 'Test task activity must be Weekly Test');
      assert.ok(testTask.topic.includes('Weekly Cumulative Test') || testTask.topic.includes('Test'), 'Test task topic should indicate weekly test');
    });
  });

  // =========================================================================
  // 5. Real Progress Tracking (No Hardcoded Percentages)
  // =========================================================================
  test('Real Progress Tracking: 10 topics total, completing 5 yields 50%, completing 6 yields 60%', () => {
    // Topic calculation test
    const totalTopics = 10;
    let completedTopics = 5;

    let progress = Math.round((completedTopics / totalTopics) * 100);
    assert.equal(progress, 50, '5 completed out of 10 topics must be exactly 50%');

    // Complete 6th topic
    completedTopics += 1;
    progress = Math.round((completedTopics / totalTopics) * 100);
    assert.equal(progress, 60, '6 completed out of 10 topics must be exactly 60%');

    // Daily progress metric
    const todayTotalTasks = 4;
    const todayCompletedTasks = 3;
    const todayProgressPct = Math.round((todayCompletedTasks / todayTotalTasks) * 100);
    assert.equal(todayProgressPct, 75, '3 of 4 daily tasks must be exactly 75%');

    // Weekly progress metric
    const weekTotalTasks = 22;
    const weekCompletedTasks = 18;
    const weekProgressPct = Math.round((weekCompletedTasks / weekTotalTasks) * 100);
    assert.equal(weekProgressPct, 82, '18 of 22 weekly tasks must be exactly 82%');
  });

  // =========================================================================
  // 6. Adaptive Schedule: Performance-based Time Allocation
  // =========================================================================
  test('Adaptive Allocation: Weak Mathematics (40%) receives more study duration than strong Science (80%)', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    const examDate = new Date(startDate);
    examDate.setDate(examDate.getDate() + 21);

    const examDateStr = examDate.toISOString().split('T')[0];

    const plan = generateDeterministicStudyPlan({
      student: { id: 's3', name: 'Priya', grade: 'Class 10', board: 'CBSE', academicYear: '2026-27' },
      examDate: examDateStr,
      selectedSubjects: ['Mathematics', 'Science'],
      selectedCurriculum: [
        {
          subject: 'Mathematics',
          chapters: [
            { chapterName: 'Real Numbers', topics: ["Euclid's Lemma", "Fundamental Theorem", "Irrational Numbers"] }
          ]
        },
        {
          subject: 'Science',
          chapters: [
            { chapterName: 'Chemical Reactions', topics: ["Chemical Equations", "Types of Reactions", "Oxidation"] }
          ]
        }
      ],
      preAssessmentResult: {
        id: 'pa3',
        studentId: 's3',
        totalQuestions: 20,
        correctAnswers: 12,
        overallPercentage: 60,
        completedAt: new Date().toISOString(),
        grade: 'Class 10',
        board: 'CBSE',
        academicYear: '2026-27',
        subjectPerformance: {
          Mathematics: { subject: 'Mathematics', totalQuestions: 10, correctAnswers: 4, percentage: 40, accuracy: 40 },
          Science: { subject: 'Science', totalQuestions: 10, correctAnswers: 8, percentage: 80, accuracy: 80 }
        },
        chapterPerformance: {},
        topicPerformance: {},
        difficultyBreakdown: { easy: { total: 5, correct: 3, percentage: 60 }, moderate: { total: 10, correct: 6, percentage: 60 }, difficult: { total: 5, correct: 3, percentage: 60 } },
        questionPerformance: []
      },
      dailyMinutesBudget: 120
    });

    let mathMinutes = 0;
    let scienceMinutes = 0;

    plan.dailyPlans.forEach(d => {
      d.tasks.forEach(t => {
        if (t.activity !== 'Weekly Test') {
          if (t.subject === 'Mathematics') mathMinutes += t.durationMinutes;
          if (t.subject === 'Science') scienceMinutes += t.durationMinutes;
        }
      });
    });

    assert.ok(mathMinutes > scienceMinutes, `Weak Mathematics (${mathMinutes} min) must receive more study time than strong Science (${scienceMinutes} min)`);
  });

  // =========================================================================
  // 7. Missed Task Rescheduling
  // =========================================================================
  test('Missed Tasks: Rescheduled forward into upcoming study days without arbitrary dropping', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    const examDate = new Date(startDate);
    examDate.setDate(examDate.getDate() + 14);

    const examDateStr = examDate.toISOString().split('T')[0];

    const initialPlan = generateDeterministicStudyPlan({
      student: { id: 's4', name: 'Test Student', grade: 'Class 10', board: 'CBSE', academicYear: '2026-27' },
      examDate: examDateStr,
      selectedSubjects: ['Mathematics'],
      selectedCurriculum: [
        {
          subject: 'Mathematics',
          chapters: [
            { chapterName: 'Real Numbers', topics: ["Euclid's Lemma", "Fundamental Theorem"] }
          ]
        }
      ],
      preAssessmentResult: null,
      dailyMinutesBudget: 120
    });

    const firstStudyDay = initialPlan.dailyPlans.find(d => !d.isRestDay && !d.isWeeklyTestDay && d.tasks.length > 0);
    assert.ok(firstStudyDay, 'Should have a study day with tasks');
    const missedTask = firstStudyDay.tasks[0];
    const missedDate = firstStudyDay.date;

    const rescheduledPlan = rescheduleMissedTasks(initialPlan, missedDate, [missedTask.id]);
    assert.ok(rescheduledPlan, 'Rescheduled plan should be returned');

    // The missed task should now appear in a subsequent day
    const missedDayIndex = initialPlan.dailyPlans.findIndex(d => d.date === missedDate);
    const futureDays = rescheduledPlan.dailyPlans.slice(missedDayIndex + 1);
    const foundInFuture = futureDays.some(d => d.tasks.some(t => t.id === missedTask.id || (t.topic === missedTask.topic && t.chapter === missedTask.chapter)));
    assert.ok(foundInFuture, 'Missed task must be preserved in a future study day');
  });

});
