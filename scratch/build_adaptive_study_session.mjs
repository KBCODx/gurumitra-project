import fs from 'fs';
import path from 'path';

const content = `import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  FileText,
  HelpCircle,
  Sparkles,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Bookmark,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Award,
  Check,
  X,
  RefreshCw,
  Target,
  Flame,
  Eye,
  EyeOff,
  Key,
  Layers,
  GraduationCap
} from 'lucide-react';
import { useStudent } from '../context/StudentContext';
import { LearningStyle, SubjectType } from '../types';
import {
  fetchOrGenerateAdaptiveLesson,
  recordQuestionAttempt
} from '../services/adaptiveLessonService';
import { getChapters } from '../services/curriculumService';
import { AdaptiveLessonContent, StudySessionRecord } from '../types';
import { AiModelConfigModal } from './AiModelConfigModal';
import { getStoredGeminiKey } from '../services/preAssessmentService';

export const AdaptiveStudySession: React.FC = () => {
  const {
    student,
    activeSubject,
    currentLearningContext,
    setTopicContext,
    setPreferredStyle,
    setActiveTab,
    completeTaskAndRecordSession,
    activeLearningPlan
  } = useStudent();

  // Active Subject & Task Context
  const subject = (currentLearningContext.subject || activeSubject || 'Mathematics') as SubjectType;
  const chapter = currentLearningContext.chapter || 'Foundational Chapter';
  const topic = currentLearningContext.topic || 'Core Topic';
  const allocatedMinutes = currentLearningContext.allocatedMinutes || 45;
  const taskId = currentLearningContext.taskId;
  const studentLevel = currentLearningContext.studentLevel || 'Average';
  const subtopicsPlanned = currentLearningContext.subtopics || [];

  // Lesson State
  const [lesson, setLesson] = useState<AdaptiveLessonContent | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingStep, setLoadingStep] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  // 5-Step Adaptive Learning Flow:
  // 1. Learn Theory & Subtopics
  // 2. Theory Review Q&A (Question & Theoretical Answer)
  // 3. Today's Summary
  // 4. Topic Quiz (10 Questions)
  // 5. Practice Lab
  const [activeTab, setLocalActiveTab] = useState<'learn' | 'theory_qa' | 'summary' | 'questions' | 'practice'>('learn');

  // Interactive Question & Review State
  const [expandedSubtopics, setExpandedSubtopics] = useState<Record<string, boolean>>({});
  const [expandedTheoryAnswers, setExpandedTheoryAnswers] = useState<Record<string, boolean>>({});
  const [theoryAnswers, setTheoryAnswers] = useState<Record<string, { selectedOption: number; isSubmitted: boolean; isCorrect: boolean }>>({});
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, { selectedOption: number; isSubmitted: boolean; isCorrect: boolean; showHint: boolean }>>({});
  
  const [theoryRead, setTheoryRead] = useState<boolean>(false);
  const [theoryQaReviewed, setTheoryQaReviewed] = useState<boolean>(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(() => {
    try {
      return !!getStoredGeminiKey();
    } catch {
      return false;
    }
  });

  // Timer State
  const timerStorageKey = \`gurumitra_timer_\${taskId || \`\${subject}_\${topic}\`.replace(/[^a-z0-9]/gi, '_')}\`;
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(timerStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.timeLeft === 'number' && parsed.timeLeft >= 0) {
          return parsed.timeLeft;
        }
      }
    } catch {}
    return allocatedMinutes * 60;
  });

  const [overtimeSeconds, setOvertimeSeconds] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(timerStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.overtime === 'number') return parsed.overtime;
      }
    } catch {}
    return 0;
  });

  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);
  const [showTimeUpBanner, setShowTimeUpBanner] = useState<boolean>(false);
  const [isSessionCompleted, setIsSessionCompleted] = useState<boolean>(false);
  const [completedSessionData, setCompletedSessionData] = useState<StudySessionRecord | null>(null);

  // Available chapters for quick switching
  const chapters = getChapters(student.grade, student.board, student.stream, subject);

  // Timer Countdown Effect
  useEffect(() => {
    if (!isTimerRunning || isSessionCompleted) return;

    const interval = setInterval(() => {
      setTimeLeftSeconds(prev => {
        if (prev > 0) {
          const next = prev - 1;
          if (next === 0) {
            setShowTimeUpBanner(true);
          }
          return next;
        } else {
          setOvertimeSeconds(ot => ot + 1);
          return 0;
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning, isSessionCompleted]);

  // Persist timer periodically
  useEffect(() => {
    try {
      localStorage.setItem(
        timerStorageKey,
        JSON.stringify({ timeLeft: timeLeftSeconds, overtime: overtimeSeconds, updatedAt: Date.now() })
      );
    } catch {}
  }, [timeLeftSeconds, overtimeSeconds, timerStorageKey]);

  // Animated Loading Steps
  useEffect(() => {
    if (!loading) return;
    const s1 = setTimeout(() => setLoadingStep(2), 700);
    const s2 = setTimeout(() => setLoadingStep(3), 1500);
    const s3 = setTimeout(() => setLoadingStep(4), 2300);
    return () => {
      clearTimeout(s1);
      clearTimeout(s2);
      clearTimeout(s3);
    };
  }, [loading]);

  // Fetch or Generate Lesson
  const loadLesson = async (force: boolean = false) => {
    setLoading(true);
    setLoadingStep(1);
    setError(null);
    try {
      const result = await fetchOrGenerateAdaptiveLesson({
        classLevel: student.grade,
        board: student.board,
        subject,
        chapter,
        topic,
        subtopics: subtopicsPlanned,
        allocatedMinutes,
        studentLevel,
        learningStyle: student.preferredStyle,
        forceRegenerate: force
      });

      setLesson(result);
      
      // Auto expand first two subtopics
      if (result.subtopics && result.subtopics.length > 0) {
        setExpandedSubtopics({
          [result.subtopics[0].id]: true,
          ...(result.subtopics[1] ? { [result.subtopics[1].id]: true } : {})
        });
      }

      // Auto expand first theory answer
      if (result.theory_qa && result.theory_qa.length > 0) {
        setExpandedTheoryAnswers({
          [result.theory_qa[0].id]: true
        });
      }
    } catch (err: any) {
      console.error('Failed to load lesson:', err);
      setError(err?.message || 'Could not load today’s adaptive lesson. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLesson(false);
  }, [subject, chapter, topic, studentLevel, student.preferredStyle]);

  // Formatting helper for time display
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return \`\${String(mins).padStart(2, '0')}:\${String(secs).padStart(2, '0')}\`;
  };

  // Subtopic toggle
  const toggleSubtopic = (id: string) => {
    setExpandedSubtopics(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAllSubtopics = () => {
    if (!lesson?.subtopics) return;
    const all: Record<string, boolean> = {};
    lesson.subtopics.forEach(s => { all[s.id] = true; });
    setExpandedSubtopics(all);
  };

  const collapseAllSubtopics = () => {
    setExpandedSubtopics({});
  };

  // Theory Q&A toggle
  const toggleTheoryAnswer = (id: string) => {
    setExpandedTheoryAnswers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAllTheoryAnswers = () => {
    if (!lesson?.theory_qa) return;
    const all: Record<string, boolean> = {};
    lesson.theory_qa.forEach(q => { all[q.id] = true; });
    setExpandedTheoryAnswers(all);
  };

  const collapseAllTheoryAnswers = () => {
    setExpandedTheoryAnswers({});
  };

  // Handle Theory Quiz Answer Submit (10 Questions)
  const handleSelectTheoryOption = (questionId: string, optionIdx: number) => {
    if (theoryAnswers[questionId]?.isSubmitted) return;
    setTheoryAnswers(prev => ({
      ...prev,
      [questionId]: {
        selectedOption: optionIdx,
        isSubmitted: false,
        isCorrect: false
      }
    }));
  };

  const handleSubmitTheoryAnswer = (q: any) => {
    const current = theoryAnswers[q.id];
    if (!current || current.selectedOption === undefined) return;

    const isCorrect = current.selectedOption === q.correctOptionIndex;
    setTheoryAnswers(prev => ({
      ...prev,
      [q.id]: {
        selectedOption: current.selectedOption,
        isSubmitted: true,
        isCorrect
      }
    }));

    // Record attempt asynchronously
    recordQuestionAttempt({
      id: \`att_\${q.id}_\${Date.now()}\`,
      userId: student.id || 'student',
      lessonId: lesson?.id || 'lesson',
      questionId: q.id,
      type: 'theory',
      subject,
      chapter,
      topic,
      difficulty: q.difficulty,
      selectedOption: current.selectedOption,
      isCorrect,
      attemptedAt: new Date().toISOString()
    });
  };

  // Handle Practice Question Answer Submit
  const handleSelectPracticeOption = (qId: string, optionIdx: number) => {
    if (practiceAnswers[qId]?.isSubmitted) return;
    setPracticeAnswers(prev => ({
      ...prev,
      [qId]: {
        selectedOption: optionIdx,
        isSubmitted: false,
        isCorrect: false,
        showHint: prev[qId]?.showHint || false
      }
    }));
  };

  const handleSubmitPracticeAnswer = (pq: any) => {
    const current = practiceAnswers[pq.id];
    if (!current || current.selectedOption === undefined) return;

    const isCorrect = current.selectedOption === pq.correctOptionIndex;
    setPracticeAnswers(prev => ({
      ...prev,
      [pq.id]: {
        ...current,
        isSubmitted: true,
        isCorrect
      }
    }));

    recordQuestionAttempt({
      id: \`att_\${pq.id}_\${Date.now()}\`,
      userId: student.id || 'student',
      lessonId: lesson?.id || 'lesson',
      questionId: pq.id,
      type: 'practice',
      subject,
      chapter,
      topic,
      difficulty: pq.difficulty,
      selectedOption: current.selectedOption,
      isCorrect,
      attemptedAt: new Date().toISOString()
    });
  };

  const togglePracticeHint = (qId: string) => {
    setPracticeAnswers(prev => ({
      ...prev,
      [qId]: {
        selectedOption: prev[qId]?.selectedOption ?? -1,
        isSubmitted: prev[qId]?.isSubmitted ?? false,
        isCorrect: prev[qId]?.isCorrect ?? false,
        showHint: !prev[qId]?.showHint
      }
    }));
  };

  // Real Progress Calculations
  const theoryQuestionsCount = lesson?.questions?.length || 10;
  const theoryAttemptedCount = Object.values(theoryAnswers).filter(a => a.isSubmitted).length;
  const theoryCorrectCount = Object.values(theoryAnswers).filter(a => a.isSubmitted && a.isCorrect).length;

  const practiceQuestionsCount = lesson?.practice_questions?.length || 5;
  const practiceAttemptedCount = Object.values(practiceAnswers).filter(a => a.isSubmitted).length;
  const practiceCorrectCount = Object.values(practiceAnswers).filter(a => a.isSubmitted && a.isCorrect).length;

  const progressPercentage = useMemo(() => {
    let score = 0;
    if (theoryRead) score += 20;
    if (theoryQaReviewed) score += 20;
    if (theoryQuestionsCount > 0) {
      score += Math.round((theoryAttemptedCount / theoryQuestionsCount) * 40);
    }
    if (practiceQuestionsCount > 0) {
      score += Math.round((practiceAttemptedCount / practiceQuestionsCount) * 20);
    }
    return Math.min(100, score);
  }, [theoryRead, theoryQaReviewed, theoryAttemptedCount, theoryQuestionsCount, practiceAttemptedCount, practiceQuestionsCount]);

  // Complete Study Session Action -> Saves record and routes directly to Learning Path screen
  const handleCompleteSession = async () => {
    const totalAttempted = theoryAttemptedCount + practiceAttemptedCount;
    const totalCorrect = theoryCorrectCount + practiceCorrectCount;
    const accuracy = totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 75;

    let topicUnderstanding: 'Strong' | 'Developing' | 'Needs Revision' = 'Developing';
    if (accuracy >= 80) topicUnderstanding = 'Strong';
    else if (accuracy < 55) topicUnderstanding = 'Needs Revision';

    const actualDurationMinutes = Math.max(
      1,
      Math.round((allocatedMinutes * 60 - timeLeftSeconds + overtimeSeconds) / 60)
    );

    const sessionRecord: StudySessionRecord = {
      id: \`session_\${Date.now()}\`,
      userId: student.id || 'student',
      taskId,
      date: new Date().toISOString().split('T')[0],
      subject,
      chapter,
      topic,
      allocatedMinutes,
      actualMinutes: actualDurationMinutes,
      startedAt: new Date(Date.now() - actualDurationMinutes * 60000).toISOString(),
      completedAt: new Date().toISOString(),
      status: 'completed',
      theoryCompleted: true,
      questionsAttempted: theoryAttemptedCount,
      questionsCorrect: theoryCorrectCount,
      practiceAttempted: practiceAttemptedCount,
      practiceCorrect: practiceCorrectCount,
      difficultyLevel: studentLevel === 'Weak' ? 'Beginner' : studentLevel === 'Strong' ? 'Advanced' : 'Intermediate',
      topicUnderstanding
    };

    setCompletedSessionData(sessionRecord);
    setIsSessionCompleted(true);
    setIsTimerRunning(false);

    // Save session & update daily task completion in plan
    await completeTaskAndRecordSession(sessionRecord);

    // Clear saved timer
    try {
      localStorage.removeItem(timerStorageKey);
    } catch {}

    // Navigate to Learning Path view where the completed task and remaining classes for the day appear
    setActiveTab('learningPath');
  };

  // Find next task in active plan if available
  const nextTask = useMemo(() => {
    if (!activeLearningPlan || !activeLearningPlan.dailyPlans) return null;
    for (const day of activeLearningPlan.dailyPlans) {
      for (const t of day.tasks) {
        if (!t.completed && t.id !== taskId) {
          return t;
        }
      }
    }
    return null;
  }, [activeLearningPlan, taskId]);

  // Loading Screen
  if (loading) {
    return (
      <div style={{ maxWidth: '850px', margin: '60px auto', padding: '0 20px' }}>
        <div className="card" style={{ padding: '48px 36px', textAlign: 'center', borderRadius: '24px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 20px',
            borderRadius: '20px',
            backgroundColor: '#EEF2FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4F46E5'
          }}>
            <Sparkles size={32} className="animate-spin" />
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1E293B', marginBottom: '8px' }}>
            Preparing Your Adaptive Lesson
          </h2>
          <p style={{ color: '#64748B', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto 32px' }}>
            Calibrating educational material for <strong>{topic}</strong> in <strong>{chapter}</strong> ({subject}).
          </p>

          <div style={{
            maxWidth: '460px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CheckCircle2 size={20} color="#10B981" />
              <span style={{ fontSize: '0.9rem', color: '#1E293B', fontWeight: 600 }}>
                Grounded in {student.board} Class {student.grade} Curriculum
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {loadingStep >= 2 ? (
                <CheckCircle2 size={20} color="#10B981" />
              ) : (
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #CBD5E1' }} />
              )}
              <span style={{ fontSize: '0.9rem', color: loadingStep >= 2 ? '#1E293B' : '#94A3B8', fontWeight: 600 }}>
                Calibrating depth to <strong>{studentLevel}</strong> student level ({student.preferredStyle} mode)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {loadingStep >= 3 ? (
                <CheckCircle2 size={20} color="#10B981" />
              ) : (
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #CBD5E1' }} />
              )}
              <span style={{ fontSize: '0.9rem', color: loadingStep >= 3 ? '#1E293B' : '#94A3B8', fontWeight: 600 }}>
                Generating comprehensive subtopics & theoretical review Q&A
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {loadingStep >= 4 ? (
                <CheckCircle2 size={20} color="#10B981" />
              ) : (
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #CBD5E1' }} />
              )}
              <span style={{ fontSize: '0.9rem', color: loadingStep >= 4 ? '#1E293B' : '#94A3B8', fontWeight: 600 }}>
                Generating 10 topic quiz questions & practice problems
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error State with Safe Retry
  if (error || !lesson) {
    return (
      <div style={{ maxWidth: '650px', margin: '60px auto', padding: '0 20px' }}>
        <div className="card" style={{ padding: '36px', textAlign: 'center', borderRadius: '20px' }}>
          <AlertTriangle size={48} color="#EF4444" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1E293B', marginBottom: '8px' }}>
            Lesson Preparation Notice
          </h3>
          <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '24px' }}>
            {error || 'Unable to generate session content right now.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => loadLesson(true)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <RefreshCw size={16} />
              <span>Retry Generation</span>
            </button>
            <button
              onClick={() => setActiveTab('learningPath')}
              className="btn btn-secondary"
            >
              Return to Day Plan
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Completion Screen (Fallback if navigated here while finished)
  if (isSessionCompleted && completedSessionData) {
    return (
      <div style={{ maxWidth: '780px', margin: '40px auto 80px', padding: '0 20px' }}>
        <div className="card" style={{ padding: '44px 36px', textAlign: 'center', borderRadius: '24px' }}>
          <div style={{
            width: '72px',
            height: '72px',
            margin: '0 auto 20px',
            borderRadius: '50%',
            backgroundColor: '#ECFDF5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10B981'
          }}>
            <Award size={40} />
          </div>

          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Session Completed & Recorded Successfully 🎉
          </span>

          <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#1E293B', marginTop: '6px', marginBottom: '4px' }}>
            {lesson.topic}
          </h2>
          <p style={{ color: '#64748B', fontSize: '0.95rem', margin: 0 }}>
            {lesson.chapter} • {lesson.subject} (Class {student.grade} {student.board})
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            margin: '32px 0'
          }}>
            <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#64748B', fontSize: '0.8rem', fontWeight: 700 }}>
                <Clock size={16} color="#4F46E5" />
                <span>STUDY DURATION</span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E293B', marginTop: '6px' }}>
                {completedSessionData.actualMinutes}m <span style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600 }}>/ {completedSessionData.allocatedMinutes}m</span>
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#64748B', fontSize: '0.8rem', fontWeight: 700 }}>
                <Target size={16} color="#10B981" />
                <span>TOPIC QUIZ (10 Qs)</span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E293B', marginTop: '6px' }}>
                {completedSessionData.questionsCorrect} <span style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600 }}>/ {completedSessionData.questionsAttempted} Correct</span>
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#64748B', fontSize: '0.8rem', fontWeight: 700 }}>
                <Flame size={16} color="#D97706" />
                <span>PRACTICE LAB</span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E293B', marginTop: '6px' }}>
                {completedSessionData.practiceCorrect} <span style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600 }}>/ {completedSessionData.practiceAttempted} Correct</span>
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#64748B', fontSize: '0.8rem', fontWeight: 700 }}>
                <Sparkles size={16} color="#7C3AED" />
                <span>TOPIC MASTERY</span>
              </div>
              <div style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                color: completedSessionData.topicUnderstanding === 'Strong' ? '#10B981' : completedSessionData.topicUnderstanding === 'Developing' ? '#D97706' : '#EF4444',
                marginTop: '10px'
              }}>
                {completedSessionData.topicUnderstanding}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => setActiveTab('learningPath')}
              className="btn btn-primary"
              style={{ padding: '12px 28px' }}
            >
              <span>Return to Learning Path & Day Plan</span>
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const theoryQaList = lesson.theory_qa || [];

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '24px 24px 80px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      {/* Top Header Card */}
      <div className="card" style={{ padding: '24px 28px', borderRadius: '20px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: '#4F46E5',
                backgroundColor: '#EEF2FF',
                padding: '4px 10px',
                borderRadius: '8px',
                textTransform: 'uppercase'
              }}>
                {subject} • {student.board} Class {student.grade}
              </span>

              <span style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: studentLevel === 'Weak' ? '#B45309' : studentLevel === 'Strong' ? '#047857' : '#4338CA',
                backgroundColor: studentLevel === 'Weak' ? '#FEF3C7' : studentLevel === 'Strong' ? '#D1FAE5' : '#E0E7FF',
                padding: '4px 10px',
                borderRadius: '8px'
              }}>
                Calibrated Level: {studentLevel}
              </span>

              <span style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: '#7C3AED',
                backgroundColor: '#F3E8FF',
                padding: '4px 10px',
                borderRadius: '8px'
              }}>
                Style: {student.preferredStyle}
              </span>

              {/* AI Key Configuration Badge & Button */}
              <button
                onClick={() => setIsAiModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: hasApiKey ? '#059669' : '#D97706',
                  backgroundColor: hasApiKey ? '#ECFDF5' : '#FFFBEB',
                  border: hasApiKey ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                title="Configure Gemini API key for live AI generation"
              >
                <Key size={13} />
                <span>{hasApiKey ? 'Gemini AI Active' : 'Configure AI Key'}</span>
              </button>
            </div>

            <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#1E293B', margin: '8px 0 4px' }}>
              {lesson.topic}
            </h1>
            <p style={{ color: '#64748B', fontSize: '0.92rem', margin: 0 }}>
              Chapter: <strong>{lesson.chapter}</strong> • Allocated Time: <strong>{allocatedMinutes} mins</strong>
            </p>
          </div>

          {/* Subject Countdown Timer Card */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            backgroundColor: timeLeftSeconds === 0 ? '#FEF2F2' : '#F8FAFC',
            border: timeLeftSeconds === 0 ? '1px solid #FCA5A5' : '1px solid #E2E8F0',
            padding: '12px 18px',
            borderRadius: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: timeLeftSeconds === 0 ? '#FEE2E2' : '#EEF2FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: timeLeftSeconds === 0 ? '#EF4444' : '#4F46E5'
              }}>
                <Clock size={20} />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: timeLeftSeconds === 0 ? '#B91C1C' : '#64748B', textTransform: 'uppercase' }}>
                  {timeLeftSeconds === 0 ? 'Overtime Learning' : 'Session Timer'}
                </span>
                <div style={{
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  color: timeLeftSeconds === 0 ? '#DC2626' : '#1E293B',
                  letterSpacing: '1px'
                }}>
                  {timeLeftSeconds > 0 ? formatTime(timeLeftSeconds) : \`+\${formatTime(overtimeSeconds)}\`}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569'
                }}
                title={isTimerRunning ? 'Pause timer' : 'Resume timer'}
              >
                {isTimerRunning ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <button
                onClick={() => {
                  setTimeLeftSeconds(allocatedMinutes * 60);
                  setOvertimeSeconds(0);
                }}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569'
                }}
                title="Reset timer to allocated minutes"
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Progress Bar & 5-Step Section Navigation */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
              Adaptive Session Progress
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4F46E5' }}>
              {progressPercentage}%
            </span>
          </div>
          <div className="progress-bar-container" style={{ height: '7px' }}>
            <div className="progress-bar-fill" style={{ width: \`\${progressPercentage}%\` }} />
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '16px',
            flexWrap: 'wrap'
          }}>
            {[
              { id: 'learn', label: '1. Learn Theory & Subtopics', count: \`\${lesson.subtopics.length} concepts\` },
              { id: 'theory_qa', label: '2. Theory Review Q&A', count: \`\${theoryQaList.length} Q&As\` },
              { id: 'summary', label: '3. Today\\'s Summary', count: \`\${lesson.summary.length} takeaways\` },
              { id: 'questions', label: '4. Topic Quiz (10 Questions)', count: \`\${theoryAttemptedCount}/\${theoryQuestionsCount} completed\` },
              { id: 'practice', label: '5. Practice Lab', count: \`\${practiceAttemptedCount}/\${practiceQuestionsCount} solved\` }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setLocalActiveTab(tab.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: isActive ? '1px solid #4F46E5' : '1px solid #E2E8F0',
                    backgroundColor: isActive ? '#EEF2FF' : '#FFFFFF',
                    color: isActive ? '#4F46E5' : '#475569',
                    fontSize: '0.82rem',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{tab.label}</span>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: '999px',
                    backgroundColor: isActive ? '#4F46E5' : '#F1F5F9',
                    color: isActive ? '#FFFFFF' : '#64748B',
                    fontWeight: 700
                  }}>
                    {tab.count}
                  </span>
                </button>
              );
            })}

            {/* Complete Study Session Action Button */}
            <button
              onClick={handleCompleteSession}
              className="btn btn-primary"
              style={{
                marginLeft: 'auto',
                padding: '8px 18px',
                fontSize: '0.85rem',
                backgroundColor: '#10B981',
                borderColor: '#10B981',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Record session and return to Learning Path Day Plan"
            >
              <CheckCircle2 size={16} />
              <span>Complete Study Session</span>
            </button>
          </div>
        </div>
      </div>

      {/* Non-blocking Time Up Banner */}
      {showTimeUpBanner && timeLeftSeconds === 0 && (
        <div style={{
          padding: '16px 20px',
          borderRadius: '16px',
          backgroundColor: '#FFFBEB',
          border: '1px solid #FDE68A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={22} color="#D97706" />
            <div>
              <strong style={{ color: '#92400E', fontSize: '0.92rem' }}>
                Planned Study Time ({allocatedMinutes} mins) is Complete!
              </strong>
              <div style={{ color: '#B45309', fontSize: '0.82rem' }}>
                You can finish now or continue learning. Any extra study time will be tracked accurately.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setShowTimeUpBanner(false)}
              className="btn btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.82rem' }}
            >
              Continue Learning
            </button>
            <button
              onClick={handleCompleteSession}
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.82rem', backgroundColor: '#10B981', borderColor: '#10B981' }}
            >
              Finish Session Now
            </button>
          </div>
        </div>
      )}

      {/* Main Study Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.5fr) minmax(0, 1fr)', gap: '24px' }}>
        {/* Left Column: Current Active Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* ========================================================================= */}
          {/* STEP 1: LEARN THEORY & SUBTOPICS */}
          {/* ========================================================================= */}
          {activeTab === 'learn' && (
            <div className="card" style={{ padding: '32px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <BookOpen size={18} color="#4F46E5" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase' }}>
                    Personalized Theory & Subtopics
                  </span>
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                  Mastering {lesson.topic}
                </h2>
                <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.7', marginTop: '12px' }}>
                  {lesson.theory}
                </p>
              </div>

              {/* Learning Objectives */}
              {lesson.learning_objectives && lesson.learning_objectives.length > 0 && (
                <div style={{
                  padding: '16px 20px',
                  borderRadius: '14px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0'
                }}>
                  <h4 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Today’s Learning Objectives
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {lesson.learning_objectives.map((obj, idx) => (
                      <li key={idx} style={{ fontSize: '0.88rem', color: '#475569', lineHeight: '1.5' }}>
                        {obj}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 6-7 Important Subtopics / Concepts */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                    Core Subtopics ({lesson.subtopics.length} Key Concepts)
                  </h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={expandAllSubtopics}
                      style={{
                        background: 'none',
                        border: '1px solid #CBD5E1',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      Expand All
                    </button>
                    <button
                      onClick={collapseAllSubtopics}
                      style={{
                        background: 'none',
                        border: '1px solid #CBD5E1',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      Collapse All
                    </button>
                  </div>
                </div>

                {lesson.subtopics.map((sub, idx) => {
                  const isExpanded = !!expandedSubtopics[sub.id];
                  return (
                    <div
                      key={sub.id}
                      style={{
                        borderRadius: '14px',
                        border: isExpanded ? '1px solid #C7D2FE' : '1px solid #E2E8F0',
                        backgroundColor: isExpanded ? '#FFFFFF' : '#F8FAFC',
                        overflow: 'hidden',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <button
                        onClick={() => toggleSubtopic(sub.id)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '16px 20px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            backgroundColor: isExpanded ? '#4F46E5' : '#E2E8F0',
                            color: isExpanded ? '#FFFFFF' : '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.82rem',
                            fontWeight: 700
                          }}>
                            {idx + 1}
                          </span>
                          <span style={{ fontSize: '0.98rem', fontWeight: 700, color: '#1E293B' }}>
                            {sub.title.replace(/^\\d+\\.\\s*/, '')}
                          </span>
                        </div>
                        {isExpanded ? <ChevronDown size={18} color="#4F46E5" /> : <ChevronRight size={18} color="#94A3B8" />}
                      </button>

                      {isExpanded && (
                        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          {/* Explanation */}
                          <p style={{ color: '#334155', fontSize: '0.93rem', lineHeight: '1.7', margin: 0 }}>
                            {sub.explanation}
                          </p>

                          {/* Formula / Rule where applicable */}
                          {sub.formulaOrRule && (
                            <div style={{
                              padding: '12px 16px',
                              borderRadius: '10px',
                              backgroundColor: '#EEF2FF',
                              border: '1px solid #C7D2FE',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px'
                            }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase' }}>
                                Rule / Formula:
                              </span>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1E293B', fontSize: '0.95rem' }}>
                                {sub.formulaOrRule}
                              </span>
                            </div>
                          )}

                          {/* Intuition */}
                          {sub.intuition && (
                            <div style={{
                              padding: '12px 16px',
                              borderRadius: '10px',
                              backgroundColor: '#ECFDF5',
                              border: '1px solid #A7F3D0',
                              fontSize: '0.88rem',
                              color: '#065F46'
                            }}>
                              <strong>Intuitive Mental Model: </strong>
                              {sub.intuition}
                            </div>
                          )}

                          {/* Example */}
                          {sub.example && (
                            <div style={{
                              padding: '12px 16px',
                              borderRadius: '10px',
                              backgroundColor: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              fontSize: '0.88rem',
                              color: '#334155'
                            }}>
                              <strong style={{ color: '#1E293B' }}>Worked Example: </strong>
                              {sub.example}
                            </div>
                          )}

                          {/* Common Mistake */}
                          {sub.commonMistake && (
                            <div style={{
                              padding: '12px 16px',
                              borderRadius: '10px',
                              backgroundColor: '#FEF2F2',
                              border: '1px solid #FCA5A5',
                              fontSize: '0.85rem',
                              color: '#991B1B'
                            }}>
                              <strong>⚠️ Common Mistake: </strong>
                              {sub.commonMistake}
                            </div>
                          )}

                          {/* Important Points */}
                          {sub.importantPoints && sub.importantPoints.length > 0 && (
                            <div style={{ marginTop: '4px' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                                Key Takeaways
                              </span>
                              <ul style={{ margin: '4px 0 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {sub.importantPoints.map((pt, pIdx) => (
                                  <li key={pIdx} style={{ fontSize: '0.85rem', color: '#475569' }}>
                                    {pt}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Action: Mark Theory Read & Move to Theory Review Q&A */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '20px',
                borderTop: '1px solid #F1F5F9',
                marginTop: '12px',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <button
                  onClick={() => setTheoryRead(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: theoryRead ? '#ECFDF5' : '#FFFFFF',
                    color: theoryRead ? '#059669' : '#475569',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Check size={16} />
                  <span>{theoryRead ? 'Theory Marked Understood' : 'Mark Theory Understood'}</span>
                </button>

                <button
                  onClick={() => {
                    setTheoryRead(true);
                    setLocalActiveTab('theory_qa');
                  }}
                  className="btn btn-primary"
                  style={{ padding: '10px 22px' }}
                >
                  <span>Next: Theory Review Q&A ({theoryQaList.length} Questions)</span>
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: THEORY REVIEW Q&A (CONCEPTUAL THEORY QUESTIONS & THEORETICAL ANSWERS) */}
          {/* ========================================================================= */}
          {activeTab === 'theory_qa' && (
            <div className="card" style={{ padding: '32px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HelpCircle size={18} color="#4F46E5" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase' }}>
                      Conceptual Theory Review
                    </span>
                  </div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E293B', margin: '4px 0 0' }}>
                    Theory Questions & Model Theoretical Answers ({theoryQaList.length} Q&As)
                  </h2>
                  <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '4px 0 0' }}>
                    Deep subjective theory questions on {lesson.topic} and {lesson.chapter} with complete CBSE board theoretical answers.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={expandAllTheoryAnswers}
                    style={{
                      background: 'none',
                      border: '1px solid #CBD5E1',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Expand All Answers
                  </button>
                  <button
                    onClick={collapseAllTheoryAnswers}
                    style={{
                      background: 'none',
                      border: '1px solid #CBD5E1',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Collapse All Answers
                  </button>
                </div>
              </div>

              {/* Theory Q&A Cards List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {theoryQaList.map((tqa, idx) => {
                  const isAnswerOpen = !!expandedTheoryAnswers[tqa.id];
                  return (
                    <div
                      key={tqa.id}
                      style={{
                        padding: '22px 24px',
                        borderRadius: '16px',
                        border: isAnswerOpen ? '1.5px solid #C7D2FE' : '1px solid #E2E8F0',
                        backgroundColor: '#FFFFFF',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                      }}
                    >
                      {/* Question Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          color: '#4F46E5',
                          backgroundColor: '#EEF2FF',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          textTransform: 'uppercase'
                        }}>
                          Theory Question {idx + 1}
                        </span>

                        <button
                          onClick={() => toggleTheoryAnswer(tqa.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: isAnswerOpen ? '#EEF2FF' : '#F8FAFC',
                            border: isAnswerOpen ? '1px solid #C7D2FE' : '1px solid #E2E8F0',
                            padding: '4px 12px',
                            borderRadius: '8px',
                            color: isAnswerOpen ? '#4F46E5' : '#475569',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {isAnswerOpen ? <EyeOff size={14} /> : <Eye size={14} />}
                          <span>{isAnswerOpen ? 'Hide Theoretical Answer' : 'Show Theoretical Answer'}</span>
                        </button>
                      </div>

                      {/* Question Text */}
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1E293B', lineHeight: '1.6', margin: '6px 0 14px' }}>
                        {tqa.question}
                      </h4>

                      {/* Expandable Model Theoretical Answer */}
                      {isAnswerOpen && (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          padding: '16px 18px',
                          borderRadius: '12px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0'
                        }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                              <GraduationCap size={16} color="#059669" />
                              <strong style={{ fontSize: '0.82rem', color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                Theoretical Model Answer:
                              </strong>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.92rem', color: '#1E293B', lineHeight: '1.7' }}>
                              {tqa.theoreticalAnswer}
                            </p>
                          </div>

                          {/* Key Points */}
                          {tqa.keyPoints && tqa.keyPoints.length > 0 && (
                            <div style={{ paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                                Key Points Required for Full Marks:
                              </span>
                              <ul style={{ margin: '4px 0 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {tqa.keyPoints.map((kp, kIdx) => (
                                  <li key={kIdx} style={{ fontSize: '0.85rem', color: '#334155' }}>
                                    {kp}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Board Marking Tip */}
                          {tqa.boardMarkingTip && (
                            <div style={{
                              padding: '10px 14px',
                              borderRadius: '8px',
                              backgroundColor: '#FFFBEB',
                              border: '1px solid #FDE68A',
                              fontSize: '0.82rem',
                              color: '#92400E'
                            }}>
                              <strong>💡 Board Examiner Tip: </strong>
                              {tqa.boardMarkingTip}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Nav: Back to Theory & Proceed to Summary */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '20px',
                borderTop: '1px solid #F1F5F9',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <button
                  onClick={() => setLocalActiveTab('learn')}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <ArrowLeft size={16} />
                  <span>Back to Theory</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={() => setTheoryQaReviewed(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: theoryQaReviewed ? '#ECFDF5' : '#FFFFFF',
                      color: theoryQaReviewed ? '#059669' : '#475569',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Check size={16} />
                    <span>{theoryQaReviewed ? 'Q&A Marked Reviewed' : 'Mark Q&A Reviewed'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setTheoryQaReviewed(true);
                      setLocalActiveTab('summary');
                    }}
                    className="btn btn-primary"
                    style={{ padding: '10px 22px' }}
                  >
                    <span>Next: Today’s Summary →</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: TODAY'S LEARNING SUMMARY */}
          {/* ========================================================================= */}
          {activeTab === 'summary' && (
            <div className="card" style={{ padding: '32px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <FileText size={18} color="#4F46E5" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase' }}>
                    Lesson Synthesis & Takeaways
                  </span>
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                  Today’s Key Takeaways
                </h2>
                <p style={{ color: '#64748B', fontSize: '0.9rem', marginTop: '4px' }}>
                  High-yield essentials to remember for board examinations and upcoming tests in {lesson.topic}.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {lesson.summary.map((point, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '16px 20px',
                      borderRadius: '14px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '14px'
                    }}
                  >
                    <span style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '8px',
                      backgroundColor: '#EEF2FF',
                      color: '#4F46E5',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {idx + 1}
                    </span>
                    <p style={{ margin: 0, fontSize: '0.94rem', color: '#1E293B', lineHeight: '1.6' }}>
                      {point}
                    </p>
                  </div>
                ))}
              </div>

              {/* Bottom Nav: Back to Theory Q&A & Proceed to 10 Questions Quiz */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '20px',
                borderTop: '1px solid #F1F5F9',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <button
                  onClick={() => setLocalActiveTab('theory_qa')}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <ArrowLeft size={16} />
                  <span>Back to Theory Q&A</span>
                </button>

                <button
                  onClick={() => setLocalActiveTab('questions')}
                  className="btn btn-primary"
                  style={{ padding: '10px 22px' }}
                >
                  <span>Next: Topic Quiz (10 Questions) →</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: TOPIC QUIZ (10 QUESTIONS) */}
          {/* ========================================================================= */}
          {activeTab === 'questions' && (
            <div className="card" style={{ padding: '32px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Target size={18} color="#4F46E5" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase' }}>
                      Topic Assessment
                    </span>
                  </div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E293B', margin: '4px 0 0' }}>
                    Topic Understanding Check ({lesson.questions.length} Questions)
                  </h2>
                  <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '4px 0 0' }}>
                    Every question strictly tests <strong>{lesson.topic}</strong> from <strong>{lesson.chapter}</strong>.
                  </p>
                </div>

                <div style={{
                  padding: '8px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#1E293B'
                }}>
                  Score: <strong style={{ color: '#10B981' }}>{theoryCorrectCount}</strong> / {theoryAttemptedCount} Attempted
                </div>
              </div>

              {/* Questions List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {lesson.questions.map((q, idx) => {
                  const state = theoryAnswers[q.id];
                  const isSubmitted = state?.isSubmitted;
                  const isCorrect = state?.isCorrect;
                  const selected = state?.selectedOption;

                  return (
                    <div
                      key={q.id}
                      style={{
                        padding: '24px',
                        borderRadius: '16px',
                        border: isSubmitted
                          ? isCorrect
                            ? '1.5px solid #10B981'
                            : '1.5px solid #EF4444'
                          : '1px solid #E2E8F0',
                        backgroundColor: '#FFFFFF',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                      }}
                    >
                      {/* Question Header & Difficulty */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4F46E5' }}>
                          Question {idx + 1} of {lesson.questions.length}
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: q.difficulty === 'easy' ? '#ECFDF5' : q.difficulty === 'hard' ? '#FEF2F2' : '#FEF3C7',
                          color: q.difficulty === 'easy' ? '#059669' : q.difficulty === 'hard' ? '#DC2626' : '#D97706'
                        }}>
                          {q.difficulty}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', lineHeight: '1.6', marginBottom: '16px' }}>
                        {q.question}
                      </h4>

                      {/* Options */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {q.options.map((opt, optIdx) => {
                          const isOptionSelected = selected === optIdx;
                          const isOptionCorrect = optIdx === q.correctOptionIndex;

                          let borderColor = '#E2E8F0';
                          let bgColor = '#FFFFFF';

                          if (isSubmitted) {
                            if (isOptionCorrect) {
                              borderColor = '#10B981';
                              bgColor = '#ECFDF5';
                            } else if (isOptionSelected && !isCorrect) {
                              borderColor = '#EF4444';
                              bgColor = '#FEF2F2';
                            }
                          } else if (isOptionSelected) {
                            borderColor = '#4F46E5';
                            bgColor = '#EEF2FF';
                          }

                          return (
                            <label
                              key={optIdx}
                              onClick={() => handleSelectTheoryOption(q.id, optIdx)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px 16px',
                                borderRadius: '10px',
                                border: \`1px solid \${borderColor}\`,
                                backgroundColor: bgColor,
                                cursor: isSubmitted ? 'default' : 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                border: isOptionSelected ? '6px solid #4F46E5' : '2px solid #CBD5E1',
                                backgroundColor: '#FFFFFF',
                                flexShrink: 0
                              }} />
                              <span style={{ fontSize: '0.9rem', color: '#1E293B', lineHeight: '1.4' }}>
                                {opt}
                              </span>
                            </label>
                          );
                        })}
                      </div>

                      {/* Submit / Feedback Row */}
                      {!isSubmitted ? (
                        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleSubmitTheoryAnswer(q)}
                            disabled={selected === undefined}
                            className="btn btn-primary"
                            style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                          >
                            Submit Answer
                          </button>
                        </div>
                      ) : (
                        <div style={{
                          marginTop: '16px',
                          padding: '14px 18px',
                          borderRadius: '12px',
                          backgroundColor: isCorrect ? '#ECFDF5' : '#FEF2F2',
                          border: isCorrect ? '1px solid #A7F3D0' : '1px solid #FCA5A5'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            {isCorrect ? (
                              <Check size={18} color="#059669" />
                            ) : (
                              <X size={18} color="#DC2626" />
                            )}
                            <strong style={{ color: isCorrect ? '#065F46' : '#991B1B', fontSize: '0.9rem' }}>
                              {isCorrect ? 'Correct!' : 'Incorrect'}
                            </strong>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.88rem', color: isCorrect ? '#065F46' : '#991B1B', lineHeight: '1.5' }}>
                            <strong>Explanation: </strong>{q.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Nav: Back to Summary & Proceed to Practice Lab */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '20px',
                borderTop: '1px solid #F1F5F9',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <button
                  onClick={() => setLocalActiveTab('summary')}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <ArrowLeft size={16} />
                  <span>Back to Summary</span>
                </button>

                <button
                  onClick={() => setLocalActiveTab('practice')}
                  className="btn btn-primary"
                  style={{ padding: '10px 22px' }}
                >
                  <span>Next: Practice Lab ({lesson.practice_questions.length} Problems) →</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 5: PRACTICE LAB */}
          {/* ========================================================================= */}
          {activeTab === 'practice' && (
            <div className="card" style={{ padding: '32px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={18} color="#10B981" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#10B981', textTransform: 'uppercase' }}>
                      Interactive Practice Lab
                    </span>
                  </div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E293B', margin: '4px 0 0' }}>
                    Reinforce {lesson.topic}
                  </h2>
                </div>

                <div style={{
                  padding: '8px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#1E293B'
                }}>
                  Solved: <strong style={{ color: '#10B981' }}>{practiceCorrectCount}</strong> / {practiceAttemptedCount}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {lesson.practice_questions.map((pq, idx) => {
                  const state = practiceAnswers[pq.id];
                  const isSubmitted = state?.isSubmitted;
                  const isCorrect = state?.isCorrect;
                  const selected = state?.selectedOption;
                  const showHint = state?.showHint;

                  return (
                    <div
                      key={pq.id}
                      style={{
                        padding: '24px',
                        borderRadius: '16px',
                        border: isSubmitted
                          ? isCorrect
                            ? '1.5px solid #10B981'
                            : '1.5px solid #EF4444'
                          : '1px solid #E2E8F0',
                        backgroundColor: '#FFFFFF'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10B981' }}>
                          Practice Problem {idx + 1}
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: pq.difficulty === 'easy' ? '#ECFDF5' : pq.difficulty === 'hard' ? '#FEF2F2' : '#FEF3C7',
                          color: pq.difficulty === 'easy' ? '#059669' : pq.difficulty === 'hard' ? '#DC2626' : '#D97706'
                        }}>
                          {pq.difficulty}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', lineHeight: '1.6', marginBottom: '16px' }}>
                        {pq.question}
                      </h4>

                      {/* Options */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {pq.options.map((opt, optIdx) => {
                          const isOptionSelected = selected === optIdx;
                          const isOptionCorrect = optIdx === pq.correctOptionIndex;

                          let borderColor = '#E2E8F0';
                          let bgColor = '#FFFFFF';

                          if (isSubmitted) {
                            if (isOptionCorrect) {
                              borderColor = '#10B981';
                              bgColor = '#ECFDF5';
                            } else if (isOptionSelected && !isCorrect) {
                              borderColor = '#EF4444';
                              bgColor = '#FEF2F2';
                            }
                          } else if (isOptionSelected) {
                            borderColor = '#10B981';
                            bgColor = '#ECFDF5';
                          }

                          return (
                            <label
                              key={optIdx}
                              onClick={() => handleSelectPracticeOption(pq.id, optIdx)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px 16px',
                                borderRadius: '10px',
                                border: \`1px solid \${borderColor}\`,
                                backgroundColor: bgColor,
                                cursor: isSubmitted ? 'default' : 'pointer'
                              }}
                            >
                              <div style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                border: isOptionSelected ? '6px solid #10B981' : '2px solid #CBD5E1',
                                backgroundColor: '#FFFFFF',
                                flexShrink: 0
                              }} />
                              <span style={{ fontSize: '0.9rem', color: '#1E293B', lineHeight: '1.4' }}>
                                {opt}
                              </span>
                            </label>
                          );
                        })}
                      </div>

                      {/* Hint & Submit Row */}
                      <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {pq.hint ? (
                          <button
                            onClick={() => togglePracticeHint(pq.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#D97706',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Lightbulb size={16} />
                            <span>{showHint ? 'Hide Hint' : 'Need a Hint?'}</span>
                          </button>
                        ) : <div />}

                        {!isSubmitted && (
                          <button
                            onClick={() => handleSubmitPracticeAnswer(pq)}
                            disabled={selected === undefined}
                            className="btn btn-primary"
                            style={{ padding: '8px 18px', fontSize: '0.85rem', backgroundColor: '#10B981', borderColor: '#10B981' }}
                          >
                            Submit Practice
                          </button>
                        )}
                      </div>

                      {/* Hint Display */}
                      {showHint && pq.hint && (
                        <div style={{
                          marginTop: '12px',
                          padding: '12px 16px',
                          borderRadius: '10px',
                          backgroundColor: '#FFFBEB',
                          border: '1px solid #FDE68A',
                          color: '#92400E',
                          fontSize: '0.85rem'
                        }}>
                          💡 <strong>Hint:</strong> {pq.hint}
                        </div>
                      )}

                      {/* Explanation Feedback */}
                      {isSubmitted && (
                        <div style={{
                          marginTop: '16px',
                          padding: '14px 18px',
                          borderRadius: '12px',
                          backgroundColor: isCorrect ? '#ECFDF5' : '#FEF2F2',
                          border: isCorrect ? '1px solid #A7F3D0' : '1px solid #FCA5A5'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            {isCorrect ? <Check size={18} color="#059669" /> : <X size={18} color="#DC2626" />}
                            <strong style={{ color: isCorrect ? '#065F46' : '#991B1B', fontSize: '0.9rem' }}>
                              {isCorrect ? 'Well done!' : 'Keep practicing'}
                            </strong>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.88rem', color: isCorrect ? '#065F46' : '#991B1B', lineHeight: '1.5' }}>
                            <strong>Solution: </strong>{pq.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Complete Session Action */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '20px',
                borderTop: '1px solid #F1F5F9',
                marginTop: '12px',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <button
                  onClick={() => setLocalActiveTab('questions')}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <ArrowLeft size={16} />
                  <span>Back to Topic Quiz</span>
                </button>

                <button
                  onClick={handleCompleteSession}
                  className="btn btn-primary"
                  style={{
                    padding: '12px 28px',
                    backgroundColor: '#10B981',
                    borderColor: '#10B981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Award size={18} />
                  <span>Finish & Record Study Session</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Pedagogical Controls & Context Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Pedagogical Style Switcher Card */}
          <div className="card" style={{ padding: '22px', borderRadius: '18px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E293B', marginBottom: '4px' }}>
              Adaptive Learning Style
            </h4>
            <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 14px' }}>
              Calibrate pedagogical presentation for {subject}.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { style: 'Simple', icon: '💡', title: 'Simple', desc: 'Direct, clear, jargon-free' },
                { style: 'Analogy', icon: '🧩', title: 'Analogy', desc: 'Real-world mental models' },
                { style: 'Visual', icon: '👁️', title: 'Visual', desc: 'Step-by-step structured frameworks' },
                { style: 'Exam-oriented', icon: '📝', title: 'Exam-oriented', desc: 'High-yield marking criteria' }
              ].map(item => {
                const isSelected = student.preferredStyle === item.style;
                return (
                  <div
                    key={item.style}
                    onClick={() => {
                      setPreferredStyle(item.style as LearningStyle);
                      loadLesson(true);
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #4F46E5' : '1px solid #E2E8F0',
                      backgroundColor: isSelected ? '#EEF2FF' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.15rem' }}>{item.icon}</span>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isSelected ? '#4F46E5' : '#1E293B' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                          {item.desc}
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 size={16} color="#4F46E5" style={{ marginLeft: 'auto' }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Engine Status Card with Key Configuration Button */}
          <div className="card" style={{
            padding: '20px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)',
            border: '1px solid #E9D5FF'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="#7C3AED" />
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#7C3AED' }}>
                  AI Adaptive Engine
                </span>
              </div>
              <button
                onClick={() => setIsAiModalOpen(true)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #D8B4FE',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#7C3AED',
                  cursor: 'pointer'
                }}
              >
                Key Settings
              </button>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#6B21A8', margin: 0, lineHeight: '1.4' }}>
              Pacing calibrated to <strong>{studentLevel}</strong> difficulty for <strong>{student.board} Class {student.grade}</strong>. As you complete questions, your mastery profile dynamically updates.
            </p>
          </div>

          {/* Quick Chapter Selector */}
          {chapters.length > 0 && (
            <div className="card" style={{ padding: '20px', borderRadius: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Bookmark size={16} color="#4F46E5" />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E293B' }}>
                  {subject} Chapters
                </span>
              </div>
              <select
                value={chapter}
                onChange={(e) => {
                  const ch = chapters.find(c => c.title === e.target.value);
                  if (ch && ch.topics.length > 0) {
                    setTopicContext(subject, ch.title, ch.topics[0].title);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.82rem',
                  color: '#1E293B',
                  fontWeight: 600,
                  backgroundColor: '#F8FAFC',
                  outline: 'none'
                }}
              >
                {chapters.map(ch => (
                  <option key={ch.id} value={ch.title}>
                    Ch {ch.number}: {ch.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* AI Key Configuration Modal */}
      <AiModelConfigModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onKeyUpdated={(hasKey) => {
          setHasApiKey(hasKey);
          loadLesson(true);
        }}
      />
    </div>
  );
};
`;

fs.writeFileSync('src/components/AdaptiveStudySession.tsx', content, 'utf8');
console.log('Successfully wrote src/components/AdaptiveStudySession.tsx');
