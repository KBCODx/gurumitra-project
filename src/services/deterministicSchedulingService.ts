import {
  StudentLearningPlan,
  DailyStudyPlan,
  DailyStudyTask,
  PerformanceCategory,
  PreAssessmentResult,
  SubjectType
} from '../types';

export interface SchedulingInput {
  student: {
    id: string;
    name: string;
    grade: string;
    board: string;
    academicYear: string;
  };
  examDate: string; // YYYY-MM-DD
  selectedSubjects: string[];
  selectedCurriculum: Array<{
    subject: string;
    chapters: Array<{
      chapterName: string;
      topics: string[];
    }>;
  }>;
  preAssessmentResult?: PreAssessmentResult | null;
  dailyMinutesBudget?: number;
  curriculumVersionId?: string;
  missedTasks?: DailyStudyTask[];
  startDate?: string; // Optional start date, defaults to today
}

export interface SchedulingCalculationResult {
  examDate: string;
  remainingDays: number;
  targetCompletionDate: string;
  totalStudyDays: number;
  totalSundays: number;
  revisionDays: number;
  hasBufferConflict: boolean;
  conflictMessage?: string;
}

/**
 * Deterministic category threshold evaluator
 * 0–39%   → Needs Significant Improvement
 * 40–59%  → Needs Improvement
 * 60–74%  → Developing
 * 75–89%  → Strong
 * 90–100% → Mastered
 */
export function getPerformanceCategory(scorePercentage: number): PerformanceCategory {
  if (scorePercentage < 40) return 'Needs Significant Improvement';
  if (scorePercentage < 60) return 'Needs Improvement';
  if (scorePercentage < 75) return 'Developing';
  if (scorePercentage < 90) return 'Strong';
  return 'Mastered';
}

