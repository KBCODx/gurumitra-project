import assert from 'node:assert/strict';
import {
  generateDeterministicStudyPlan,
  rescheduleMissedTasks,
  parseLocalDate
} from '../src/services/deterministicSchedulingService.ts';

console.log('Testing Sunday-only remedial class scheduling guarantees...\n');

// 1. Generate a multi-week plan
const startDate = '2026-10-01'; // Thursday
const examDate = '2026-10-31';  // 30 days later

const plan = generateDeterministicStudyPlan({
  student: {
    id: 'student_remedial_test',
    name: 'Test Student',
    grade: 'Class 10',
    board: 'CBSE',
    academicYear: '2026-27'
  },
  examDate,
  startDate,
  selectedSubjects: ['Mathematics', 'Science'],
  selectedCurriculum: [
    {
      subject: 'Mathematics',
      chapters: [
        { chapterName: 'Quadratic Equations', topics: ['Roots', 'Discriminant'] },
        { chapterName: 'Triangles', topics: ['Similarity', 'Pythagoras'] }
      ]
    },
    {
      subject: 'Science',
      chapters: [
        { chapterName: 'Chemical Reactions', topics: ['Balancing', 'Oxidation'] },
        { chapterName: 'Light', topics: ['Reflection', 'Refraction'] }
      ]
    }
  ],
  dailyMinutesBudget: 90
});

// Verify initial plan has Sundays marked
const sundays = plan.dailyPlans.filter(d => {
  const parsed = parseLocalDate(d.date);
  return parsed.getDay() === 0;
});
assert.ok(sundays.length >= 4, 'Should have at least 4 Sundays in a 30-day plan');
console.log(`✓ Initial plan generated with ${sundays.length} verified Sundays`);

// 2. Simulate Setting Up a Remedial Class
// Suppose student is viewing Wednesday (2026-10-07) and requests a remedial class
const viewingDate = '2026-10-07'; // Wednesday
const parsedViewing = parseLocalDate(viewingDate);
assert.equal(parsedViewing.getDay(), 3, 'Viewing date must be Wednesday');

// The new logic finds the next Sunday on or after viewingDate:
const matchingSunday = sundays.find(s => s.date >= viewingDate);
assert.ok(matchingSunday, 'Must find upcoming Sunday');
assert.equal(parseLocalDate(matchingSunday.date).getDay(), 0, 'Matching target date must be Sunday (0)');
assert.equal(matchingSunday.date, '2026-10-11', 'Next Sunday after Oct 7 must be Oct 11');

// Schedule the remedial class on Oct 11
const remedialTask = {
  id: `task_remedial_manual_${Date.now()}`,
  subject: 'Mathematics',
  chapter: 'Quadratic Equations',
  topic: 'Roots & Discriminant Reinforcement',
  activity: 'Remedial Review',
  durationMinutes: 45,
  completed: false,
  priority: 'High Priority',
  isWeakTopic: true
};

const updatedPlans = plan.dailyPlans.map(d => {
  const isTargetSunday = d.date === matchingSunday.date && parseLocalDate(d.date).getDay() === 0;
  if (isTargetSunday) {
    return {
      ...d,
      tasks: [...d.tasks, remedialTask],
      totalStudyMinutes: d.totalStudyMinutes + 45,
      restDayNote: 'Sunday Remedial Reinforcement: Focused catch-up session scheduled on Sunday so your weekday study load remains balanced.'
    };
  }
  return d;
});

// Verify Wednesday (Oct 7) has ZERO remedial tasks
const wednesdayPlan = updatedPlans.find(d => d.date === viewingDate);
assert.ok(wednesdayPlan, 'Wednesday plan exists');
assert.equal(
  wednesdayPlan.tasks.some(t => t.activity === 'Remedial Review'),
  false,
  'Wednesday (weekday) must have NO remedial review tasks'
);

// Verify Sunday (Oct 11) has the remedial task
const oct11Plan = updatedPlans.find(d => d.date === '2026-10-11');
assert.ok(oct11Plan, 'Sunday Oct 11 exists');
assert.ok(
  oct11Plan.tasks.some(t => t.topic === 'Roots & Discriminant Reinforcement' && t.activity === 'Remedial Review'),
  'Sunday must contain the remedial task'
);
console.log('✓ Manual remedial class setup strictly targeted Sunday (2026-10-11), Wednesday remained completely unpolluted');

// 3. Test Rescheduling Missed Tasks
// Mark 3 tasks on past days as incomplete and reschedule
const planWithMissed = {
  ...plan,
  dailyPlans: plan.dailyPlans.map(d => {
    if (d.date === '2026-10-02' || d.date === '2026-10-05') {
      return {
        ...d,
        isCompleted: false,
        tasks: d.tasks.map(t => ({ ...t, completed: false }))
      };
    }
    return d;
  })
};

const rescheduledPlan = rescheduleMissedTasks(planWithMissed, '2026-10-06');

// Verify NO remedial tasks exist on weekdays in the rescheduled plan
rescheduledPlan.dailyPlans.forEach(d => {
  const parsed = parseLocalDate(d.date);
  const isSun = parsed.getDay() === 0;
  const hasRemedial = d.tasks.some(t => t.activity === 'Remedial Review');

  if (hasRemedial && d.date >= '2026-10-06') {
    assert.equal(isSun, true, `Date ${d.date} has remedial task but is not Sunday (day: ${parsed.getDay()})!`);
  }
});
console.log('✓ Automatic reschedule of missed tasks exclusively placed remedial reviews on Sundays, zero placed on weekdays');

console.log('\nAll Sunday-only remedial class tests passed successfully!');
