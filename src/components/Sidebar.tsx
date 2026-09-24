import React from 'react';
import {
  Home,
  Bot,
  BookOpen,
  BrainCircuit,
  HelpCircle,
  BarChart3,
  Lightbulb,
  GitFork,
  UploadCloud,
  Settings,
  GraduationCap,
  Sparkles,
  Award
} from 'lucide-react';
import { useStudent } from '../context/StudentContext';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, student } = useStudent();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, badge: null },
    { id: 'adaptive', label: 'Adaptive Study', icon: BrainCircuit, badge: 'Live' },
    { id: 'quiz', label: 'Quizzes', icon: HelpCircle, badge: 'Adaptive' },
    { id: 'pre-assessment', label: 'Assessments', icon: Sparkles, badge: 'Diagnostic' },
    { id: 'analytics', label: 'Progress & Analytics', icon: BarChart3, badge: null },
    { id: 'recommendations', label: 'Recommendations', icon: Lightbulb, badge: 'AI' },
    { id: 'learning-path', label: 'Study Plan & Path', icon: GitFork, badge: null },
    { id: 'tutor', label: 'AI Tutor', icon: Bot, badge: '24/7' },
    { id: 'subjects', label: 'Curriculum Subjects', icon: BookOpen, badge: null },
    { id: 'upload', label: 'Upload Syllabus / PDF', icon: UploadCloud, badge: null },
    { id: 'profile', label: 'Profile & Settings', icon: Settings, badge: null },
  ];

  return (
    <aside style={{
      width: '260px',
      minWidth: '260px',
      backgroundColor: '#FFFFFF',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      boxShadow: '2px 0 16px rgba(79, 70, 229, 0.03)'
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '24px 20px 18px',
        borderBottom: '1px solid #F1F5F9',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          boxShadow: '0 8px 18px -3px rgba(79, 70, 229, 0.35)'
        }}>
          <GraduationCap size={24} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              color: '#1E293B',
              letterSpacing: '-0.03em'
            }}>
              GuruMitra
            </span>
            <Sparkles size={14} color="#F59E0B" fill="#F59E0B" />
          </div>
          <p style={{
            fontSize: '0.68rem',
            color: '#64748B',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            AI Adaptive Companion
          </p>
        </div>
      </div>

      {/* Navigation List */}
      <nav style={{
        flex: 1,
        padding: '16px 12px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '10px 14px',
                borderRadius: '12px',
                border: 'none',
                background: isActive
                  ? 'linear-gradient(90deg, #EEF2FF 0%, #F5F3FF 100%)'
                  : 'transparent',
                color: isActive ? '#4F46E5' : '#64748B',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                  e.currentTarget.style.color = '#1E293B';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#64748B';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Icon
                  size={19}
                  color={isActive ? '#4F46E5' : '#94A3B8'}
                  strokeWidth={isActive ? 2.3 : 1.8}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span style={{
                  fontSize: '0.65rem',
                  padding: '2px 7px',
                  borderRadius: '999px',
                  fontWeight: 700,
                  backgroundColor: isActive ? '#4F46E5' : '#F1F5F9',
                  color: isActive ? '#FFFFFF' : '#64748B'
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
