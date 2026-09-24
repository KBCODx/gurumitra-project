import React from 'react';
import {
  ArrowRight,
  Flame,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
  Award,
  AlertCircle,
  HelpCircle,
  BookOpen,
  Atom,
  Lightbulb,
  ShieldCheck,
  Target,
  GraduationCap
} from 'lucide-react';
import { useStudent } from '../context/StudentContext';
import { getTodaysLesson, getChapters } from '../services/curriculumService';

export const Dashboard: React.FC = () => {
  const { student, subjects, activities, activeSubject, setActiveTab, setActiveSubject, currentLearningContext, preAssessmentResult, progressMetrics } = useStudent();

  const todaysLesson = getTodaysLesson(
    student.grade,
    student.board,
    student.stream,
    activeSubject,
    student.level
  );

  const currentSubjectChapters = getChapters(
    student.grade,
    student.board,
    student.stream,
    activeSubject
  );

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '32px 32px 64px',
      display: 'flex',
      flexDirection: 'column',
      gap: '28px'
    }}>
      {/* Top Welcome Greeting Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#4F46E5',
            backgroundColor: '#EEF2FF',
            padding: '4px 12px',
            borderRadius: '999px',
            marginBottom: '6px'
          }}>
            <GraduationCap size={15} />
            <span>
              {student.grade} • {student.board} {student.stream !== 'Not applicable' ? `• ${student.stream}` : ''}
            </span>
          </div>
          <h1 style={{
            fontSize: '1.9rem',
            fontWeight: 800,
            color: '#1E293B',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>Welcome back, {student.name.split(' ')[0]}!</span>
            <span>👋</span>
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.95rem' }}>
            Your curriculum is calibrated to {student.grade} ({student.board}). AI adaptive engine is continuously tuning your study plan.
          </p>
        </div>

        {/* Quick Level Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: '#FFFFFF',
          padding: '8px 18px',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
        }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: student.level === 'Advanced' ? '#10B981' : student.level === 'Intermediate' ? '#4F46E5' : '#F59E0B',
            boxShadow: `0 0 10px ${student.level === 'Advanced' ? '#10B981' : '#4F46E5'}`
          }} />
          <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>
            Difficulty:
          </span>
          <span style={{ fontSize: '0.9rem', color: '#1E293B', fontWeight: 800 }}>
            {student.level}
          </span>
        </div>
      </div>

      {/* AI Diagnostic Pre-Assessment Banner */}
      {preAssessmentResult ? (
        <div className="card" style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
          border: '1.5px solid #C7D2FE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
            }}>
              <Sparkles size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B' }}>
                  Diagnostic Baseline: {preAssessmentResult.overallScore}% ({preAssessmentResult.learningLevel})
                </span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '999px' }}>
                  Active
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0' }}>
                {preAssessmentResult.identifiedGaps.length} learning gap(s) identified across {Object.keys(preAssessmentResult.chapterPerformance).length} chapters • {preAssessmentResult.correctAnswers} of {preAssessmentResult.totalQuestions} questions correct.
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('pre-assessment')}
            className="btn btn-primary"
            style={{ padding: '8px 18px', fontSize: '0.84rem' }}
          >
            <span>View Diagnostic Report</span>
            <ArrowRight size={15} />
          </button>
        </div>
      ) : (
        <div className="card" style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
          border: '1.5px solid #C7D2FE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
            }}>
              <Sparkles size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B' }}>
                  Establish Your Learning Baseline (Pre-Assessment)
                </span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#FEF3C7', color: '#D97706', padding: '2px 8px', borderRadius: '999px' }}>
                  Recommended
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0' }}>
                Take a short combined diagnostic assessment to uncover your topic-level strengths, knowledge gaps, and initialize your adaptive study path.
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('pre-assessment')}
            className="btn btn-primary"
            style={{ padding: '8px 18px', fontSize: '0.84rem' }}
          >
            <span>Start Pre-Assessment</span>
            <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* Row 1: Today's Learning + Motivational Card */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)',
        gap: '24px'
      }}>
        {/* Today's Learning Card (Dynamic according to activeSubject & academic profile) */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#64748B',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Today's Learning
              </span>
              <span className="badge badge-info">
                {activeSubject} Active Session
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
                border: '1px solid #C7D2FE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4F46E5',
                fontSize: '1.6rem'
              }}>
                {subjects.find(s => s.name === activeSubject)?.icon || '📚'}
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#4F46E5', fontWeight: 700 }}>
                  {activeSubject} ({student.grade})
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E293B' }}>
                  {currentLearningContext.topic || todaysLesson.topic}
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  {currentLearningContext.chapter || todaysLesson.chapter}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
                <span style={{ color: '#64748B', fontWeight: 600 }}>Mastery Progress</span>
                <span style={{ color: '#4F46E5', fontWeight: 800 }}>{todaysLesson.progress}%</span>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${todaysLesson.progress}%` }} />
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('adaptive')}
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px' }}
          >
            <span>Continue {activeSubject} Lesson</span>
            <ArrowRight size={17} />
          </button>
        </div>

        {/* Motivational Card with Plant */}
        <div className="card" style={{
          padding: '24px',
          background: 'linear-gradient(145deg, #FAF5FF 0%, #F3E8FF 100%)',
          border: '1px solid #E9D5FF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            boxShadow: '0 8px 20px rgba(168, 85, 247, 0.15)',
            marginBottom: '16px'
          }}>
            🌱
          </div>
          <p style={{
            fontSize: '1.15rem',
            fontWeight: 700,
            color: '#6B21A8',
            fontFamily: 'var(--font-display)',
            maxWidth: '240px',
            lineHeight: '1.4',
            marginBottom: '10px'
          }}>
            "Small steps every day lead to big results."
          </p>
          <span style={{ fontSize: '0.78rem', color: '#9333EA', fontWeight: 600 }}>
            Daily Momentum • Streak: {student.streak} Days
          </span>
        </div>
      </div>

      {/* Row 2: Today's Focus (Dynamic for activeSubject) + Recent Activity */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1.5fr)',
        gap: '24px'
      }}>
        {/* Today's Focus List calibrated to active subject */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={18} color="#4F46E5" />
              <span>Today's Focus • {activeSubject}</span>
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
              AI Prioritized
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Topic 1 - High Priority */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: '14px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #F1F5F9'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E293B' }}>
                  {currentSubjectChapters[0]?.topics[0]?.title || `${activeSubject} Core Fundamentals`}
                </span>
              </div>
              <span className="badge badge-high-priority">
                High Priority
              </span>
            </div>

            {/* Topic 2 - Practice */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: '14px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #F1F5F9'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E293B' }}>
                  {currentSubjectChapters[0]?.topics[1]?.title || `${activeSubject} Problem Sets`}
                </span>
              </div>
              <span className="badge badge-practice">
                Practice
              </span>
            </div>

            {/* Topic 3 - On Track */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: '14px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #F1F5F9'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E293B' }}>
                  {currentSubjectChapters[1]?.topics[0]?.title || `Applied ${activeSubject} Review`}
                </span>
              </div>
              <span className="badge badge-on-track">
                On Track
              </span>
            </div>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="#4F46E5" />
              <span>Recent Activity</span>
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
              Live Stream
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activities.slice(0, 3).map((act) => (
              <div
                key={act.id}
                style={{
                  padding: '12px 16px',
                  borderRadius: '14px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #F1F5F9',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1E293B', marginBottom: '2px' }}>
                    {act.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    {act.subtitle}
                  </div>
                </div>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#4F46E5',
                  backgroundColor: '#EEF2FF',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  whiteSpace: 'nowrap'
                }}>
                  {act.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Key Metrics & AI Learning Insights (Prompt Section 4 & 17) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px'
      }}>
        <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #4F46E5' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Today's Progress</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1E293B', marginTop: '4px' }}>
            {progressMetrics.todayProgressPct}%
          </div>
          <div style={{ fontSize: '0.72rem', color: '#4F46E5', fontWeight: 700, marginTop: '2px' }}>
            {progressMetrics.todayCompletedTasks} / {progressMetrics.todayTotalTasks} tasks completed
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>This Week's Runway</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1E293B', marginTop: '4px' }}>
            {progressMetrics.weekProgressPct}%
          </div>
          <div style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700, marginTop: '2px' }}>
            {progressMetrics.weekCompletedTasks} / {progressMetrics.weekTotalTasks} tasks completed
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #F59E0B' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Overall Progress</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1E293B', marginTop: '4px' }}>
            {student.overallProgress}%
          </div>
          <div style={{ fontSize: '0.72rem', color: '#D97706', fontWeight: 600, marginTop: '2px' }}>
            {progressMetrics.overallCompletedTasks} / {progressMetrics.overallTotalTasks} total curriculum units
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #EC4899' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Learning Streak</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1E293B', marginTop: '4px' }}>
            {student.streak} Days 🔥
          </div>
          <div style={{ fontSize: '0.72rem', color: '#EC4899', fontWeight: 700, marginTop: '2px' }}>
            Daily consistency record
          </div>
        </div>
      </div>

      {/* Row 4: AI Learning Insights Box */}
      <div className="card" style={{
        padding: '24px',
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFF 100%)',
        border: '1.5px solid #E0E7FF'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Sparkles size={20} color="#4F46E5" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B' }}>
            Your Learning Insights
          </h3>
          <span style={{
            fontSize: '0.7rem',
            backgroundColor: '#EEF2FF',
            color: '#4F46E5',
            padding: '2px 8px',
            borderRadius: '999px',
            fontWeight: 700
          }}>
            AI Generated
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px'
        }}>
          <div style={{
            padding: '14px 16px',
            borderRadius: '14px',
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#15803D', marginBottom: '4px' }}>
              🌟 Strongest Subjects
            </div>
            <p style={{ fontSize: '0.8rem', color: '#166534', margin: 0 }}>
              You're performing highest in <strong>English (91%)</strong> and <strong>Science (74%)</strong>.
            </p>
          </div>

          <div style={{
            padding: '14px 16px',
            borderRadius: '14px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#B91C1C', marginBottom: '4px' }}>
              🎯 Target for Practice
            </div>
            <p style={{ fontSize: '0.8rem', color: '#991B1B', margin: 0 }}>
              <strong>Geometry</strong> needs more practice before advancing to coordinate theorems.
            </p>
          </div>

          <div style={{
            padding: '14px 16px',
            borderRadius: '14px',
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1D4ED8', marginBottom: '4px' }}>
              💡 Pedagogical Match
            </div>
            <p style={{ fontSize: '0.8rem', color: '#1E40AF', margin: 0 }}>
              Retention is highest when concepts are framed using <strong>{student.preferredStyle}</strong> explanations.
            </p>
          </div>
        </div>
      </div>

      {/* Row: Enrolled Academic Subjects Section (Matching Section 16 Requirement) */}
      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase' }}>
              {student.grade} • {student.board} {student.stream !== 'Not applicable' ? `• ${student.stream}` : ''}
            </span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E293B', margin: '2px 0 0' }}>
              Your Enrolled Subjects
            </h3>
          </div>
          <button
            onClick={() => setActiveTab('subjects')}
            className="btn btn-outline"
            style={{ padding: '6px 14px', fontSize: '0.82rem' }}
          >
            <span>View All Subjects</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px'
        }}>
          {subjects.map((sub) => {
            const isActive = sub.name.toLowerCase() === activeSubject.toLowerCase();
            return (
              <div
                key={sub.id}
                onClick={() => {
                  setActiveSubject(sub.name);
                  setActiveTab('adaptive');
                }}
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  backgroundColor: isActive ? '#EEF2FF' : '#F8FAFC',
                  border: isActive ? '2px solid #4F46E5' : '1px solid #E2E8F0',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: isActive ? '0 4px 14px rgba(79, 70, 229, 0.1)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '1.6rem' }}>{sub.icon}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: sub.color,
                      backgroundColor: sub.bgLight,
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}>
                      {sub.progress}% Progress
                    </span>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#047857',
                      backgroundColor: '#ECFDF5',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: '1px solid #A7F3D0'
                    }}>
                      {sub.accuracy}% Mastery
                    </span>
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B', margin: '0 0 4px' }}>
                    {sub.name}
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0 0 2px' }}>
                    {sub.completedTopics} / {sub.totalTopics} Topics Completed
                  </p>
                </div>
                <div className="progress-bar-container" style={{ height: '6px' }}>
                  <div className="progress-bar-fill" style={{ width: `${sub.progress}%`, backgroundColor: sub.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 5: WHY GURUMITRA? BANNER (Matching Screenshot Panel 10 & USP!) */}
      <div style={{
        background: 'linear-gradient(135deg, #EEF2FF 0%, #FAF5FF 100%)',
        border: '1.5px solid #E0E7FF',
        borderRadius: '24px',
        padding: '28px 32px',
        position: 'relative'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              fontWeight: 800,
              color: '#4F46E5',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '6px'
            }}>
              <Sparkles size={15} />
              <span>The Adaptive Advantage</span>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E293B' }}>
              Why GuruMitra?
            </h2>
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.1rem',
            fontWeight: 700,
            color: '#7C3AED',
            fontStyle: 'italic'
          }}>
            "Because every student learns differently ♡"
          </div>
        </div>

        {/* 5 Pillars matching Panel 10 in Screenshot */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '14px'
        }}>
          {[
            { icon: '📖', title: 'Learns from your material', desc: 'Customizes paths from your uploads' },
            { icon: '🔍', title: 'Finds your weak areas', desc: 'Pinpoints exact diagnostic gaps' },
            { icon: '🪄', title: 'Adapts to your style', desc: 'Simple, Analogy, Visual or Exam' },
            { icon: '📋', title: 'Creates study plans', desc: 'Daily prioritized time allocations' },
            { icon: '💡', title: 'Helps you improve', desc: 'Continuous reassessment loop' }
          ].map((pillar, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                padding: '16px 14px',
                textAlign: 'center',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.05)',
                border: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '1.8rem' }}>{pillar.icon}</span>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1E293B', lineHeight: '1.3' }}>
                {pillar.title}
              </h4>
              <p style={{ fontSize: '0.72rem', color: '#64748B', margin: 0, lineHeight: '1.3' }}>
                {pillar.desc}
              </p>
            </div>
          ))}
        </div>

        {/* USP Cycle vs Traditional Comparison (Section 20 of prompt!) */}
        <div style={{
          marginTop: '22px',
          padding: '16px 20px',
          borderRadius: '14px',
          background: 'rgba(255, 255, 255, 0.7)',
          border: '1px dashed #C7D2FE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ fontSize: '0.82rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, color: '#EF4444' }}>Traditional EdTech:</span>
            <span>Same content ➔ Same difficulty ➔ Fixed syllabus</span>
          </div>

          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4F46E5', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>GuruMitra AI:</span>
            <span style={{ color: '#1E293B' }}>
              Assess ➔ Analyze ➔ Personalize ➔ Learn ➔ Reassess ➔ Adapt
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
