import React, { useState } from 'react';
import {
  CheckCircle2,
  BookOpen,
  Edit2,
  Trash2,
  Plus,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { SubjectType, ExtractedChapter } from '../types';

export interface EditableSyllabusMap {
  [subject: string]: ExtractedChapter[];
}

interface ReviewSyllabusViewProps {
  syllabusBySubject: EditableSyllabusMap;
  classLevel: string;
  board: string;
  onConfirm: (confirmedSyllabus: EditableSyllabusMap) => void;
  onBack: () => void;
}

export const ReviewSyllabusView: React.FC<ReviewSyllabusViewProps> = ({
  syllabusBySubject,
  classLevel,
  board,
  onConfirm,
  onBack
}) => {
  const subjects = Object.keys(syllabusBySubject) as SubjectType[];
  const [activeSubject, setActiveSubject] = useState<SubjectType>(subjects[0] || 'Mathematics');
  const [editableMap, setEditableMap] = useState<EditableSyllabusMap>(() => JSON.parse(JSON.stringify(syllabusBySubject)));

  // Editing state trackers
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [tempChapterName, setTempChapterName] = useState<string>('');

  const [editingTopicKey, setEditingTopicKey] = useState<string | null>(null); // "chId:topicIdx"
  const [tempTopicName, setTempTopicName] = useState<string>('');

  const [newTopicChapterId, setNewTopicChapterId] = useState<string | null>(null);
  const [newTopicInput, setNewTopicInput] = useState<string>('');

  const [newChapterInput, setNewChapterInput] = useState<string>('');
  const [isAddingChapter, setIsAddingChapter] = useState<boolean>(false);

  const currentChapters = editableMap[activeSubject] || [];

  // Edit Chapter Name
  const handleStartEditChapter = (ch: ExtractedChapter) => {
    setEditingChapterId(ch.chapterId);
    setTempChapterName(ch.chapterName);
  };

  const handleSaveEditChapter = (chapterId: string) => {
    if (!tempChapterName.trim()) return;
    setEditableMap(prev => {
      const updated = { ...prev };
      updated[activeSubject] = updated[activeSubject].map(ch => {
        if (ch.chapterId === chapterId) {
          return { ...ch, chapterName: tempChapterName.trim() };
        }
        return ch;
      });
      return updated;
    });
    setEditingChapterId(null);
  };

  // Remove Chapter
  const handleRemoveChapter = (chapterId: string) => {
    setEditableMap(prev => {
      const updated = { ...prev };
      updated[activeSubject] = updated[activeSubject].filter(ch => ch.chapterId !== chapterId);
      return updated;
    });
  };

  // Add Chapter
  const handleAddChapter = () => {
    if (!newChapterInput.trim()) return;
    const newCh: ExtractedChapter = {
      chapterId: `ch_custom_${Date.now()}`,
      chapterName: newChapterInput.trim(),
      subject: activeSubject,
      topics: ['Key Fundamentals & Concepts', 'Practice Problems']
    };
    setEditableMap(prev => {
      const updated = { ...prev };
      updated[activeSubject] = [...(updated[activeSubject] || []), newCh];
      return updated;
    });
    setNewChapterInput('');
    setIsAddingChapter(false);
  };

  // Edit Topic Name
  const handleStartEditTopic = (chId: string, topicIdx: number, currentName: string) => {
    setEditingTopicKey(`${chId}:${topicIdx}`);
    setTempTopicName(currentName);
  };

  const handleSaveEditTopic = (chId: string, topicIdx: number) => {
    if (!tempTopicName.trim()) return;
    setEditableMap(prev => {
      const updated = { ...prev };
      updated[activeSubject] = updated[activeSubject].map(ch => {
        if (ch.chapterId === chId) {
          const newTopics = [...ch.topics];
          newTopics[topicIdx] = tempTopicName.trim();
          return { ...ch, topics: newTopics };
        }
        return ch;
      });
      return updated;
    });
    setEditingTopicKey(null);
  };

  // Remove Topic
  const handleRemoveTopic = (chId: string, topicIdx: number) => {
    setEditableMap(prev => {
      const updated = { ...prev };
      updated[activeSubject] = updated[activeSubject].map(ch => {
        if (ch.chapterId === chId) {
          const newTopics = ch.topics.filter((_, i) => i !== topicIdx);
          return { ...ch, topics: newTopics.length > 0 ? newTopics : ['General Concepts'] };
        }
        return ch;
      });
      return updated;
    });
  };

  // Add Topic
  const handleAddTopic = (chId: string) => {
    if (!newTopicInput.trim()) return;
    setEditableMap(prev => {
      const updated = { ...prev };
      updated[activeSubject] = updated[activeSubject].map(ch => {
        if (ch.chapterId === chId) {
          return { ...ch, topics: [...ch.topics, newTopicInput.trim()] };
        }
        return ch;
      });
      return updated;
    });
    setNewTopicInput('');
    setNewTopicChapterId(null);
  };

  const totalChaptersAcrossSubjects = Object.values(editableMap).reduce((acc, chs) => acc + chs.length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0,
              marginBottom: '4px'
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Syllabus Upload</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
              Review Your Syllabus
            </h2>
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '999px',
              backgroundColor: '#EEF2FF',
              color: '#4F46E5',
              border: '1px solid #C7D2FE'
            }}>
              {board} • {classLevel}
            </span>
          </div>
          <p style={{ color: '#64748B', fontSize: '0.92rem', marginTop: '4px' }}>
            Verify extracted chapters and topics before generating your adaptive study plan. You can edit names, add missing topics, or remove unwanted items.
          </p>
        </div>

        <button
          onClick={() => onConfirm(editableMap)}
          disabled={totalChaptersAcrossSubjects === 0}
          style={{
            backgroundColor: '#4F46E5',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '12px',
            padding: '14px 28px',
            fontSize: '1rem',
            fontWeight: 800,
            cursor: totalChaptersAcrossSubjects === 0 ? 'not-allowed' : 'pointer',
            opacity: totalChaptersAcrossSubjects === 0 ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 8px 20px -4px rgba(79, 70, 229, 0.4)'
          }}
        >
          <CheckCircle2 size={18} />
          <span>Confirm Syllabus ({totalChaptersAcrossSubjects} Chapters)</span>
          <ArrowRight size={18} />
        </button>
      </div>

      {/* Subject Tabs */}
      {subjects.length > 1 && (
        <div style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid #E2E8F0',
          paddingBottom: '4px',
          overflowX: 'auto'
        }}>
          {subjects.map(sub => {
            const isActive = sub === activeSubject;
            const chCount = editableMap[sub]?.length || 0;
            return (
              <button
                key={sub}
                onClick={() => setActiveSubject(sub)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px 10px 0 0',
                  border: 'none',
                  backgroundColor: isActive ? '#EEF2FF' : 'transparent',
                  color: isActive ? '#4F46E5' : '#64748B',
                  fontWeight: isActive ? 800 : 600,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderBottom: isActive ? '3px solid #4F46E5' : '3px solid transparent',
                  marginBottom: '-6px'
                }}
              >
                <span>{sub}</span>
                <span style={{
                  fontSize: '0.75rem',
                  padding: '1px 7px',
                  borderRadius: '999px',
                  backgroundColor: isActive ? '#C7D2FE' : '#F1F5F9',
                  color: isActive ? '#3730A3' : '#64748B'
                }}>
                  {chCount}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Chapters Review Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {currentChapters.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            borderRadius: '16px',
            backgroundColor: '#F8FAFC',
            border: '2px dashed #CBD5E1'
          }}>
            <BookOpen size={32} color="#94A3B8" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ margin: '0 0 6px', color: '#1E293B', fontWeight: 800 }}>No chapters found for {activeSubject}</h4>
            <p style={{ margin: '0 0 16px', color: '#64748B', fontSize: '0.88rem' }}>
              Add chapters manually or re-upload the syllabus document.
            </p>
            <button
              onClick={() => setIsAddingChapter(true)}
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <Plus size={16} />
              <span>Add Chapter</span>
            </button>
          </div>
        ) : (
          currentChapters.map((ch, chIdx) => {
            const isEditingTitle = editingChapterId === ch.chapterId;
            return (
              <div
                key={ch.chapterId}
                style={{
                  borderRadius: '16px',
                  border: '1.5px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  padding: '20px 24px',
                  boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}
              >
                {/* Chapter Title Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: '#EEF2FF',
                      color: '#4F46E5',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      ✓
                    </div>

                    {isEditingTitle ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <input
                          type="text"
                          value={tempChapterName}
                          onChange={(e) => setTempChapterName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditChapter(ch.chapterId); }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1.5px solid #4F46E5',
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            flex: 1
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEditChapter(ch.chapterId)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            backgroundColor: '#4F46E5',
                            color: '#FFFFFF',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setEditingChapterId(null)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            backgroundColor: '#F1F5F9',
                            color: '#64748B',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1E293B' }}>
                          Chapter {chIdx + 1} — {ch.chapterName}
                        </h4>
                        <button
                          onClick={() => handleStartEditChapter(ch)}
                          title="Edit Chapter Title"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94A3B8',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleRemoveChapter(ch.chapterId)}
                    title="Remove Chapter"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#EF4444',
                      cursor: 'pointer',
                      padding: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '6px'
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Topics List */}
                <div style={{
                  paddingLeft: '38px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {ch.topics.map((topic, topicIdx) => {
                    const topicKey = `${ch.chapterId}:${topicIdx}`;
                    const isEditingTopic = editingTopicKey === topicKey;

                    return (
                      <div
                        key={topicIdx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #F1F5F9'
                        }}
                      >
                        {isEditingTopic ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                            <input
                              type="text"
                              value={tempTopicName}
                              onChange={(e) => setTempTopicName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditTopic(ch.chapterId, topicIdx); }}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid #4F46E5',
                                fontSize: '0.85rem',
                                flex: 1
                              }}
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEditTopic(ch.chapterId, topicIdx)}
                              style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: '#4F46E5', color: '#FFF', border: 'none', cursor: 'pointer' }}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditingTopicKey(null)}
                              style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer' }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: '#4F46E5', fontSize: '1rem', lineHeight: 1 }}>•</span>
                              <span style={{ fontSize: '0.88rem', color: '#334155', fontWeight: 600 }}>
                                {topic}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                onClick={() => handleStartEditTopic(ch.chapterId, topicIdx, topic)}
                                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '2px' }}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleRemoveTopic(ch.chapterId, topicIdx)}
                                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '2px' }}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}

                  {/* Add Topic In Chapter */}
                  {newTopicChapterId === ch.chapterId ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <input
                        type="text"
                        placeholder="Enter topic name..."
                        value={newTopicInput}
                        onChange={(e) => setNewTopicInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddTopic(ch.chapterId); }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1.5px solid #4F46E5',
                          fontSize: '0.85rem',
                          flex: 1
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleAddTopic(ch.chapterId)}
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                      >
                        Add
                      </button>
                      <button
                        onClick={() => { setNewTopicChapterId(null); setNewTopicInput(''); }}
                        className="btn btn-outline"
                        style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setNewTopicChapterId(ch.chapterId); setNewTopicInput(''); }}
                      style={{
                        alignSelf: 'flex-start',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'transparent',
                        border: 'none',
                        color: '#4F46E5',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '4px 0',
                        marginTop: '4px'
                      }}
                    >
                      <Plus size={14} />
                      <span>Add Topic to Chapter</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Add Chapter Section */}
        {isAddingChapter ? (
          <div style={{
            padding: '20px 24px',
            borderRadius: '16px',
            backgroundColor: '#EEF2FF',
            border: '1.5px dashed #4F46E5',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#3730A3' }}>
              Add New Chapter for {activeSubject}
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                placeholder="e.g. Surface Areas and Volumes"
                value={newChapterInput}
                onChange={(e) => setNewChapterInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddChapter(); }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid #4F46E5',
                  fontSize: '0.92rem',
                  flex: 1
                }}
                autoFocus
              />
              <button
                onClick={handleAddChapter}
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '0.88rem' }}
              >
                Add Chapter
              </button>
              <button
                onClick={() => { setIsAddingChapter(false); setNewChapterInput(''); }}
                className="btn btn-outline"
                style={{ padding: '8px 16px', fontSize: '0.88rem' }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingChapter(true)}
            style={{
              padding: '14px 20px',
              borderRadius: '12px',
              border: '2px dashed #CBD5E1',
              backgroundColor: '#F8FAFC',
              color: '#4F46E5',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus size={16} />
            <span>Add Another Chapter to {activeSubject}</span>
          </button>
        )}
      </div>

      {/* Footer Confirm Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderRadius: '16px',
        backgroundColor: '#F8FAFC',
        border: '1px solid #E2E8F0',
        marginTop: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', fontSize: '0.85rem' }}>
          <AlertCircle size={16} color="#4F46E5" />
          <span>All edits are local to your plan and will be used to structure your diagnostic goals.</span>
        </div>

        <button
          onClick={() => onConfirm(editableMap)}
          disabled={totalChaptersAcrossSubjects === 0}
          style={{
            backgroundColor: '#4F46E5',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '10px',
            padding: '12px 24px',
            fontSize: '0.92rem',
            fontWeight: 800,
            cursor: totalChaptersAcrossSubjects === 0 ? 'not-allowed' : 'pointer',
            opacity: totalChaptersAcrossSubjects === 0 ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <CheckCircle2 size={16} />
          <span>Confirm & Continue to Chapter Selection</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
