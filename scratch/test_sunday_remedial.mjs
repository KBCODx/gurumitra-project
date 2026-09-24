import assert from 'node:assert/strict';
import { generateDeterministicStudyPlan, rescheduleMissedTasks } from '../src/services/deterministicSchedulingService.ts';

console.log('🧪 Testing Sunday Remedial Class Scheduling...');

// Test 1: Plan with missed tasks allocates them to Sunday, NOT weekdays
const today = new Date();
const examDate = new Date(today);
examDate.setDate(examDate.getDate() + 28); // 4 weeks

const examDateStr = examDate.toISOString().split('T')[0];
const todayStr = today.toISOString().split('T')[0];

const plan = generateDeterministicStudyPlan({
  student: { id: 's_rem', name: 'Student', grade: 'Class 10', board: 'CBSE', academicYear: '2026-27' },
  examDate: examDateStr,
  selectedSubjects: ['Mathematics', 'Science', 'English'],
  selectedCurriculum: [
    { subject: 'Mathematics', chapters: [{ chapterName: 'Quadratic Equations', topics: ['Roots', 'Discriminant'] }] },
    { subject: 'Science', chapters: [{ chapterName: 'Chemical Reactions', topics: ['Redox', 'Balancing'] }] },
    { subject: 'English', chapters: [{ chapterName: 'Letter Writing', topics: ['Formal Letter'] }] }
  ],
  missedTasks: [
    {
      id: 'task_missed_1',
      subject: 'Mathematics',
      chapter: 'Quadratic Equations',
      topic: 'Nature of Roots',
      activity: 'Practice',
      durationMinutes: 45,
      completed: false
    }
  ]
});

// Check that regular study days (Mon-Sat) have ZERO remedial reviews
const weekdayRemedials = plan.dailyPlans
  .filter(d => !d.isRestDay && d.day !== 'Sunday')
  .flatMap(d => d.tasks.filter(t => t.activity === 'Remedial Review'));

assert.equal(weekdayRemedials.length, 0, 'Weekdays must NEVER have Remedial Review tasks!');
console.log('✅ TEST 1 PASSED: Weekdays have ZERO remedial classes.');

// Check that Sunday has the remedial review
const sundaysWithRemedial = plan.dailyPlans
  .filter(d => d.isRestDay || d.day === 'Sunday')
  .filter(d => d.tasks.some(t => t.activity === 'Remedial Review'));

assert.ok(sundaysWithRemedial.length > 0, 'Sunday must host the remedial review!');
console.log('✅ TEST 2 PASSED: Sunday hosts the scheduled remedial review.');

// Test 2: rescheduleMissedTasks places tasks on upcoming Sunday
const firstStudyDay = plan.dailyPlans.find(d => !d.isRestDay && d.tasks.length > 0);
assert.ok(firstStudyDay, 'Study day exists');

// Mark a task as missed yesterday
const pastDay = new Date(today);
pastDay.setDate(pastDay.getDate() - 1);
const pastDayStr = pastDay.toISOString().split('T')[0];

const planWithPastIncomplete = {
  ...plan,
  dailyPlans: [
    {
      date: pastDayStr,
      day: 'Wednesday',
      isRestDay: false,
      isCompleted: false,
      tasks: [{
        id: 'task_past_missed',
        subject: 'Science',
        chapter: 'Chemical Reactions',
        topic: 'Redox Reactions',
        activity: 'Learn',
        durationMinutes: 40,
        completed: false
      }],
      totalStudyMinutes: 40
    },
    ...plan.dailyPlans
  ]
};

const rescheduledPlan = rescheduleMissedTasks(planWithPastIncomplete, todayStr);

// Verify that the rescheduled task is on Sunday, NOT on weekdays
const rescheduledOnWeekday = rescheduledPlan.dailyPlans
  .filter(d => d.date >= todayStr && !d.isRestDay && d.day !== 'Sunday')
  .flatMap(d => d.tasks.filter(t => t.id.includes('task_past_missed') || t.topic === 'Redox Reactions'));

assert.equal(rescheduledOnWeekday.length, 0, 'Rescheduled task must NOT appear on weekdays!');

const rescheduledOnSunday = rescheduledPlan.dailyPlans
  .filter(d => d.date >= todayStr && (d.isRestDay || d.day === 'Sunday'))
  .flatMap(d => d.tasks.filter(t => t.topic === 'Redox Reactions'));

assert.ok(rescheduledOnSunday.length > 0, 'Rescheduled task must be scheduled on Sunday!');
console.log('✅ TEST 3 PASSED: Rescheduled missed task is allocated to Sunday, not weekdays.');

console.log('🎉 All Sunday Remedial Class tests passed with flying colors!');
