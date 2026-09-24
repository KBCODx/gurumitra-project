import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Lock,
  Play,
  RotateCcw,
  Sparkles,
  ArrowDown,
  ArrowRight,
  Target,
  Award,
  Calendar,
  Clock,
  AlertCircle,
  ShieldCheck,
  Coffee,
  Check,
  ChevronDown,
  ChevronRight,
  BookOpen,
  BarChart2,
  TrendingUp,
  X,
  Loader2,
  Layers
} from 'lucide-react';
import { useStudent } from '../context/StudentContext';
import { useAuth } from '../context/AuthContext';
import {
  calculateScheduleMetrics,
  getPerformanceCategory,
  rescheduleMissedTasks
} from '../services/deterministicSchedulingService';
import {
  SubjectType,
  DailyStudyPlan,
  DailyStudyTask,
  StudentLearningPlan
} from '../types';

export const LearningPathView: React.FC = () => {
  const { user } = useAuth();
  const {
    learningPath,
    student,
    preAssessmentResult,
    activeLearningPlan,
    recordLearningPlan,
    setActiveTab,
    setActiveSubject,
    setTopicContext,
    setPlannerStep,
    toggleStudyTaskCompletion
  } = useStudent();

  const [activeSubTab, setActiveSubTab] = useState<'plan' | 'progress' | 'graph'>('plan');
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [isWeeklyTestOpen, setIsWeeklyTestOpen] = useState<boolean>(false);
  const [weeklyTestLoading, setWeeklyTestLoading] = useState<boolean>(false);
  const [weeklyTestQuestions, setWeeklyTestQuestions] = useState<any[]>([]);
  const [weeklyTestAnswers, setWeeklyTestAnswers] = useState<Record<number, number>>({});
  const [weeklyTestSubmitted, setWeeklyTestSubmitted] = useState<boolean>(false);
  const [weeklyTestResult, setWeeklyTestResult] = useState<any | null>(null);
  const [isAdaptingPlan, setIsAdaptingPlan] = useState<boolean>(false);
  const [adaptSuccessMsg, setAdaptSuccessMsg] = useState<string | null>(null);

  // Derive schedule metrics if active plan exists
  const scheduleMetrics = useMemo(() => {
    if (!activeLearningPlan) return null;
    return calculateScheduleMetrics(activeLearningPlan.examDate, activeLearningPlan.dailyPlans[0]?.date);
  }, [activeLearningPlan]);

  // Today's date string YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Today's index in dailyPlans (or nearest upcoming day)
  const defaultTodayIndex = useMemo(() => {
    if (!activeLearningPlan || activeLearningPlan.dailyPlans.length === 0) return 0;
    const idx = activeLearningPlan.dailyPlans.findIndex(d => d.date === todayStr);
    return idx >= 0 ? idx : 0;
  }, [activeLearningPlan, todayStr]);

  // Sync selected day index when plan loads
  React.useEffect(() => {
    setSelectedDayIdx(defaultTodayIndex);
  }, [defaultTodayIndex]);

  // Detect missed tasks from prior days
  const missedTasksPrior = useMemo(() => {
    if (!activeLearningPlan) return [];
    return activeLearningPlan.dailyPlans
      .filter(d => d.date < todayStr && !d.isRestDay)
      .flatMap(d => d.tasks.filter(t => !t.completed));
  }, [activeLearningPlan, todayStr]);

  // Handle toggling task completion status with centralized real progress recalculation
  const handleToggleTask = (dayDate: string, taskId: string) => {
    toggleStudyTaskCompletion(dayDate, taskId);
  };

  // Handle rescheduling missed tasks
  const handleReschedule = () => {
    if (!activeLearningPlan) return;
    const adjustedPlan = rescheduleMissedTasks(activeLearningPlan, todayStr);
    recordLearningPlan(adjustedPlan);
  };

  // Launch a specific study task in Tutor / Adaptive Learning mode
  const handleStartTask = (task: DailyStudyTask) => {
    setActiveSubject(task.subject as SubjectType);
    setTopicContext(task.subject as SubjectType, task.chapter, task.topic);
    setActiveTab('adaptive');
  };

  // Launch topic node from legacy graph
  const handleLaunchTopic = (node: any) => {
    setActiveSubject(node.subject);
    setTopicContext(node.subject, node.title, node.title);
    setActiveTab('adaptive');
  };

  // Start Weekly Test
  const handleOpenWeeklyTest = async () => {
    setIsWeeklyTestOpen(true);
    setWeeklyTestLoading(true);
    setWeeklyTestAnswers({});
    setWeeklyTestSubmitted(false);
    setWeeklyTestResult(null);

    // Collect topics studied in current week
    const currentWeekIdx = Math.floor(selectedDayIdx / 7) + 1;
    const weekStartDay = (currentWeekIdx - 1) * 7;
    const weekPlans = activeLearningPlan?.dailyPlans.slice(weekStartDay, weekStartDay + 7) || [];
    const topicsThisWeek = weekPlans.flatMap(p => p.tasks.map(t => ({
      subject: t.subject,
      chapter: t.chapter,
      topic: t.topic
    })));

    try {
      const res = await fetch('/api/ai/weekly-test/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: user?.id || 'guest_student',
          weekNumber: currentWeekIdx,
          subjects: activeLearningPlan?.selectedSubjects || ['Mathematics', 'Science'],
          topics: topicsThisWeek
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.questions && data.questions.length > 0) {
          setWeeklyTestQuestions(data.questions);
          setWeeklyTestLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Fallback generating weekly test questions locally:', err);
    }

    // High quality deterministic fallback weekly test questions
    const fallbackQuestions = (activeLearningPlan?.selectedSubjects || ['Mathematics', 'Science']).flatMap((sub, subIdx) => [
      {
        id: `wt_q_${subIdx}_1`,
        subject: sub,
        chapter: 'Core Review',
        topic: 'Fundamental Principles',
        difficulty: 'medium',
        question: `In ${sub}, which of the following is considered an essential foundational principle for high exam accuracy?`,
        options: [
          'Direct conceptual derivation from first principles',
          'Memorization without systematic verification',
          'Skipping prerequisite boundary conditions',
          'Ignoring units and dimensions in problem solving'
        ],
        correctAnswer: 0,
        explanation: 'Deep conceptual derivation and strict step-wise verification ensure robustness in standard board exams.'
      },
      {
        id: `wt_q_${subIdx}_2`,
        subject: sub,
        chapter: 'Exam Applications',
        topic: 'Problem Solving',
        difficulty: 'medium',
        question: `When answering numerical or step-based questions in ${sub}, what is the highest yield test-taking strategy?`,
        options: [
          'Immediately writing random guesses',
          'Identifying given variables, stating standard formulas, and solving systematically',
          'Leaving multi-mark questions until the final minute',
          'Omitting final units and concluding statements'
        ],
        correctAnswer: 1,
        explanation: 'Stating formulas and systematic step-wise working secures partial and full marks according to official marking schemes.'
      }
    ]);

    setWeeklyTestQuestions(fallbackQuestions);
    setWeeklyTestLoading(false);
  };

  // Submit Weekly Test and Trigger Adaptive Study Plan Update
  const handleSubmitWeeklyTest = async () => {
    let correctCount = 0;
    const weakTopicsSet = new Set<string>();
    const strongTopicsSet = new Set<string>();
    const subScores: Record<string, { total: number; correct: number }> = {};

    weeklyTestQuestions.forEach((q, idx) => {
      const selected = weeklyTestAnswers[idx];
      const isCorrect = selected === q.correctAnswer;
      if (isCorrect) correctCount++;

      if (!subScores[q.subject]) subScores[q.subject] = { total: 0, correct: 0 };
      subScores[q.subject].total++;
      if (isCorrect) subScores[q.subject].correct++;

      if (!isCorrect) {
        weakTopicsSet.add(`${q.subject}: ${q.chapter}`);
      } else {
        strongTopicsSet.add(`${q.subject}: ${q.chapter}`);
      }
    });

    const totalQuestions = weeklyTestQuestions.length;
    const scorePct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const weakTopics = Array.from(weakTopicsSet);
    const strongTopics = Array.from(strongTopicsSet);

    const result = {
      scorePct,
      correctCount,
      totalQuestions,
      weakTopics,
      strongTopics,
      subScores
    };

    setWeeklyTestResult(result);
    setWeeklyTestSubmitted(true);
    setIsAdaptingPlan(true);

    // Call /api/ai/study-plan/adapt to adapt future plan
    try {
      const res = await fetch('/api/ai/study-plan/adapt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: activeLearningPlan?.id,
          studentId: user?.id || 'guest_student',
          weeklyTestResult: {
            percentage: scorePct,
            weakTopics,
            strongTopics
          },
          currentDailyPlans: activeLearningPlan?.dailyPlans
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.adaptedPlan) {
          recordLearningPlan(data.adaptedPlan);
          setAdaptSuccessMsg('Your upcoming study schedule has been updated! Weak topics received higher practice priority.');
          setIsAdaptingPlan(false);
          return;
        }
      }
    } catch (err) {
      console.warn('API study-plan/adapt fallback:', err);
    }

    // Deterministic adaptation fallback:
    if (activeLearningPlan && weakTopics.length > 0) {
      const updatedDaily: DailyStudyPlan[] = activeLearningPlan.dailyPlans.map((d, dIdx) => {
        // Boost practice for days after current day if topics match
        if (dIdx > selectedDayIdx && !d.isRestDay) {
          const matchingTasks: DailyStudyTask[] = d.tasks.map(t => {
            const isWeak = weakTopics.some(w => w.includes(t.chapter));
            if (isWeak) {
              return {
                ...t,
                activity: 'Remedial Review' as const,
                durationMinutes: Math.min(90, Math.round(t.durationMinutes * 1.3))
              };
            }
            return t;
          });
          return { ...d, tasks: matchingTasks };
        }
        return d;
      });

      recordLearningPlan({
        ...activeLearningPlan,
        dailyPlans: updatedDaily,
        updatedAt: new Date().toISOString()
      });
      setAdaptSuccessMsg('Study plan adapted: upcoming days will reinforce weak areas identified in this test.');
    }

    setIsAdaptingPlan(false);
  };

  // Active day being viewed in the timeline
  const activeDayPlan: DailyStudyPlan | undefined = activeLearningPlan?.dailyPlans[selectedDayIdx];

  // Format date helper
  const formatDateReadable = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div style={{
      maxWidth: '1020px',
      margin: '0 auto',
      padding: '32px 20px 80px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      {/* =================================================================== */}
      {/* 1. TOP HEADER & NAVIGATION BAR */}
      {/* =================================================================== */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        backgroundColor: '#FFFFFF',
        padding: '24px 28px',
        borderRadius: '16px',
        border: '1.5px solid var(--border-subtle)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4F46E5', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <Sparkles size={16} />
            <span>Adaptive AI Learning Companion</span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1E293B', margin: '4px 0 0' }}>
            My Learning Path
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.92rem', margin: '2px 0 0' }}>
            Personalized learning cycle: Assess → Analyze → Plan → Learn → Test → Adapt
          </p>
        </div>

        {/* View Switcher Sub-Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '10px' }}>
          <button
            onClick={() => setActiveSubTab('plan')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeSubTab === 'plan' ? '#FFFFFF' : 'transparent',
              color: activeSubTab === 'plan' ? '#4F46E5' : '#64748B',
              fontWeight: activeSubTab === 'plan' ? 800 : 600,
              fontSize: '0.84rem',
              cursor: 'pointer',
              boxShadow: activeSubTab === 'plan' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            Daily Roadmap
          </button>

          <button
            onClick={() => setActiveSubTab('progress')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeSubTab === 'progress' ? '#FFFFFF' : 'transparent',
              color: activeSubTab === 'progress' ? '#4F46E5' : '#64748B',
              fontWeight: activeSubTab === 'progress' ? 800 : 600,
              fontSize: '0.84rem',
              cursor: 'pointer',
              boxShadow: activeSubTab === 'progress' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            Subject Progress
          </button>

          <button
            onClick={() => setActiveSubTab('graph')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeSubTab === 'graph' ? '#FFFFFF' : 'transparent',
              color: activeSubTab === 'graph' ? '#4F46E5' : '#64748B',
              fontWeight: activeSubTab === 'graph' ? 800 : 600,
              fontSize: '0.84rem',
              cursor: 'pointer',
              boxShadow: activeSubTab === 'graph' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            Mastery Graph
          </button>
        </div>

        {/* Reconfigure / Planner Button */}
        <button
          onClick={() => {
            setPlannerStep('subjects');
            setActiveTab('learning-path-planner');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            border: '1.5px solid #C7D2FE',
            backgroundColor: '#EEF2FF',
            color: '#4F46E5',
            fontSize: '0.86rem',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          <Calendar size={16} />
          <span>{activeLearningPlan ? 'Edit Exam & Syllabus' : 'Build Learning Path'}</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* 2. NO ACTIVE PLAN BANNER (IF APPLICABLE) */}
      {/* =================================================================== */}
      {!activeLearningPlan && (
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: '36px 32px',
          borderRadius: '16px',
          border: '1.5px dashed #C7D2FE',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            backgroundColor: '#EEF2FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4F46E5'
          }}>
            <Sparkles size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
              Let&apos;s Build Your Adaptive Learning Path
            </h2>
            <p style={{ color: '#64748B', fontSize: '0.94rem', marginTop: '6px', maxWidth: '580px' }}>
              Set your target exam date, select your verified CBSE/ICSE chapters, and let our deterministic engine schedule your runway with guaranteed Sunday rest days and a 7-day revision buffer.
            </p>
          </div>
          <button
            onClick={() => {
              setPlannerStep('subjects');
              setActiveTab('learning-path-planner');
            }}
            style={{
              backgroundColor: '#4F46E5',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 28px',
              fontSize: '0.98rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 8px 20px -4px rgba(79, 70, 229, 0.4)'
            }}
          >
            <span>Start Learning Path Setup</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. RUNWAY METRICS BAR (EXAM COUNTDOWN + TARGET COMPLETION) */}
      {/* =================================================================== */}
      {activeLearningPlan && scheduleMetrics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px'
        }}>
          {/* Exam Countdown Card */}
          <div style={{
            backgroundColor: '#FFFFFF',
            padding: '20px 22px',
            borderRadius: '14px',
            border: '1.5px solid var(--border-subtle)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4F46E5', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>
              <Clock size={16} />
              <span>Exam Countdown</span>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1E293B', marginTop: '4px' }}>
              {scheduleMetrics.remainingDays} <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#64748B' }}>Days Remaining</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
              Exam: <strong>{new Date(activeLearningPlan.examDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
            </div>
          </div>

          {/* Syllabus Target Card */}
          <div style={{
            backgroundColor: '#FFFFFF',
            padding: '20px 22px',
            borderRadius: '14px',
            border: '1.5px solid var(--border-subtle)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>
              <Target size={16} />
              <span>Syllabus Target</span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#065F46', marginTop: '4px' }}>
              Complete by {new Date(scheduleMetrics.targetCompletionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#059669', marginTop: '2px', fontWeight: 600 }}>
              🛡️ {scheduleMetrics.revisionDays}-Day Revision Buffer Protected
            </div>
          </div>

          {/* Study Runway & Sundays Card */}
          <div style={{
            backgroundColor: '#FFFFFF',
            padding: '20px 22px',
            borderRadius: '14px',
            border: '1.5px solid var(--border-subtle)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#D97706', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>
              <Coffee size={16} />
              <span>Study / Rest Ratio</span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#92400E', marginTop: '4px' }}>
              {scheduleMetrics.totalStudyDays} Study / {scheduleMetrics.totalSundays} Sundays
            </div>
            <div style={{ fontSize: '0.8rem', color: '#B45309', marginTop: '2px' }}>
              🌿 Sundays guaranteed 0 min regular load
            </div>
          </div>

          {/* Weekly Test Shortcut Card */}
          <div style={{
            backgroundColor: '#F5F3FF',
            padding: '20px 22px',
            borderRadius: '14px',
            border: '1.5px solid #DDD6FE',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#7C3AED', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>
                <Award size={16} />
                <span>Weekly Assessment</span>
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#4C1D95', marginTop: '4px' }}>
                Week {Math.floor(selectedDayIdx / 7) + 1} Mastery Test
              </div>
            </div>
            <button
              onClick={handleOpenWeeklyTest}
              style={{
                marginTop: '8px',
                backgroundColor: '#7C3AED',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <span>Take Weekly Test</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. MISSED TASKS CATCH-UP ALERT BANNER */}
      {/* =================================================================== */}
      {missedTasksPrior.length > 0 && (
        <div style={{
          backgroundColor: '#FFFBEB',
          border: '1.5px solid #FCD34D',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={22} color="#D97706" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#92400E' }}>
                You have {missedTasksPrior.length} incomplete study task(s) from earlier days.
              </div>
              <div style={{ fontSize: '0.82rem', color: '#B45309', marginTop: '2px' }}>
                We can dynamically reschedule them into upcoming active study days without delaying your exam target.
              </div>
            </div>
          </div>
          <button
            onClick={handleReschedule}
            style={{
              backgroundColor: '#D97706',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 18px',
              fontSize: '0.84rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(217, 119, 6, 0.25)'
            }}
          >
            Reschedule Missed Tasks
          </button>
        </div>
      )}

      {/* Adaptation Success Banner */}
      {adaptSuccessMsg && (
        <div style={{
          backgroundColor: '#ECFDF5',
          border: '1.5px solid #A7F3D0',
          borderRadius: '12px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#065F46', fontSize: '0.88rem', fontWeight: 700 }}>
            <CheckCircle2 size={18} color="#059669" />
            <span>{adaptSuccessMsg}</span>
          </div>
          <button
            onClick={() => setAdaptSuccessMsg(null)}
            style={{ background: 'none', border: 'none', color: '#065F46', cursor: 'pointer', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. SUB-TAB 1: DAILY ROADMAP & TIMELINE */}
      {/* =================================================================== */}
      {activeSubTab === 'plan' && activeLearningPlan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Day Navigation Carousel / Tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '8px'
          }}>
            {activeLearningPlan.dailyPlans.map((day, idx) => {
              const isSelected = selectedDayIdx === idx;
              const isToday = day.date === todayStr;
              const isSunday = day.isRestDay;
              const allTasksDone = day.tasks.length > 0 && day.tasks.every(t => t.completed);

              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDayIdx(idx)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: isSelected ? '2px solid #4F46E5' : '1px solid #E2E8F0',
                    backgroundColor: isSelected
                      ? '#EEF2FF'
                      : isSunday
                      ? '#FEF3C7'
                      : '#FFFFFF',
                    color: isSelected ? '#4F46E5' : '#334155',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: '94px',
                    flexShrink: 0,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: isSunday ? '#B45309' : isSelected ? '#4F46E5' : '#64748B' }}>
                    {day.day.slice(0, 3)} {isToday && '• TODAY'}
                  </span>
                  <span style={{ fontSize: '0.98rem', fontWeight: 800, margin: '2px 0' }}>
                    {new Date(day.date).getDate()} {new Date(day.date).toLocaleDateString('en-GB', { month: 'short' })}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: isSunday ? '#92400E' : allTasksDone ? '#10B981' : '#64748B', fontWeight: 600 }}>
                    {isSunday ? '🌿 Rest' : `${day.totalStudyMinutes}m`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Day Detail Card */}
          {activeDayPlan && (
            <div style={{
              backgroundColor: '#FFFFFF',
              padding: '28px',
              borderRadius: '16px',
              border: '1.5px solid var(--border-subtle)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderBottom: '1.5px solid #F1F5F9', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase' }}>
                      Study Schedule for
                    </span>
                    <span style={{
                      backgroundColor: activeDayPlan.isRestDay ? '#FEF3C7' : '#EEF2FF',
                      color: activeDayPlan.isRestDay ? '#B45309' : '#4F46E5',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 800
                    }}>
                      {activeDayPlan.day.toUpperCase()}
                    </span>
                  </div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E293B', margin: '4px 0 0' }}>
                    {new Date(activeDayPlan.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </h2>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                      Scheduled Load
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E293B' }}>
                      {Math.floor(activeDayPlan.totalStudyMinutes / 60)}h {activeDayPlan.totalStudyMinutes % 60}m
                    </div>
                  </div>
                </div>
              </div>

              {/* Sunday Rest Day View */}
              {activeDayPlan.isRestDay ? (
                <div style={{
                  backgroundColor: '#F0FDF4',
                  border: '1.5px solid #BBF7D0',
                  borderRadius: '14px',
                  padding: '32px 24px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{ fontSize: '42px' }}>🌿</div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#14532D', margin: 0 }}>
                    Sunday — Guaranteed Rest & Recovery Day
                  </h3>
                  <p style={{ color: '#166534', fontSize: '0.94rem', maxWidth: '540px', lineHeight: 1.5, margin: 0 }}>
                    No regular study load is scheduled today (0 minutes). Take time to recharge your brain, sleep well, and build retention.
                  </p>
                  <div style={{
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                    justifyContent: 'center'
                  }}>
                    <span style={{ backgroundColor: '#DCFCE7', color: '#15803D', padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700 }}>
                      ✓ Optional: Flashcard practice
                    </span>
                    <span style={{ backgroundColor: '#DCFCE7', color: '#15803D', padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700 }}>
                      ✓ Review past mistakes
                    </span>
                    <span style={{ backgroundColor: '#DCFCE7', color: '#15803D', padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700 }}>
                      ✓ Catch up on missed work
                    </span>
                  </div>
                </div>
              ) : (
                /* Regular Day Tasks List */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {activeDayPlan.tasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#64748B' }}>
                      No tasks scheduled for this day. Enjoy your free time or do light revision!
                    </div>
                  ) : (
                    activeDayPlan.tasks.map(task => {
                      const isDone = !!task.completed;

                      return (
                        <div
                          key={task.id}
                          style={{
                            padding: '18px 20px',
                            borderRadius: '12px',
                            border: isDone ? '1px solid #BBF7D0' : '1.5px solid var(--border-subtle)',
                            backgroundColor: isDone ? '#F0FDF4' : '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '16px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                            {/* Complete Task Checkbox */}
                            <button
                              onClick={() => handleToggleTask(activeDayPlan.date, task.id)}
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '8px',
                                border: isDone ? '2px solid #10B981' : '2px solid #CBD5E1',
                                backgroundColor: isDone ? '#10B981' : '#FFFFFF',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                              title={isDone ? 'Mark Incomplete' : 'Mark Complete'}
                            >
                              {isDone && <Check size={16} strokeWidth={3} />}
                            </button>

                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{
                                  backgroundColor: '#EEF2FF',
                                  color: '#4F46E5',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.74rem',
                                  fontWeight: 800
                                }}>
                                  {task.subject}
                                </span>
                                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: isDone ? '#64748B' : '#1E293B', textDecoration: isDone ? 'line-through' : 'none' }}>
                                  {task.chapter}
                                </span>
                                <span style={{ color: '#94A3B8', fontSize: '0.8rem' }}>•</span>
                                <span style={{ fontSize: '0.84rem', color: '#475569' }}>
                                  {task.topic}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                                <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
                                  {task.activity}
                                </span>
                                <span style={{ color: '#CBD5E1' }}>|</span>
                                <span style={{ fontSize: '0.78rem', color: '#4F46E5', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Clock size={12} />
                                  <span>{task.durationMinutes} min</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Launch Learning Button */}
                          <button
                            onClick={() => handleStartTask(task)}
                            style={{
                              backgroundColor: isDone ? '#F1F5F9' : '#4F46E5',
                              color: isDone ? '#475569' : '#FFFFFF',
                              border: 'none',
                              borderRadius: '10px',
                              padding: '10px 18px',
                              fontSize: '0.84rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <span>{isDone ? 'Review' : 'Start Study'}</span>
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 6. SUB-TAB 2: SUBJECT & CHAPTER PROGRESS DRILL-DOWN */}
      {/* =================================================================== */}
      {activeSubTab === 'progress' && activeLearningPlan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            padding: '24px',
            borderRadius: '16px',
            border: '1.5px solid var(--border-subtle)'
          }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1E293B', margin: '0 0 6px' }}>
              Subject Performance & Syllabus Coverage
            </h2>
            <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '0 0 20px' }}>
              Deterministic mastery categories calculated from your diagnostic assessments & weekly tests.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {activeLearningPlan.selectedSubjects.map(sub => {
                const subSnapshot = activeLearningPlan.performanceSnapshot?.[sub];
                const score = subSnapshot !== undefined ? subSnapshot : 70;
                const category = getPerformanceCategory(score);

                // Category colors
                const colorMap = {
                  'Needs Significant Improvement': { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5' },
                  'Needs Improvement': { bg: '#FEF3C7', text: '#B45309', border: '#FCD34D' },
                  'Developing': { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
                  'Strong': { bg: '#E0E7FF', text: '#3730A3', border: '#A5B4FC' },
                  'Mastered': { bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' }
                };
                const cStyle = colorMap[category] || colorMap['Developing'];

                // Filter chapters for this subject in the plan
                const chaptersInPlan = Array.from(
                  new Set(
                    activeLearningPlan.dailyPlans.flatMap(d => d.tasks.filter(t => t.subject === sub).map(t => t.chapter))
                  )
                );

                return (
                  <div
                    key={sub}
                    style={{
                      borderRadius: '14px',
                      border: '1.5px solid var(--border-subtle)',
                      padding: '20px',
                      backgroundColor: '#FAFAFA'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1E293B' }}>
                        {sub}
                      </h3>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        backgroundColor: cStyle.bg,
                        color: cStyle.text,
                        border: `1px solid ${cStyle.border}`,
                        fontSize: '0.78rem',
                        fontWeight: 800
                      }}>
                        {category} ({score}%)
                      </span>
                    </div>

                    <div style={{ marginTop: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
                        <span>Syllabus Covered</span>
                        <span>{chaptersInPlan.length} chapters scheduled</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: '#E2E8F0', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, chaptersInPlan.length * 20)}%`, height: '100%', backgroundColor: '#4F46E5', borderRadius: '4px' }} />
                      </div>
                    </div>

                    {/* Chapter Accordions */}
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {chaptersInPlan.map(chName => {
                        const isExpanded = !!expandedChapters[`${sub}_${chName}`];
                        const chScore = activeLearningPlan.performanceSnapshot?.[chName];

                        return (
                          <div
                            key={chName}
                            style={{
                              backgroundColor: '#FFFFFF',
                              borderRadius: '8px',
                              border: '1px solid #E2E8F0',
                              padding: '10px 12px'
                            }}
                          >
                            <div
                              onClick={() => setExpandedChapters(prev => ({ ...prev, [`${sub}_${chName}`]: !prev[`${sub}_${chName}`] }))}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                            >
                              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1E293B' }}>
                                {chName}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {chScore !== undefined && (
                                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: chScore >= 70 ? '#15803D' : '#B45309' }}>
                                    {chScore}%
                                  </span>
                                )}
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </div>
                            </div>

                            {isExpanded && (
                              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #F1F5F9', fontSize: '0.78rem', color: '#64748B' }}>
                                Scheduled in active study runway. Click to review in Tutor mode.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 7. SUB-TAB 3: LEGACY TOPIC MASTERY GRAPH (PRESERVED) */}
      {/* =================================================================== */}
      {(activeSubTab === 'graph' || !activeLearningPlan) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '12px 20px',
            borderRadius: '14px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--border-subtle)',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>
              <CheckCircle2 size={16} color="#10B981" />
              <span>Completed</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#1E40AF', fontWeight: 600 }}>
              <Play size={16} color="#3B82F6" />
              <span>Current In Progress</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#991B1B', fontWeight: 600 }}>
              <RotateCcw size={16} color="#EF4444" />
              <span>Remedial Revision</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
              <Lock size={16} color="#94A3B8" />
              <span>Locked</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
            {learningPath.map((node, index) => {
              const isCompleted = node.status === 'completed';
              const isCurrent = node.status === 'current';
              const isRevision = node.status === 'revision';
              const isLocked = node.status === 'locked';

              const borderColor = isCompleted
                ? '#10B981'
                : isCurrent
                ? '#4F46E5'
                : isRevision
                ? '#EF4444'
                : '#CBD5E1';

              const bgColor = isCompleted
                ? '#F0FDF4'
                : isCurrent
                ? '#EEF2FF'
                : isRevision
                ? '#FEF2F2'
                : '#F8FAFC';

              return (
                <React.Fragment key={node.id}>
                  <div
                    className="card"
                    style={{
                      padding: '24px',
                      backgroundColor: bgColor,
                      border: `2px solid ${borderColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '20px',
                      borderRadius: '16px',
                      opacity: isLocked ? 0.7 : 1
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: isCompleted ? '#10B981' : isCurrent ? '#4F46E5' : isRevision ? '#EF4444' : '#CBD5E1',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1rem',
                        flexShrink: 0
                      }}>
                        {isCompleted ? <CheckCircle2 size={22} /> : isLocked ? <Lock size={20} /> : isRevision ? <RotateCcw size={20} /> : node.stepNumber}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                            Step {node.stepNumber} • {node.subject}
                          </span>
                          <span className={`badge ${
                            isCompleted ? 'badge-on-track' : isCurrent ? 'badge-info' : isRevision ? 'badge-high-priority' : 'badge-practice'
                          }`} style={{ fontSize: '0.68rem' }}>
                            {node.status.toUpperCase()}
                          </span>
                        </div>

                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E293B', marginBottom: '4px' }}>
                          {node.title}
                        </h3>

                        <p style={{ fontSize: '0.82rem', color: '#475569', margin: 0 }}>
                          {node.description}
                        </p>
                      </div>
                    </div>

                    <div>
                      {!isLocked ? (
                        <button
                          onClick={() => handleLaunchTopic(node)}
                          className="btn btn-primary"
                          style={{
                            padding: '10px 18px',
                            fontSize: '0.85rem',
                            background: isRevision
                              ? 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)'
                              : undefined
                          }}
                        >
                          <span>{isRevision ? 'Start Revision' : isCompleted ? 'Review' : 'Continue'}</span>
                          <ArrowRight size={15} />
                        </button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600 }}>
                          <Lock size={14} />
                          <span>Locked</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {index < learningPath.length - 1 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      padding: '8px 0',
                      color: '#94A3B8'
                    }}>
                      <ArrowDown size={22} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 8. WEEKLY TEST MODAL */}
      {/* =================================================================== */}
      {isWeeklyTestOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            maxWidth: '740px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FAFAFA'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Award size={22} color="#7C3AED" />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1E293B' }}>
                  Weekly Adaptive Test (Week {Math.floor(selectedDayIdx / 7) + 1})
                </h3>
              </div>
              <button
                onClick={() => setIsWeeklyTestOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 0 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {weeklyTestLoading ? (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <Loader2 size={36} className="spin" color="#7C3AED" style={{ margin: '0 auto 12px' }} />
                  <h4 style={{ margin: 0, color: '#1E293B', fontSize: '1.1rem' }}>
                    Generating Verified Weekly Test Questions...
                  </h4>
                  <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: '#64748B' }}>
                    Curating high-yield questions for topics studied this week.
                  </p>
                </div>
              ) : weeklyTestSubmitted && weeklyTestResult ? (
                /* Results View */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{
                    textAlign: 'center',
                    padding: '24px',
                    backgroundColor: weeklyTestResult.scorePct >= 70 ? '#F0FDF4' : '#FFFBEB',
                    borderRadius: '16px',
                    border: `1.5px solid ${weeklyTestResult.scorePct >= 70 ? '#BBF7D0' : '#FCD34D'}`
                  }}>
                    <div style={{ fontSize: '2.4rem', fontWeight: 900, color: weeklyTestResult.scorePct >= 70 ? '#15803D' : '#B45309' }}>
                      {weeklyTestResult.scorePct}%
                    </div>
                    <h4 style={{ margin: '4px 0 0', fontSize: '1.1rem', color: '#1E293B' }}>
                      {weeklyTestResult.correctCount} of {weeklyTestResult.totalQuestions} questions correct
                    </h4>
                    <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: '#64748B' }}>
                      Performance Category: <strong>{getPerformanceCategory(weeklyTestResult.scorePct)}</strong>
                    </p>
                  </div>

                  {weeklyTestResult.weakTopics.length > 0 && (
                    <div style={{ backgroundColor: '#FEF2F2', padding: '16px', borderRadius: '12px', border: '1px solid #FECACA' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#991B1B', textTransform: 'uppercase' }}>
                        Identified Gaps for Re-Testing & Revision:
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                        {weeklyTestResult.weakTopics.map((wt: string) => (
                          <span key={wt} style={{ backgroundColor: '#FFFFFF', color: '#DC2626', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, border: '1px solid #FECACA' }}>
                            {wt}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {isAdaptingPlan && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4F46E5', fontSize: '0.85rem', fontWeight: 700, justifyContent: 'center' }}>
                      <Loader2 size={16} className="spin" />
                      <span>Adapting next week&apos;s study schedule...</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Questions View */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {weeklyTestQuestions.map((q, qIdx) => (
                    <div
                      key={q.id || qIdx}
                      style={{
                        padding: '18px 20px',
                        borderRadius: '14px',
                        border: '1px solid #E2E8F0',
                        backgroundColor: '#FFFFFF'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ backgroundColor: '#EEF2FF', color: '#4F46E5', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                          {q.subject}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
                          {q.chapter}
                        </span>
                      </div>
                      <h4 style={{ margin: '0 0 14px', fontSize: '0.98rem', fontWeight: 700, color: '#1E293B', lineHeight: 1.4 }}>
                        Q{qIdx + 1}. {q.question}
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {q.options.map((opt: string, optIdx: number) => {
                          const isSelected = weeklyTestAnswers[qIdx] === optIdx;
                          return (
                            <button
                              key={optIdx}
                              onClick={() => setWeeklyTestAnswers(prev => ({ ...prev, [qIdx]: optIdx }))}
                              style={{
                                textAlign: 'left',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                border: isSelected ? '2px solid #7C3AED' : '1px solid #E2E8F0',
                                backgroundColor: isSelected ? '#F5F3FF' : '#FFFFFF',
                                color: isSelected ? '#7C3AED' : '#334155',
                                fontSize: '0.88rem',
                                fontWeight: isSelected ? 700 : 500,
                                cursor: 'pointer',
                                transition: 'all 0.1s ease'
                              }}
                            >
                              <span style={{ fontWeight: 800, marginRight: '8px' }}>
                                {String.fromCharCode(65 + optIdx)}.
                              </span>
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              backgroundColor: '#FAFAFA'
            }}>
              {weeklyTestSubmitted ? (
                <button
                  onClick={() => setIsWeeklyTestOpen(false)}
                  style={{
                    backgroundColor: '#7C3AED',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 24px',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Close & View Updated Plan
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setIsWeeklyTestOpen(false)}
                    style={{
                      background: 'none',
                      border: '1px solid #CBD5E1',
                      borderRadius: '10px',
                      padding: '10px 18px',
                      fontSize: '0.88rem',
                      color: '#64748B',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitWeeklyTest}
                    disabled={Object.keys(weeklyTestAnswers).length === 0}
                    style={{
                      backgroundColor: '#7C3AED',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '10px 24px',
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      cursor: Object.keys(weeklyTestAnswers).length === 0 ? 'not-allowed' : 'pointer',
                      opacity: Object.keys(weeklyTestAnswers).length === 0 ? 0.6 : 1
                    }}
                  >
                    Submit Test & Adapt Schedule
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
