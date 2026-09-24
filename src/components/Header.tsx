import React, { useState, useRef, useEffect } from 'react';
import { Flame, Star, Play, RotateCcw, User, Sparkles, ChevronDown, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { useStudent } from '../context/StudentContext';
import { useAuth } from '../context/AuthContext';
import { LearningStyle } from '../types';

export const Header: React.FC = () => {
  const {
    student,
    setPreferredStyle,
    setActiveTab,
    resetToDefault,
    resetDemo,
    judgeDemoStep,
    setJudgeDemoStep
  } = useStudent();

  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return fullName.slice(0, 2).toUpperCase() || 'SS';
  };

  const initials = getInitials(student.name);

  const styles: { style: LearningStyle; icon: string; label: string }[] = [
    { style: 'Simple', icon: '💡', label: 'Simple' },
    { style: 'Analogy', icon: '🧩', label: 'Analogy' },
    { style: 'Visual', icon: '👁️', label: 'Visual' },
    { style: 'Exam-oriented', icon: '📝', label: 'Exam' },
  ];

  return (
    <header style={{
      height: '74px',
      backgroundColor: '#FFFFFF',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      position: 'sticky',
      top: 0,
      zIndex: 30,
      boxShadow: '0 2px 12px rgba(79, 70, 229, 0.03)'
    }}>
      {/* Left: Current Active Mode or Slogan */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
          padding: '6px 14px',
          borderRadius: '999px',
          border: '1px solid #E0E7FF'
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4F46E5', letterSpacing: '0.02em' }}>
            LEARNING STYLE:
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {styles.map((s) => {
              const isSelected = student.preferredStyle === s.style;
              return (
                <button
                  key={s.style}
                  onClick={() => setPreferredStyle(s.style)}
                  title={`Switch explanation mode to ${s.style}`}
                  style={{
                    border: 'none',
                    padding: '3px 9px',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    background: isSelected ? '#4F46E5' : 'transparent',
                    color: isSelected ? '#FFFFFF' : '#64748B',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Gamification Badges, Demo Tour, & Student Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Judge Demo Quick Launcher */}
        <button
          onClick={() => {
            setJudgeDemoStep(1);
            setActiveTab('dashboard');
          }}
          className="btn"
          style={{
            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
            color: '#FFFFFF',
            padding: '7px 14px',
            fontSize: '0.8rem',
            borderRadius: '999px',
            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)'
          }}
          title="Start 10-step hackathon judge demo flow"
        >
          <Play size={13} fill="#FFFFFF" />
          <span>Judge Demo Tour</span>
        </button>

        {/* Reset Demo / Reset State button */}
        {user?.isDemo ? (
          <button
            onClick={resetDemo}
            className="btn"
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              borderRadius: '999px',
              backgroundColor: '#FEF2F2',
              border: '1.5px solid #FECACA',
              color: '#B91C1C',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Reset Demo user to initial presentation state (onboarding ready)"
          >
            <RotateCcw size={13} color="#B91C1C" />
            <span>Reset Demo</span>
          </button>
        ) : (
          <button
            onClick={resetToDefault}
            className="btn btn-ghost"
            style={{
              padding: '6px 10px',
              fontSize: '0.75rem',
              borderRadius: '8px',
              color: '#94A3B8'
            }}
            title="Reset sample progress to baseline"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        )}

        {/* Streak Pill matching Screenshot Panel 3 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: '#FFF7ED',
          border: '1px solid #FFEDD5',
          color: '#EA580C',
          padding: '6px 12px',
          borderRadius: '999px',
          fontWeight: 700,
          fontSize: '0.82rem',
          boxShadow: '0 2px 8px rgba(234, 88, 12, 0.08)'
        }}>
          <Flame size={17} color="#F97316" fill="#F97316" />
          <span>{student.streak} Day Streak</span>
        </div>

        {/* XP Points */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: '#FEF9C3',
          border: '1px solid #FEF08A',
          color: '#854D0E',
          padding: '6px 12px',
          borderRadius: '999px',
          fontWeight: 700,
          fontSize: '0.82rem'
        }}>
          <Star size={16} color="#EAB308" fill="#EAB308" />
          <span>{student.xp} XP</span>
        </div>

        {/* Student Avatar and Profile Dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '4px 12px 4px 6px',
              borderRadius: '999px',
              background: isDropdownOpen ? '#EEF2FF' : '#F8FAFC',
              border: isDropdownOpen ? '1px solid #C7D2FE' : '1px solid var(--border-subtle)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!isDropdownOpen) e.currentTarget.style.backgroundColor = '#EEF2FF';
            }}
            onMouseLeave={(e) => {
              if (!isDropdownOpen) e.currentTarget.style.backgroundColor = '#F8FAFC';
            }}
          >
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontSize: '0.85rem',
              fontWeight: 800,
              boxShadow: '0 3px 10px rgba(236, 72, 153, 0.3)'
            }}>
              {initials}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E293B', lineHeight: '1.2' }}>
                {student.name}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 500 }}>
                {student.grade} • {student.board} {student.stream !== 'Not applicable' ? `• ${student.stream}` : ''}
              </div>
            </div>
            <ChevronDown
              size={14}
              color="#94A3B8"
              style={{
                transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease'
              }}
            />
          </div>

          {/* User Dropdown Menu */}
          {isDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '240px',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 12px 36px -4px rgba(15, 23, 42, 0.12)',
              padding: '10px',
              zIndex: 100,
              animation: 'pulse-soft 0.15s ease'
            }}>
              {/* Profile summary */}
              <div style={{
                padding: '10px 12px',
                borderRadius: '10px',
                backgroundColor: '#F8FAFC',
                marginBottom: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1E293B' }}>
                    {student.name}
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email || ''}
                </div>
                <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: '#EEF2FF',
                    color: '#4F46E5'
                  }}>
                    {student.level}
                  </span>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: '#F1F5F9',
                    color: '#475569'
                  }}>
                    {student.grade} • {student.board}
                  </span>
                </div>
              </div>

              {/* Menu items */}
              <button
                onClick={() => {
                  setActiveTab('profile');
                  setIsDropdownOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#334155',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Settings size={15} color="#64748B" />
                <span>Profile & Settings</span>
              </button>

              <div style={{ height: '1px', backgroundColor: '#F1F5F9', margin: '6px 0' }} />

              {/* Logout Option */}
              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  logout();
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#DC2626',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <LogOut size={15} color="#DC2626" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