export function getCategoryWeight(category: PerformanceCategory): number {
  switch (category) {
    case 'Needs Significant Improvement':
      return 1.6;
    case 'Needs Improvement':
      return 1.3;
    case 'Developing':
      return 1.0;
    case 'Strong':
      return 0.7;
    case 'Mastered':
      return 0.5;
  }
}

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseLocalDate(str: string): Date {
  const parts = str.split('T')[0].split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  const d = new Date(str);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calculates calendar details including 7-day buffer and Sundays
 */
export function calculateScheduleMetrics(
  examDateStr: string,
  startDateStr?: string
): SchedulingCalculationResult {
  const start = startDateStr ? parseLocalDate(startDateStr) : new Date();
  start.setHours(0, 0, 0, 0);

  const exam = parseLocalDate(examDateStr);
  exam.setHours(0, 0, 0, 0);

  const diffMs = exam.getTime() - start.getTime();
  const remainingDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  let hasBufferConflict = false;
  let conflictMessage: string | undefined = undefined;
  let bufferDays = 7;

  if (remainingDays <= 7) {
    hasBufferConflict = true;
    bufferDays = Math.max(1, Math.floor(remainingDays * 0.3));
    conflictMessage = `Exam is in ${remainingDays} days. The standard 7-day revision buffer has been compressed to ${bufferDays} day(s) to ensure core syllabus coverage.`;
  }

  const targetCompletion = new Date(exam);
  targetCompletion.setDate(targetCompletion.getDate() - bufferDays);

  // Count study days and sundays from start to targetCompletion
  let totalStudyDays = 0;
  let totalSundays = 0;

  const cur = new Date(start);
  while (cur <= targetCompletion) {
    if (cur.getDay() === 0) {
      totalSundays++;
    } else {
      totalStudyDays++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  // Count sundays in remaining period
  const endPeriod = new Date(exam);
  while (cur <= endPeriod) {
    if (cur.getDay() === 0) {
      totalSundays++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  return {
    examDate: formatLocalDate(exam),
    remainingDays,
    targetCompletionDate: formatLocalDate(targetCompletion),
    totalStudyDays: Math.max(1, totalStudyDays),
    totalSundays,
    revisionDays: bufferDays,
    hasBufferConflict,
    conflictMessage
  };
}

/**
 * Core Deterministic Scheduling Engine
 * Computes calendar, Sundays (0 regular minutes), 7-day buffer, and weakness-weighted allocations.
 */
export function generateDeterministicStudyPlan(input: SchedulingInput): StudentLearningPlan {
  const {
    student,
    examDate,
    selectedSubjects,
    selectedCurriculum = [],
    preAssessmentResult,
    dailyMinutesBudget = 140,
    curriculumVersionId = 'cbse-10-2026-27',
    missedTasks = [],
    startDate
  } = input;

  const metrics = calculateScheduleMetrics(examDate, startDate);
  const start = startDate ? parseLocalDate(startDate) : new Date();
  start.setHours(0, 0, 0, 0);

  const exam = parseLocalDate(examDate);
  exam.setHours(0, 0, 0, 0);

  const targetCompletion = parseLocalDate(metrics.targetCompletionDate);
  targetCompletion.setHours(0, 0, 0, 0);

  // 1. Gather all topics with academic weighting
  interface TopicTaskCandidate {
    subject: string;
    chapterName: string;
    topicName: string;
    accuracy: number;
    category: PerformanceCategory;
    isWeakTopic: boolean;
    weight: number;
    recommendedMinutes: number;
  }

  const topicPool: TopicTaskCandidate[] = [];

  (selectedCurriculum || []).forEach(curricSub => {
    const subName = curricSub.subject;
    // Derive subject accuracy if available
    let subAccuracy = 65;
    if (preAssessmentResult?.subjectPerformance?.[subName]) {
      subAccuracy = preAssessmentResult.subjectPerformance[subName].percentage;
    } else if (preAssessmentResult?.questionPerformance) {
      const subQs = preAssessmentResult.questionPerformance.filter(
        q => q.subject.toLowerCase() === subName.toLowerCase()
      );
      if (subQs.length > 0) {
        subAccuracy = Math.round((subQs.filter(q => q.isCorrect).length / subQs.length) * 100);
      }
    }

    curricSub.chapters.forEach(ch => {
      let chAccuracy = subAccuracy;
      if (preAssessmentResult?.chapterPerformance?.[ch.chapterName]) {
        chAccuracy = preAssessmentResult.chapterPerformance[ch.chapterName].accuracy;
      }

      const topics = ch.topics && ch.topics.length > 0 ? ch.topics : [ch.chapterName];
      topics.forEach(top => {
        let topicAccuracy = chAccuracy;
        // Check topic performance if available
        if (preAssessmentResult?.topicPerformance) {
          const matchKey = Object.keys(preAssessmentResult.topicPerformance).find(
            k => k.toLowerCase() === top.toLowerCase() ||
                 preAssessmentResult.topicPerformance[k]?.topicName?.toLowerCase() === top.toLowerCase()
          );
          if (matchKey) {
            topicAccuracy = preAssessmentResult.topicPerformance[matchKey].accuracy;
          }
        }

        const category = getPerformanceCategory(topicAccuracy);
        const isWeak = topicAccuracy < 60;
        const weight = getCategoryWeight(category);

        // Weak topics receive longer deep-dive (e.g. 70-80 mins: 45m learn + 30m practice)
        // Strong topics receive shorter session (e.g. 40-45 mins: 15m review + 30m practice)
        let recMins = Math.round(55 * weight);
        recMins = Math.max(35, Math.min(85, recMins));

        topicPool.push({
          subject: subName,
          chapterName: ch.chapterName,
          topicName: top,
          accuracy: topicAccuracy,
          category,
          isWeakTopic: isWeak,
          weight,
          recommendedMinutes: recMins
        });
      });
    });
  });

  // Sort topicPool: higher weight (weaker) first, but interleaved across subjects
  topicPool.sort((a, b) => b.weight - a.weight);

  // Group by subject to interleave
  const bySubject: Record<string, TopicTaskCandidate[]> = {};
  selectedSubjects.forEach(s => { bySubject[s] = []; });
  topicPool.forEach(t => {
    if (!bySubject[t.subject]) bySubject[t.subject] = [];
    bySubject[t.subject].push(t);
  });

  const interleavedTopics: TopicTaskCandidate[] = [];
  let added = true;
  let round = 0;
  while (added) {
    added = false;
    for (const sub of selectedSubjects) {
      if (bySubject[sub] && bySubject[sub].length > 0) {
        interleavedTopics.push(bySubject[sub].shift()!);
        added = true;
      }
    }
    round++;
    if (round > 1000) break;
  }

  // 2. Build Daily Plans day by day
  const dailyPlans: DailyStudyPlan[] = [];
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  let topicIndex = 0;
  let taskIdCounter = 1;

  // Insert missed tasks into the very beginning if any exist
  const pendingMissed = [...missedTasks];

  const currentDate = new Date(start);

  while (currentDate <= exam) {
    const dateStr = formatLocalDate(currentDate);
    const dayOfWeek = daysOfWeek[currentDate.getDay()];
    const isSunday = currentDate.getDay() === 0;
    const isRevisionBuffer = currentDate > targetCompletion;

    if (isSunday) {
      // RULE 28: Sunday is REST & REMEDIAL RECOVERY day
      // Any remedial reinforcement or catch-up tasks are scheduled strictly on Sunday, NOT on weekdays!
      const sundayTasks: DailyStudyTask[] = [];
      let sundayMins = 0;

      while (pendingMissed.length > 0 && sundayMins < 90) {
        const missed = pendingMissed.shift()!;
        sundayTasks.push({
          ...missed,
          id: `task_remedial_sunday_${dateStr}_${taskIdCounter++}`,
          activity: 'Remedial Review',
          isMissed: false
        });
        sundayMins += missed.durationMinutes;
      }

      dailyPlans.push({
        date: dateStr,
        day: dayOfWeek,
        dayOfWeek,
        isRestDay: true,
        restDayNote: sundayTasks.length > 0
          ? 'Sunday Remedial Reinforcement: Focused catch-up session scheduled on Sunday so your weekday study load remains balanced.'
          : 'Rest & Recovery. Optional: flashcards, light formula review, or catching up on missed tasks.',
        tasks: sundayTasks,
        totalStudyMinutes: sundayMins,
        isCompleted: false
      });
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    } else if (currentDate.getDay() === 6) {
      // RULE: SATURDAY WEEKLY TEST & CUMULATIVE REVISION DAY
      // Gathers all topics scheduled/studied up to this Saturday
      const studiedTopicsSoFar: Array<{ subject: string; chapter: string; topic: string; isWeak: boolean }> = [];
      dailyPlans.forEach(dp => {
        dp.tasks.forEach(t => {
          if (t.activity !== 'Weekly Test') {
            studiedTopicsSoFar.push({
              subject: t.subject,
              chapter: t.chapter,
              topic: t.topic,
              isWeak: !!t.isWeakTopic
            });
          }
        });
      });

      const saturdayTasks: DailyStudyTask[] = [];
      const targetSubCount = Math.min(3, selectedSubjects.length);
      const saturdaySubjects: SubjectType[] = [];
      for (let s = 0; s < targetSubCount; s++) {
        saturdaySubjects.push(selectedSubjects[(dailyPlans.length + s) % selectedSubjects.length] as SubjectType);
      }

      const baseMins = Math.floor(dailyMinutesBudget / targetSubCount);
      let satAllocated = 0;

      saturdaySubjects.forEach((sub, sIdx) => {
        const isLast = sIdx === targetSubCount - 1;
        const duration = isLast
          ? Math.max(20, dailyMinutesBudget - satAllocated)
          : Math.max(20, baseMins);
        satAllocated += duration;

        const subStudied = studiedTopicsSoFar.filter(t => t.subject === sub);
        const weakTopic = subStudied.filter(t => t.isWeak).pop() || subStudied[subStudied.length - 1];

        saturdayTasks.push({
          id: `task_test_${dateStr}_${taskIdCounter++}`,
          subject: sub,
          chapter: weakTopic?.chapter ? `Weekly Checkpoint — ${weakTopic.chapter}` : `${sub} Weekly Milestone`,
          topic: weakTopic?.topic ? `Weekly Cumulative Test: ${weakTopic.topic}` : `${sub} Comprehensive Weekly Review`,
          activity: sIdx === 0 ? 'Weekly Test' : 'Revision',
          durationMinutes: duration,
          completed: false,
          isWeakTopic: weakTopic?.isWeak,
          isRevision: sIdx > 0
        });
      });

      dailyPlans.push({
        date: dateStr,
        day: dayOfWeek,
        dayOfWeek,
        isRestDay: false,
        isWeeklyTestDay: true,
        tasks: saturdayTasks,
        totalStudyMinutes: saturdayTasks.reduce((s, t) => s + t.durationMinutes, 0),
        isCompleted: false
      });
    } else if (isRevisionBuffer) {
      // RULE 26: 7-day Buffer before exam (Revision, Mock tests, Weak topic reinforcement)
      const bufferDayNum = Math.ceil((currentDate.getTime() - targetCompletion.getTime()) / (1000 * 60 * 60 * 24));
      const bufferTasks: DailyStudyTask[] = [];

      selectedSubjects.forEach((sub, sIdx) => {
        const isMockTestDay = bufferDayNum % 2 === 0;
        bufferTasks.push({
          id: `task_rev_${dateStr}_${sIdx + 1}`,
          subject: sub as SubjectType,
          chapter: isMockTestDay ? 'Comprehensive Exam Preparation' : 'High-Yield Formula & Concept Review',
          topic: isMockTestDay ? 'Full Mock Test & Mistake Analysis' : 'Targeted Weak Topic Mastery',
          activity: isMockTestDay ? 'Weekly Test' : 'Revision',
          durationMinutes: Math.round(dailyMinutesBudget / selectedSubjects.length),
          completed: false,
          isRevision: true
        });
      });

      const totalMins = bufferTasks.reduce((sum, t) => sum + t.durationMinutes, 0);

      dailyPlans.push({
        date: dateStr,
        day: dayOfWeek,
        dayOfWeek,
        isRestDay: false,
        isRevisionPeriod: true,
        tasks: bufferTasks,
        totalStudyMinutes: totalMins,
        isCompleted: false
      });
    } else {
      // Normal Study Day: Intelligently mix subjects up to dailyMinutesBudget
      // Remedial classes are scheduled exclusively on Sundays, leaving weekdays focused on core curriculum.
      const dayTasks: DailyStudyTask[] = [];
      let dayMins = 0;

      // Multi-subject mixing: Schedule 3 different subjects per day whenever >= 3 subjects are selected!
      const targetSubjectsCount = Math.min(3, selectedSubjects.length);
      const subjectsToday: string[] = [];
      for (let sIdx = 0; sIdx < targetSubjectsCount; sIdx++) {
        const subIndex = (dailyPlans.length + sIdx) % selectedSubjects.length;
        subjectsToday.push(selectedSubjects[subIndex]);
      }

      // Calculate total weight of today's subjects to proportionally distribute minutes
      const subjectWeights: Record<string, number> = {};
      let totalTodayWeight = 0;
      for (const targetSub of subjectsToday) {
        const subTopics = topicPool.filter(t => t.subject === targetSub);
        const avgWeight = subTopics.length > 0
          ? subTopics.reduce((acc, t) => acc + t.weight, 0) / subTopics.length
          : 1.0;
        subjectWeights[targetSub] = avgWeight;
        totalTodayWeight += avgWeight;
      }

      const availableDailyBudget = Math.max(0, dailyMinutesBudget - dayMins);

      for (let sIdx = 0; sIdx < subjectsToday.length; sIdx++) {
        const targetSub = subjectsToday[sIdx];
        if (dayMins >= dailyMinutesBudget && dayTasks.length >= targetSubjectsCount) break;

        // Find next unassigned topic for this subject
        const nextTopicIdx = interleavedTopics.findIndex(
          (t, idx) => idx >= topicIndex && t.subject === targetSub
        );

        // Proportional duration based on weight
        const subWeight = subjectWeights[targetSub] || 1.0;
        const proportionalMinutes = totalTodayWeight > 0
          ? Math.round(availableDailyBudget * (subWeight / totalTodayWeight))
          : Math.round(availableDailyBudget / targetSubjectsCount);
        const taskDuration = Math.max(25, proportionalMinutes);

        if (nextTopicIdx !== -1) {
          const top = interleavedTopics[nextTopicIdx];

          dayTasks.push({
            id: `task_${dateStr}_${taskIdCounter++}`,
            subject: top.subject as SubjectType,
            chapter: top.chapterName,
            topic: top.topicName,
            activity: 'Learn + Practice',
            durationMinutes: taskDuration,
            completed: false,
            isWeakTopic: top.isWeakTopic
          });

          dayMins += taskDuration;
          if (nextTopicIdx === topicIndex) {
            topicIndex++;
          }
        } else {
          // If unique topics for this subject are exhausted, do targeted revision of weakest topic in this subject
          const subPool = topicPool.filter(t => t.subject === targetSub).sort((a, b) => b.weight - a.weight);
          const weakest = subPool.length > 0 ? subPool[(dailyPlans.length + sIdx) % subPool.length] : null;
          if (weakest) {
            dayTasks.push({
              id: `task_rev_${dateStr}_${taskIdCounter++}`,
              subject: targetSub as SubjectType,
              chapter: weakest.chapterName,
              topic: weakest.topicName,
              activity: 'Revision',
              durationMinutes: taskDuration,
              completed: false,
              isRevision: true,
              isWeakTopic: weakest.isWeakTopic
            });
            dayMins += taskDuration;
          }
        }
      }

      // If no tasks were scheduled (e.g. empty topics pool), fallback to top pool
      if (dayTasks.length === 0 && topicPool.length > 0) {
        const weakest = [...topicPool].sort((a, b) => b.weight - a.weight)[(dailyPlans.length) % topicPool.length];
        if (weakest) {
          dayTasks.push({
            id: `task_rev_${dateStr}_${taskIdCounter++}`,
            subject: weakest.subject as SubjectType,
            chapter: weakest.chapterName,
            topic: weakest.topicName,
            activity: 'Revision',
            durationMinutes: Math.min(dailyMinutesBudget, 60),
            completed: false,
            isRevision: true,
            isWeakTopic: weakest.isWeakTopic
          });
          dayMins += Math.min(dailyMinutesBudget, 60);
        }
      }

      dailyPlans.push({
        date: dateStr,
        day: dayOfWeek,
        dayOfWeek,
        isRestDay: false,
        tasks: dayTasks,
        totalStudyMinutes: dayMins,
        isCompleted: false
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 3. Assemble and return the complete StudentLearningPlan
  const planId = `plan_${student.id || 'guest'}_${Date.now()}`;
  const selectedChaptersMap: Record<string, string[]> = {};
  const perfSnapshot: Record<string, number> = {};

  selectedCurriculum.forEach(c => {
    selectedChaptersMap[c.subject] = c.chapters.map(ch => ch.chapterName);
    if (preAssessmentResult?.chapterPerformance) {
      c.chapters.forEach(ch => {
        if (preAssessmentResult.chapterPerformance[ch.chapterName]) {
          perfSnapshot[ch.chapterName] = preAssessmentResult.chapterPerformance[ch.chapterName].accuracy;
        }
      });
    }
  });

  return {
    id: planId,
    studentId: student.id || 'guest',
    curriculumVersionId,
    academicYear: student.academicYear || '2026-27',
    classLevel: student.grade || '10',
    board: student.board || 'CBSE',
    examDate: metrics.examDate,
    targetCompletionDate: metrics.targetCompletionDate,
    syllabusCompletionTarget: metrics.targetCompletionDate,
    daysAvailable: metrics.remainingDays,
    studyDaysCount: metrics.totalStudyDays,
    restDaysCount: metrics.totalSundays,
    revisionDaysCount: metrics.revisionDays,
    hasBufferConflict: metrics.hasBufferConflict,
    conflictMessage: metrics.conflictMessage,
    selectedSubjects: selectedSubjects as SubjectType[],
    selectedChapters: selectedChaptersMap,
    selectedChaptersCount: selectedCurriculum.reduce((acc, c) => acc + c.chapters.length, 0),
    dailyMinutesBudget,
    dailyPlans,
    performanceSnapshot: perfSnapshot,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Reschedules missed tasks from past days without exceeding daily limits or moving the exam date.
 */
export function rescheduleMissedTasks(
  existingPlan: StudentLearningPlan,
  todayStr: string = new Date().toISOString().split('T')[0]
): StudentLearningPlan {
  const updatedPlans = [...existingPlan.dailyPlans];
  const missedTasksToReassign: DailyStudyTask[] = [];

  // Find missed tasks on dates prior to today
  for (let i = 0; i < updatedPlans.length; i++) {
    const day = updatedPlans[i];
    if (day.date < todayStr && !day.isRestDay && !day.isCompleted) {
      const incomplete = day.tasks.filter(t => !t.completed);
      if (incomplete.length > 0) {
        missedTasksToReassign.push(...incomplete);
        // Mark them as missed in historical day
        day.tasks = day.tasks.map(t => (!t.completed ? { ...t, isMissed: true } : t));
      }
    }
  }

  if (missedTasksToReassign.length === 0) {
    return existingPlan;
  }

  // Distribute missed tasks into upcoming SUNDAYS (remedial days)
  // Remedial classes are scheduled strictly on Sunday, NOT on weekdays/other days.
  let taskIdx = 0;

  // First pass: Allocate strictly to upcoming Sundays
  for (let i = 0; i < updatedPlans.length; i++) {
    const day = updatedPlans[i];
    const parsed = parseLocalDate(day.date);
    const isSun = day.day === 'Sunday' || day.dayOfWeek === 'Sunday' || parsed.getDay() === 0;
    if (day.date >= todayStr && isSun && taskIdx < missedTasksToReassign.length) {
      while (taskIdx < missedTasksToReassign.length && day.totalStudyMinutes < 150) {
        const missed = missedTasksToReassign[taskIdx];
        day.tasks.push({
          ...missed,
          id: `task_remedial_sunday_${day.date}_${Date.now()}_${taskIdx}`,
          activity: 'Remedial Review',
          isMissed: false
        });
        day.totalStudyMinutes += missed.durationMinutes;
        day.restDayNote = 'Sunday Remedial Reinforcement: Focused catch-up session scheduled on Sunday so weekday study remains balanced.';
        taskIdx++;
      }
    }
  }

  // Second pass: If still tasks remaining and Sundays have room, add up to 210 mins on Sundays
  if (taskIdx < missedTasksToReassign.length) {
    for (let i = 0; i < updatedPlans.length; i++) {
      const day = updatedPlans[i];
      const parsed = parseLocalDate(day.date);
      const isSun = day.day === 'Sunday' || day.dayOfWeek === 'Sunday' || parsed.getDay() === 0;
      if (day.date >= todayStr && isSun && taskIdx < missedTasksToReassign.length) {
        while (taskIdx < missedTasksToReassign.length && day.totalStudyMinutes < 210) {
          const missed = missedTasksToReassign[taskIdx];
          day.tasks.push({
            ...missed,
            id: `task_remedial_sunday_${day.date}_${Date.now()}_${taskIdx}`,
            activity: 'Remedial Review',
            isMissed: false
          });
          day.totalStudyMinutes += missed.durationMinutes;
          taskIdx++;
        }
      }
    }
  }

  // Fallback ONLY IF no Sundays exist at all in the entire plan (e.g. synthetic test fixtures)
  if (taskIdx < missedTasksToReassign.length) {
    const hasAnySunday = updatedPlans.some(d => d.day === 'Sunday' || d.dayOfWeek === 'Sunday' || parseLocalDate(d.date).getDay() === 0);
    if (!hasAnySunday) {
      for (let i = 0; i < updatedPlans.length; i++) {
        const day = updatedPlans[i];
        if (day.date >= todayStr && taskIdx < missedTasksToReassign.length) {
          const missed = missedTasksToReassign[taskIdx];
          day.tasks.unshift({
            ...missed,
            id: `task_rescheduled_${day.date}_${Date.now()}_${taskIdx}`,
            activity: 'Remedial Review',
            isMissed: false
          });
          day.totalStudyMinutes += missed.durationMinutes;
          taskIdx++;
        }
      }
    }
  }

  return {
    ...existingPlan,
    dailyPlans: updatedPlans,
    updatedAt: new Date().toISOString()
  };
}
