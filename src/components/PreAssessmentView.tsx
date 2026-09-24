import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  HelpCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  BrainCircuit,
  BookOpen,
  Loader2,
  UploadCloud,
  Layers,
  Award,
  ShieldCheck,
  RotateCcw,
  Info,
  Filter,
  CheckSquare,
  Square
} from 'lucide-react';
import { useStudent } from '../context/StudentContext';
import {
  PreAssessmentQuestion,
  ExtractedChapter,
  SubjectType,
  PreAssessmentResult,
  AllowedContentMap
} from '../types';
import {
  extractChaptersFromMaterial,
  generateCombinedQuestions,
  buildAllowedContentMap,
  validateAssessmentSession,
  ChapterQuestionAllocation,
  TARGET_PRE_ASSESSMENT_QUESTIONS,
  getTargetQuestionsForSubjects,
  getStoredGeminiKey
} from '../services/preAssessmentService';
import {
  evaluateAssessmentSession,
  generateAIRecommendations
} from '../services/assessmentScoringService';
import { PreAssessmentResultView } from './PreAssessmentResultView';
import { AiModelConfigModal } from './AiModelConfigModal';

export const PreAssessmentView: React.FC = () => {
  const {
    student,
    syllabusData,
    uploadedMaterial,
    setActiveTab,
    preAssessmentResult,
    recordPreAssessmentResult,
    clearPreAssessment
  } = useStudent();

  // Test state machine: 'intro' | 'loading' | 'active' | 'result'
  const [phase, setPhase] = useState<'intro' | 'loading' | 'active' | 'result'>('intro');
  const [loadingMessage, setLoadingMessage] = useState('Analyzing syllabus materials...');
  const [chaptersBySubject, setChaptersBySubject] = useState<Record<SubjectType, ExtractedChapter[]>>({} as any);
  const [allocations, setAllocations] = useState<ChapterQuestionAllocation[]>([]);
  const [questions, setQuestions] = useState<PreAssessmentQuestion[]>([]);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [allowedContentMap, setAllowedContentMap] = useState<AllowedContentMap | null>(null);

  // Subject and Chapter Selection State (Strict Hard Filter)
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectType[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<Record<SubjectType, Set<string>>>({} as any);
  const [isExtractingChapters, setIsExtractingChapters] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean>(() => !!getStoredGeminiKey());

  // Active Test State
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { selectedOption: number | null; timeSpentSeconds: number }>>({});
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Per-question timer tracking
  const questionStartTimeRef = useRef<number>(Date.now());
  const timerIntervalRef = useRef<any>(null);

  // If there's an existing result in context, show it
  useEffect(() => {
    if (preAssessmentResult) {
      setPhase('result');
    }
  }, [preAssessmentResult]);

  // Initial chapter extraction for all available subjects
  useEffect(() => {
    let isMounted = true;
    async function loadSubjectChapters() {
      setIsExtractingChapters(true);
      const extracted: Record<SubjectType, ExtractedChapter[]> = {} as any;

      // 1. Process uploaded single material if present
      if (uploadedMaterial && uploadedMaterial.extractedText) {
        const primarySub = student.preferredSubjects[0] || 'Mathematics';
        const { chapters: chs } = await extractChaptersFromMaterial(
          uploadedMaterial.extractedText,
          primarySub,
          student.grade
        );
        if (chs.length > 0) {
          extracted[primarySub] = chs;
        }
      }

      // 2. Process all syllabusData entries
      const subjectsWithSyllabus = Object.keys(syllabusData) as SubjectType[];
      for (const sub of subjectsWithSyllabus) {
        const item = syllabusData[sub];
        if (item?.extractedText && !extracted[sub]) {
          const { chapters: chs } = await extractChaptersFromMaterial(
            item.extractedText,
            sub,
            student.grade
          );
          if (chs.length > 0) {
            extracted[sub] = chs;
          }
        }
      }

      // 3. Fallback for preferred subjects if zero files uploaded yet
      const candidateSubs = (student.preferredSubjects && student.preferredSubjects.length > 0)
        ? student.preferredSubjects
        : (['Mathematics', 'Science'] as SubjectType[]);

      for (const sub of candidateSubs) {
        if (!extracted[sub]) {
          // Check standard curriculum chapters
          const standardText = `Standard school syllabus for ${sub}. Units: Number Systems, Polynomials, Linear Equations, Chemical Reactions, Life Processes, Electricity.`;
          const { chapters: chs } = await extractChaptersFromMaterial(standardText, sub, student.grade);
          extracted[sub] = chs;
        }
      }

      if (isMounted) {
        setChaptersBySubject(extracted);

        // Default selected subjects
        const available = Object.keys(extracted) as SubjectType[];
        const initialSubs = available.length > 0 ? available.slice(0, 2) : ['Mathematics'];
        setSelectedSubjects(initialSubs);

        // Select all chapters by default for those subjects
        const initialChapterIds: Record<SubjectType, Set<string>> = {} as any;
        initialSubs.forEach(sub => {
          initialChapterIds[sub] = new Set((extracted[sub] || []).map(c => c.chapterId));
        });
        setSelectedChapterIds(initialChapterIds);
        setIsExtractingChapters(false);
      }
    }

    loadSubjectChapters();
    return () => { isMounted = false; };
  }, [uploadedMaterial, syllabusData, student.preferredSubjects, student.grade]);

  // Global test timer
  useEffect(() => {
    if (phase === 'active') {
      timerIntervalRef.current = setInterval(() => {
        setTotalSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [phase]);

  // When changing questions, commit time spent on previous question
  const recordCurrentQuestionTime = (fromQuestionId: string) => {
    const elapsed = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
    setAnswers((prev) => {
      const existing = prev[fromQuestionId] || { selectedOption: null, timeSpentSeconds: 0 };
      return {
        ...prev,
        [fromQuestionId]: {
          ...existing,
          timeSpentSeconds: (existing.timeSpentSeconds || 0) + Math.max(1, elapsed)
        }
      };
    });
    questionStartTimeRef.current = Date.now();
  };

  // Toggle subject selection
  const handleToggleSubject = (sub: SubjectType) => {
    setValidationError(null);
    setSelectedSubjects(prev => {
      let next: SubjectType[];
      if (prev.includes(sub)) {
        if (prev.length === 1) {
          return prev; // keep at least one subject
        }
        next = prev.filter(s => s !== sub);
      } else {
        next = [...prev, sub];
      }

      // Initialize chapter selection if newly added
      if (!selectedChapterIds[sub] && chaptersBySubject[sub]) {
        setSelectedChapterIds(chMap => ({
          ...chMap,
          [sub]: new Set(chaptersBySubject[sub].map(c => c.chapterId))
        }));
      }
      return next;
    });
  };

  // Toggle individual chapter selection
  const handleToggleChapter = (sub: SubjectType, chId: string) => {
    setValidationError(null);
    setSelectedChapterIds(prev => {
      const currentSet = new Set(prev[sub] || []);
      if (currentSet.has(chId)) {
        if (currentSet.size > 1) {
          currentSet.delete(chId);
        }
      } else {
        currentSet.add(chId);
      }
      return {
        ...prev,
        [sub]: currentSet
      };
    });
  };

  // Fast Scope Preset helper
  const handleSelectPreset = (mode: 'math_only' | 'science_only' | 'math_science' | 'all') => {
    setValidationError(null);
    const available = Object.keys(chaptersBySubject) as SubjectType[];

    let targetSubs: SubjectType[] = [];
    if (mode === 'math_only' && available.includes('Mathematics')) {
      targetSubs = ['Mathematics'];
    } else if (mode === 'science_only' && available.includes('Science')) {
      targetSubs = ['Science'];
    } else if (mode === 'math_science') {
      targetSubs = available.filter(s => s === 'Mathematics' || s === 'Science');
      if (targetSubs.length === 0) targetSubs = available.slice(0, 2);
    } else {
      targetSubs = available;
    }

    if (targetSubs.length === 0) targetSubs = [available[0] || 'Mathematics'];
    setSelectedSubjects(targetSubs);

    const newChMap: Record<SubjectType, Set<string>> = {} as any;
    targetSubs.forEach(s => {
      newChMap[s] = new Set((chaptersBySubject[s] || []).map(c => c.chapterId));
    });
    setSelectedChapterIds(newChMap);
  };

  // Start generation with strict boundary verification
  const handleStartGeneration = async () => {
    if (selectedSubjects.length === 0) {
      setValidationError('Please select at least one subject for your pre-assessment.');
      return;
    }

    // Build filtered chapters by subject
    const filteredChaptersBySubject: Record<SubjectType, ExtractedChapter[]> = {} as any;
    let totalChaptersSelected = 0;

    for (const sub of selectedSubjects) {
      const allSubjectChs = chaptersBySubject[sub] || [];
      const allowedSet = selectedChapterIds[sub] || new Set();
      const activeChs = allSubjectChs.filter(c => allowedSet.has(c.chapterId));

      if (activeChs.length > 0) {
        filteredChaptersBySubject[sub] = activeChs;
        totalChaptersSelected += activeChs.length;
      }
    }

    if (totalChaptersSelected === 0) {
      setValidationError('Please select at least one chapter from your chosen subjects.');
      return;
    }

    setPhase('loading');
    setLoadingMessage(`Verifying chapters and building diagnostic assessment strictly for [${selectedSubjects.join(' & ')}]...`);

    try {
      const targetCount = getTargetQuestionsForSubjects(selectedSubjects);
      const {
        questions: genQuestions,
        isDemoMode: qDemoFlag,
        allocations: allocs,
        allowedMap
      } = await generateCombinedQuestions(
        filteredChaptersBySubject,
        selectedSubjects,
        student.grade,
        targetCount
      );

      // Validate session against strict boundary rules
      const sessionCheck = validateAssessmentSession(genQuestions, allowedMap, targetCount);
      if (!sessionCheck.valid) {
        console.warn('Assessment validation warnings:', sessionCheck.reasons);
      }

      setAllowedContentMap(allowedMap);
      setAllocations(allocs || []);
      setQuestions(genQuestions);
      setIsDemoMode(qDemoFlag);

      // Initialize answers dictionary
      const initialAnswers: Record<string, { selectedOption: number | null; timeSpentSeconds: number }> = {};
      genQuestions.forEach((q) => {
        initialAnswers[q.questionId] = { selectedOption: null, timeSpentSeconds: 0 };
      });
      setAnswers(initialAnswers);

      // Transition to active test
      setCurrentIdx(0);
      setTotalSeconds(0);
      questionStartTimeRef.current = Date.now();
      setPhase('active');
    } catch (err: any) {
      console.error('Failed to generate pre-assessment:', err);
      const detail = err?.message ? `: ${err.message}` : '';
      setValidationError(`An error occurred during assessment generation${detail}. Please try again.`);
      setPhase('intro');
    }
  };

  const handleSelectOption = (optionIndex: number) => {
    const currentQ = questions[currentIdx];
    if (!currentQ) return;

    setAnswers((prev) => ({
      ...prev,
      [currentQ.questionId]: {
        ...prev[currentQ.questionId],
        selectedOption: optionIndex
      }
    }));
  };

  const handleNavigateQuestion = (targetIdx: number) => {
    if (targetIdx < 0 || targetIdx >= questions.length || targetIdx === currentIdx) return;
    const currentQ = questions[currentIdx];
    if (currentQ) {
      recordCurrentQuestionTime(currentQ.questionId);
    }
    setCurrentIdx(targetIdx);
  };

  const handleSubmitTest = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const currentQ = questions[currentIdx];
    if (currentQ) {
      recordCurrentQuestionTime(currentQ.questionId);
    }

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    // Deterministic evaluation
    const result = evaluateAssessmentSession(
      student.id,
      questions,
      answers,
      totalSeconds,
      isDemoMode
    );

    // Call AI recommendation in background
    generateAIRecommendations(result)
      .then((aiRec) => {
        if (aiRec) {
          result.aiRecommendation = aiRec;
          recordPreAssessmentResult(result);
        }
      })
      .catch((err) => console.warn('AI recommendation generation error:', err));

    recordPreAssessmentResult(result);
    setShowSubmitModal(false);
    setIsSubmitting(false);
    setPhase('result');
  };

  const handleRetake = () => {
    clearPreAssessment();
    setPhase('intro');
    setCurrentIdx(0);
    setAnswers({});
    setTotalSeconds(0);
    setAllowedContentMap(null);
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const answeredCount = Object.values(answers).filter(a => a.selectedOption !== null).length;
  const totalCount = questions.length;

  // ==========================================================================
  // VIEW: RESULT
  // ==========================================================================
  if (phase === 'result' && preAssessmentResult) {
    return <PreAssessmentResultView result={preAssessmentResult} onRetake={handleRetake} />;
  }

  // ==========================================================================
  // VIEW: LOADING SPINNER
  // ==========================================================================
  if (phase === 'loading') {
    return (
      <div style={{
        minHeight: '75vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        gap: '20px'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          boxShadow: '0 10px 25px rgba(79, 70, 229, 0.35)',
          animation: 'pulse-soft 2s infinite ease-in-out'
        }}>
          <BrainCircuit size={36} />
        </div>
        <div style={{ textAlign: 'center', maxWidth: '520px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1E293B', marginBottom: '8px' }}>
            Preparing Your Grounded Pre-Assessment
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#64748B', lineHeight: '1.5' }}>
            {loadingMessage}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4F46E5', fontSize: '0.85rem', fontWeight: 600 }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Verifying question source boundaries (~10 Easy, ~14 Moderate, ~6 Difficult)...</span>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // VIEW: INTRO & SCOPE CONFIGURATOR
  // ==========================================================================
  if (phase === 'intro') {
    const availableSubjects = Object.keys(chaptersBySubject) as SubjectType[];
    const totalActiveChapters = selectedSubjects.reduce((acc, sub) => {
      return acc + (selectedChapterIds[sub]?.size || 0);
    }, 0);

    return (
      <div style={{
        maxWidth: '920px',
        margin: '0 auto',
        padding: '36px 20px 80px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {/* Intro Hero Header */}
        <div className="card" style={{
          padding: '32px 36px',
          background: 'linear-gradient(135deg, #FFFFFF 0%, #EEF2FF 100%)',
          border: '1.5px solid #C7D2FE',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#4F46E5',
              backgroundColor: '#EEF2FF',
              padding: '3px 10px',
              borderRadius: '999px',
              border: '1px solid #C7D2FE'
            }}>
              GuruMitra Diagnostic Engine
            </span>

            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '999px',
                border: hasGeminiKey ? '1.5px solid #10B981' : '1.5px solid #C7D2FE',
                backgroundColor: hasGeminiKey ? '#ECFDF5' : '#FFFFFF',
                color: hasGeminiKey ? '#065F46' : '#4F46E5',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: hasGeminiKey ? '#10B981' : '#6366F1',
                boxShadow: hasGeminiKey ? '0 0 8px rgba(16, 185, 129, 0.7)' : 'none',
                display: 'inline-block'
              }} />
              <span>{hasGeminiKey ? 'Gemini AI Active' : 'Curriculum Engine Active'}</span>
              <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>• Settings</span>
            </button>
          </div>

          <h1 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#1E293B', margin: 0, letterSpacing: '-0.02em' }}>
            Diagnostic Pre-Assessment
          </h1>

          <p style={{ fontSize: '1rem', color: '#475569', lineHeight: '1.6', margin: 0 }}>
            Establish an accurate baseline of your current knowledge. Pre-assessment questions are strictly
            grounded in your uploaded syllabus and chosen chapters. Content outside your selected subjects will NEVER appear.
          </p>

          {/* Validation Alert */}
          {validationError && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '10px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#991B1B',
              fontSize: '0.86rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              <span>{validationError}</span>
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginTop: '4px'
          }}>
            <button
              onClick={handleStartGeneration}
              disabled={isExtractingChapters}
              className="btn btn-primary"
              style={{
                padding: '13px 26px',
                fontSize: '0.98rem',
                fontWeight: 700,
                borderRadius: '12px',
                boxShadow: '0 8px 24px -4px rgba(79, 70, 229, 0.4)',
                cursor: isExtractingChapters ? 'not-allowed' : 'pointer'
              }}
            >
              {isExtractingChapters ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={18} />}
              <span>Start Diagnostic ({getTargetQuestionsForSubjects(selectedSubjects)} Qs)</span>
              <ArrowRight size={18} />
            </button>

            {uploadedMaterial ? (
              <span style={{ fontSize: '0.82rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                <CheckCircle2 size={16} />
                Grounding in uploaded file: "{uploadedMaterial.fileName}"
              </span>
            ) : Object.keys(syllabusData).length > 0 ? (
              <span style={{ fontSize: '0.82rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                <CheckCircle2 size={16} />
                Grounding in uploaded syllabus across {Object.keys(syllabusData).length} subjects
              </span>
            ) : (
              <span style={{ fontSize: '0.82rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={16} />
                Standard NCERT/CBSE verified chapters for {student.grade}
              </span>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* INTERACTIVE SCOPE & CHAPTER CONFIGURATOR */}
        {/* =================================================================== */}
        <div className="card" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Filter size={18} color="#4F46E5" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                  Assessment Subject & Chapter Filter
                </h3>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0 }}>
                Select exactly which subjects and chapters to include. The test enforces a strict boundary: zero questions from excluded subjects.
              </p>
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleSelectPreset('math_only')}
                className="btn btn-outline"
                style={{ padding: '5px 12px', fontSize: '0.76rem', borderRadius: '8px' }}
              >
                Math Only
              </button>
              <button
                onClick={() => handleSelectPreset('science_only')}
                className="btn btn-outline"
                style={{ padding: '5px 12px', fontSize: '0.76rem', borderRadius: '8px' }}
              >
                Science Only
              </button>
              <button
                onClick={() => handleSelectPreset('math_science')}
                className="btn btn-outline"
                style={{ padding: '5px 12px', fontSize: '0.76rem', borderRadius: '8px' }}
              >
                Math + Science
              </button>
              <button
                onClick={() => handleSelectPreset('all')}
                className="btn btn-outline"
                style={{ padding: '5px 12px', fontSize: '0.76rem', borderRadius: '8px' }}
              >
                All Available
              </button>
            </div>
          </div>

          {/* Hard Boundary Guarantee Banner */}
          <div style={{
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#166534',
            fontSize: '0.84rem'
          }}>
            <ShieldCheck size={18} color="#16A34A" style={{ flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 700 }}>Hard Filter Active: </span>
              Pre-assessment questions will come <strong>ONLY</strong> from {selectedSubjects.join(' and ')}.
              {selectedSubjects.length === 1 && ` ZERO questions from other subjects will appear.`}
            </div>
          </div>

          {/* Subject Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {availableSubjects.map(sub => {
              const isSelected = selectedSubjects.includes(sub);
              const chapterCount = (chaptersBySubject[sub] || []).length;

              return (
                <button
                  key={sub}
                  onClick={() => handleToggleSubject(sub)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid #4F46E5' : '1.5px solid #E2E8F0',
                    backgroundColor: isSelected ? '#EEF2FF' : '#FFFFFF',
                    color: isSelected ? '#4F46E5' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '4px',
                    backgroundColor: isSelected ? '#4F46E5' : 'transparent',
                    border: isSelected ? 'none' : '1.5px solid #CBD5E1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF'
                  }}>
                    {isSelected && <CheckCircle2 size={14} />}
                  </span>
                  <span>{sub}</span>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '1px 6px',
                    borderRadius: '6px',
                    backgroundColor: isSelected ? '#C7D2FE' : '#F1F5F9',
                    color: isSelected ? '#3730A3' : '#64748B'
                  }}>
                    {chapterCount} Ch
                  </span>
                </button>
              );
            })}
          </div>

          {/* Chapter Expansion for Selected Subjects */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '6px' }}>
            {selectedSubjects.map(sub => {
              const subjectChapters = chaptersBySubject[sub] || [];
              const activeChSet = selectedChapterIds[sub] || new Set();

              return (
                <div
                  key={sub}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1E293B' }}>
                        {sub} Verified Chapters
                      </span>
                      <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                        ({activeChSet.size} of {subjectChapters.length} active)
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        const allSelected = activeChSet.size === subjectChapters.length;
                        setSelectedChapterIds(prev => ({
                          ...prev,
                          [sub]: allSelected
                            ? new Set(subjectChapters.slice(0, 1).map(c => c.chapterId))
                            : new Set(subjectChapters.map(c => c.chapterId))
                        }));
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#4F46E5',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {activeChSet.size === subjectChapters.length ? 'Deselect Extra' : 'Select All Chapters'}
                    </button>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: '8px'
                  }}>
                    {subjectChapters.map(ch => {
                      const isChActive = activeChSet.has(ch.chapterId);

                      return (
                        <div
                          key={ch.chapterId}
                          onClick={() => handleToggleChapter(sub, ch.chapterId)}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: isChActive ? '1.5px solid #C7D2FE' : '1px solid #E2E8F0',
                            backgroundColor: isChActive ? '#FFFFFF' : '#F1F5F9',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ color: isChActive ? '#4F46E5' : '#94A3B8' }}>
                            {isChActive ? <CheckSquare size={16} /> : <Square size={16} />}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '0.84rem',
                              fontWeight: isChActive ? 700 : 500,
                              color: isChActive ? '#1E293B' : '#64748B',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {ch.chapterName}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                              {ch.topics.length} topics grounded
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Scope Blueprint Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #F1F5F9'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.84rem', color: '#475569' }}>
              <span>Subjects: <strong>{selectedSubjects.length}</strong></span>
              <span>Chapters: <strong>{totalActiveChapters}</strong></span>
              <span>Questions: <strong>{getTargetQuestionsForSubjects(selectedSubjects)}</strong></span>
            </div>

            <button
              onClick={handleStartGeneration}
              disabled={isExtractingChapters}
              className="btn btn-primary"
              style={{ padding: '9px 20px', fontSize: '0.86rem' }}
            >
              <span>Confirm & Begin Test</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Blueprint Overview Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Layers size={20} color="#4F46E5" />
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                Strict Subject Boundary
              </h4>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
              Questions strictly respect your selected subjects. If Math is chosen, zero Science questions will appear.
            </p>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Award size={20} color="#059669" />
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                Balanced 30 Questions
              </h4>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
              Evenly distributed across your selected chapters (~10 Easy, ~14 Moderate, ~6 Difficult).
            </p>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Clock size={20} color="#D97706" />
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                Fair Efficiency Tracking
              </h4>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
              80% weight on accuracy and 20% on normalized response time without penalties for careful thinking.
            </p>
          </div>
        </div>

        {/* Upload Custom Material Banner */}
        <div style={{
          padding: '16px 20px',
          borderRadius: '14px',
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1E293B' }}>
              Want to ground the assessment in a specific PDF textbook or school syllabus?
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
              Upload any PDF in the Upload Material tab, and GuruMitra will extract its exact chapters and concepts.
            </div>
          </div>
          <button
            onClick={() => setActiveTab('upload')}
            className="btn btn-outline"
            style={{ padding: '8px 16px', fontSize: '0.82rem' }}
          >
            <UploadCloud size={15} />
            <span>Upload Custom PDF</span>
          </button>
        </div>

        {/* AI Model Configuration Modal */}
        <AiModelConfigModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          onKeyUpdated={(has) => setHasGeminiKey(has)}
        />
      </div>
    );
  }

  // ==========================================================================
  // VIEW: ACTIVE TEST SESSION
  // ==========================================================================
  const currentQ = questions[currentIdx];
  if (!currentQ) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <p>No questions loaded.</p>
        <button onClick={() => setPhase('intro')} className="btn btn-primary">Back to Intro</button>
      </div>
    );
  }

  const currentAnswer = answers[currentQ.questionId]?.selectedOption ?? null;
  const isLastQuestion = currentIdx === questions.length - 1;

  const difficultyColors = {
    easy: { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
    moderate: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
    difficult: { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' }
  };
  const diffStyle = difficultyColors[currentQ.difficulty];

  return (
    <div style={{
      maxWidth: '920px',
      margin: '0 auto',
      padding: '24px 20px 80px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {/* Top Bar: Progress, Timer, and Submit button */}
      <div className="card" style={{
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF'
          }}>
            <BrainCircuit size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Diagnostic Pre-Assessment
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B' }}>
              Question {currentIdx + 1} <span style={{ color: '#94A3B8', fontWeight: 500 }}>of {totalCount}</span>
            </div>
          </div>
        </div>

        {/* Live Elapsed Timer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: '999px',
          backgroundColor: '#F8FAFC',
          border: '1.5px solid #E2E8F0',
          color: '#1E293B',
          fontSize: '0.92rem',
          fontWeight: 700
        }}>
          <Clock size={16} color="#4F46E5" />
          <span>{formatTimer(totalSeconds)}</span>
        </div>

        <button
          onClick={() => setShowSubmitModal(true)}
          className="btn btn-primary"
          style={{ padding: '8px 18px', fontSize: '0.84rem' }}
        >
          <span>Submit Test</span>
        </button>
      </div>

      {/* Question Palette / Navigator */}
      <div className="card" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
            Question Palette ({answeredCount} answered)
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.75rem', color: '#64748B' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4F46E5' }} /> Answered
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#CBD5E1' }} /> Unanswered
            </span>
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          maxHeight: '140px',
          overflowY: 'auto',
          padding: '4px 2px'
        }}>
          {questions.map((q, idx) => {
            const isAnswered = answers[q.questionId]?.selectedOption !== null && answers[q.questionId]?.selectedOption !== undefined;
            const isCurrent = idx === currentIdx;

            return (
              <button
                key={q.questionId}
                onClick={() => handleNavigateQuestion(idx)}
                style={{
                  minWidth: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: isCurrent
                    ? '2px solid #4F46E5'
                    : isAnswered
                    ? '1px solid #C7D2FE'
                    : '1px solid #E2E8F0',
                  backgroundColor: isCurrent
                    ? '#EEF2FF'
                    : isAnswered
                    ? '#4F46E5'
                    : '#FFFFFF',
                  color: isCurrent
                    ? '#4F46E5'
                    : isAnswered
                    ? '#FFFFFF'
                    : '#64748B',
                  fontWeight: isCurrent || isAnswered ? 800 : 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Question Card */}
      <div className="card" style={{ padding: '32px 32px 36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Question Metadata Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '6px',
              backgroundColor: '#EEF2FF',
              color: '#4F46E5'
            }}>
              {currentQ.subject}
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E293B' }}>
              Chapter: {currentQ.chapterName}
            </span>
            <span style={{ color: '#CBD5E1' }}>•</span>
            <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
              {currentQ.topic}
            </span>
          </div>

          <div style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: '999px',
            backgroundColor: diffStyle.bg,
            color: diffStyle.text,
            border: `1px solid ${diffStyle.border}`
          }}>
            {currentQ.difficulty.toUpperCase()}
          </div>
        </div>

        {/* Question Text */}
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#1E293B',
          lineHeight: '1.6',
          margin: 0
        }}>
          {currentQ.question}
        </h3>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {currentQ.options.map((opt, optIdx) => {
            const isSelected = currentAnswer === optIdx;
            const letter = String.fromCharCode(65 + optIdx);

            return (
              <div
                key={optIdx}
                onClick={() => handleSelectOption(optIdx)}
                style={{
                  padding: '16px 20px',
                  borderRadius: '14px',
                  border: isSelected
                    ? '2px solid #4F46E5'
                    : '1.5px solid #E2E8F0',
                  backgroundColor: isSelected
                    ? '#EEF2FF'
                    : '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = '#CBD5E1';
                    e.currentTarget.style.backgroundColor = '#F8FAFC';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = '#E2E8F0';
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                  }
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: isSelected
                    ? '2px solid #4F46E5'
                    : '1.5px solid #CBD5E1',
                  backgroundColor: isSelected
                    ? '#4F46E5'
                    : '#FFFFFF',
                  color: isSelected
                    ? '#FFFFFF'
                    : '#64748B',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {letter}
                </div>

                <span style={{
                  fontSize: '0.95rem',
                  color: isSelected ? '#1E293B' : '#334155',
                  fontWeight: isSelected ? 700 : 500,
                  lineHeight: '1.5'
                }}>
                  {opt}
                </span>
              </div>
            );
          })}
        </div>

        {/* Question Footer Navigation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '12px',
          paddingTop: '20px',
          borderTop: '1px solid #F1F5F9'
        }}>
          <button
            onClick={() => handleNavigateQuestion(currentIdx - 1)}
            disabled={currentIdx === 0}
            className="btn btn-outline"
            style={{
              padding: '10px 18px',
              fontSize: '0.85rem',
              opacity: currentIdx === 0 ? 0.4 : 1,
              cursor: currentIdx === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <ArrowLeft size={16} />
            <span>Previous</span>
          </button>

          {isLastQuestion ? (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="btn btn-primary"
              style={{
                padding: '10px 22px',
                fontSize: '0.88rem',
                backgroundColor: '#059669',
                borderColor: '#059669'
              }}
            >
              <span>Submit Pre-Assessment</span>
              <CheckCircle2 size={16} />
            </button>
          ) : (
            <button
              onClick={() => handleNavigateQuestion(currentIdx + 1)}
              className="btn btn-primary"
              style={{ padding: '10px 20px', fontSize: '0.88rem' }}
            >
              <span>Next Question</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
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
          zIndex: 100,
          padding: '20px'
        }}>
          <div className="card" style={{
            maxWidth: '460px',
            width: '100%',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              backgroundColor: '#EEF2FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4F46E5',
              margin: '0 auto'
            }}>
              <Award size={28} />
            </div>

            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E293B', marginBottom: '8px' }}>
                Complete Diagnostic Test?
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: '1.5' }}>
                You have answered <strong>{answeredCount} of {totalCount}</strong> questions.
                {totalCount - answeredCount > 0 && (
                  <span style={{ color: '#D97706', display: 'block', marginTop: '6px', fontWeight: 600 }}>
                    ⚠️ {totalCount - answeredCount} question(s) remain unanswered.
                  </span>
                )}
              </p>
            </div>

            <div style={{
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '0.82rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Total Time:</span>
                <span style={{ fontWeight: 700, color: '#1E293B' }}>{formatTimer(totalSeconds)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Subjects Assessed:</span>
                <span style={{ fontWeight: 700, color: '#1E293B' }}>{selectedSubjects.join(', ')}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <button
                onClick={() => setShowSubmitModal(false)}
                disabled={isSubmitting}
                className="btn btn-outline"
                style={{ flex: 1, padding: '10px' }}
              >
                Back to Test
              </button>
              <button
                onClick={handleSubmitTest}
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{ flex: 1, padding: '10px' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Scoring...</span>
                  </>
                ) : (
                  <span>Yes, Submit</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
