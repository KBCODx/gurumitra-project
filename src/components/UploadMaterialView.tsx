import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  FileCode,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Bot,
  ChevronDown,
  RotateCcw,
  AlertCircle,
  FileCheck,
  MessageSquareQuote,
  BookOpen
} from 'lucide-react';
import { useStudent } from '../context/StudentContext';
import { getStoredGeminiKey } from '../services/preAssessmentService';
import { AiModelConfigModal } from './AiModelConfigModal';

export const UploadMaterialView: React.FC = () => {
  const {
    setActiveTab,
    uploadedMaterial,
    uploadState,
    uploadError,
    processAndSetFile,
    removeUploadedMaterial,
    clearUploadError,
    setPlannerStep
  } = useStudent();

  const [selectedFormat, setSelectedFormat] = useState<'PDF' | 'Notes' | 'DOCX'>('PDF');
  const [isDragOver, setIsDragOver] = useState(false);
  const [expandedTopic, setExpandedTopic] = useState<number | null>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean>(() => !!getStoredGeminiKey());

  const isAnalyzing = uploadState === 'uploading' || uploadState === 'analyzing';
  const isAnalyzed = uploadState === 'ready' && !!uploadedMaterial;

  const handleTriggerBrowse = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      try {
        await processAndSetFile(file);
      } catch {
        // Handled in context
      }
    }
    // Reset file input value so same file can be re-uploaded if desired
    if (e.target) e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      try {
        await processAndSetFile(file);
      } catch {
        // Handled in context
      }
    }
  };

  const handleReset = () => {
    removeUploadedMaterial();
    clearUploadError();
  };

  return (
    <div style={{
      maxWidth: '1080px',
      margin: '0 auto',
      padding: '32px 32px 64px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      {/* Hidden genuine file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.txt,.text,.md,.csv,.json"
        style={{ display: 'none' }}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            AI Curriculum Ingestion
          </span>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1E293B', marginTop: '2px' }}>
            Upload Learning Material
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.92rem', margin: 0 }}>
            Upload your textbook chapter, class notes, or assignment and let GuruMitra build your adaptive plan and tutor context.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
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

          {(isAnalyzed || uploadState === 'error') && (
            <button onClick={handleReset} className="btn btn-outline" style={{ padding: '8px 14px', fontSize: '0.82rem' }}>
              <RotateCcw size={14} />
              <span>Upload Another File</span>
            </button>
          )}
        </div>
      </div>

      {/* Error state if file processing failed */}
      {uploadState === 'error' && (
        <div style={{
          padding: '16px 20px',
          borderRadius: '14px',
          backgroundColor: '#FEF2F2',
          border: '1.5px solid #FECACA',
          color: '#991B1B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} color="#EF4444" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>File Processing Notice</div>
              <div style={{ fontSize: '0.82rem', color: '#B91C1C' }}>
                {uploadError || "Couldn't read this file. Please try another supported file (PDF, TXT, DOCX)."}
              </div>
            </div>
          </div>
          <button
            onClick={handleTriggerBrowse}
            className="btn btn-outline"
            style={{ padding: '6px 14px', fontSize: '0.8rem', borderColor: '#FCA5A5', color: '#991B1B' }}
          >
            Select Another File
          </button>
        </div>
      )}

      {!isAnalyzed && !isAnalyzing ? (
        /* Upload Area */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Drag & Drop Card */}
          <div
            className="card"
            style={{
              padding: '60px 32px',
              border: isDragOver ? '2.5px dashed #4F46E5' : '2px dashed #C7D2FE',
              backgroundColor: isDragOver ? '#EEF2FF' : '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={handleTriggerBrowse}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <div style={{
              width: '74px',
              height: '74px',
              borderRadius: '50%',
              backgroundColor: '#EEF2FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4F46E5',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.15)'
            }}>
              <UploadCloud size={36} />
            </div>

            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E293B', marginBottom: '6px' }}>
                Drag & drop your file here
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#64748B', margin: 0 }}>
                or <span style={{ color: '#4F46E5', fontWeight: 700, textDecoration: 'underline' }}>Browse Files</span> on your computer
              </p>
              <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '6px' }}>
                Supports PDF, DOCX, TXT, and Markdown files
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleTriggerBrowse();
              }}
              className="btn btn-primary"
              style={{ padding: '12px 28px', marginTop: '8px' }}
            >
              <span>Select File & Scan with GuruMitra AI</span>
              <Sparkles size={16} />
            </button>
          </div>

          {/* Format Selector Pills */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '14px',
            flexWrap: 'wrap'
          }}>
            {[
              { id: 'PDF', icon: FileText, label: 'PDF Document (.pdf)', color: '#EF4444', bg: '#FEE2E2' },
              { id: 'DOCX', icon: FileCode, label: 'Word Document (.docx)', color: '#2563EB', bg: '#DBEAFE' },
              { id: 'Notes', icon: FileCheck, label: 'Plain Text / Notes (.txt, .md)', color: '#059669', bg: '#D1FAE5' }
            ].map((fmt) => {
              const Icon = fmt.icon;
              const isSelected = selectedFormat === fmt.id;
              return (
                <button
                  key={fmt.id}
                  onClick={() => {
                    setSelectedFormat(fmt.id as any);
                    handleTriggerBrowse();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    borderRadius: '12px',
                    backgroundColor: isSelected ? fmt.bg : '#FFFFFF',
                    border: isSelected ? `2px solid ${fmt.color}` : '1px solid var(--border-subtle)',
                    color: isSelected ? fmt.color : '#64748B',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={16} color={fmt.color} />
                  <span>{fmt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : isAnalyzing ? (
        /* Real Analyzing Progress State */
        <div className="card" style={{ padding: '36px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
            boxShadow: '0 8px 24px rgba(79, 70, 229, 0.3)',
            animation: 'pulse-soft 1.5s infinite ease-in-out'
          }}>
            <Bot size={32} />
          </div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1E293B', marginBottom: '8px' }}>
            {uploadState === 'uploading' ? 'Reading your material...' : 'GuruMitra AI is analyzing your material...'}
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#64748B', maxWidth: '460px', margin: '0 auto 24px' }}>
            Extracting text structure, key concepts, formulas, and indexing topics for your interactive AI Tutor session.
          </p>

          <div style={{ maxWidth: '520px', margin: '0 auto' }}>
            <div className="progress-bar-container" style={{ height: '10px' }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: uploadState === 'uploading' ? '45%' : '85%',
                  transition: 'width 0.6s ease'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94A3B8', marginTop: '8px' }}>
              <span>{uploadState === 'uploading' ? 'Reading file buffer...' : 'Analyzing key topics & concepts...'}</span>
              <span>{uploadState === 'uploading' ? '45%' : '85%'}</span>
            </div>
          </div>
        </div>
      ) : (
        /* Genuine Extracted Material State */
        uploadedMaterial && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Top Info Card */}
            <div className="card" style={{ padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <FileCheck size={24} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                        {uploadedMaterial.fileName}
                      </h3>
                      <span className="badge badge-on-track" style={{ fontSize: '0.7rem' }}>
                        Ready in AI Tutor
                      </span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '4px 0 0' }}>
                      {uploadedMaterial.fileSizeFormatted} • {uploadedMaterial.wordCount} words • Uploaded at {uploadedMaterial.uploadedAt}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => setActiveTab('tutor')}
                    className="btn btn-primary"
                    style={{ padding: '9px 18px', fontSize: '0.85rem' }}
                  >
                    <MessageSquareQuote size={16} />
                    <span>Ask AI Tutor About This</span>
                  </button>
                </div>
              </div>

              {/* Summary Preview */}
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                backgroundColor: '#F8FAFC',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                fontSize: '0.86rem',
                color: '#334155',
                lineHeight: '1.5'
              }}>
                <strong style={{ color: '#4F46E5' }}>Document Summary: </strong>
                {uploadedMaterial.summaryPreview}
              </div>
            </div>

            {/* Split Layout: Extraction Summary + Topics Found */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.8fr)',
              gap: '24px'
            }}>
              {/* Extraction Verification Checklist */}
              <div className="card" style={{ padding: '24px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E293B', marginBottom: '16px' }}>
                  Ingestion Checklist
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {[
                    { label: 'Text stream extraction complete', done: true },
                    { label: `Identified ${uploadedMaterial.topics.length} key sections`, done: true },
                    { label: 'Vocabulary & glossary indexed', done: true },
                    { label: 'Context synchronized with AI Tutor', done: true }
                  ].map((step, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: '#10B981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF'
                      }}>
                        <CheckCircle2 size={16} />
                      </div>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1E293B' }}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Topics Found Accordion */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                    Topics Found ({uploadedMaterial.topics.length})
                  </h4>
                  <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                    Extracted from File
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {uploadedMaterial.topics.map((topic, i) => {
                    const isExpanded = expandedTopic === i;
                    return (
                      <div
                        key={i}
                        style={{
                          borderRadius: '12px',
                          border: '1px solid #E2E8F0',
                          overflow: 'hidden',
                          backgroundColor: isExpanded ? '#F8FAFC' : '#FFFFFF'
                        }}
                      >
                        <button
                          onClick={() => setExpandedTopic(isExpanded ? null : i)}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                        >
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1E293B' }}>
                            {topic.title}
                          </span>
                          <ChevronDown
                            size={16}
                            color="#64748B"
                            style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                          />
                        </button>

                        {isExpanded && (
                          <div style={{ padding: '0 16px 14px', fontSize: '0.82rem', color: '#64748B', lineHeight: '1.4' }}>
                            <strong>Core Concepts: </strong>{topic.concepts}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Mascot Banner */}
            <div className="card" style={{
              padding: '20px 24px',
              background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
              border: '1.5px solid #C7D2FE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '2rem' }}>🤖</span>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#4F46E5' }}>
                    "{uploadedMaterial.fileName}" is ready in your session!
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#4338CA', margin: 0 }}>
                    Switch to the AI Tutor to ask questions directly about this material.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    setPlannerStep('chapters');
                    setActiveTab('learning-path');
                  }}
                  className="btn btn-primary"
                  style={{
                    padding: '10px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#4F46E5',
                    color: '#FFFFFF'
                  }}
                >
                  <BookOpen size={16} />
                  <span>Create Study Plan from this Topic</span>
                </button>
                <button
                  onClick={() => setActiveTab('pre-assessment')}
                  className="btn btn-outline"
                  style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FFFFFF' }}
                >
                  <Sparkles size={16} />
                  <span>Start Pre-Assessment</span>
                </button>
                <button
                  onClick={() => setActiveTab('tutor')}
                  className="btn btn-outline"
                  style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FFFFFF' }}
                >
                  <span>Chat with AI Tutor</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* AI Model Settings Modal */}
      <AiModelConfigModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onKeyUpdated={(has) => setHasGeminiKey(has)}
      />
    </div>
  );
};
