import React, { useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Calendar,
  Flame,
  Award,
  Sparkles,
  ArrowUpRight,
  PieChart,
  Clock,
  BookOpen,
  AlertCircle,
  ArrowRight,
  HelpCircle,
  Target
} from 'lucide-react';
import { useStudent } from '../context/StudentContext';

export const AnalyticsView: React.FC = () => {
  const {
    student,
    subjects,
    activities,
    quizHistory,
    allStudySessions,
    preAssessmentResult,
    progressMetrics,
    setActiveTab,
    setTopicContext
  } = useStudent();

  // Dynamically compute study activity by day of the week from all real sessions & quizzes
  const weeklyDays = useMemo(() => {
    const daysMap: Record<string, { day: string; hours: number; sessions: number }> = {
      Mon: { day: 'Mon', hours: 0, sessions: 0 },
      Tue: { day: 'Tue', hours: 0, sessions: 0 },
      Wed: { day: 'Wed', hours: 0, sessions: 0 },
      Thu: { day: 'Thu', hours: 0, sessions: 0 },
      Fri: { day: 'Fri', hours: 0, sessions: 0 },
      Sat: { day: 'Sat', hours: 0, sessions: 0 },
      Sun: { day: 'Sun', hours: 0, sessions: 0 }
    };

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // 1. Process study sessions
    allStudySessions.forEach(session => {
      const dateObj = new Date(session.startedAt || session.date || Date.now());
      const dayName = dayNames[dateObj.getDay()];
      if (daysMap[dayName]) {
        const mins = session.actualMinutes || session.allocatedMinutes || 30;
        daysMap[dayName].hours += mins / 60;
        daysMap[dayName].sessions += 1;
      }
    });

    // 2. Process quiz history
    quizHistory.forEach(quiz => {
      const dateObj = new Date(quiz.timestamp || Date.now());
      const dayName = dayNames[dateObj.getDay()];
      if (daysMap[dayName]) {
        const mins = (quiz.timeSpentSeconds ? quiz.timeSpentSeconds / 60 : 10);
        daysMap[dayName].hours += mins / 60;
        daysMap[dayName].sessions += 1;
      }
    });

    // Baseline minimum display for fresh presentation user if no activity yet recorded
    const rawList = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(k => daysMap[k]);
    const totalSessions = rawList.reduce((acc, d) => acc + d.sessions, 0);

    // If completely empty, show presentation baseline values aligned to Sally Sharma's 4-day streak
    if (totalSessions === 0 && student.isDemo) {
      return [
        { day: 'Mon', hours: 1.2, sessions: 2 },
        { day: 'Tue', hours: 1.8, sessions: 3 },
        { day: 'Wed', hours: 0.9, sessions: 1 },
        { day: 'Thu', hours: 2.1, sessions: 4 },
        { day: 'Fri', hours: 0.4, sessions: 1 },
        { day: 'Sat', hours: 0.0, sessions: 0 },
        { day: 'Sun', hours: 0.0, sessions: 0 }
      ];
    }

    return rawList.map(d => ({
      ...d,
      hours: Math.round(d.hours * 10) / 10
    }));
  }, [allStudySessions, quizHistory, student.isDemo]);

  const totalWeeklyHours = useMemo(() => {
    return Math.round(weeklyDays.reduce((acc, d) => acc + d.hours, 0) * 10) / 10;
  }, [weeklyDays]);

  const totalWeeklySessions = useMemo(() => {
    return weeklyDays.reduce((acc, d) => acc + d.sessions, 0);
  }, [weeklyDays]);

  // Dynamically compute real Strong Areas & Areas Needing Practice from:
  // 1) Quizzes taken
  // 2) Diagnostic Pre-assessment
  // 3) Subject matrix
  const { realStrongTopics, realWeakTopics } = useMemo(() => {
    const strongSet = new Set<string>();
    const weakSet = new Set<string>();

    // From quizzes
    quizHistory.forEach(q => {
      if (q.accuracy >= 75) {
        strongSet.add(`${q.topic} (${q.subject})`);
        weakSet.delete(`${q.topic} (${q.subject})`);
      } else if (q.accuracy < 60) {
        weakSet.add(`${q.topic} (${q.subject})`);
        strongSet.delete(`${q.topic} (${q.subject})`);
      }
    });

    // From pre-assessment diagnostic gaps
    if (preAssessmentResult) {
      preAssessmentResult.identifiedGaps.forEach(gap => {
        weakSet.add(`${gap.topic} (${gap.subject})`);
      });
      // Correct questions in pre-assessment
      preAssessmentResult.questionPerformance
        .filter(q => q.isCorrect)
        .slice(0, 4)
        .forEach(q => {
          strongSet.add(`${q.chapterName} (${q.subject})`);
        });
    }

    // From subjects' strengths and weaknesses
    subjects.forEach(sub => {
      sub.strengths.forEach(st => strongSet.add(`${st} (${sub.name})`));
      sub.weaknesses.forEach(wk => weakSet.add(`${wk} (${sub.name})`));
    });

    return {
      realStrongTopics: Array.from(strongSet).slice(0, 8),
      realWeakTopics: Array.from(weakSet).slice(0, 8)
    };
  }, [quizHistory, preAssessmentResult, subjects]);

  const maxWeeklyHours = Math.max(2.5, ...weeklyDays.map(d => d.hours));

  return (
    <div style={{
      maxWidth: '1180px',
      margin: '0 auto',
      padding: '32px 32px 64px',
      display: 'flex',
      flexDirection: 'column',
      gap: '28px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase' }}>
            Diagnostic Learning Analytics
          </span>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1E293B', marginTop: '2px', margin: 0 }}>
            Progress & Performance
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.92rem', margin: '4px 0 0' }}>
            Calculated in real time from completed lessons, adaptive quizzes, and diagnostic assessments.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setActiveTab('quiz')}
            className="btn btn-primary"
            style={{ padding: '8px 18px', fontSize: '0.85rem' }}
          >
            <HelpCircle size={15} />
            <span>Take New Quiz</span>
          </button>
          <button
            onClick={() => setActiveTab('pre-assessment')}
            className="btn btn-outline"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <Sparkles size={14} color="#4F46E5" />
            <span>Assessments</span>
          </button>
        </div>
      </div>

      {/* Row 1: High Level Real Data KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px'
      }}>
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>
            OVERALL ACCURACY
          </span>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10B981', margin: '6px 0 2px' }}>
            {student.overallAccuracy}%
          </div>
          <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700 }}>
            {quizHistory.length > 0 ? `Based on ${quizHistory.length} quiz attempt(s)` : 'Diagnostic baseline'}
          </span>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #F97316' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>
            LEARNING STREAK
          </span>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#F97316', margin: '6px 0 2px' }}>
            {student.streak} Days 🔥
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
            Daily study momentum active
          </span>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #4F46E5' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>
            SYLLABUS PROGRESS
          </span>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#4F46E5', margin: '6px 0 2px' }}>
            {student.overallProgress || progressMetrics.overallProgressPct}%
          </div>
          <span style={{ fontSize: '0.72rem', color: '#4F46E5', fontWeight: 700 }}>
            {progressMetrics.completedTopicsCount} of {progressMetrics.totalTopicsCount} topics covered
          </span>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #7C3AED' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>
            ADAPTIVE LEVEL
          </span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1E293B', margin: '6px 0 2px' }}>
            {student.level}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#7C3AED', fontWeight: 700 }}>
            Tuned by performance loop
          </span>
        </div>
      </div>

      {/* Row 2: Subject Performance Bars + Weekly Activity */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)',
        gap: '24px'
      }}>
        {/* Subject Accuracy & Progress List */}
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
              Subject-wise Progress & Mastery
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
              Class 10 CBSE Benchmark
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {subjects.map((sub) => (
              <div key={sub.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>{sub.icon}</span>
                    <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1E293B' }}>
                      {sub.name}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                      ({sub.completedTopics}/{sub.totalTopics} Topics)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B' }}>
                      Progress: {sub.progress}%
                    </span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: sub.color }}>
                      Mastery: {sub.accuracy}%
                    </span>
                  </div>
                </div>

                <div className="progress-bar-container" style={{ height: '8px' }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${sub.accuracy}%`,
                      background: `linear-gradient(90deg, ${sub.color} 0%, ${sub.color}cc 100%)`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Activity Bar Chart with Real Data */}
        <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                Weekly Activity
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                Study Hours
              </span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              height: '160px',
              paddingTop: '20px',
              borderBottom: '1px solid #E2E8F0',
              marginBottom: '12px'
            }}>
              {weeklyDays.map((d, i) => {
                const heightPercent = maxWeeklyHours > 0 ? (d.hours / maxWeeklyHours) * 100 : 0;
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '32px' }}>
                    <div
                      style={{
                        width: '18px',
                        height: `${Math.max(6, heightPercent)}%`,
                        background: d.hours > 0 ? 'linear-gradient(180deg, #4F46E5 0%, #818CF8 100%)' : '#E2E8F0',
                        borderRadius: '6px 6px 0 0',
                        transition: 'height 0.4s ease'
                      }}
                      title={`${d.hours} hrs (${d.sessions} session/quiz)`}
                    />
                    <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
                      {d.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{
            padding: '12px 16px',
            borderRadius: '12px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #F1F5F9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '0.8rem', color: '#64748B' }}>Total This Week:</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1E293B' }}>
              {totalWeeklyHours} Hours • {totalWeeklySessions} Study Actions
            </span>
          </div>
        </div>
      </div>

      {/* Row 3: Strengths vs Weaknesses Breakdown derived from real results */}
      <div className="card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
              Diagnostic Strengths & Improvement Areas
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '4px 0 0' }}>
              Dynamically identified based on your assessment results, quiz accuracy thresholds, and practice sessions.
            </p>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4F46E5', backgroundColor: '#EEF2FF', padding: '4px 10px', borderRadius: '999px' }}>
            Adaptive Engine
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px'
        }}>
          {/* Strong Areas */}
          <div style={{
            padding: '20px',
            borderRadius: '16px',
            backgroundColor: '#F0FDF4',
            border: '1.5px solid #BBF7D0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <CheckCircle2 size={18} color="#15803D" />
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#15803D', margin: 0 }}>
                Strong Areas (Mastery &ge; 75%)
              </h4>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {realStrongTopics.length > 0 ? (
                realStrongTopics.map((st, i) => (
                  <span key={i} className="badge badge-on-track" style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                    ✓ {st}
                  </span>
                ))
              ) : (
                <p style={{ fontSize: '0.82rem', color: '#166534', margin: 0 }}>
                  Take quizzes to demonstrate topic mastery and unlock verified strong areas.
                </p>
              )}
            </div>
          </div>

          {/* Weak Areas needing revision */}
          <div style={{
            padding: '20px',
            borderRadius: '16px',
            backgroundColor: '#FEF2F2',
            border: '1.5px solid #FECACA'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <TrendingUp size={18} color="#DC2626" />
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#B91C1C', margin: 0 }}>
                Areas Needing Practice (Mastery &lt; 60%)
              </h4>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {realWeakTopics.length > 0 ? (
                realWeakTopics.map((wk, i) => (
                  <span key={i} className="badge badge-high-priority" style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                    ! {wk}
                  </span>
                ))
              ) : (
                <p style={{ fontSize: '0.82rem', color: '#991B1B', margin: 0 }}>
                  No critical learning gaps currently detected! Maintain your performance.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Real Quiz History Feed */}
      <div className="card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
              Recent Quiz Attempts & Performance
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '4px 0 0' }}>
              Stored records of every quiz completed in this profile.
            </p>
          </div>

          <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
            Total Attempts: <strong>{quizHistory.length}</strong>
          </span>
        </div>

        {quizHistory.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {quizHistory.map((quiz) => {
              const isPass = quiz.accuracy >= 60;
              const formattedDate = quiz.timestamp
                ? new Date(quiz.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'Recent';

              return (
                <div
                  key={quiz.id}
                  style={{
                    padding: '16px 20px',
                    borderRadius: '14px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      backgroundColor: isPass ? '#DCFCE7' : '#FEE2E2',
                      color: isPass ? '#15803D' : '#DC2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.9rem'
                    }}>
                      {quiz.accuracy}%
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E293B' }}>
                          {quiz.topic}
                        </span>
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                          {quiz.subject}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        Score: {quiz.score}/{quiz.totalQuestions} • Difficulty: {quiz.difficulty} • {formattedDate}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className={`badge ${quiz.accuracy >= 80 ? 'badge-on-track' : quiz.accuracy >= 60 ? 'badge-practice' : 'badge-high-priority'}`}>
                      {quiz.accuracy >= 80 ? 'Advanced Mastery' : quiz.accuracy >= 60 ? 'Proficient' : 'Needs Practice'}
                    </span>
                    <button
                      onClick={() => {
                        setTopicContext(quiz.subject, quiz.chapter || quiz.topic, quiz.topic);
                        setActiveTab('quiz');
                      }}
                      className="btn btn-outline"
                      style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                    >
                      <span>Retake</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            padding: '36px 20px',
            textAlign: 'center',
            backgroundColor: '#F8FAFC',
            borderRadius: '14px',
            border: '1px dashed #CBD5E1'
          }}>
            <HelpCircle size={36} color="#94A3B8" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', marginBottom: '4px' }}>
              No Quiz Results Recorded Yet
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#64748B', maxWidth: '420px', margin: '0 auto 16px' }}>
              Complete adaptive topic quizzes to unlock historical score trends, mistake breakdowns, and verified accuracy analytics.
            </p>
            <button
              onClick={() => setActiveTab('quiz')}
              className="btn btn-primary"
              style={{ padding: '8px 20px', fontSize: '0.85rem' }}
            >
              Take Your First Quiz Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
