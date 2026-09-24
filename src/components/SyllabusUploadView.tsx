import React, { useState, useRef } from 'react';
import {
  GraduationCap,
  Sparkles,
  UploadCloud,
  FileText,
  CheckCircle2,
  X,
  ArrowRight,
  Loader2,
  SkipForward,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStudent } from '../context/StudentContext';
import { SubjectType } from '../types';

interface SyllabusFileData {
  file: File;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

const SUBJECT_ICONS: Record<SubjectType, string> = {
  'Mathematics': '📐',
  'Science': '🔬',
  'English': '📖',
  'Computer Science': '💻',
  'Social Science': '🌍'
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const SyllabusUploadView: React.FC = () => {
  const { user } = useAuth();
  const { completeSyllabusSetup, setActiveTab, setActiveSubject } = useStudent();

  const preferredSubjects = user?.preferredSubjects || [];
  // Ensure we have at least one subject to avoid undefined
  // Default to Mathematics if no preferred subjects or if the first one is invalid
  let defaultSubject: SubjectType = 'Mathematics';
  if (preferredSubjects.length > 0) {
    const firstSubject = preferredSubjects[0];
    // Verify it's a valid SubjectType
    if (['Mathematics', 'Science', 'English', 'Computer Science', 'Social Science'].includes(firstSubject as any)) {
      defaultSubject = firstSubject;
    }
  }
  const [activeSubjectTab, setActiveSubjectTab] = useState<SubjectType>(defaultSubject);
  const [syllabusFiles, setSyllabusFiles] = useState<Record<string, SyllabusFileData | null>>({});
  const [skippedSubjects, setSkippedSubjects] = useState<Set<string>>(new Set());
  const [isCompleting, setIsCompleting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File, subject: SubjectType) => {
    // Only accept PDF format
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      alert('Only PDF files are supported. Please select a .pdf file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit. Please choose a smaller file.');
      return;
    }

    const fileData: SyllabusFileData = {
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString()
    };

    setSyllabusFiles((prev) => ({ ...prev, [subject]: fileData }));

    // Remove from skipped if it was there
    setSkippedSubjects((prev) => {
      const newSet = new Set(prev);
      newSet.delete(subject);
      return newSet;
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file, activeSubjectTab);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file, activeSubjectTab);
    }
  };

  const handleRemoveFile = (subject: SubjectType) => {
    setSyllabusFiles((prev) => ({ ...prev, [subject]: null }));
  };

  const handleSkipSubject = (subject: SubjectType) => {
    setSkippedSubjects((prev) => new Set(prev).add(subject));
    setSyllabusFiles((prev) => ({ ...prev, [subject]: null }));
  };

  const getSubjectStatus = (subject: SubjectType): 'pending' | 'uploaded' | 'skipped' => {
    if (syllabusFiles[subject]) return 'uploaded';
    if (skippedSubjects.has(subject)) return 'skipped';
    return 'pending';
  };

  const configuredCount = preferredSubjects.filter((sub) =>
    getSubjectStatus(sub) !== 'pending'
  ).length;

  const allConfigured = configuredCount === preferredSubjects.length;

  const handleStartLearning = async () => {
    setIsCompleting(true);

    // Prepare files for completeSyllabusSetup (keep file object for extraction)
    const filesToSubmit: Record<string, any> = {};
    preferredSubjects.forEach((subject) => {
      const fileData = syllabusFiles[subject];
      if (fileData) {
        filesToSubmit[subject] = {
          ...fileData,
          // Ensure we keep the file object for PDF extraction
          file: fileData.file
        };
      }
    });

    // Simulate upload delay for premium UX
    await new Promise((resolve) => setTimeout(resolve, 800));

    await completeSyllabusSetup(filesToSubmit);
    setIsCompleting(false);
    // Navigate to syllabus analysis view
    setActiveTab('syllabus-analysis');
    // Set active subject to first subject that has syllabus data
    const firstSubjectWithData = preferredSubjects.find(sub => syllabusFiles[sub] !== null);
    if (firstSubjectWithData) {
      setActiveSubject(firstSubjectWithData);
    }
  };

