import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StudentProvider, useStudent } from './context/StudentContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { SyllabusUploadView } from './components/SyllabusUploadView';
import { SyllabusAnalysisView } from './components/SyllabusAnalysisView';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { AITutor } from './components/AITutor';
import { SubjectsView } from './components/SubjectsView';
import { AdaptiveStudySession } from './components/AdaptiveStudySession';
import { QuizView } from './components/QuizView';
import { RecommendationsView } from './components/RecommendationsView';
import { LearningPathView } from './components/LearningPathView';
import { AnalyticsView } from './components/AnalyticsView';
import { UploadMaterialView } from './components/UploadMaterialView';
import { ProfileModal } from './components/ProfileModal';
import { JudgeDemoTour } from './components/JudgeDemoTour';
import { PreAssessmentView } from './components/PreAssessmentView';
import { LearningPathPlannerView } from './components/LearningPathPlannerView';
import { AlertCircle, CheckCircle, Info, X, GraduationCap, Loader2, Sparkles } from 'lucide-react';

const AppContent: React.FC = () => {
  const { activeTab, notification, clearNotification } = useStudent();

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'tutor':
        return <AITutor />;
      case 'subjects':
        return <SubjectsView />;
      case 'study':
      case 'adaptive':
        return <AdaptiveStudySession />;
      case 'quiz':
      case 'quizzes':
        return <QuizView />;
      case 'progress':
      case 'analytics':
        return <AnalyticsView />;
      case 'recommendations':
        return <RecommendationsView />;
      case 'learning-path':
      case 'learningPath':
        return <LearningPathView />;
      case 'learning-path-planner':
        return <LearningPathPlannerView />;
      case 'upload':
        return <UploadMaterialView />;
      case 'syllabus-analysis':
        return <SyllabusAnalysisView />;
      case 'pre-assessment':
      case 'assessment':
      case 'assessments':
        return <PreAssessmentView />;
      case 'profile':
        return <ProfileModal />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-page)' }}>
      {/* Fixed Sidebar */}
      <Sidebar />

      {/* Main Content Workspace */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header />

        {/* Global Reactive Notification Banner */}
        {notification && (
          <div style={{
            position: 'fixed',
            top: '86px',
            right: '24px',
            zIndex: 90,
            maxWidth: '480px',
            padding: '12px 18px',
            borderRadius: '14px',
            backgroundColor: notification.type === 'success' ? '#ECFDF5' : notification.type === 'warning' ? '#FEF2F2' : '#EEF2FF',
            border: notification.type === 'success' ? '1.5px solid #A7F3D0' : notification.type === 'warning' ? '1.5px solid #FECACA' : '1.5px solid #C7D2FE',
            color: notification.type === 'success' ? '#065F46' : notification.type === 'warning' ? '#991B1B' : '#1E40AF',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            animation: 'pulse-soft 0.3s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
              {notification.type === 'success' && <CheckCircle size={18} color="#10B981" />}
              {notification.type === 'warning' && <AlertCircle size={18} color="#EF4444" />}
              {notification.type === 'info' && <Info size={18} color="#3B82F6" />}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={clearNotification}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '2px'
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* View Content */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {renderActiveTab()}
        </main>

        {/* Floating Judge Demo Stepper */}
        <JudgeDemoTour />
      </div>
    </div>
  );
};

const AppRoot: React.FC = () => {
  const { user, isAuthenticated, isLoading, pendingVerificationEmail, resendVerificationEmail } = useAuth();
  const { syllabusUploaded } = useStudent();

  // Initializing auth session loader
  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-page)',
        gap: '18px'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '18px',
          background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          boxShadow: '0 10px 25px rgba(79, 70, 229, 0.35)',
          animation: 'pulse-soft 2s infinite ease-in-out'
        }}>
          <GraduationCap size={36} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
            color: '#1E293B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <span>GuruMitra</span>
            <Sparkles size={16} color="#F59E0B" fill="#F59E0B" />
          </div>
          <p style={{ fontSize: '0.84rem', color: '#64748B', marginTop: '4px' }}>
            Loading your learning environment...
          </p>
        </div>
      </div>
    );
  }

  // Route & View Protection: unauthenticated users only see the Authentication Screen
  if (!isAuthenticated) {
    // If there is a pending verification email (after signup), show verification screen
    if (pendingVerificationEmail) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-page)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            boxShadow: '0 10px 25px rgba(79, 70, 229, 0.35)',
            marginBottom: '24px'
          }}>
            <CheckCircle size={32} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1E293B', marginBottom: '16px' }}>
              Almost there!
            </h2>
            <p style={{ fontSize: '1.1rem', color: '#64748B', maxWidth: '400px', marginBottom: '24px', lineHeight: '1.6' }}>
              We've sent a verification link to <strong>{pendingVerificationEmail}</strong>. Please check your inbox (and spam folder) and click the link to verify your email.
            </p>
            <button
              onClick={resendVerificationEmail}
              className="btn btn-outline"
              style={{ padding: '10px 24px', fontSize: '0.9rem' }}
            >
              Resend Verification Email
            </button>
            <p style={{ fontSize: '0.85rem', color: '#94A3B8', marginTop: '16px' }}>
              Didn't receive the email?{' '}
              <button
                onClick={resendVerificationEmail}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#4F46E5',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  padding: 0
                }}
              >
                Resend
              </button>
            </p>
          </div>
        </div>
      );
    }

    // Otherwise show regular auth screen (login/signup)
    return <AuthScreen />;
  }

  // One-time syllabus upload onboarding (for new users who haven't uploaded yet or after demo reset)
  if (!syllabusUploaded && user) {
    return <SyllabusUploadView />;
  }

  // Authenticated users enter the protected main dashboard
  return <AppContent />;
};

export default function App() {
  return (
    <AuthProvider>
      <StudentProvider>
        <AppRoot />
      </StudentProvider>
    </AuthProvider>
  );
}