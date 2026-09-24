import React from 'react';
import {
  Sparkles,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Calendar,
  BookOpen,
  Bot,
  Layers
} from 'lucide-react';
import { useStudent } from '../context/StudentContext';
import { RecommendationItem } from '../types';

export const RecommendationsView: React.FC = () => {
  const {
    recommendations,
    studyPlan,
    toggleStudyPlanItem,
    setActiveTab,
    setActiveSubject,
    setTopicContext,
    student
  } = useStudent();

  const handleStartRecommendation = (rec: RecommendationItem) => {
    setTopicContext(rec.subject, rec.topic, rec.topic, undefined, undefined, rec.difficulty);
    setActiveTab('adaptive');
  };

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
      <div>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase' }}>
          Personalized Intelligence
        </span>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1E293B', marginTop: '2px' }}>
          Recommended For You
        </h1>
        <p style={{ color: '#64748B', fontSize: '0.92rem', margin: 0 }}>
          Generated automatically from your diagnostic quiz results, learning style preferences, and knowledge gaps.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)',
        gap: '24px'
      }}>
        {/* Left Column: Dynamic Recommended Topics Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B' }}>
              Adaptive Recommendations ({recommendations.length})
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
              Ordered by urgency
            </span>
          </div>

          {recommendations.length === 0 ? (
            <div className="card" style={{ padding: '36px 24px', textAlign: 'center', backgroundColor: '#F8FAFC' }}>
              <Sparkles size={36} color="#4F46E5" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B', marginBottom: '6px' }}>
                No Active Recommendations Yet
              </h4>
              <p style={{ fontSize: '0.85rem', color: '#64748B', maxWidth: '420px', margin: '0 auto 16px' }}>
                Continue studying or take an adaptive quiz to generate personalized recommendations based on your latest performance.
              </p>
              <button
                onClick={() => setActiveTab('quiz')}
                className="btn btn-primary"
                style={{ padding: '8px 20px', fontSize: '0.85rem' }}
              >
                Take an Adaptive Quiz
              </button>
            </div>
          ) : (
            recommendations.map((rec) => (
              <div
                key={rec.id}
                className="card"
                style={{
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  borderLeft: rec.priority === 'High Priority' ? '4px solid #EF4444' : rec.priority === 'Practice' ? '4px solid #F59E0B' : '4px solid #10B981'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#64748B',
                      textTransform: 'uppercase'
                    }}>
                      {rec.subject} • {rec.difficulty}
                    </span>
                    <span className={`badge ${
                      rec.priority === 'High Priority' ? 'badge-high-priority' : rec.priority === 'Practice' ? 'badge-practice' : 'badge-on-track'
                    }`}>
                      {rec.priority}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      <span>{rec.duration}</span>
                    </span>
                  </div>

                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', marginBottom: '6px' }}>
                    {rec.topic}
                  </h4>

                  <p style={{ fontSize: '0.82rem', color: '#475569', margin: 0, lineHeight: '1.4' }}>
                    "{rec.reason}"
                  </p>
                </div>

                <button
                  onClick={() => handleStartRecommendation(rec)}
                  className="btn btn-primary"
                  style={{ padding: '10px 18px', fontSize: '0.85rem' }}
                >
                  <span>Start Learning</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Right Column: Personalized Study Plan (Panel 8 in Screenshot!) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                  Schedule
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E293B' }}>
                  Tomorrow's Plan
                </h3>
              </div>
              <span style={{ fontSize: '0.78rem', color: '#4F46E5', fontWeight: 700 }}>
                Total: 1h 20min
              </span>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '18px', lineHeight: '1.4' }}>
              Based on your performance, here's what we recommend for tomorrow:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {studyPlan.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => toggleStudyPlanItem(plan.id)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    backgroundColor: plan.completed ? '#F1F5F9' : '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    opacity: plan.completed ? 0.65 : 1
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '6px',
                      border: plan.completed ? 'none' : '1.5px solid #CBD5E1',
                      backgroundColor: plan.completed ? '#10B981' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF'
                    }}>
                      {plan.completed && <CheckCircle2 size={14} />}
                    </div>

                    <div>
                      <div style={{
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        color: plan.completed ? '#64748B' : '#1E293B',
                        textDecoration: plan.completed ? 'line-through' : 'none'
                      }}>
                        {plan.title}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                        {plan.duration}
                      </span>
                    </div>
                  </div>

                  <span className={`badge ${
                    plan.type === 'High Priority'
                      ? 'badge-high-priority'
                      : plan.type === 'Practice'
                      ? 'badge-practice'
                      : plan.type === 'All Topics'
                      ? 'badge-on-track'
                      : 'badge-info'
                  }`} style={{ fontSize: '0.68rem' }}>
                    {plan.type}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveTab('learning-path')}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
            >
              <span>View Full Learning Path</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Cute Robot Encouragement Box (Matching Panel 8 Screenshot!) */}
          <div className="card" style={{
            padding: '20px',
            background: 'linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)',
            border: '1px solid #E9D5FF',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.6rem',
              boxShadow: '0 4px 12px rgba(168, 85, 247, 0.15)'
            }}>
              🤖
            </div>
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#6B21A8' }}>
                You're making progress!
              </div>
              <p style={{ fontSize: '0.78rem', color: '#7E22CE', margin: 0 }}>
                Keep going! Tomorrow's study plan takes only 1h 20m.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
