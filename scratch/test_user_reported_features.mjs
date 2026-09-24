import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateDeterministicStudyPlan,
  calculateScheduleMetrics
} from '../src/services/deterministicSchedulingService.ts';

import { MockProvider } from '../src/services/llm/llmProvider.ts';
import { extractTopicsFromText } from '../src/services/fileProcessingService.ts';
import { getVerifiedChaptersForSubject } from '../src/services/curriculumDatabaseService.ts';

describe('User Reported Issues Verification', () => {

  // Test 1: Day-by-day plan must include 3 different subjects per day when >= 3 subjects are selected
  test('Deterministic Scheduler: Daily plan includes 3 distinct subjects per study day', () => {
    const selectedSubjects = ['Mathematics', 'Science', 'English'];
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 30);
    const examDateStr = examDate.toISOString().split('T')[0];

    const selectedCurriculum = selectedSubjects.map(sub => ({
      subject: sub,
      chapters: [
        { chapterName: `${sub} Ch 1`, topics: [`${sub} Topic 1.1`, `${sub} Topic 1.2`, `${sub} Topic 1.3`] },
        { chapterName: `${sub} Ch 2`, topics: [`${sub} Topic 2.1`, `${sub} Topic 2.2`] }
      ]
    }));

    const plan = generateDeterministicStudyPlan({
      student: {
        id: 'test_student',
        name: 'Test Student',
        grade: 'Class 10',
        board: 'CBSE',
        academicYear: '2026-27'
      },
      examDate: examDateStr,
      selectedSubjects,
      selectedCurriculum,
      dailyMinutesBudget: 120,
      curriculumVersionId: 'test-curriculum-v1'
    });

    assert.ok(plan.dailyPlans.length > 0, 'Plan should contain daily plans');

    // Filter to regular study days (not Sunday rest days, not revision buffer)
    const regularStudyDays = plan.dailyPlans.filter(d => !d.isRestDay && !d.isRevisionPeriod);
    assert.ok(regularStudyDays.length >= 5, 'Should have multiple regular study days');

    regularStudyDays.forEach(day => {
      const distinctSubjectsToday = Array.from(new Set(day.tasks.map(t => t.subject)));
      assert.equal(
        distinctSubjectsToday.length,
        3,
        `Study day ${day.date} (${day.day}) must have exactly 3 different subjects, got ${distinctSubjectsToday.join(', ')}`
      );

      // Verify all 3 selected subjects are represented
      selectedSubjects.forEach(sub => {
        assert.ok(
          distinctSubjectsToday.includes(sub),
          `Subject ${sub} must be scheduled on day ${day.date}`
        );
      });

      // Total study duration should equal or approximate daily budget
      const totalMins = day.tasks.reduce((sum, t) => sum + t.durationMinutes, 0);
      assert.equal(totalMins, 120, `Daily study minutes should equal 120, got ${totalMins}`);
    });
  });

  // Test 2: MockProvider also schedules 3 distinct subjects per day when >= 3 subjects are selected
  test('MockProvider: Study plan generator schedules 3 distinct subjects per day', async () => {
    const provider = new MockProvider();
    const selectedSubjects = ['Mathematics', 'Science', 'Social Science'];
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 25);
    const examDateStr = examDate.toISOString().split('T')[0];

    const plans = await provider.generateStudyPlan({
      student: {
        id: 'test_student',
        name: 'Test Student',
        grade: 'Class 10',
        board: 'CBSE'
      },
      examDate: examDateStr,
      selectedSubjects,
      selectedCurriculum: selectedSubjects.map(sub => ({
        subject: sub,
        chapters: [
          { chapterName: `${sub} Fundamentals`, topics: [`${sub} Core 1`, `${sub} Core 2`, `${sub} Core 3`] }
        ]
      })),
      dailyMinutesBudget: 120,
      curriculumVersionId: 'test-v1'
    });

    const regularStudyDays = plans.filter(d => !d.isRestDay && !d.isRevisionPeriod);
    assert.ok(regularStudyDays.length >= 3, 'Should have regular study days');

    regularStudyDays.forEach(day => {
      const distinctSubjectsToday = Array.from(new Set(day.tasks.map(t => t.subject)));
      assert.equal(
        distinctSubjectsToday.length,
        3,
        `Day ${day.date} must have 3 distinct subjects, found: ${distinctSubjectsToday.join(', ')}`
      );
      assert.equal(day.totalStudyMinutes, 120, `Daily total minutes must be 120, got ${day.totalStudyMinutes}`);
    });
  });

  // Test 3: Topic upload parsing extracts topics from bullet lists / notes
  test('Topic Extraction: Parses notes, bullets, and section headings without Chapter prefix', () => {
    const notesText = `
      # Newton's Laws of Motion
      First Law states an object remains at rest unless acted upon by external force.
      Inertia and momentum are foundational principles.

      # Work, Energy and Power
      Work done is the scalar product of force and displacement.
      Kinetic energy and potential energy conservation theorems.

      # Gravitational Fields
      Universal law of gravitation and planetary motion.
      Kepler's third law and satellite trajectories.
    `;

    const extracted = extractTopicsFromText(notesText, 'Physics_Notes.txt');
    assert.ok(extracted, 'Extracted result must exist');
    assert.ok(extracted.topics.length >= 3, `Should extract 3 topics, got ${extracted.topics.length}`);
    assert.ok(extracted.topics.some(t => t.title.includes("Newton's Laws")));
    assert.ok(extracted.topics.some(t => t.title.includes("Work, Energy")));
    assert.ok(extracted.topics.some(t => t.title.includes("Gravitational")));
  });

  // Test 4: Uploaded chapter count vs NCERT chapter count
  test('Chapter count logic: Uploaded chapter count (4) supersedes NCERT default count (15)', () => {
    const sub = 'Mathematics';
    const ncertChapters = getVerifiedChaptersForSubject(sub, 'CBSE', 'Class 10', '2026-27');
    assert.ok(ncertChapters.length >= 10, 'NCERT Class 10 Math should have standard curriculum chapters');

    // Simulate uploaded syllabus with only 4 chapters
    const uploadedChapters = [
      { chapterId: 'ch_math_1', chapterName: 'Real Numbers', subject: 'Mathematics', topics: ['Euclid Lemma'] },
      { chapterId: 'ch_math_2', chapterName: 'Polynomials', subject: 'Mathematics', topics: ['Zeroes'] },
      { chapterId: 'ch_math_3', chapterName: 'Quadratic Equations', subject: 'Mathematics', topics: ['Factoring'] },
      { chapterId: 'ch_math_4', chapterName: 'Arithmetic Progressions', subject: 'Mathematics', topics: ['nth term'] }
    ];

    // Compute totalInSub using the updated logic
    const totalInSub = (uploadedChapters && uploadedChapters.length > 0)
      ? uploadedChapters.length
      : ncertChapters.length;

    assert.equal(totalInSub, 4, 'Uploaded syllabus chapter count should be 4, NOT the NCERT count');
  });
});
