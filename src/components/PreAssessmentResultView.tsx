import React, { useState } from 'react';
import {
  Sparkles,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  RotateCcw,
  BookOpen,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  BrainCircuit,
  Info,
  Layers,
  ChevronRight,
  HelpCircle
} from 'lucide-react';
import { useStudent } from '../context/StudentContext';
import { PreAssessmentResult, LearningGapItem, SubjectType } from '../types';

interface PreAssessmentResultViewProps {
  result: PreAssessmentResult;
  onRetake: () => void;
}

export const PreAssessmentResultView: React.FC<PreAssessmentResultViewProps> = ({
  result,
  onRetake
}) => {
  const {
    setActiveTab,
    setActiveSubject,
    setTopicContext,
    setSelectedPlannerSubjects,
    setPlannerStep
  } = useStudent();
  const [showQuestionReview, setShowQuestionReview] = useState(false);
  const [expandedGapId, setExpandedGapId] = useState<string | null>(null);
  const [expandedChapterIds, setExpandedChapterIds] = useState<Record<string, boolean>>({});
  const [evidenceChapterIds, setEvidenceChapterIds] = useState<Record<string, boolean>>({});

  const toggleChapterExpand = (id: string) => {
    setExpandedChapterIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleEvidenceExpand = (id: string) => {
    setEvidenceChapterIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 1. Identify all subjects that were actually part of the assessment
  const assessedSubjects = Array.from(
    new Set([
      ...result.questionPerformance.map(q => q.subject),
      ...Object.values(result.chapterPerformance).map(c => c.subject)
    ])
  ).filter(Boolean) as SubjectType[];

  // 2. Build subject breakdown strictly from assessment data
  const subjectBreakdown = assessedSubjects.map(sub => {
    const subQuestions = result.questionPerformance.filter(
      q => q.subject.toLowerCase() === sub.toLowerCase()
    );
    const subChapters = Object.entries(result.chapterPerformance)
      .filter(([_, ch]) => ch.subject.toLowerCase() === sub.toLowerCase())
      .map(([chId, ch]) => {
        const qList = subQuestions.filter(
          q => q.chapterId === chId || q.chapterName.toLowerCase() === ch.chapterName.toLowerCase()
        );
        const qCount = qList.length > 0 ? qList.length : ch.total;
        const correctCount = qList.length > 0 ? qList.filter(q => q.isCorrect).length : ch.correct;
        const accuracy = qCount > 0 ? Math.round((correctCount / qCount) * 100) : ch.accuracy;

        let confidence: 'High' | 'Medium' | 'Limited Data' = 'High';
        if (qCount <= 1) confidence = 'Limited Data';
        else if (qCount <= 3) confidence = 'Medium';

        let status: 'Strong' | 'Developing' | 'Needs Attention' = 'Needs Attention';
        if (accuracy >= 80) status = 'Strong';
        else if (accuracy >= 50) status = 'Developing';

        const topicEntries = Object.entries(result.topicPerformance).filter(
          ([_, t]) => t.chapterName.toLowerCase() === ch.chapterName.toLowerCase() && t.subject.toLowerCase() === sub.toLowerCase()
        );

        const easyQ = qList.filter(q => q.difficulty === 'easy');
        const modQ = qList.filter(q => q.difficulty === 'moderate');
        const diffQ = qList.filter(q => q.difficulty === 'difficult');

        return {
          chapterId: chId,
          chapterName: ch.chapterName,
          subject: sub,
          accuracy,
          qCount,
          correctCount,
          incorrectCount: qCount - correctCount,
          confidence,
          status,
          easyRatio: `${easyQ.filter(q => q.isCorrect).length}/${easyQ.length}`,
          modRatio: `${modQ.filter(q => q.isCorrect).length}/${modQ.length}`,
          diffRatio: `${diffQ.filter(q => q.isCorrect).length}/${diffQ.length}`,
          topics: topicEntries.map(([_, t]) => ({
            topicName: t.topicName,
            accuracy: t.accuracy,
            total: t.total,
            correct: t.correct,
            status: t.accuracy >= 80 ? 'Strong' : t.accuracy >= 50 ? 'Developing' : 'Needs Attention'
          }))
        };
      });

    const totalSubQ = subQuestions.length;
    const totalSubCorrect = subQuestions.filter(q => q.isCorrect).length;
    const subAccuracy = totalSubQ > 0 ? Math.round((totalSubCorrect / totalSubQ) * 100) : 0;

    const strongAreas = subChapters.filter(c => c.status === 'Strong').length;
    const needsPractice = subChapters.filter(c => c.status === 'Developing').length;
    const needsAttention = subChapters.filter(c => c.status === 'Needs Attention').length;

    return {
      subject: sub,
      accuracy: subAccuracy,
      totalQuestions: totalSubQ,
      chapters: subChapters,
      strongAreas,
      needsPractice,
      needsAttention
    };
  });

  // Formatting helpers
  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins}m ${remainder < 10 ? '0' : ''}${remainder}s`;
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Strong':
        return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
      case 'Proficient':
        return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
      case 'Developing':
        return { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE' };
      case 'Beginner':
        return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
      default:
        return { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' };
    }
  };

  const levelColor = getLevelColor(result.learningLevel);



  return (
    <div style={{
      maxWidth: '1080px',
      margin: '0 auto',
      padding: '32px 24px 80px',
      display: 'flex',
      flexDirection: 'column',
      gap: '28px'
    }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#4F46E5'
            }}>
              Diagnostic Pre-Assessment
            </span>
            {result.isDemoMode && (
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: '#F1F5F9',
                color: '#64748B',
                border: '1px solid #E2E8F0'
              }}>
                Demo Mode
              </span>
            )}
          </div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
            Your Learning Baseline & Diagnostic Report
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.92rem', marginTop: '4px' }}>
            Analyzed across {Object.keys(result.chapterPerformance).length} chapters from your uploaded learning materials.
          </p>
        </div>

        <button
          onClick={onRetake}
          className="btn btn-outline"
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          <RotateCcw size={15} />
          <span>Retake Diagnostic</span>
        </button>
      </div>

      {/* Hero Score Card */}
      <div className="card" style={{
        padding: '32px',
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
        border: '1.5px solid var(--border-subtle)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '32px',
        alignItems: 'center'
      }}>
        {/* Left: Big Circular Learning Level Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{
            position: 'relative',
            width: '130px',
            height: '130px',
            borderRadius: '50%',
            background: `conic-gradient(#4F46E5 ${result.overallScore * 3.6}deg, #E2E8F0 0deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px -4px rgba(79, 70, 229, 0.25)',
            flexShrink: 0
          }}>
            <div style={{
              width: '102px',
              height: '102px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '2.1rem', fontWeight: 900, color: '#1E293B', lineHeight: 1 }}>
                {result.overallScore}%
              </span>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginTop: '2px' }}>
                Diagnostic
              </span>
            </div>
          </div>

          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '999px',
              backgroundColor: levelColor.bg,
              color: levelColor.text,
              border: `1px solid ${levelColor.border}`,
              fontSize: '0.82rem',
              fontWeight: 700,
              marginBottom: '8px'
            }}>
              <Sparkles size={14} />
              <span>Current Stage: {result.learningLevel}</span>
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
              {result.overallScore >= 75 ? 'Strong Foundation Identified' : result.overallScore >= 50 ? 'Developing Understanding' : 'Foundational Support Needed'}
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '4px 0 0', lineHeight: 1.4 }}>
              This baseline represents your current diagnostic checkpoint across uploaded topics, not a permanent academic grade.
            </p>
          </div>
        </div>

        {/* Right: Key Breakdown Metrics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '14px',
          borderLeft: '1px solid #E2E8F0',
          paddingLeft: '24px'
        }}>
          <div style={{
            padding: '14px',
            borderRadius: '12px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Knowledge Accuracy (80%)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4F46E5', marginTop: '2px' }}>
              {result.knowledgeScore}%
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
              {result.correctAnswers} of {result.totalQuestions} correct
            </div>
          </div>

          <div style={{
            padding: '14px',
            borderRadius: '12px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Time Efficiency (20%)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
              {result.timeEfficiencyScore}%
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
              Avg {result.averageTimeSeconds}s per question
            </div>
          </div>

          <div style={{
            padding: '14px',
            borderRadius: '12px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Total Duration</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E293B', marginTop: '2px' }}>
              {formatSeconds(result.totalTimeSeconds)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
              Completed in one session
            </div>
          </div>

          <div style={{
            padding: '14px',
            borderRadius: '12px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Unanswered</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: result.unansweredAnswers > 0 ? '#D97706' : '#1E293B', marginTop: '2px' }}>
              {result.unansweredAnswers}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
              {result.unansweredAnswers === 0 ? 'All attempted' : 'Skipped questions'}
            </div>
          </div>
        </div>
      </div>

      {/* AI Diagnostic Narrative (Summary & Advice) */}
      {result.aiRecommendation && (
        <div className="card" style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
          border: '1.5px solid #C7D2FE'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              backgroundColor: '#4F46E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF'
            }}>
              <BrainCircuit size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#4F46E5', margin: 0 }}>
                GuruMitra AI Learning Advisor Evaluation
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#6366F1', fontWeight: 600 }}>
                Personalized conceptual summary derived from your response pattern
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.9rem', color: '#1E293B', lineHeight: '1.6', margin: '0 0 12px' }}>
            {result.aiRecommendation.summary}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginTop: '12px' }}>
            <div style={{ backgroundColor: '#FFFFFF', padding: '14px 16px', borderRadius: '12px', border: '1px solid #E0E7FF' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#059669', marginBottom: '4px' }}>
                ✓ Key Demonstrated Strength
              </div>
              <p style={{ fontSize: '0.82rem', color: '#475569', margin: 0 }}>
                {result.aiRecommendation.strengthSummary}
              </p>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', padding: '14px 16px', borderRadius: '12px', border: '1px solid #E0E7FF' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#D97706', marginBottom: '4px' }}>
                ! Key Focus Area
              </div>
              <p style={{ fontSize: '0.82rem', color: '#475569', margin: 0 }}>
                {result.aiRecommendation.gapSummary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grid: Difficulty & Chapter Performance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Difficulty-wise Performance */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
              Performance by Difficulty
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
              1 Easy, 1 Mod, 1 Diff per chapter
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Easy */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, color: '#059669' }}>Easy (Basic Recall & Definitions)</span>
                <span style={{ fontWeight: 800, color: '#1E293B' }}>
                  {result.difficultyPerformance.easy.accuracy}% ({result.difficultyPerformance.easy.correct}/{result.difficultyPerformance.easy.total})
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${result.difficultyPerformance.easy.accuracy}%`,
                  backgroundColor: '#10B981',
                  borderRadius: '999px',
                  transition: 'width 0.6s ease'
                }} />
              </div>
            </div>

            {/* Moderate */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, color: '#D97706' }}>Moderate (Application & Reasoning)</span>
                <span style={{ fontWeight: 800, color: '#1E293B' }}>
                  {result.difficultyPerformance.moderate.accuracy}% ({result.difficultyPerformance.moderate.correct}/{result.difficultyPerformance.moderate.total})
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${result.difficultyPerformance.moderate.accuracy}%`,
                  backgroundColor: '#F59E0B',
                  borderRadius: '999px',
                  transition: 'width 0.6s ease'
                }} />
              </div>
            </div>

            {/* Difficult */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, color: '#7C3AED' }}>Difficult (Complex Problem Solving)</span>
                <span style={{ fontWeight: 800, color: '#1E293B' }}>
                  {result.difficultyPerformance.difficult.accuracy}% ({result.difficultyPerformance.difficult.correct}/{result.difficultyPerformance.difficult.total})
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${result.difficultyPerformance.difficult.accuracy}%`,
                  backgroundColor: '#8B5CF6',
                  borderRadius: '999px',
                  transition: 'width 0.6s ease'
                }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subject-Wise & Chapter Understanding Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Subject Diagnostics
              </span>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: '#EEF2FF',
                color: '#4F46E5'
              }}>
                Overall Understanding: {result.overallScore}%
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1E293B', margin: '4px 0 0' }}>
              Subject & Chapter Understanding Matrix
            </h2>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0 }}>
            Derived strictly from your actual pre-assessment responses.
          </p>
        </div>

        {subjectBreakdown.map((subItem) => (
          <div
            key={subItem.subject}
            className="card"
            style={{
              padding: '24px',
              border: '1.5px solid var(--border-subtle)',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px'
            }}
          >
            {/* Subject Summary Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              paddingBottom: '18px',
              borderBottom: '1px solid #F1F5F9'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  backgroundColor: '#EEF2FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px'
                }}>
                  {subItem.subject === 'Mathematics' && '📐'}
                  {subItem.subject === 'Science' && '🔬'}
                  {subItem.subject === 'English' && '📖'}
                  {subItem.subject === 'Computer Science' && '💻'}
                  {subItem.subject === 'Social Science' && '🌍'}
                  {!['Mathematics', 'Science', 'English', 'Computer Science', 'Social Science'].includes(subItem.subject) && '📚'}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                    {subItem.subject}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                    <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#4F46E5' }}>
                      Understanding: {subItem.accuracy}%
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                      ({subItem.totalQuestions} questions assessed)
                    </span>
                  </div>
                </div>
              </div>

              {/* Area Count Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '8px',
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  border: '1px solid #BBF7D0'
                }}>
                  Strong Areas: {subItem.strongAreas}
                </span>
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '8px',
                  backgroundColor: '#FEF3C7',
                  color: '#B45309',
                  border: '1px solid #FDE68A'
                }}>
                  Needs Practice: {subItem.needsPractice}
                </span>
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '8px',
                  backgroundColor: '#FEE2E2',
                  color: '#B91C1C',
                  border: '1px solid #FECACA'
                }}>
                  Needs Attention: {subItem.needsAttention}
                </span>
              </div>
            </div>

            {/* Chapter Table */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {subItem.chapters.map((ch) => {
                const isExpanded = !!expandedChapterIds[ch.chapterId];
                const isEvidenceOpen = !!evidenceChapterIds[ch.chapterId];

                const statusColor = ch.status === 'Strong'
                  ? { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' }
                  : ch.status === 'Developing'
                  ? { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' }
                  : { bg: '#FEE2E2', text: '#B91C1C', border: '#FECACA' };

                return (
                  <div
                    key={ch.chapterId}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      backgroundColor: '#F8FAFC',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Chapter Row Header */}
                    <div style={{
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      backgroundColor: '#FFFFFF'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
                        <button
                          onClick={() => toggleChapterExpand(ch.chapterId)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#64748B',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '4px'
                          }}
                          title="Expand topic breakdown"
                        >
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.96rem', fontWeight: 700, color: '#1E293B' }}>
                              {ch.chapterName}
                            </span>
                            {ch.topics.length > 0 && (
                              <span style={{ fontSize: '0.72rem', color: '#64748B', backgroundColor: '#F1F5F9', padding: '1px 6px', borderRadius: '4px' }}>
                                {ch.topics.length} topics
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '0.75rem', color: '#64748B' }}>
                            <span>Questions: {ch.qCount}</span>
                            <span>•</span>
                            <span>Confidence: <strong style={{ color: ch.confidence === 'Limited Data' ? '#D97706' : '#1E293B' }}>{ch.confidence}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Score, Progress Bar, Status Badge & Action */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '110px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 800 }}>
                            <span style={{ color: ch.confidence === 'Limited Data' ? '#D97706' : '#1E293B' }}>
                              {ch.confidence === 'Limited Data' ? `${ch.accuracy}%*` : `${ch.accuracy}%`}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 500 }}>
                              {ch.correctCount}/{ch.qCount}
                            </span>
                          </div>
                          <div style={{ height: '6px', backgroundColor: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${ch.accuracy}%`,
                              backgroundColor: ch.accuracy >= 80 ? '#10B981' : ch.accuracy >= 50 ? '#F59E0B' : '#EF4444',
                              borderRadius: '999px'
                            }} />
                          </div>
                        </div>

                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: statusColor.bg,
                          color: statusColor.text,
                          border: `1px solid ${statusColor.border}`,
                          minWidth: '95px',
                          textAlign: 'center'
                        }}>
                          {ch.status}
                        </span>

                        <button
                          onClick={() => toggleEvidenceExpand(ch.chapterId)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            backgroundColor: isEvidenceOpen ? '#EEF2FF' : '#F1F5F9',
                            color: isEvidenceOpen ? '#4F46E5' : '#475569',
                            border: isEvidenceOpen ? '1px solid #C7D2FE' : '1px solid #E2E8F0',
                            cursor: 'pointer'
                          }}
                        >
                          {isEvidenceOpen ? 'Hide Evidence' : 'Why this score?'}
                        </button>
                      </div>
                    </div>

                    {/* Transparent Evidence Box */}
                    {isEvidenceOpen && (
                      <div style={{
                        padding: '12px 18px',
                        backgroundColor: '#F8FAFC',
                        borderTop: '1px solid #E2E8F0',
                        fontSize: '0.8rem',
                        color: '#475569'
                      }}>
                        <div style={{ fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                          Transparent Diagnostic Evidence for {ch.chapterName}:
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                          <div>• <strong>Questions Attempted:</strong> {ch.qCount}</div>
                          <div>• <strong>Correct:</strong> {ch.correctCount} | <strong>Incorrect:</strong> {ch.incorrectCount}</div>
                          <div>• <strong>Easy Questions:</strong> {ch.easyRatio} correct</div>
                          <div>• <strong>Moderate Questions:</strong> {ch.modRatio} correct</div>
                          <div>• <strong>Difficult Questions:</strong> {ch.diffRatio} correct</div>
                        </div>
                        {ch.confidence === 'Limited Data' && (
                          <div style={{ marginTop: '6px', color: '#B45309', fontSize: '0.75rem', fontWeight: 600 }}>
                            * Note: Only 1 question was asked from this chapter in the diagnostic baseline. Confidence is marked Limited Data until more practice is completed.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expandable Topic Level Rows */}
                    {isExpanded && (
                      <div style={{
                        padding: '12px 18px',
                        backgroundColor: '#FFFFFF',
                        borderTop: '1px solid #E2E8F0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                          Topic-Level Understanding
                        </div>
                        {ch.topics.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {ch.topics.map((top, tIdx) => (
                              <div
                                key={tIdx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  backgroundColor: '#F8FAFC',
                                  border: '1px solid #E2E8F0'
                                }}
                              >
                                <span style={{ fontSize: '0.86rem', color: '#1E293B', fontWeight: 600 }}>
                                  {top.topicName}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: top.accuracy >= 80 ? '#059669' : top.accuracy >= 50 ? '#D97706' : '#DC2626' }}>
                                    {top.accuracy}%
                                  </span>
                                  <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                    ({top.correct}/{top.total} correct)
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.82rem', color: '#64748B', fontStyle: 'italic' }}>
                            Chapter tested as a unified conceptual unit ({ch.qCount} questions).
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Identified Knowledge Gaps (Traceable Evidence Chain) */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
              Identified Learning Gaps & Conceptual Weaknesses
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0' }}>
              Multi-level diagnosis with verifiable question evidence and prerequisite tracking.
            </p>
          </div>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: '999px',
            backgroundColor: result.identifiedGaps.length > 0 ? '#FEF2F2' : '#ECFDF5',
            color: result.identifiedGaps.length > 0 ? '#DC2626' : '#059669'
          }}>
            {result.identifiedGaps.length} Gaps Detected
          </span>
        </div>

        {result.identifiedGaps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#059669' }}>
            <CheckCircle2 size={36} style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>No Critical Knowledge Gaps Detected!</div>
            <p style={{ fontSize: '0.84rem', color: '#64748B', margin: '4px 0 0' }}>
              You achieved solid mastery across all tested topics in the uploaded material.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {result.identifiedGaps.map((gap) => {
              const isExpanded = expandedGapId === gap.id;
              const isHighPriority = gap.priority === 'High Priority';

              return (
                <div
                  key={gap.id}
                  style={{
                    borderRadius: '14px',
                    border: isHighPriority ? '1.5px solid #FECACA' : '1px solid #E2E8F0',
                    backgroundColor: isHighPriority ? '#FEF2F2' : '#FFFFFF',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div
                    onClick={() => setExpandedGapId(isExpanded ? null : gap.id)}
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <AlertTriangle size={18} color={isHighPriority ? '#DC2626' : '#D97706'} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1E293B' }}>
                            {gap.topic}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '1px 8px',
                            borderRadius: '999px',
                            backgroundColor: isHighPriority ? '#FEE2E2' : '#FEF3C7',
                            color: isHighPriority ? '#DC2626' : '#D97706'
                          }}>
                            {gap.priority}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                          Chapter: <strong>{gap.chapterName}</strong> ({gap.subject}) • Accuracy: {gap.accuracy}% ({gap.incorrectQuestions} error{gap.incorrectQuestions > 1 ? 's' : ''})
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {gap.prerequisite && (
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          backgroundColor: '#EEF2FF',
                          color: '#4F46E5',
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}>
                          Prereq: {gap.prerequisite}
                        </span>
                      )}
                      {isExpanded ? <ChevronUp size={16} color="#64748B" /> : <ChevronDown size={16} color="#64748B" />}
                    </div>
                  </div>

                  {/* Expandable Evidence Chain */}
                  {isExpanded && (
                    <div style={{
                      padding: '0 20px 16px',
                      borderTop: '1px solid rgba(0,0,0,0.06)',
                      backgroundColor: '#FFFFFF'
                    }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', margin: '12px 0 8px', textTransform: 'uppercase' }}>
                        Verifiable Question Evidence Chain
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {gap.evidence.map((ev, i) => (
                          <div
                            key={i}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '10px',
                              backgroundColor: ev.isCorrect ? '#F0FDF4' : '#FFF1F2',
                              border: `1px solid ${ev.isCorrect ? '#BBF7D0' : '#FECDD3'}`,
                              fontSize: '0.82rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontWeight: 700, color: ev.isCorrect ? '#15803D' : '#BE123C' }}>
                                Question {ev.questionIndex} ({ev.difficulty.toUpperCase()} level) — {ev.isCorrect ? 'Correct' : 'Incorrect'}
                              </span>
                            </div>
                            <p style={{ margin: '0 0 6px', color: '#1E293B', fontWeight: 600 }}>
                              "{ev.questionText}"
                            </p>
                            {!ev.isCorrect && (
                              <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                                <span>Your Answer: <strong style={{ color: '#BE123C' }}>{ev.userAnswerText}</strong></span>
                                <span style={{ margin: '0 8px' }}>•</span>
                                <span>Correct Answer: <strong style={{ color: '#15803D' }}>{ev.correctAnswerText}</strong></span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>



      {/* Accordion: Review All Questions & Explanations */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <button
          onClick={() => setShowQuestionReview(!showQuestionReview)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen size={18} color="#4F46E5" />
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E293B' }}>
              Review Detailed Answers & Explanations ({result.questionPerformance.length} Questions)
            </span>
          </div>
          {showQuestionReview ? <ChevronUp size={18} color="#64748B" /> : <ChevronDown size={18} color="#64748B" />}
        </button>

        {showQuestionReview && (
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {result.questionPerformance.map((qRec, index) => {
              const isCorrect = qRec.isCorrect;
              const hasOptions = Array.isArray(qRec.options) && qRec.options.length === 4;
              const userSelected = qRec.selectedOption;
              const correctOption = qRec.correctOption;

              return (
                <div
                  key={qRec.questionId}
                  style={{
                    padding: '20px',
                    borderRadius: '16px',
                    border: `1.5px solid ${isCorrect ? '#BBF7D0' : '#FECDD3'}`,
                    backgroundColor: isCorrect ? '#F0FDF4' : '#FFF1F2',
                    boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.05)'
                  }}
                >
                  {/* Header bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        color: isCorrect ? '#15803D' : '#BE123C',
                        backgroundColor: isCorrect ? '#DCFCE7' : '#FFE4E6',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}>
                        {isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        Question {index + 1} • {isCorrect ? 'Correct' : userSelected === null || userSelected === undefined ? 'Unanswered' : 'Incorrect'}
                      </span>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#FFFFFF', color: '#64748B', border: '1px solid #E2E8F0', fontWeight: 600 }}>
                        {qRec.chapterName}
                      </span>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#FFFFFF', color: '#64748B', border: '1px solid #E2E8F0', fontWeight: 600, textTransform: 'uppercase' }}>
                        {qRec.difficulty}
                      </span>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#EEF2FF', color: '#4F46E5', fontWeight: 600 }}>
                        {qRec.topic}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748B' }}>
                      <Clock size={13} color="#64748B" />
                      <span>{qRec.timeSpentSeconds}s</span>
                      <span style={{ opacity: 0.6 }}>(Target: {qRec.expectedTimeSeconds}s)</span>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div style={{
                    fontSize: '0.98rem',
                    fontWeight: 700,
                    color: '#1E293B',
                    lineHeight: 1.5,
                    marginBottom: '16px',
                    backgroundColor: '#FFFFFF',
                    padding: '14px 18px',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0'
                  }}>
                    {qRec.questionText || `${qRec.topic}: Question ${index + 1}`}
                  </div>

                  {/* Options List with Vibrant Correct/Incorrect States */}
                  {hasOptions ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                      {qRec.options!.map((optText, optIdx) => {
                        const isThisCorrect = optIdx === correctOption;
                        const isThisSelected = optIdx === userSelected;

                        let optBg = '#FFFFFF';
                        let optBorder = '#E2E8F0';
                        let optBadgeColor = '#64748B';
                        let badgeBg = '#F1F5F9';
                        let badgeText = '';

                        if (isThisCorrect) {
                          optBg = '#F0FDF4';
                          optBorder = '#10B981';
                          badgeBg = '#DCFCE7';
                          badgeText = '✓ Correct Answer';
                          optBadgeColor = '#15803D';
                        } else if (isThisSelected && !isCorrect) {
                          optBg = '#FEF2F2';
                          optBorder = '#EF4444';
                          badgeBg = '#FEE2E2';
                          badgeText = '✗ Your Selection (Incorrect)';
                          optBadgeColor = '#DC2626';
                        }

                        const letter = String.fromCharCode(65 + optIdx);

                        return (
                          <div
                            key={optIdx}
                            style={{
                              padding: '12px 14px',
                              borderRadius: '10px',
                              border: `1.5px solid ${optBorder}`,
                              backgroundColor: optBg,
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              position: 'relative'
                            }}
                          >
                            <span style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '6px',
                              backgroundColor: isThisCorrect ? '#10B981' : isThisSelected ? '#EF4444' : '#E2E8F0',
                              color: isThisCorrect || isThisSelected ? '#FFFFFF' : '#475569',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {letter}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.88rem', color: '#1E293B', fontWeight: isThisCorrect || isThisSelected ? 700 : 500, lineHeight: 1.4 }}>
                                {optText}
                              </div>
                              {badgeText && (
                                <span style={{
                                  display: 'inline-block',
                                  marginTop: '6px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  color: optBadgeColor,
                                  backgroundColor: badgeBg,
                                  padding: '2px 8px',
                                  borderRadius: '4px'
                                }}>
                                  {badgeText}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ marginBottom: '14px', padding: '10px 14px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.82rem' }}>
                      <span style={{ color: '#BE123C', fontWeight: 600 }}>
                        Your Choice: Option {userSelected !== null && userSelected !== undefined ? String.fromCharCode(65 + userSelected) : 'Unanswered'}
                      </span>
                      <span style={{ margin: '0 8px' }}>•</span>
                      <span style={{ color: '#15803D', fontWeight: 700 }}>
                        Correct Choice: Option {String.fromCharCode(65 + correctOption)}
                      </span>
                    </div>
                  )}

                  {/* Summary Comparison & Educational Explanation */}
                  <div style={{
                    fontSize: '0.84rem',
                    color: '#334155',
                    backgroundColor: '#FFFFFF',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    lineHeight: 1.5
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#4F46E5', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      <Lightbulb size={14} />
                      <span>Step-by-Step Educational Explanation</span>
                    </div>
                    <div>
                      {qRec.explanation || `In ${qRec.chapterName}, "${qRec.topic}" tests ${qRec.difficulty} mastery. The correct answer is Option ${String.fromCharCode(65 + qRec.correctOption)}.`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Prominent Bottom CTA: Start Planning My Learning Path */}
      <div style={{
        marginTop: '16px',
        padding: '28px 32px',
        borderRadius: '18px',
        background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        boxShadow: '0 12px 30px -4px rgba(79, 70, 229, 0.4)'
      }}>
        <div style={{ maxWidth: '620px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            padding: '4px 12px',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '8px'
          }}>
            <Sparkles size={13} />
            <span>Next Phase: Personalized Learning Path</span>
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 6px', color: '#FFFFFF' }}>
            Ready to Plan Your Adaptive Learning Journey?
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#E0E7FF', margin: 0, lineHeight: 1.5 }}>
            Combine your pre-assessment diagnostic results with your syllabus PDF to ground what you need to learn against what you already understand.
          </p>
        </div>

        <button
          onClick={() => {
            const subsToPlan = assessedSubjects.length > 0 ? assessedSubjects : ['Mathematics'];
            setSelectedPlannerSubjects(subsToPlan);
            setPlannerStep('subjects');
            setActiveTab('learning-path-planner');
          }}
          style={{
            backgroundColor: '#FFFFFF',
            color: '#4F46E5',
            border: 'none',
            borderRadius: '12px',
            padding: '14px 26px',
            fontSize: '0.98rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
            transition: 'all 0.2s ease'
          }}
        >
          <span>Start My Learning Path</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
