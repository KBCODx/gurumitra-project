import React, { useState, useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Award,
  BookOpen,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Clock,
  Filter,
  Check,
  X,
  Layers,
  ChevronDown
} from 'lucide-react';
import { useStudent } from '../context/StudentContext';
import { SubjectType, QuizQuestion, QuizResult, DifficultyLevel } from '../types';
import { getQuizQuestions, getChapters } from '../services/curriculumService';
import { buildSubjectCurriculumLesson } from '../services/curriculumKnowledgePacks';

export const QuizView: React.FC = () => {
  const {
    student,
    subjects,
    activeSubject,
    setActiveSubject,
    recordQuizResult,
    lastQuizResult,
    setActiveTab,
    currentLearningContext,
    setTopicContext
  } = useStudent();

  // Active context state
  const [selectedSubject, setSelectedSubject] = useState<SubjectType>(activeSubject || 'Mathematics');
  const availableChapters = useMemo(() => {
    return getChapters(student.grade, student.board, student.stream, selectedSubject);
  }, [student.grade, student.board, student.stream, selectedSubject]);

  const [selectedChapter, setSelectedChapter] = useState<string>(
    currentLearningContext.chapter || availableChapters[0]?.title || 'Foundational Chapter'
  );

  const activeChapterObj = useMemo(() => {
    return availableChapters.find(ch => ch.title === selectedChapter) || availableChapters[0];
  }, [availableChapters, selectedChapter]);

  const [selectedTopic, setSelectedTopic] = useState<string>(
    currentLearningContext.topic || activeChapterObj?.topics[0]?.title || 'Core Topic'
  );

  const [showTopicPicker, setShowTopicPicker] = useState<boolean>(false);

  // Sync when activeSubject changes
  useEffect(() => {
    setSelectedSubject(activeSubject);
  }, [activeSubject]);

  // Sync chapters when subject changes
  useEffect(() => {
    if (availableChapters.length > 0) {
      const ch = availableChapters[0];
      setSelectedChapter(ch.title);
      if (ch.topics.length > 0) {
        setSelectedTopic(ch.topics[0].title);
      }
    }
  }, [selectedSubject, availableChapters]);

  // Retrieve base questions from curated questions database
  const baseQuestions = useMemo(() => {
    return getQuizQuestions(
      student.grade,
      student.board,
      student.stream,
      selectedSubject,
      selectedChapter,
      selectedTopic,
      student.level
    );
  }, [student.grade, student.board, student.stream, selectedSubject, selectedChapter, selectedTopic, student.level]);

  // Dynamic fallback using verified curriculum knowledge pack if topic has no pre-written questions
  const questionsToUse = useMemo<QuizQuestion[]>(() => {
    if (baseQuestions && baseQuestions.length > 0) {
      return baseQuestions;
    }

    // Dynamic pack generation
    const lessonPack = buildSubjectCurriculumLesson({
      classLevel: student.grade || 'Class 10',
      board: student.board || 'CBSE',
      subject: selectedSubject,
      chapter: selectedChapter,
      topic: selectedTopic,
      studentLevel: student.level === 'Advanced' ? 'Strong' : student.level === 'Beginner' ? 'Weak' : 'Average',
      allocatedMinutes: 30
    });

    const mapDifficulty = (d?: string): DifficultyLevel => {
      if (!d) return student.level || 'Intermediate';
      const lower = d.toLowerCase();
      if (lower === 'easy' || lower === 'beginner') return 'Beginner';
      if (lower === 'hard' || lower === 'advanced') return 'Advanced';
      return 'Intermediate';
    };

    if (lessonPack.questions && lessonPack.questions.length > 0) {
      return lessonPack.questions.map((q, idx): QuizQuestion => ({
        id: q.id || `dyn_q_${idx + 1}`,
        subject: selectedSubject,
        chapter: selectedChapter,
        topic: selectedTopic,
        difficulty: mapDifficulty(q.difficulty),
        question: q.question,
        options: q.options,
        correctIndex: q.correctOptionIndex ?? 0,
        explanation: q.explanation || 'Review the core definitions and conditions for this concept.',
        hint: q.conceptTested
      }));
    }

    return [];
  }, [baseQuestions, selectedSubject, selectedChapter, selectedTopic, student.grade, student.board, student.level]);

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [userAnswers, setUserAnswers] = useState<{
    questionIndex: number;
    questionText: string;
    options: string[];
    selectedIndex: number;
    correctIndex: number;
    isCorrect: boolean;
    explanation: string;
  }[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeReviewTab, setActiveReviewTab] = useState<'all' | 'mistakes'>('all');

  // Elapsed timer tracking
  useEffect(() => {
    if (isCompleted) return;
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isCompleted]);

  // Reset quiz states on topic or subject change
  const handleResetQuiz = () => {
    setCurrentQIndex(0);
    setSelectedOption(null);
    setIsAnswerChecked(false);
    setUserAnswers([]);
    setIsCompleted(false);
    setElapsedSeconds(0);
  };

  useEffect(() => {
    handleResetQuiz();
  }, [selectedSubject, selectedChapter, selectedTopic]);

  const currentQ = questionsToUse[currentQIndex] || questionsToUse[0];

  const handleSelectOption = (index: number) => {
    if (isAnswerChecked) return; // Prevent changing after checking
    setSelectedOption(index);
  };

  const handleCheckAnswer = () => {
    if (selectedOption === null || !currentQ) return;
    setIsAnswerChecked(true);

    const isCorrect = selectedOption === currentQ.correctIndex;
    const answerRecord = {
      questionIndex: currentQIndex,
      questionText: currentQ.question,
      options: currentQ.options,
      selectedIndex: selectedOption,
      correctIndex: currentQ.correctIndex,
      isCorrect,
      explanation: currentQ.explanation
    };

    setUserAnswers(prev => [...prev, answerRecord]);
  };

  const handleNextQuestion = () => {
    setSelectedOption(null);
    setIsAnswerChecked(false);

    if (currentQIndex + 1 < questionsToUse.length) {
      setCurrentQIndex(currentQIndex + 1);
    } else {
      // Quiz complete: calculate score
      finishQuiz(userAnswers);
    }
  };

  const finishQuiz = (answers: typeof userAnswers) => {
    const correctCount = answers.filter((a) => a.isCorrect).length;
    const total = answers.length;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    let newDiff: DifficultyLevel = 'Intermediate';
    let adaptMsg = '';

    if (accuracy > 80) {
      newDiff = 'Advanced';
      adaptMsg = 'Great performance! Difficulty increased to Advanced. Higher challenge unlocked!';
      try {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      } catch {}
    } else if (accuracy >= 60) {
      newDiff = 'Intermediate';
      adaptMsg = "You're progressing steadily. Continue practicing at Intermediate level.";
    } else {
      newDiff = 'Beginner';
      adaptMsg = "Let's strengthen core fundamentals before advancing. Difficulty adjusted to Beginner (Revision).";
    }

    const activeTopicTitle = selectedTopic || currentLearningContext.topic || selectedSubject;

    const result: QuizResult = {
      id: `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      timeSpentSeconds: elapsedSeconds,
      chapter: selectedChapter,
      score: correctCount,
      totalQuestions: total,
      accuracy,
      subject: selectedSubject,
      topic: activeTopicTitle,
      difficulty: currentQ?.difficulty || 'Intermediate',
      strongTopics: accuracy >= 60 ? [activeTopicTitle] : [],
      weakTopics: accuracy < 60 ? [activeTopicTitle] : [],
      adaptationMessage: adaptMsg,
      newDifficulty: newDiff,
      recommendedTopic: accuracy < 60 ? `${activeTopicTitle} Basics & Revision` : `Advanced ${activeTopicTitle} Applications`,
      userAnswers: answers.map(a => ({
        questionIndex: a.questionIndex,
        selectedIndex: a.selectedIndex,
        isCorrect: a.isCorrect
      }))
    };

    recordQuizResult(result);
    setIsCompleted(true);
  };

  // Quick 58% simulation for Section 19 Hackathon Demo Flow
  const handleSimulateDemo58 = () => {
    const activeTopicTitle = selectedTopic || currentLearningContext.topic || `${selectedSubject} Foundations`;

    const simulatedAnswers = [
      { questionIndex: 0, questionText: 'Fundamental concepts review', options: ['A', 'B', 'C', 'D'], selectedIndex: 0, correctIndex: 0, isCorrect: true, explanation: 'Correct conceptual application.' },
      { questionIndex: 1, questionText: 'Formula deduction', options: ['A', 'B', 'C', 'D'], selectedIndex: 1, correctIndex: 1, isCorrect: true, explanation: 'Direct application of the standard theorem.' },
      { questionIndex: 2, questionText: 'Multi-step calculation', options: ['A', 'B', 'C', 'D'], selectedIndex: 2, correctIndex: 0, isCorrect: false, explanation: 'Common sign error during substitution step.' },
      { questionIndex: 3, questionText: 'Properties and criteria', options: ['A', 'B', 'C', 'D'], selectedIndex: 3, correctIndex: 3, isCorrect: true, explanation: 'Criteria verified successfully.' },
      { questionIndex: 4, questionText: 'Geometric proof verification', options: ['A', 'B', 'C', 'D'], selectedIndex: 0, correctIndex: 1, isCorrect: false, explanation: 'Converse property was mistakenly assumed.' },
      { questionIndex: 5, questionText: 'Applied theorem calculation', options: ['A', 'B', 'C', 'D'], selectedIndex: 1, correctIndex: 1, isCorrect: true, explanation: 'Value calculated accurately.' },
      { questionIndex: 6, questionText: 'Edge case identification', options: ['A', 'B', 'C', 'D'], selectedIndex: 2, correctIndex: 3, isCorrect: false, explanation: 'Zero and negative bounds were overlooked.' },
      { questionIndex: 7, questionText: 'Concept application problem', options: ['A', 'B', 'C', 'D'], selectedIndex: 3, correctIndex: 3, isCorrect: true, explanation: 'Standard proportionality applied.' },
      { questionIndex: 8, questionText: 'Symbolic equivalence', options: ['A', 'B', 'C', 'D'], selectedIndex: 0, correctIndex: 2, isCorrect: false, explanation: 'Order of terms inverted in algebraic expansion.' },
      { questionIndex: 9, questionText: 'Final analytical check', options: ['A', 'B', 'C', 'D'], selectedIndex: 1, correctIndex: 0, isCorrect: false, explanation: 'Units were not converted before substitution.' },
    ];

    setUserAnswers(simulatedAnswers);

    const result: QuizResult = {
      id: `quiz_${Date.now()}_sim58`,
      timestamp: new Date().toISOString(),
      timeSpentSeconds: 145,
      chapter: selectedChapter,
      score: 6,
      totalQuestions: 10,
      accuracy: 58,
      subject: selectedSubject,
      topic: activeTopicTitle,
      difficulty: 'Intermediate',
      strongTopics: [`${activeTopicTitle} Foundations`],
      weakTopics: [`${activeTopicTitle} Problem Sets`],
      adaptationMessage: "Accuracy is 58%. System lowered difficulty to Beginner and scheduled remedial reinforcement.",
      newDifficulty: 'Beginner',
      recommendedTopic: `${activeTopicTitle} Fundamentals`,
      userAnswers: simulatedAnswers.map(a => ({
        questionIndex: a.questionIndex,
        selectedIndex: a.selectedIndex,
        isCorrect: a.isCorrect
      }))
    };

    recordQuizResult(result);
    setIsCompleted(true);
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // RENDER POST-QUIZ RESULTS SCREEN
  if (isCompleted && lastQuizResult) {
    const { score, totalQuestions, accuracy, subject, topic, adaptationMessage, newDifficulty, recommendedTopic, timeSpentSeconds } = lastQuizResult;
    const isSuccess = accuracy >= 80;
    const isWarning = accuracy < 60;

    const mistakesList = userAnswers.filter(a => !a.isCorrect);

    return (
      <div style={{
        maxWidth: '960px',
        margin: '0 auto',
        padding: '32px 24px 64px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {/* Top Result Banner */}
        <div className="card" style={{
          padding: '32px',
          textAlign: 'center',
          background: isSuccess
            ? 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)'
            : isWarning
            ? 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)'
            : 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
          border: isSuccess ? '1.5px solid #A7F3D0' : isWarning ? '1.5px solid #FED7AA' : '1.5px solid #C7D2FE'
        }}>
          <span style={{ fontSize: '2.5rem', marginBottom: '8px', display: 'block' }}>
            {isSuccess ? '🏆' : isWarning ? '💡' : '📈'}
          </span>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1E293B', marginBottom: '6px' }}>
            Diagnostic Quiz Complete
          </h2>
          <p style={{ fontSize: '0.95rem', color: '#475569', margin: 0 }}>
            Subject: <strong>{subject}</strong> • Topic: <strong>{topic}</strong> • Time: <strong>{formatTimer(timeSpentSeconds || elapsedSeconds)}</strong>
          </p>
        </div>

        {/* Results Card with Circular Gauge & Performance */}
        <div className="card" style={{ padding: '32px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.8fr)',
            gap: '32px',
            alignItems: 'center'
          }}>
            {/* Circular Gauge */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              borderRadius: '20px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '12px' }}>
                Score Overview
              </span>

              <div style={{
                position: 'relative',
                width: '140px',
                height: '140px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="140" height="140" viewBox="0 0 140 140">
                  <circle
                    cx="70"
                    cy="70"
                    r="58"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="12"
                  />
                  <circle
                    cx="70"
                    cy="70"
                    r="58"
                    fill="none"
                    stroke={accuracy >= 80 ? '#10B981' : accuracy >= 60 ? '#4F46E5' : '#EF4444'}
                    strokeWidth="12"
                    strokeDasharray={2 * Math.PI * 58}
                    strokeDashoffset={2 * Math.PI * 58 * (1 - accuracy / 100)}
                    strokeLinecap="round"
                    transform="rotate(-90 70 70)"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1E293B', lineHeight: '1.1' }}>
                    {score}/{totalQuestions}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>
                    {accuracy}% Accuracy
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', gap: '8px', fontSize: '0.78rem', color: '#64748B' }}>
                <span style={{ color: '#10B981', fontWeight: 700 }}>✓ {score} Correct</span>
                <span>•</span>
                <span style={{ color: '#EF4444', fontWeight: 700 }}>✗ {totalQuestions - score} Mistakes</span>
              </div>
            </div>

            {/* Performance Breakdown */}
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', marginBottom: '14px' }}>
                Topic Mastery Status
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #F1F5F9'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isWarning ? '#EF4444' : '#10B981' }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E293B' }}>
                      {topic}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1E293B' }}>
                      {accuracy}%
                    </span>
                    <span className={`badge ${isWarning ? 'badge-high-priority' : 'badge-on-track'}`}>
                      {isWarning ? 'Needs Practice' : 'Mastered'}
                    </span>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #F1F5F9'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Clock size={16} color="#64748B" />
                    <span style={{ fontSize: '0.88rem', color: '#475569', fontWeight: 600 }}>
                      Completion Time
                    </span>
                  </div>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1E293B' }}>
                    {formatTimer(timeSpentSeconds || elapsedSeconds)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* DYNAMIC ADAPTATION REACTION CARD */}
          <div style={{
            marginTop: '28px',
            padding: '20px 24px',
            borderRadius: '16px',
            backgroundColor: isWarning ? '#FEF2F2' : isSuccess ? '#F0FDF4' : '#EEF2FF',
            border: isWarning ? '1.5px solid #FECACA' : isSuccess ? '1.5px solid #BBF7D0' : '1.5px solid #C7D2FE',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={20} color={isWarning ? '#DC2626' : isSuccess ? '#15803D' : '#4F46E5'} />
              <h4 style={{
                fontSize: '1rem',
                fontWeight: 800,
                color: isWarning ? '#991B1B' : isSuccess ? '#166534' : '#1E1B4B',
                margin: 0
              }}>
                Adaptive Engine Recalibration
              </h4>
            </div>

            <p style={{
              fontSize: '0.92rem',
              color: isWarning ? '#7F1D1D' : isSuccess ? '#14532D' : '#312E81',
              margin: 0,
              lineHeight: '1.5'
            }}>
              {adaptationMessage} Difficulty automatically tuned to <strong>{newDifficulty}</strong>.
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(0,0,0,0.08)'
            }}>
              <span style={{ fontSize: '0.85rem', color: '#334155' }}>
                Next AI Recommendation: <strong>{recommendedTopic}</strong>
              </span>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setActiveTab('recommendations')}
                  className="btn btn-primary"
                  style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                >
                  <span>Start Recommended Practice</span>
                  <ArrowRight size={15} />
                </button>
                <button
                  onClick={() => {
                    setTopicContext(subject, selectedChapter, topic);
                    setActiveTab('adaptive');
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  <BookOpen size={14} />
                  <span>Study Topic Theory</span>
                </button>
                <button
                  onClick={handleResetQuiz}
                  className="btn btn-outline"
                  style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                >
                  <RotateCcw size={14} />
                  <span>Retake Quiz</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Question-by-Question Review with Mistake Breakdown */}
        {userAnswers.length > 0 && (
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                  Question-wise Performance & Explanations
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '4px 0 0' }}>
                  Review each question, check detailed explanations, and inspect mistakes.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setActiveReviewTab('all')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: activeReviewTab === 'all' ? '#4F46E5' : '#F1F5F9',
                    color: activeReviewTab === 'all' ? '#FFFFFF' : '#64748B'
                  }}
                >
                  All Questions ({userAnswers.length})
                </button>
                <button
                  onClick={() => setActiveReviewTab('mistakes')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: activeReviewTab === 'mistakes' ? '#EF4444' : '#F1F5F9',
                    color: activeReviewTab === 'mistakes' ? '#FFFFFF' : '#64748B'
                  }}
                >
                  Mistakes ({mistakesList.length})
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(activeReviewTab === 'all' ? userAnswers : mistakesList).map((ans, idx) => {
                const letters = ['A', 'B', 'C', 'D'];
                return (
                  <div
                    key={idx}
                    style={{
                      padding: '18px 20px',
                      borderRadius: '14px',
                      backgroundColor: ans.isCorrect ? '#F8FAFC' : '#FEF2F2',
                      border: ans.isCorrect ? '1px solid #E2E8F0' : '1.5px solid #FECACA'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1E293B' }}>
                        Q{ans.questionIndex + 1}. {ans.questionText}
                      </span>
                      <span className={`badge ${ans.isCorrect ? 'badge-on-track' : 'badge-high-priority'}`} style={{ whiteSpace: 'nowrap' }}>
                        {ans.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: ans.isCorrect ? '#DCFCE7' : '#FEE2E2',
                        border: ans.isCorrect ? '1px solid #BBF7D0' : '1px solid #FCA5A5',
                        fontSize: '0.82rem'
                      }}>
                        <strong style={{ color: ans.isCorrect ? '#15803D' : '#991B1B' }}>Your Answer:</strong>{' '}
                        {letters[ans.selectedIndex]} - {ans.options[ans.selectedIndex]}
                      </div>

                      {!ans.isCorrect && (
                        <div style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          backgroundColor: '#DCFCE7',
                          border: '1px solid #BBF7D0',
                          fontSize: '0.82rem',
                          color: '#15803D'
                        }}>
                          <strong>Correct Answer:</strong> {letters[ans.correctIndex]} - {ans.options[ans.correctIndex]}
                        </div>
                      )}
                    </div>

                    {ans.explanation && (
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        fontSize: '0.82rem',
                        color: '#475569',
                        lineHeight: '1.5'
                      }}>
                        <strong style={{ color: '#4F46E5' }}>💡 Explanation:</strong> {ans.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // RENDER ACTIVE QUESTION FLOW
  return (
    <div style={{
      maxWidth: '960px',
      margin: '0 auto',
      padding: '32px 24px 64px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {/* Top Header & Topic Selector Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase' }}>
              Adaptive Quiz • {selectedSubject}
            </span>
            <span style={{ fontSize: '0.72rem', backgroundColor: '#EEF2FF', color: '#4F46E5', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
              {student.level}
            </span>
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
            {selectedTopic}
          </h1>
          <span style={{ fontSize: '0.82rem', color: '#64748B' }}>
            Chapter: {selectedChapter}
          </span>
        </div>

        {/* Quick judge demo shortcut & topic selector button */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowTopicPicker(prev => !prev)}
            className="btn btn-outline"
            style={{ padding: '8px 14px', fontSize: '0.8rem', borderRadius: '10px' }}
          >
            <Filter size={14} />
            <span>Change Topic / Subject</span>
            <ChevronDown size={14} />
          </button>

          <button
            onClick={handleSimulateDemo58}
            className="btn"
            style={{
              backgroundColor: '#FFF7ED',
              color: '#C2410C',
              border: '1px solid #FFEDD5',
              padding: '8px 14px',
              fontSize: '0.78rem',
              borderRadius: '999px',
              fontWeight: 700
            }}
            title="Fast-forward: Simulates 58% score to demonstrate adaptive difficulty lowering"
          >
            ⚡ Presentation Simulation (Score 58%)
          </button>
        </div>
      </div>

      {/* Expandable Topic & Subject Picker */}
      {showTopicPicker && (
        <div className="card" style={{ padding: '20px 24px', backgroundColor: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1E293B', marginBottom: '14px' }}>
            Select Any Subject & Topic from CBSE Class 10 Syllabus:
          </h4>

          {/* Subject Pills */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {subjects.map(s => {
              const isSelected = s.name === selectedSubject;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedSubject(s.name);
                    setActiveSubject(s.name);
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: isSelected ? 800 : 600,
                    border: isSelected ? '1.5px solid #4F46E5' : '1px solid #CBD5E1',
                    backgroundColor: isSelected ? '#EEF2FF' : '#FFFFFF',
                    color: isSelected ? '#4F46E5' : '#475569',
                    cursor: 'pointer'
                  }}
                >
                  <span>{s.icon} {s.name}</span>
                </button>
              );
            })}
          </div>

          {/* Chapter & Topic Dropdowns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '6px' }}>
                Chapter
              </label>
              <select
                value={selectedChapter}
                onChange={(e) => {
                  const newCh = e.target.value;
                  setSelectedChapter(newCh);
                  const chObj = availableChapters.find(c => c.title === newCh);
                  if (chObj && chObj.topics.length > 0) {
                    setSelectedTopic(chObj.topics[0].title);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                {availableChapters.map(ch => (
                  <option key={ch.id} value={ch.title}>
                    {ch.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '6px' }}>
                Topic
              </label>
              <select
                value={selectedTopic}
                onChange={(e) => {
                  setSelectedTopic(e.target.value);
                  setTopicContext(selectedSubject, selectedChapter, e.target.value);
                  setShowTopicPicker(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                {activeChapterObj?.topics.map(t => (
                  <option key={t.id} value={t.title}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Progress Counter & Live Elapsed Timer */}
      <div className="card" style={{ padding: '18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#4F46E5' }}>
              Question {currentQIndex + 1} of {questionsToUse.length}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
              Difficulty: {currentQ?.difficulty || student.level}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#64748B' }}>
            <Clock size={15} color="#4F46E5" />
            <span>Time: {formatTimer(elapsedSeconds)}</span>
          </div>
        </div>

        <div className="progress-bar-container" style={{ height: '6px' }}>
          <div
            className="progress-bar-fill"
            style={{ width: `${((currentQIndex + (isAnswerChecked ? 1 : 0.5)) / questionsToUse.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      {currentQ && (
        <div className="card" style={{ padding: '32px' }}>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#1E293B',
            lineHeight: '1.5',
            marginBottom: '24px'
          }}>
            {currentQ.question}
          </h3>

          {/* Options List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {currentQ.options.map((opt, index) => {
              const isSelected = selectedOption === index;
              const isCorrectOpt = index === currentQ.correctIndex;
              const letter = ['A', 'B', 'C', 'D'][index];

              let borderColor = 'var(--border-subtle)';
              let bgColor = '#FFFFFF';
              let textColor = '#1E293B';

              if (isAnswerChecked) {
                if (isCorrectOpt) {
                  borderColor = '#10B981';
                  bgColor = '#DCFCE7';
                  textColor = '#15803D';
                } else if (isSelected && !isCorrectOpt) {
                  borderColor = '#EF4444';
                  bgColor = '#FEE2E2';
                  textColor = '#991B1B';
                }
              } else if (isSelected) {
                borderColor = '#4F46E5';
                bgColor = '#EEF2FF';
                textColor = '#4F46E5';
              }

              return (
                <button
                  key={index}
                  onClick={() => handleSelectOption(index)}
                  disabled={isAnswerChecked}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderRadius: '14px',
                    border: `2px solid ${borderColor}`,
                    backgroundColor: bgColor,
                    color: textColor,
                    fontWeight: isSelected || (isAnswerChecked && isCorrectOpt) ? 700 : 500,
                    fontSize: '0.95rem',
                    cursor: isAnswerChecked ? 'default' : 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: isAnswerChecked
                        ? (isCorrectOpt ? '#10B981' : isSelected ? '#EF4444' : '#F1F5F9')
                        : (isSelected ? '#4F46E5' : '#F1F5F9'),
                      color: (isSelected || (isAnswerChecked && isCorrectOpt)) ? '#FFFFFF' : '#64748B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.85rem'
                    }}>
                      {letter}
                    </span>
                    <span>{opt}</span>
                  </div>

                  {isAnswerChecked && isCorrectOpt && (
                    <CheckCircle2 size={20} color="#10B981" />
                  )}
                  {isAnswerChecked && isSelected && !isCorrectOpt && (
                    <XCircle size={20} color="#EF4444" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Immediate Pedagogical Explanation Feedback */}
          {isAnswerChecked && (
            <div style={{
              padding: '16px 20px',
              borderRadius: '12px',
              backgroundColor: selectedOption === currentQ.correctIndex ? '#F0FDF4' : '#FEF2F2',
              border: selectedOption === currentQ.correctIndex ? '1px solid #BBF7D0' : '1px solid #FECACA',
              marginBottom: '24px',
              animation: 'fadeIn 0.2s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                {selectedOption === currentQ.correctIndex ? (
                  <CheckCircle2 size={18} color="#15803D" />
                ) : (
                  <AlertTriangle size={18} color="#DC2626" />
                )}
                <strong style={{ fontSize: '0.9rem', color: selectedOption === currentQ.correctIndex ? '#15803D' : '#991B1B' }}>
                  {selectedOption === currentQ.correctIndex ? 'Correct! Excellent work.' : 'Incorrect. Study the principle below:'}
                </strong>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#475569', margin: 0, lineHeight: '1.5' }}>
                <strong>Explanation:</strong> {currentQ.explanation}
              </p>
            </div>
          )}

          {/* Action Buttons: Check Answer / Next Question */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #F1F5F9',
            paddingTop: '20px'
          }}>
            <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
              {selectedOption === null
                ? 'Select an option to proceed'
                : !isAnswerChecked
                ? 'Click "Check Answer" for instant explanation'
                : 'Click "Next Question" to proceed'}
            </span>

            {!isAnswerChecked ? (
              <button
                onClick={handleCheckAnswer}
                className="btn btn-primary"
                style={{ padding: '12px 28px', borderRadius: '12px' }}
                disabled={selectedOption === null}
              >
                <span>Check Answer</span>
                <Check size={17} />
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                className="btn btn-primary"
                style={{ padding: '12px 28px', borderRadius: '12px' }}
              >
                <span>{currentQIndex + 1 === questionsToUse.length ? 'Submit Quiz' : 'Next Question'}</span>
                <ChevronRight size={17} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
