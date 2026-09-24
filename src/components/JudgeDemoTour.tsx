import React from 'react';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  PlayCircle,
  Award
} from 'lucide-react';
import { useStudent } from '../context/StudentContext';

export const JudgeDemoTour: React.FC = () => {
  const {
    judgeDemoStep,
    setJudgeDemoStep,
    setActiveTab,
    setActiveSubject,
    setTopicContext,
    recordQuizResult
  } = useStudent();

  const [isMinimized, setIsMinimized] = React.useState(false);

  if (judgeDemoStep === 0) return null;

  const demoSteps = [
    {
      step: 1,
      title: 'Step 1: Student Dashboard Overview',
      tab: 'dashboard',
      instruction: 'Observe Sally Sharma’s baseline status (Class 10 CBSE, 76% progress, Today’s Focus with High Priority concepts).',
      actionText: 'Go to AI Tutor',
      action: () => {
        setActiveTab('tutor');
        setActiveSubject('Mathematics');
        setJudgeDemoStep(2);
      }
    },
    {
      step: 2,
      title: 'Step 2: AI Tutor — Mathematics',
      tab: 'tutor',
      instruction: 'Tutor is set to Mathematics. Try "Solve 2x + 5 = 15" or "Explain quadratic equations" to see step-by-step calculations.',
      actionText: 'Switch to Science Tutor',
      action: () => {
        setActiveTab('tutor');
        setActiveSubject('Science');
        setJudgeDemoStep(3);
      }
    },
    {
      step: 3,
      title: 'Step 3: AI Tutor — Science',
      tab: 'tutor',
      instruction: 'Tutor context seamlessly switches to Science. Try "Explain photosynthesis" to see the biological and chemical breakdown.',
      actionText: 'Switch to Computer Science',
      action: () => {
        setActiveTab('tutor');
        setActiveSubject('Computer Science');
        setJudgeDemoStep(4);
      }
    },
    {
      step: 4,
      title: 'Step 4: AI Tutor — Computer Science',
      tab: 'tutor',
      instruction: 'Tutor context shifts to CS. Try "What is a binary tree?" or "Explain recursion" to see code and complexity.',
      actionText: 'Launch Adaptive Quiz',
      action: () => {
        setTopicContext('Mathematics', 'Geometry', 'Triangles');
        setActiveTab('quiz');
        setJudgeDemoStep(5);
      }
    },
    {
      step: 5,
      title: 'Step 5: Take Diagnostic Geometry Quiz',
      tab: 'quiz',
      instruction: 'Take the Geometry Quiz, or click "Simulate 58% Score" below to demonstrate how GuruMitra handles a student struggling in geometry.',
      actionText: 'Simulate 58% Geometry Score',
      action: () => {
        // Automatically inject the 58% score to trigger adaptation
        recordQuizResult({
          score: 6,
          totalQuestions: 10,
          accuracy: 58,
          subject: 'Mathematics',
          topic: 'Geometry',
          difficulty: 'Intermediate',
          strongTopics: ['Algebra', 'Arithmetic'],
          weakTopics: ['Geometry', 'Triangles'],
          adaptationMessage: "Accuracy is 58%. System adjusted difficulty to Beginner and recommended revision for Geometry Basics.",
          newDifficulty: 'Beginner',
          recommendedTopic: 'Geometry Basics',
          userAnswers: []
        });
        setActiveTab('quiz');
        setJudgeDemoStep(6);
      }
    },
    {
      step: 6,
      title: 'Step 6: Diagnostic Results & Weak Topic Analysis',
      tab: 'quiz',
      instruction: 'The diagnostic score gauge reveals 58% accuracy and flags Geometry as a critical Weak Area.',
      actionText: 'Observe Adaptive Recalibration',
      action: () => {
        setTopicContext('Mathematics', 'Geometry', 'Triangles');
        setActiveTab('adaptive');
        setJudgeDemoStep(7);
      }
    },
    {
      step: 7,
      title: 'Step 7: Adaptive Study Session with 4 Pedagogical Styles',
      tab: 'adaptive',
      instruction: 'GuruMitra tailors the lesson. Try toggling between "Simple", "Analogy", "Visual", and "Exam-oriented" to see real-time pedagogical switching!',
      actionText: 'Check AI Recommendations',
      action: () => {
        setActiveTab('recommendations');
        setJudgeDemoStep(8);
      }
    },
    {
      step: 8,
      title: 'Step 8: Personalized AI Recommendations',
      tab: 'recommendations',
      instruction: 'Notice the top recommendation: "Geometry Basics - Recommended because your recent accuracy was 58%."',
      actionText: 'Inspect Visual Learning Path',
      action: () => {
        setActiveTab('learning-path');
        setJudgeDemoStep(9);
      }
    },
    {
      step: 9,
      title: 'Step 9: Dynamic Visual Learning Path',
      tab: 'learning-path',
      instruction: 'The system has adapted the learning path, inserting a targeted remedial revision node before unlocking advanced topics.',
      actionText: 'Return to Updated Dashboard',
      action: () => {
        setActiveTab('dashboard');
        setJudgeDemoStep(10);
      }
    },
    {
      step: 10,
      title: 'Step 10: Complete Flow Validated!',
      tab: 'dashboard',
      instruction: 'The dashboard reflects newly adapted priorities, updated accuracy, and recent AI actions. Core USP successfully proven!',
      actionText: 'Finish Tour',
      action: () => {
        setJudgeDemoStep(0);
      }
    }
  ];

  const current = demoSteps.find((s) => s.step === judgeDemoStep) || demoSteps[0];

  // Minimized Floating Pill - leaves AI Tutor chat input completely unobstructed!
  if (isMinimized) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '18px',
        right: '24px',
        background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
        color: '#FFFFFF',
        borderRadius: '999px',
        padding: '8px 16px',
        boxShadow: '0 10px 25px rgba(15, 23, 42, 0.4)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <button
          onClick={() => setIsMinimized(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#FCD34D',
            fontSize: '0.78rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer'
          }}
        >
          <Sparkles size={13} />
          <span>Demo Step {current.step}/10 • Click to Expand</span>
        </button>
        <button
          onClick={() => setJudgeDemoStep(0)}
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: 'none',
            color: '#CBD5E1',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title="Exit Demo Tour"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '90%',
      maxWidth: '860px',
      background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
      color: '#FFFFFF',
      borderRadius: '20px',
      padding: '14px 22px',
      boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)',
      zIndex: 100,
      backdropFilter: 'blur(12px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'rgba(245, 158, 11, 0.25)',
            border: '1px solid #F59E0B',
            color: '#FCD34D',
            padding: '3px 10px',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <Sparkles size={13} />
            <span>JUDGE DEMO MODE • STEP {current.step}/10</span>
          </div>
          <h4 style={{ color: '#FFFFFF', fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
            {current.title}
          </h4>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Minimize button to clear space for AI Tutor */}
          <button
            onClick={() => setIsMinimized(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: 'none',
              color: '#CBD5E1',
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title="Minimize tour banner"
          >
            Minimize
          </button>

          {/* Close button */}
          <button
            onClick={() => setJudgeDemoStep(0)}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: 'none',
              color: '#CBD5E1',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Exit Demo Tour"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#E0E7FF', lineHeight: '1.4', flex: 1 }}>
          {current.instruction}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {current.step > 1 && (
            <button
              onClick={() => {
                const prev = demoSteps[current.step - 2];
                if (prev) {
                  setActiveTab(prev.tab);
                  setJudgeDemoStep(prev.step);
                }
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                color: '#FFFFFF',
                padding: '7px 12px',
                borderRadius: '10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <ChevronLeft size={15} />
              <span>Back</span>
            </button>
          )}

          <button
            onClick={current.action}
            style={{
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              border: 'none',
              color: '#FFFFFF',
              padding: '8px 16px',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.5)'
            }}
          >
            <span>{current.actionText}</span>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