  const handleAutoLoadDemoSyllabus = async () => {
    setIsCompleting(true);
    try {
      let demoPdfFile: File | null = null;
      try {
        const resp = await fetch('/sample-syllabus/Class_10_Science_Chemistry_Main_Topics.pdf');
        if (resp.ok) {
          const blob = await resp.blob();
          demoPdfFile = new File([blob], 'Class_10_CBSE_Curriculum_Syllabus.pdf', { type: 'application/pdf' });
        }
      } catch (err) {
        console.warn('Could not fetch sample syllabus blob:', err);
      }

      const targetSubjects = preferredSubjects.length > 0
        ? preferredSubjects
        : (['Mathematics', 'Science', 'English', 'Computer Science', 'Social Science'] as SubjectType[]);

      const filesToSubmit: Record<string, any> = {};
      targetSubjects.forEach((subject) => {
        filesToSubmit[subject] = {
          file: demoPdfFile || new File([''], `${subject}_Class_10_CBSE_Syllabus.pdf`, { type: 'application/pdf' }),
          name: `${subject}_Class_10_CBSE_Syllabus.pdf`,
          size: 27209,
          type: 'application/pdf',
          uploadedAt: new Date().toISOString()
        };
      });

      await new Promise(r => setTimeout(r, 600));
      await completeSyllabusSetup(filesToSubmit);
      setIsCompleting(false);
      setActiveTab('syllabus-analysis');
      setActiveSubject(targetSubjects[0]);
    } catch (e) {
      setIsCompleting(false);
      alert('Error loading demo syllabus. Please select a PDF file manually.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-page)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '1100px', width: '100%' }}>
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '72px',
            height: '72px',
            margin: '0 auto 20px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            boxShadow: 'var(--shadow-primary)',
            animation: 'pulse-soft 2.5s infinite ease-in-out'
          }}>
            <GraduationCap size={40} />
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '9999px',
            backgroundColor: '#E0E7FF',
            border: '1.5px solid #C7D2FE',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#4F46E5',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '0.02em'
          }}>
            <Sparkles size={12} />
            <span>Step 2 of 2 — Syllabus Setup</span>
          </div>

          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
            color: 'var(--text-main)',
            marginBottom: '12px',
            letterSpacing: '-0.02em'
          }}>
            Set Up Your Learning Journey
          </h1>

          <p style={{
            fontSize: '1.05rem',
            color: 'var(--text-muted)',
            maxWidth: '640px',
            margin: '0 auto 20px',
            lineHeight: '1.6'
          }}>
            Upload your syllabus for each subject so GuruMitra can create a personalized adaptive plan just for you.
          </p>

          {/* Quick Demo Syllabus Helper */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
            <button
              onClick={handleAutoLoadDemoSyllabus}
              disabled={isCompleting}
              className="btn"
              style={{
                background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                color: '#FFFFFF',
                padding: '12px 28px',
                borderRadius: '999px',
                fontWeight: 700,
                fontSize: '0.9rem',
                boxShadow: '0 8px 20px -4px rgba(79, 70, 229, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <Sparkles size={16} />
              <span>{isCompleting ? 'Loading & Analyzing CBSE Syllabus...' : '✨ 1-Click: Auto-Load Class 10 CBSE Syllabus (Demo Mode)'}</span>
            </button>
          </div>
        </div>

        {/* Subject Tabs */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          overflowX: 'auto',
          paddingBottom: '8px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          {preferredSubjects.map((subject) => {
            const isActive = subject === activeSubjectTab;
            const status = getSubjectStatus(subject);

            return (
              <button
                key={subject}
                onClick={() => setActiveSubjectTab(subject)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  border: 'none',
                  borderBottom: isActive ? '3px solid #4F46E5' : '3px solid transparent',
                  backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                  borderRadius: '8px 8px 0 0',
                  color: isActive ? '#1E293B' : '#64748B',
                  fontSize: '0.95rem',
                  fontWeight: isActive ? 700 : 600,
                  fontFamily: 'var(--font-family)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>{SUBJECT_ICONS[subject]}</span>
                <span>{subject}</span>
                {status === 'uploaded' && (
                  <CheckCircle2 size={16} color="#15803D" />
                )}
                {status === 'skipped' && (
                  <SkipForward size={16} color="#64748B" />
                )}
              </button>
            );
          })}
        </div>

        {/* Upload Card */}
        <div className="card" style={{ padding: '40px', marginBottom: '28px' }}>
          {getSubjectStatus(activeSubjectTab) === 'uploaded' && syllabusFiles[activeSubjectTab] ? (
            // File Uploaded State
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '20px',
                backgroundColor: '#DCFCE7',
                border: '1.5px solid #BBF7D0',
                borderRadius: '14px',
                marginBottom: '20px'
              }}>
                <CheckCircle2 size={24} color="#15803D" />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: '#065F46',
                    marginBottom: '2px'
                  }}>
                    Syllabus uploaded for {activeSubjectTab}!
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#047857' }}>
                    Your personalized plan will include this syllabus
                  </div>
                </div>
              </div>

              {/* File Preview Card */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px',
                backgroundColor: '#F8FAFC',
                border: '1.5px solid #E8EEFB',
                borderRadius: '12px'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  backgroundColor: '#EEF2FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FileText size={24} color="#4F46E5" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: '#1E293B',
                    marginBottom: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {syllabusFiles[activeSubjectTab].name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                    {formatFileSize(syllabusFiles[activeSubjectTab].size)}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveFile(activeSubjectTab)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#64748B',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#FEE2E2';
                    e.currentTarget.style.color = '#DC2626';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#64748B';
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          ) : getSubjectStatus(activeSubjectTab) === 'skipped' ? (
            // Skipped State
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <SkipForward size={48} color="#94A3B8" style={{ marginBottom: '16px' }} />
              <div style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#64748B',
                marginBottom: '8px'
              }}>
                {activeSubjectTab} Skipped
              </div>
              <p style={{
                fontSize: '0.9rem',
                color: '#94A3B8',
                marginBottom: '20px'
              }}>
                You can upload your syllabus later from the Upload Material section
              </p>
              <button
                onClick={() => setSkippedSubjects((prev) => {
                  const newSet = new Set(prev);
                  newSet.delete(activeSubjectTab);
                  return newSet;
                })}
                className="btn btn-outline"
                style={{ fontSize: '0.9rem' }}
              >
                Upload Syllabus
              </button>
            </div>
          ) : (
            // Upload Zone
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />

              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: dragActive ? '2.5px dashed #4F46E5' : '2.5px dashed #C7D2FE',
                  borderRadius: '20px',
                  padding: '60px 40px',
                  textAlign: 'center',
                  backgroundColor: dragActive ? '#EEF2FF' : '#F8FAFC',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                <UploadCloud
                  size={56}
                  color="#4F46E5"
                  style={{
                    marginBottom: '20px',
                    opacity: dragActive ? 1 : 0.7
                  }}
                />
                <div style={{
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: '#1E293B',
                  marginBottom: '8px'
                }}>
                  Drag & drop your syllabus PDF here
                </div>
                <div style={{
                  fontSize: '0.95rem',
                  color: '#64748B',
                  marginBottom: '4px'
                }}>
                  or{' '}
                  <span style={{
                    color: '#4F46E5',
                    fontWeight: 600,
                    textDecoration: 'underline'
                  }}>
                    Browse Files
                  </span>
                </div>
                <div style={{
                  fontSize: '0.8rem',
                  color: '#94A3B8',
                  marginTop: '12px'
                }}>
                  Supports PDF files only (max 10MB)
                </div>
              </div>

              <div style={{
                textAlign: 'center',
                marginTop: '24px'
              }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSkipSubject(activeSubjectTab);
                  }}
                  className="btn btn-ghost"
                  style={{
                    fontSize: '0.9rem',
                    gap: '6px'
                  }}
                >
                  <SkipForward size={16} />
                  Skip this subject
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Progress Section */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1.5px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px'
          }}>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#64748B'
            }}>
              Setup Progress
            </div>
            <div style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#4F46E5'
            }}>
              {configuredCount} out of {preferredSubjects.length} subjects configured
            </div>
          </div>

          <div style={{
            width: '100%',
            height: '10px',
            backgroundColor: '#EEF2F6',
            borderRadius: '9999px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, #4F46E5 0%, #818CF8 100%)',
              borderRadius: '9999px',
              width: `${(configuredCount / preferredSubjects.length) * 100}%`,
              transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
            }} />
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleStartLearning}
          disabled={!allConfigured || isCompleting}
          className="btn btn-primary"
          style={{
            width: '100%',
            padding: '16px 32px',
            fontSize: '1.05rem',
            fontWeight: 700,
            opacity: (!allConfigured || isCompleting) ? 0.5 : 1,
            cursor: (!allConfigured || isCompleting) ? 'not-allowed' : 'pointer',
            position: 'relative'
          }}
        >
          {isCompleting ? (
            <>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Setting up your learning plan...</span>
            </>
          ) : (
            <>
              <Sparkles size={20} />
              <span>AI Analyse All Syllabuses</span>
            </>
          )}
        </button>

        {/* Footer Note */}
        <div style={{
          textAlign: 'center',
          marginTop: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '0.85rem',
          color: '#94A3B8'
        }}>
          <BookOpen size={16} />
          <span>
            You can always upload or update your syllabus later from the Upload Material section.
          </span>
        </div>
      </div>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
