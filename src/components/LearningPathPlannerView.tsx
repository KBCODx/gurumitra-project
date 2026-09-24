import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  BookOpen,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  FileText,
  Layers,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Check,
  Info,
  Clock,
  ExternalLink,
  Target,
  GraduationCap,
  Calendar,
  ShieldCheck,
  Award,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  X,
  Upload,
  ListFilter,
  Tag,
  HelpCircle
} from 'lucide-react';
import { useStudent } from '../context/StudentContext';
import { useAuth } from '../context/AuthContext';
import {
  SubjectType,
  ExtractedChapter,
  SubjectLearningProfile,
  LearningProfile,
  ChapterAnalysisItem,
  TopicAnalysisItem
} from '../types';
import {
  extractSyllabusPdfWithCache,
  validateSubjectRelevance,
  runAiSyllabusAnalysis,
  matchSyllabusWithAssessment
} from '../services/learningPathPlanningService';
import { mockCurriculum } from '../data/mockCurriculum';
import { getVerifiedChaptersForSubject, getCurriculumVersion } from '../services/curriculumDatabaseService';
import {
  generateDeterministicStudyPlan,
  calculateScheduleMetrics,
  getPerformanceCategory
} from '../services/deterministicSchedulingService';
import { ReviewSyllabusView, EditableSyllabusMap } from './ReviewSyllabusView';
import { normalizeGrade } from '../services/curriculumService';
import { saveStudentSyllabus, uploadSyllabusFile } from '../services/studentSyllabiService';
import { llmProvider } from '../services/llm/llmProvider';
import { extractTextFromFile, extractTopicsFromText } from '../services/fileProcessingService';
import { cleanExtractedText, cleanChapterTitle, isProseSentence, extractTopicsFromContentSlice } from '../lib/aiSyllabusParser';
import { extractTextFromPDF } from '../utils/pdfExtractor';

interface SubjectUploadState {
  file: File | null;
  fileName: string;
  fileSize: number;
  status: 'idle' | 'uploading' | 'extracting' | 'detecting' | 'ready' | 'error';
  progressMessage: string;
  errorMessage: string | null;
  extractedText: string;
  chapters: ExtractedChapter[];
  fromCache: boolean;
  analyzing: boolean;
  analysisComplete: boolean;
}

export const LearningPathPlannerView: React.FC = () => {
  const { user } = useAuth();
  const {
    student,
    preAssessmentResult,
    learningProfile,
    recordLearningProfile,
    plannerStep,
    setPlannerStep,
    selectedPlannerSubjects,
    setSelectedPlannerSubjects,
    setActiveTab,
    setActiveSubject,
    setTopicContext,
    recordLearningPlan,
    setSyllabusAnalysis
  } = useStudent();

  // All eligible subjects
  const availableSubjects: SubjectType[] = Array.from(
    new Set([
      ...(preAssessmentResult ? preAssessmentResult.questionPerformance.map(q => q.subject) : []),
      ...(student.preferredSubjects || ['Mathematics', 'Science'])
    ])
  ).filter(Boolean) as SubjectType[];

  // 1. Subject Selection State
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectType[]>(() => {
    if (selectedPlannerSubjects.length > 0) return selectedPlannerSubjects;
    if (preAssessmentResult) {
      const assessed = Array.from(new Set(preAssessmentResult.questionPerformance.map(q => q.subject))).filter(Boolean) as SubjectType[];
      if (assessed.length > 0) return assessed;
    }
    return availableSubjects.slice(0, 2);
  });

  // 5-step Flow State
  const [examDate, setExamDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toISOString().split('T')[0];
  });
  const [classLevel, setClassLevel] = useState<string>(() => student.grade || 'Class 10');
  const [board, setBoard] = useState<string>(() => student.board || 'CBSE');
  const [academicYear, setAcademicYear] = useState<string>('2026-27');
  const [dailyMinutesBudget, setDailyMinutesBudget] = useState<number>(120);

  // Selected chapters and topics per subject
  const [selectedChaptersBySubject, setSelectedChaptersBySubject] = useState<Record<string, string[]>>({});
  const [selectedTopicsByChapter, setSelectedTopicsByChapter] = useState<Record<string, string[]>>({});
  const [expandedCurriculumChapters, setExpandedCurriculumChapters] = useState<Record<string, boolean>>({});
  const [activeCurriculumSubjectTab, setActiveCurriculumSubjectTab] = useState<SubjectType | null>(null);

  // Topic Upload & Configuration Screen State
  const [activeTopicSubjectTab, setActiveTopicSubjectTab] = useState<SubjectType | null>(null);
  const [chapterTopicInputValues, setChapterTopicInputValues] = useState<Record<string, string>>({});
  const [chapterPasteOpenMap, setChapterPasteOpenMap] = useState<Record<string, boolean>>({});
  const [chapterPasteTextMap, setChapterPasteTextMap] = useState<Record<string, string>>({});
  const [chapterUploadStatusMap, setChapterUploadStatusMap] = useState<Record<string, { loading: boolean; message?: string; error?: string }>>({});
  const [batchSubjectUploadStatus, setBatchSubjectUploadStatus] = useState<Record<string, { loading: boolean; message?: string; error?: string }>>({});

  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // 2. Syllabus Upload State per Subject
  const [uploadMap, setUploadMap] = useState<Record<string, SubjectUploadState>>({});
  const [activeAnalysisSubject, setActiveAnalysisSubject] = useState<SubjectType | null>(null);

  // 3. UI Expand States for Analysis View
  const [expandedChapterIds, setExpandedChapterIds] = useState<Record<string, boolean>>({});
  const [evidenceChapterIds, setEvidenceChapterIds] = useState<Record<string, boolean>>({});

  // Ensure activeAnalysisSubject is set
  useEffect(() => {
    if (selectedSubjects.length > 0 && (!activeAnalysisSubject || !selectedSubjects.includes(activeAnalysisSubject))) {
      setActiveAnalysisSubject(selectedSubjects[0]);
    }
  }, [selectedSubjects, activeAnalysisSubject]);

  // Toggle subject selection
  const handleToggleSubject = (subject: SubjectType) => {
    setSelectedSubjects(prev => {
      if (prev.includes(subject)) {
        if (prev.length === 1) return prev; // Keep at least one selected
        return prev.filter(s => s !== subject);
      } else {
        return [...prev, subject];
      }
    });
  };

  // Helper to extract ExtractedChapter[] for a subject from existing syllabusData or curriculum
  const getExistingChaptersForSubject = (subject: SubjectType): ExtractedChapter[] => {
    const subData = student.syllabusData?.[subject];
    const rawTopics = (subData?.topics && subData.topics.length > 0)
      ? subData.topics
      : (mockCurriculum[subject]?.topics || []);

    if (Array.isArray(rawTopics) && rawTopics.length > 0) {
      return rawTopics.map((item: any, idx: number) => {
        if (typeof item === 'object' && item !== null && item.chapterName) {
          return item as ExtractedChapter;
        }
        const name = typeof item === 'string' ? item : (item.title || item.name || `Chapter ${idx + 1}`);
        const subTopics = (subData as any)?.examFocusedTopics?.[name] || [name];
        return {
          chapterId: `ch_${subject.toLowerCase().replace(/\s+/g, '_').slice(0, 4)}_${idx + 1}`,
          chapterName: name,
          subject,
          topics: subTopics,
          sourceMethod: 'heading_detection'
        };
      });
    }
    return [];
  };

  // Pre-populate uploadMap from existing syllabusData / detected chapters so it is immediately ready
  useEffect(() => {
    setUploadMap(prev => {
      let changed = false;
      const updated = { ...prev };

      availableSubjects.forEach(sub => {
        const subData = student.syllabusData?.[sub];
        const existingChapters = getExistingChaptersForSubject(sub);
        if (existingChapters.length > 0 && (!updated[sub] || updated[sub].status === 'idle' || updated[sub].chapters.length === 0)) {
          updated[sub] = {
            file: null,
            fileName: subData?.fileName || `${sub} Syllabus.pdf`,
            fileSize: subData?.fileSize || 1024 * 180,
            status: 'ready',
            progressMessage: `${existingChapters.length} chapters verified`,
            errorMessage: null,
            extractedText: subData?.extractedText || '',
            chapters: existingChapters,
            fromCache: true,
            analyzing: false,
            analysisComplete: true
          };
          changed = true;
        }
      });

      return changed ? updated : prev;
    });
  }, [student.syllabusData, availableSubjects]);

  // Date and Countdown Calculations using Deterministic Scheduling Engine
  const tomorrowDateStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  const scheduleMetrics = calculateScheduleMetrics(examDate);
  const daysRemaining = scheduleMetrics.remainingDays;
  const studyDays = scheduleMetrics.totalStudyDays;
  const sundays = scheduleMetrics.totalSundays;
  const bufferDays = scheduleMetrics.revisionDays;
  const hasConflict = scheduleMetrics.hasBufferConflict;
  const targetCompletionFormatted = new Date(scheduleMetrics.targetCompletionDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const formattedExamDate = new Date(examDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Synchronize curriculum chapters when subjects, academic profile, or uploaded syllabus changes
  useEffect(() => {
    const initChapters: Record<string, string[]> = {};
    const initTopics: Record<string, string[]> = {};

    selectedSubjects.forEach(sub => {
      const uploadedChs = (uploadMap[sub]?.chapters && uploadMap[sub].chapters.length > 0)
        ? uploadMap[sub].chapters
        : (student.syllabusData?.[sub]?.topics && student.syllabusData[sub].topics.length > 0
          ? getExistingChaptersForSubject(sub)
          : null);

      if (uploadedChs && uploadedChs.length > 0) {
        initChapters[sub] = uploadedChs.map(c => c.chapterName);
        uploadedChs.forEach(c => {
          initTopics[c.chapterName] = c.topics;
        });
      } else {
        const chs = getVerifiedChaptersForSubject(sub, board, classLevel, academicYear);
        initChapters[sub] = chs.map(c => c.name);
        chs.forEach(c => {
          initTopics[c.name] = c.topics.map(t => t.name);
        });
      }
    });

    setSelectedChaptersBySubject(prev => {
      const updated = { ...prev };
      selectedSubjects.forEach(sub => {
        const targetList = initChapters[sub] || [];
        const currentList = updated[sub] || [];
        const hasCustomUpload = (uploadMap[sub]?.chapters && uploadMap[sub].chapters.length > 0) ||
          (student.syllabusData?.[sub]?.topics && student.syllabusData[sub].topics.length > 0);

        if (currentList.length === 0 || (hasCustomUpload && (currentList.length !== targetList.length || !targetList.every(ch => currentList.includes(ch))))) {
          updated[sub] = targetList;
        }
      });
      return updated;
    });

    setSelectedTopicsByChapter(prev => ({ ...initTopics, ...prev }));
  }, [selectedSubjects, board, classLevel, academicYear, uploadMap, student.syllabusData]);

  // Set default activeCurriculumSubjectTab
  useEffect(() => {
    if (selectedSubjects.length > 0 && (!activeCurriculumSubjectTab || !selectedSubjects.includes(activeCurriculumSubjectTab))) {
      setActiveCurriculumSubjectTab(selectedSubjects[0]);
    }
  }, [selectedSubjects, activeCurriculumSubjectTab]);

  // "Complete Syllabus": select all chapters across all subjects
  const handleSelectCompleteSyllabus = () => {
    const allChMap: Record<string, string[]> = {};
    const allTopMap: Record<string, string[]> = {};
    selectedSubjects.forEach(sub => {
      const uploadedChs = (uploadMap[sub]?.chapters && uploadMap[sub].chapters.length > 0)
        ? uploadMap[sub].chapters
        : (student.syllabusData?.[sub]?.topics && student.syllabusData[sub].topics.length > 0
          ? getExistingChaptersForSubject(sub)
          : null);

      if (uploadedChs && uploadedChs.length > 0) {
        allChMap[sub] = uploadedChs.map(c => c.chapterName);
        uploadedChs.forEach(c => {
          allTopMap[c.chapterName] = c.topics;
        });
      } else {
        const chs = getVerifiedChaptersForSubject(sub, board, classLevel, academicYear);
        allChMap[sub] = chs.map(c => c.name);
        chs.forEach(c => {
          allTopMap[c.name] = c.topics.map(t => t.name);
        });
      }
    });
    setSelectedChaptersBySubject(allChMap);
    setSelectedTopicsByChapter(prev => ({ ...prev, ...allTopMap }));
  };

  // Toggle chapter in subject
  const handleToggleChapter = (sub: string, chapterName: string) => {
    setSelectedChaptersBySubject(prev => {
      const cur = prev[sub] || [];
      const updated = cur.includes(chapterName)
        ? cur.filter(c => c !== chapterName)
        : [...cur, chapterName];
      return { ...prev, [sub]: updated };
    });
  };

  // Select all chapters for active subject
  const handleSelectAllForSubject = (sub: string) => {
    const uploadedChs = (uploadMap[sub]?.chapters && uploadMap[sub].chapters.length > 0)
      ? uploadMap[sub].chapters
      : (student.syllabusData?.[sub]?.topics && student.syllabusData[sub].topics.length > 0
        ? getExistingChaptersForSubject(sub as SubjectType)
        : null);
    const allChs = (uploadedChs && uploadedChs.length > 0)
      ? uploadedChs.map(c => c.chapterName)
      : getVerifiedChaptersForSubject(sub as SubjectType, board, classLevel, academicYear).map(c => c.name);
    setSelectedChaptersBySubject(prev => ({ ...prev, [sub]: allChs }));
  };

  // Deselect all chapters for active subject
  const handleDeselectAllForSubject = (sub: string) => {
    setSelectedChaptersBySubject(prev => ({ ...prev, [sub]: [] }));
  };

  // Toggle topic in chapter
  const handleToggleTopic = (chapterName: string, topicName: string) => {
    setSelectedTopicsByChapter(prev => {
      const cur = prev[chapterName] || [];
      const updated = cur.includes(topicName)
        ? cur.filter(t => t !== topicName)
        : [...cur, topicName];
      return { ...prev, [chapterName]: updated };
    });
  };

  // Select all topics in chapter
  const handleSelectAllTopicsInChapter = (chapterName: string, allTopics: string[]) => {
    setSelectedTopicsByChapter(prev => ({ ...prev, [chapterName]: allTopics }));
  };

  // Total selected chapters count across all selected subjects
  const totalSelectedChaptersCount = Object.entries(selectedChaptersBySubject)
    .filter(([sub]) => selectedSubjects.includes(sub as SubjectType))
    .reduce((acc, [_, chs]) => acc + chs.length, 0);

  // Total available chapters count across all selected subjects (reflecting uploads)
  const totalAvailableChaptersCount = selectedSubjects.reduce((acc, sub) => {
    const uploadedChs = (uploadMap[sub]?.chapters && uploadMap[sub].chapters.length > 0)
      ? uploadMap[sub].chapters
      : (student.syllabusData?.[sub]?.topics && student.syllabusData[sub].topics.length > 0
        ? getExistingChaptersForSubject(sub)
        : null);
    const count = (uploadedChs && uploadedChs.length > 0)
      ? uploadedChs.length
      : getVerifiedChaptersForSubject(sub, board, classLevel, academicYear).length;
    return acc + count;
  }, 0);

  const hasAnyCustomUpload = selectedSubjects.some(sub =>
    (uploadMap[sub]?.chapters && uploadMap[sub].chapters.length > 0) ||
    (student.syllabusData?.[sub]?.topics && student.syllabusData[sub].topics.length > 0)
  );

  // Total topics configured across all selected chapters
  const totalConfiguredTopicsCount = selectedSubjects.reduce((acc, sub) => {
    const chs = selectedChaptersBySubject[sub] || [];
    return acc + chs.reduce((cAcc, chName) => {
      return cAcc + (selectedTopicsByChapter[chName]?.length || 0);
    }, 0);
  }, 0);

  // Synchronize active topic subject tab
  useEffect(() => {
    if (selectedSubjects.length > 0 && (!activeTopicSubjectTab || !selectedSubjects.includes(activeTopicSubjectTab))) {
      setActiveTopicSubjectTab(selectedSubjects[0]);
    }
  }, [selectedSubjects, activeTopicSubjectTab]);

  // Add single or comma-separated topics to a chapter
  const handleAddTopicToChapter = (chapterName: string, customText?: string) => {
    const raw = (customText !== undefined ? customText : (chapterTopicInputValues[chapterName] || '')).trim();
    if (!raw) return;

    const parts = raw
      .split(/[,;\n]/)
      .map(s => cleanChapterTitle(s.trim()))
      .filter(s => s.length >= 2 && !isProseSentence(s));

    if (parts.length === 0) return;

    setSelectedTopicsByChapter(prev => {
      const existing = prev[chapterName] || [];
      const updated = Array.from(new Set([...existing, ...parts]));
      return { ...prev, [chapterName]: updated };
    });

    setChapterTopicInputValues(prev => ({ ...prev, [chapterName]: '' }));
  };

  // Remove a topic from a chapter
  const handleRemoveTopicFromChapter = (chapterName: string, topicIndex: number) => {
    setSelectedTopicsByChapter(prev => {
      const existing = prev[chapterName] || [];
      const updated = existing.filter((_, idx) => idx !== topicIndex);
      return { ...prev, [chapterName]: updated };
    });
  };

  // Paste raw text / bullet points into chapter topics
  const handlePasteTopicsForChapter = (chapterName: string) => {
    const raw = (chapterPasteTextMap[chapterName] || '').trim();
    if (!raw) return;

    const parts = raw
      .split(/[\n,;•\-\*▪►\uF0B7\u2022\u25E6\u25AA\u25CF\u2023·]/)
      .map(s => cleanChapterTitle(s.trim()))
      .filter(s => s.length >= 3 && !isProseSentence(s));

    if (parts.length > 0) {
      setSelectedTopicsByChapter(prev => {
        const existing = prev[chapterName] || [];
        return {
          ...prev,
          [chapterName]: Array.from(new Set([...existing, ...parts]))
        };
      });
    }

    setChapterPasteTextMap(prev => ({ ...prev, [chapterName]: '' }));
    setChapterPasteOpenMap(prev => ({ ...prev, [chapterName]: false }));
  };

  // Upload a topic notes/file specifically for a single chapter
  const handleChapterFileUpload = async (file: File, subject: SubjectType, chapterName: string) => {
    setChapterUploadStatusMap(prev => ({
      ...prev,
      [chapterName]: { loading: true, message: `Extracting topics from ${file.name}...` }
    }));

    try {
      let text = '';
      if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
        const { rawText } = await extractTextFromPDF(file, subject);
        text = rawText;
      } else {
        text = await extractTextFromFile(file);
      }

      if (!text || text.trim().length < 15) {
        throw new Error('File contains insufficient readable text.');
      }

      const cleaned = cleanExtractedText(text);
      const extractedTopics = extractTopicsFromContentSlice(cleaned, chapterName);
      const parsedGeneral = extractTopicsFromText(cleaned, file.name);

      const candidateTopics = new Set<string>();
      if (extractedTopics && extractedTopics.length > 0) {
        extractedTopics.forEach(t => {
          if (t && t.length >= 3 && t.length <= 80 && !isProseSentence(t) && t.toLowerCase() !== chapterName.toLowerCase()) {
            candidateTopics.add(cleanChapterTitle(t));
          }
        });
      }

      if (parsedGeneral?.topics) {
        parsedGeneral.topics.forEach(t => {
          if (t.title && t.title.length >= 3 && !isProseSentence(t.title)) {
            candidateTopics.add(cleanChapterTitle(t.title));
          }
          if (t.concepts) {
            t.concepts.split(/[,.;\n]/).forEach(c => {
              const trimmed = cleanChapterTitle(c.trim());
              if (trimmed.length >= 3 && trimmed.length <= 60 && !isProseSentence(trimmed)) {
                candidateTopics.add(trimmed);
              }
            });
          }
        });
      }

      const newTopicsList = Array.from(candidateTopics).filter(Boolean);
      if (newTopicsList.length === 0) {
        const lines = cleaned.split('\n').map(l => cleanChapterTitle(l.trim())).filter(l => l.length >= 4 && l.length <= 60 && !isProseSentence(l));
        newTopicsList.push(...lines.slice(0, 6));
      }

      if (newTopicsList.length === 0) {
        throw new Error('No distinct topics detected. You can add topics manually using the input below.');
      }

      setSelectedTopicsByChapter(prev => {
        const existing = prev[chapterName] || [];
        const combined = Array.from(new Set([...existing, ...newTopicsList]));
        return {
          ...prev,
          [chapterName]: combined
        };
      });

      setChapterUploadStatusMap(prev => ({
        ...prev,
        [chapterName]: { loading: false, message: `✓ Added ${newTopicsList.length} topics from ${file.name}` }
      }));
    } catch (err: any) {
      setChapterUploadStatusMap(prev => ({
        ...prev,
        [chapterName]: { loading: false, error: err?.message || 'Failed to extract topics from file.' }
      }));
    }
  };

  // Upload document covering all chapters of a subject
  const handleSubjectTopicsDocUpload = async (file: File, subject: SubjectType) => {
    setBatchSubjectUploadStatus(prev => ({
      ...prev,
      [subject]: { loading: true, message: `Processing topic document ${file.name}...` }
    }));

    try {
      let text = '';
      if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
        const { rawText } = await extractTextFromPDF(file, subject);
        text = rawText;
      } else {
        text = await extractTextFromFile(file);
      }

      const cleaned = cleanExtractedText(text);
      const chsForSub = selectedChaptersBySubject[subject] || [];
      const updatedTopics: Record<string, string[]> = {};
      let totalAdded = 0;

      chsForSub.forEach(chName => {
        const slice = extractTopicsFromContentSlice(cleaned, chName);
        if (slice && slice.length > 0) {
          const cleanSlice = slice.map(s => cleanChapterTitle(s)).filter(s => s.length >= 3 && !isProseSentence(s));
          if (cleanSlice.length > 0) {
            updatedTopics[chName] = cleanSlice;
            totalAdded += cleanSlice.length;
          }
        }
      });

      if (totalAdded > 0) {
        setSelectedTopicsByChapter(prev => ({
          ...prev,
          ...updatedTopics
        }));
        setBatchSubjectUploadStatus(prev => ({
          ...prev,
          [subject]: { loading: false, message: `✓ Successfully populated topics across ${Object.keys(updatedTopics).length} chapters from ${file.name}!` }
        }));
      } else {
        const general = extractTopicsFromText(cleaned, file.name);
        if (general?.topics && general.topics.length > 0 && chsForSub.length > 0) {
          const topicsPerCh = Math.ceil(general.topics.length / chsForSub.length);
          chsForSub.forEach((chName, idx) => {
            const chunk = general.topics.slice(idx * topicsPerCh, (idx + 1) * topicsPerCh).map(t => t.title);
            if (chunk.length > 0) {
              updatedTopics[chName] = chunk;
            }
          });
          setSelectedTopicsByChapter(prev => ({
            ...prev,
            ...updatedTopics
          }));
          setBatchSubjectUploadStatus(prev => ({
            ...prev,
            [subject]: { loading: false, message: `✓ Distributed ${general.topics.length} topics across ${chsForSub.length} chapters!` }
          }));
        } else {
          throw new Error('Could not automatically distribute topics from this file. You can upload or add topics to individual chapters below.');
        }
      }
    } catch (err: any) {
      setBatchSubjectUploadStatus(prev => ({
        ...prev,
        [subject]: { loading: false, error: err?.message || 'Failed to process document.' }
      }));
    }
  };

  // Reset a subject's chapters to default verified curriculum topics
  const handleResetSubjectTopics = (subject: SubjectType) => {
    const defaultChs = getVerifiedChaptersForSubject(subject, board, classLevel, academicYear);
    const resetMap: Record<string, string[]> = {};
    defaultChs.forEach(c => {
      resetMap[c.name] = c.topics.map(t => t.name);
    });
    setSelectedTopicsByChapter(prev => ({
      ...prev,
      ...resetMap
    }));
  };

  // Generate Personalized Study Plan
  const handleGenerateStudyPlan = async () => {
    setIsGeneratingPlan(true);
    setGenerationError(null);

    try {
      const selectedCurriculumInput = selectedSubjects.map(sub => {
        const uploadedChs = (uploadMap[sub]?.chapters && uploadMap[sub].chapters.length > 0)
          ? uploadMap[sub].chapters
          : (student.syllabusData?.[sub]?.topics && student.syllabusData[sub].topics.length > 0
            ? getExistingChaptersForSubject(sub)
            : null);
        const availableChs = (uploadedChs && uploadedChs.length > 0)
          ? uploadedChs.map(c => ({
              id: c.chapterId,
              name: c.chapterName,
              topics: c.topics.map((t, idx) => ({ id: `top_${idx}`, name: t }))
            }))
          : getVerifiedChaptersForSubject(sub, board, classLevel, academicYear);

        const userSelectedChNames = new Set(selectedChaptersBySubject[sub] || availableChs.map(c => c.name));
        const filteredChs = availableChs
          .filter(c => userSelectedChNames.has(c.name))
          .map(c => {
            const userTopNames = (selectedTopicsByChapter[c.name] && selectedTopicsByChapter[c.name].length > 0)
              ? selectedTopicsByChapter[c.name]
              : (c.topics.length > 0 ? c.topics.map(t => t.name) : [c.name]);
            return {
              chapterName: c.name,
              topics: userTopNames
            };
          });

        return {
          subject: sub,
          chapters: filteredChs
        };
      });

      const generatedPlan = generateDeterministicStudyPlan({
        student: {
          id: user?.id || 'guest_student',
          name: student.name || 'Student',
          grade: classLevel,
          board: board,
          academicYear: academicYear
        },
        examDate,
        selectedSubjects,
        selectedCurriculum: selectedCurriculumInput,
        preAssessmentResult,
        dailyMinutesBudget,
        curriculumVersionId: `curriculum-${board.toLowerCase()}-${classLevel.replace(/\s+/g, '').toLowerCase()}-${academicYear}`
      });

      // Attempt server API enrichment
      try {
        const res = await fetch('/api/ai/study-plan/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student: {
              id: user?.id || 'guest_student',
              name: student.name,
              grade: classLevel,
              board,
              academicYear
            },
            examDate,
            selectedSubjects,
            selectedCurriculum: selectedCurriculumInput,
            preAssessmentResult,
            dailyMinutesBudget
          })
        });

        if (res.ok) {
          const apiData = await res.json();
          if (apiData.plan) {
            recordLearningPlan(apiData.plan);
            setIsGeneratingPlan(false);
            setActiveTab('learning-path');
            return;
          }
        }
      } catch (apiErr) {
        console.warn('Server API study-plan endpoint fallback to deterministic engine:', apiErr);
      }

      recordLearningPlan(generatedPlan);
      setIsGeneratingPlan(false);
      setActiveTab('learning-path');
    } catch (err: any) {
      console.error('Failed to generate study plan:', err);
      setGenerationError(err?.message || 'Unable to generate your learning plan. Please try again.');
      setIsGeneratingPlan(false);
    }
  };

  // Proceed with selected subjects to Step 2: Exam Date & Curriculum Setup
  const handleContinueWithSubjects = async () => {
    if (selectedSubjects.length === 0) return;
    setSelectedPlannerSubjects(selectedSubjects);
    setPlannerStep('exam-date');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Case A vs Case B Syllabus Logic
  const [missingSyllabusSubjects, setMissingSyllabusSubjects] = useState<SubjectType[]>([]);
  const signupGradeNorm = normalizeGrade(student.grade);
  const selectedGradeNorm = normalizeGrade(classLevel);
  const isSameClass = signupGradeNorm === selectedGradeNorm;

  const handleContinueFromExamDate = () => {
    if (!isSameClass) {
      // CASE B: Student selects a DIFFERENT class!
      // Must prompt subject-wise upload for each selected subject for this class
      const unready = selectedSubjects.filter(sub => {
        const state = uploadMap[sub];
        return !state || state.status !== 'ready' || state.chapters.length === 0;
      });

      if (unready.length > 0) {
        setMissingSyllabusSubjects(unready);
        setPlannerStep('upload');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    } else {
      // CASE A: Student selects the SAME class used during signup!
      // Check if any subject is missing syllabus (neither in uploadMap, nor in student.syllabusData, nor in verified curriculum)
      const missing = selectedSubjects.filter(sub => {
        const inUploadMap = uploadMap[sub]?.status === 'ready' && uploadMap[sub]?.chapters?.length > 0;
        const inSyllabusData = (student.syllabusData?.[sub]?.topics?.length || 0) > 0;
        const inVerified = getVerifiedChaptersForSubject(sub, board, classLevel, academicYear).length > 0;
        return !inUploadMap && !inSyllabusData && !inVerified;
      });

      if (missing.length > 0) {
        setMissingSyllabusSubjects(missing);
        setPlannerStep('upload');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    // All subjects have verified or uploaded syllabus -> go to Chapter Selection
    setPlannerStep('chapters');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Optional: open syllabus document analysis
  const handleOpenSyllabusAnalysis = async () => {
    const subjectsWithExistingSyllabus = selectedSubjects.filter(sub => {
      const existingInMap = uploadMap[sub]?.status === 'ready' && uploadMap[sub]?.chapters?.length > 0;
      const existingInSyllabusData = (student.syllabusData?.[sub]?.topics?.length || 0) > 0;
      const existingInCurriculum = (mockCurriculum[sub]?.topics?.length || 0) > 0;
      return existingInMap || existingInSyllabusData || existingInCurriculum;
    });

    if (subjectsWithExistingSyllabus.length > 0) {
      const currentProfiles = learningProfile ? { ...learningProfile.subjects } : ({} as Record<string, SubjectLearningProfile>);
      for (const sub of subjectsWithExistingSyllabus) {
        const chapters = uploadMap[sub]?.chapters && uploadMap[sub].chapters.length > 0
          ? uploadMap[sub].chapters
          : getExistingChaptersForSubject(sub);
        const fileName = uploadMap[sub]?.fileName || student.syllabusData?.[sub]?.fileName || `${sub} Syllabus.pdf`;
        const fileSize = uploadMap[sub]?.fileSize || student.syllabusData?.[sub]?.fileSize || 1024 * 180;
        const subProfile = matchSyllabusWithAssessment(chapters, preAssessmentResult, sub, fileName, fileSize);
        currentProfiles[sub] = subProfile;
      }
      recordLearningProfile({
        studentId: user?.id || 'guest_student',
        updatedAt: new Date().toISOString(),
        subjects: currentProfiles
      });
      setPlannerStep('analysis');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setPlannerStep('upload');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };


  // Handle syllabus or topic file selection for a subject
  const handleFileSelect = async (file: File, subject: SubjectType) => {
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    const isDoc = /\.(docx?|txt|text|md|rtf)$/i.test(file.name) ||
      ['text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/markdown'].includes(file.type);

    if (!isPdf && !isDoc) {
      setUploadMap(prev => ({
        ...prev,
        [subject]: {
          ...(prev[subject] || {}),
          file: null,
          fileName: file.name,
          fileSize: file.size,
          status: 'error',
          progressMessage: '',
          errorMessage: 'Supported file types: PDF, Word (.doc, .docx), Text (.txt, .md).',
          extractedText: '',
          chapters: [],
          fromCache: false,
          analyzing: false,
          analysisComplete: false
        }
      }));
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setUploadMap(prev => ({
        ...prev,
        [subject]: {
          ...(prev[subject] || {}),
          file: null,
          fileName: file.name,
          fileSize: file.size,
          status: 'error',
          progressMessage: '',
          errorMessage: 'File exceeds 25MB limit.',
          extractedText: '',
          chapters: [],
          fromCache: false,
          analyzing: false,
          analysisComplete: false
        }
      }));
      return;
    }

    // Step 1: Uploading
    setUploadMap(prev => ({
      ...prev,
      [subject]: {
        file,
        fileName: file.name,
        fileSize: file.size,
        status: 'uploading',
        progressMessage: 'Reading file...',
        errorMessage: null,
        extractedText: '',
        chapters: [],
        fromCache: false,
        analyzing: false,
        analysisComplete: false
      }
    }));

    try {
      // Step 2: Extracting
      await new Promise(r => setTimeout(r, 200));
      setUploadMap(prev => ({
        ...prev,
        [subject]: {
          ...prev[subject],
          status: 'extracting',
          progressMessage: 'Extracting content...'
        }
      }));

      let rawText = '';
      let chapters: ExtractedChapter[] = [];
      let fromCache = false;

      if (isPdf) {
        const extracted = await extractSyllabusPdfWithCache(file, subject);
        rawText = extracted.rawText;
        chapters = extracted.chapters;
        fromCache = extracted.fromCache;
      } else {
        const docText = await extractTextFromFile(file);
        rawText = cleanExtractedText(docText);
      }

      // Subject-specific validation (only flag when competing subject strongly dominates)
      const validation = validateSubjectRelevance(rawText, subject);
      if (!validation.isRelevant && rawText.length > 200 && validation.reason?.includes('instead of')) {
        setUploadMap(prev => ({
          ...prev,
          [subject]: {
            ...prev[subject],
            status: 'error',
            progressMessage: '',
            errorMessage: validation.reason || `This document does not appear to match ${subject}. Please upload the correct syllabus.`
          }
        }));
        return;
      }

      // Step 3: Extract structured chapters & topics
      setUploadMap(prev => ({
        ...prev,
        [subject]: {
          ...prev[subject],
          status: 'detecting',
          progressMessage: `Extracting curriculum chapters & topics...`
        }
      }));

      let finalChapters: ExtractedChapter[] = [];

      try {
        const aiExtraction = await llmProvider.extractSyllabus({
          rawText,
          subject,
          classLevel,
          board: student.board
        });

        if (aiExtraction && aiExtraction.chapters && aiExtraction.chapters.length > 0) {
          finalChapters = aiExtraction.chapters.map((ch: any, idx: number) => ({
            chapterId: `ch_${subject.toLowerCase().replace(/\s+/g, '_').slice(0, 4)}_${ch.chapterNumber || idx + 1}`,
            chapterName: ch.chapterName,
            subject,
            topics: (ch.topics || []).map((t: any) => typeof t === 'string' ? t : (t.topicName || String(t)))
          }));
        }
      } catch (aiErr) {
        console.warn('AI extraction fallback to local parser:', aiErr);
      }

      // Fallback 1: Use chapters parsed from PDF TOC / heading detection
      if (finalChapters.length === 0 && chapters && chapters.length > 0) {
        finalChapters = chapters;
      }

      // Fallback 2: Use general topic parser for notes/bullet-point uploads
      if (finalChapters.length === 0) {
        const parsedAnalysis = extractTopicsFromText(rawText, file.name);
        if (parsedAnalysis && parsedAnalysis.topics && parsedAnalysis.topics.length > 0) {
          finalChapters = parsedAnalysis.topics.map((t, idx) => {
            const concepts = t.concepts
              ? t.concepts.split(/[,.;\n]/).map(s => s.trim()).filter(s => s.length > 3).slice(0, 5)
              : [];
            return {
              chapterId: `ch_${subject.toLowerCase().replace(/\s+/g, '_').slice(0, 4)}_${idx + 1}`,
              chapterName: t.title,
              subject,
              topics: concepts.length > 0 ? [t.title, ...concepts] : [t.title],
              sourceMethod: 'heading_detection'
            };
          });
        }
      }

      // Fallback 3: Group line items
      if (finalChapters.length === 0) {
        const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 3 && l.length < 80);
        const cleanLines = lines.filter(l => !/^(page\s*\d+|\d+)$/i.test(l)).slice(0, 8);
        const docTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        if (cleanLines.length > 0) {
          finalChapters = [{
            chapterId: `ch_${subject.toLowerCase().replace(/\s+/g, '_').slice(0, 4)}_1`,
            chapterName: docTitle || `${subject} Topics`,
            subject,
            topics: cleanLines,
            sourceMethod: 'heading_detection'
          }];
        }
      }

      if (finalChapters.length === 0) {
        setUploadMap(prev => ({
          ...prev,
          [subject]: {
            ...prev[subject],
            status: 'error',
            progressMessage: '',
            errorMessage: 'No curriculum chapters or topics could be extracted from this file. Please ensure it contains readable text.'
          }
        }));
        return;
      }

      // Persist to database/storage record
      try {
        await saveStudentSyllabus({
          studentId: user?.id || 'guest_student',
          classLevel,
          subject,
          fileName: file.name,
          processingStatus: 'processed',
          extractedData: {
            chapters: finalChapters,
            rawText: rawText.slice(0, 3000)
          },
          extractedAt: new Date().toISOString()
        });
        await uploadSyllabusFile(user?.id || 'guest_student', classLevel, subject, file);
      } catch (saveErr) {
        console.warn('Student syllabus save error:', saveErr);
      }

      // Extraction complete & verified
      setUploadMap(prev => ({
        ...prev,
        [subject]: {
          file,
          fileName: file.name,
          fileSize: file.size,
          status: 'ready',
          progressMessage: `${finalChapters.length} chapters extracted`,
          errorMessage: null,
          extractedText: rawText,
          chapters: finalChapters,
          fromCache,
          analyzing: false,
          analysisComplete: false
        }
      }));

      // Immediately sync with selected chapters & topics for instant planner use
      setSelectedChaptersBySubject(prev => ({
        ...prev,
        [subject]: finalChapters.map(c => c.chapterName)
      }));

      const newTopMap: Record<string, string[]> = {};
      finalChapters.forEach(c => {
        newTopMap[c.chapterName] = c.topics;
      });
      setSelectedTopicsByChapter(prev => ({ ...prev, ...newTopMap }));

      // Save to student.syllabusData and localStorage
      const examFocusedTopics: Record<string, string[]> = {};
      finalChapters.forEach(c => {
        examFocusedTopics[c.chapterName] = c.topics;
      });

      const syllabusEntry = {
        subject,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        extractedText: rawText.slice(0, 5000),
        topics: finalChapters.map(c => c.chapterName),
        chapters: finalChapters,
        examFocusedTopics,
        analysisComplete: true
      };

      setSyllabusAnalysis(subject, syllabusEntry);
      try {
        const profileKey = user?.id ? `student_profile_${user.id}` : 'student_profile_guest';
        const existingStr = localStorage.getItem(profileKey);
        const existing = existingStr ? JSON.parse(existingStr) : {};
        existing.syllabusData = {
          ...(existing.syllabusData || {}),
          [subject]: syllabusEntry
        };
        existing.syllabusUploaded = true;
        localStorage.setItem(profileKey, JSON.stringify(existing));
      } catch (e) {}
    } catch (err: any) {
      setUploadMap(prev => ({
        ...prev,
        [subject]: {
          file,
          fileName: file.name,
          fileSize: file.size,
          status: 'error',
          progressMessage: '',
          errorMessage: err?.message || 'Failed to extract text from file.',
          extractedText: '',
          chapters: [],
          fromCache: false,
          analyzing: false,
          analysisComplete: false
        }
      }));
    }
  };

  // Run AI Analysis for a single subject
  const handleRunAiAnalysisForSubject = async (subject: SubjectType) => {
    const uploadState = uploadMap[subject];
    if (!uploadState || uploadState.status !== 'ready' || uploadState.chapters.length === 0) return;

    setUploadMap(prev => ({
      ...prev,
      [subject]: {
        ...prev[subject],
        analyzing: true,
        progressMessage: 'Analyzing your current understanding...'
      }
    }));

    try {
      const subjectProfile = await runAiSyllabusAnalysis(
        subject,
        uploadState.chapters,
        preAssessmentResult,
        uploadState.fileName,
        uploadState.fileSize
      );

      // Save into global learningProfile in StudentContext
      const currentProfiles = learningProfile ? { ...learningProfile.subjects } : ({} as Record<string, SubjectLearningProfile>);
      currentProfiles[subject] = subjectProfile;

      const newLearningProfile: LearningProfile = {
        studentId: user?.id || 'guest_student',
        updatedAt: new Date().toISOString(),
        subjects: currentProfiles
      };

      recordLearningProfile(newLearningProfile);

      setUploadMap(prev => ({
        ...prev,
        [subject]: {
          ...prev[subject],
          analyzing: false,
          analysisComplete: true,
          progressMessage: 'Analysis Complete'
        }
      }));

      setActiveAnalysisSubject(subject);
      setPlannerStep('analysis');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('AI Analysis failed:', err);
      setUploadMap(prev => ({
        ...prev,
        [subject]: {
          ...prev[subject],
          analyzing: false,
          errorMessage: 'AI Analysis encountered an issue. Using deterministic diagnostic mapping.'
        }
      }));
    }
  };

  // Run AI Analysis for all ready subjects
  const handleRunAllAiAnalysis = async () => {
    const readySubjects = selectedSubjects.filter(sub => uploadMap[sub]?.status === 'ready');
    if (readySubjects.length === 0) return;

    for (const sub of readySubjects) {
      await handleRunAiAnalysisForSubject(sub);
    }
    setPlannerStep('analysis');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Toggle chapter expandable details in Analysis view
  const toggleChapterExpand = (chapterId: string) => {
    setExpandedChapterIds(prev => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  const toggleEvidenceExpand = (chapterId: string) => {
    setEvidenceChapterIds(prev => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  // Current active subject profile in Analysis view
  const currentSubjectProfile: SubjectLearningProfile | null =
    activeAnalysisSubject && learningProfile?.subjects?.[activeAnalysisSubject]
      ? learningProfile.subjects[activeAnalysisSubject]
      : null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)', padding: '36px 20px 80px' }}>
      <div style={{ maxWidth: '1020px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>

        {/* Stepper Navigation Header */}
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: '20px 24px',
          borderRadius: '16px',
          border: '1.5px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4F46E5', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <GraduationCap size={16} />
              <span>Adaptive Curriculum Roadmap</span>
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#1E293B', margin: '4px 0 0' }}>
              Learning Path Planner & Syllabus Analysis
            </h1>
          </div>

          {/* Stepper Dots */}
          {/* Stepper Navigation: 1. Subjects -> 2. Exam Date -> 3. Chapters -> 4. Topics -> 5. Preferences -> 6. Generate Plan */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'subjects', num: 1, label: 'Subjects', enabled: true },
              { id: 'exam-date', num: 2, label: 'Exam Date', enabled: selectedSubjects.length > 0 },
              { id: 'chapters', num: 3, label: 'Chapters', enabled: selectedSubjects.length > 0 },
              { id: 'topics', num: 4, label: 'Topics', enabled: selectedSubjects.length > 0 && totalSelectedChaptersCount > 0 },
              { id: 'preferences', num: 5, label: 'Preferences', enabled: selectedSubjects.length > 0 },
              { id: 'generate', num: 6, label: 'Generate Plan', enabled: selectedSubjects.length > 0 }
            ].map((stepItem, idx, arr) => {
              const order = ['subjects', 'exam-date', 'chapters', 'topics', 'preferences', 'generate'];
              const currentIdx = order.indexOf(plannerStep);
              const isActive = plannerStep === stepItem.id;
              const isPast = currentIdx > idx;

              return (
                <React.Fragment key={stepItem.id}>
                  <button
                    onClick={() => {
                      if (stepItem.enabled) setPlannerStep(stepItem.id as any);
                    }}
                    disabled={!stepItem.enabled}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: isActive ? '#EEF2FF' : 'transparent',
                      color: isActive ? '#4F46E5' : isPast ? '#059669' : '#64748B',
                      fontWeight: isActive ? 800 : 600,
                      fontSize: '0.82rem',
                      cursor: stepItem.enabled ? 'pointer' : 'not-allowed',
                      opacity: stepItem.enabled ? 1 : 0.5
                    }}
                  >
                    <span style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: isActive ? '#4F46E5' : isPast ? '#10B981' : '#E2E8F0',
                      color: (isActive || isPast) ? '#FFFFFF' : '#64748B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                      fontWeight: 700
                    }}>
                      {isPast ? <Check size={12} strokeWidth={3} /> : stepItem.num}
                    </span>
                    <span>{stepItem.label}</span>
                  </button>
                  {idx < arr.length - 1 && <span style={{ color: '#CBD5E1', fontSize: '0.8rem' }}>→</span>}
                </React.Fragment>
              );
            })}

            {/* Optional shortcut to custom syllabus upload/analysis */}
            <div style={{ marginLeft: '12px', borderLeft: '1.5px solid #E2E8F0', paddingLeft: '12px' }}>
              <button
                onClick={handleOpenSyllabusAnalysis}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: (plannerStep === 'upload' || plannerStep === 'analysis') ? '#FEF3C7' : '#F8FAFC',
                  color: (plannerStep === 'upload' || plannerStep === 'analysis') ? '#92400E' : '#64748B',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Upload custom PDF syllabus documents for extraction & analysis"
              >
                <UploadCloud size={14} />
                <span>Upload PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* STEP 1: CHOOSE YOUR SUBJECTS */}
        {/* =================================================================== */}
        {plannerStep === 'subjects' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ textAlign: 'center', margin: '8px 0 16px' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                Choose Your Subjects
              </h2>
              <p style={{ color: '#64748B', fontSize: '1rem', marginTop: '6px' }}>
                Select the subjects you want to plan your learning journey for.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px' }}>
              {availableSubjects.map((sub) => {
                const isSelected = selectedSubjects.includes(sub);

                // Compute previous assessment score if tested
                let previousScore: number | null = null;
                let testedQuestionsCount = 0;
                if (preAssessmentResult) {
                  const subQuestions = preAssessmentResult.questionPerformance.filter(
                    q => q.subject.toLowerCase() === sub.toLowerCase()
                  );
                  if (subQuestions.length > 0) {
                    testedQuestionsCount = subQuestions.length;
                    previousScore = Math.round((subQuestions.filter(q => q.isCorrect).length / testedQuestionsCount) * 100);
                  }
                }

                // Check if existing syllabus chapters are known
                const existingChapters = student.syllabusData?.[sub]?.topics?.length || 0;

                return (
                  <div
                    key={sub}
                    onClick={() => handleToggleSubject(sub)}
                    className="card"
                    style={{
                      padding: '24px',
                      cursor: 'pointer',
                      borderRadius: '16px',
                      border: isSelected ? '2px solid #4F46E5' : '1.5px solid var(--border-subtle)',
                      backgroundColor: isSelected ? '#F5F7FF' : '#FFFFFF',
                      boxShadow: isSelected ? '0 8px 24px -4px rgba(79, 70, 229, 0.15)' : 'none',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          backgroundColor: isSelected ? '#EEF2FF' : '#F1F5F9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '22px'
                        }}>
                          {sub === 'Mathematics' && '📐'}
                          {sub === 'Science' && '🔬'}
                          {sub === 'English' && '📖'}
                          {sub === 'Computer Science' && '💻'}
                          {sub === 'Social Science' && '🌍'}
                          {!['Mathematics', 'Science', 'English', 'Computer Science', 'Social Science'].includes(sub) && '📚'}
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                            {sub}
                          </h3>
                          <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                            {testedQuestionsCount > 0 ? `${testedQuestionsCount} pre-assessment questions` : 'Diagnostic available'}
                          </span>
                        </div>
                      </div>

                      {/* Custom Checkbox */}
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        border: isSelected ? '2px solid #4F46E5' : '2px solid #CBD5E1',
                        backgroundColor: isSelected ? '#4F46E5' : '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF'
                      }}>
                        {isSelected && <Check size={16} strokeWidth={3} />}
                      </div>
                    </div>

                    <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        {previousScore !== null ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Current Understanding:</span>
                            <span style={{ fontSize: '0.86rem', fontWeight: 800, color: previousScore >= 70 ? '#059669' : previousScore >= 50 ? '#D97706' : '#DC2626' }}>
                              {previousScore}%
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Not yet diagnosed</span>
                        )}
                      </div>

                      {existingChapters > 0 && (
                        <span style={{ fontSize: '0.75rem', color: '#4F46E5', fontWeight: 600 }}>
                          {existingChapters} chapters detected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Step 1 Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                onClick={handleContinueWithSubjects}
                disabled={selectedSubjects.length === 0}
                style={{
                  backgroundColor: '#4F46E5',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 32px',
                  fontSize: '1rem',
                  fontWeight: 800,
                  cursor: selectedSubjects.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: selectedSubjects.length === 0 ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 8px 20px -4px rgba(79, 70, 229, 0.4)'
                }}
              >
                <span>Continue with these subjects ({selectedSubjects.length} selected)</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 2: EXAM DATE & CURRICULUM SETUP */}
        {/* =================================================================== */}
        {plannerStep === 'exam-date' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <button
                  onClick={() => setPlannerStep('subjects')}
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
                  <span>Back to Subject Selection</span>
                </button>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                  When is your nearest exam?
                </h2>
                <p style={{ color: '#64748B', fontSize: '0.92rem', marginTop: '2px' }}>
                  We calculate remaining study days, guarantee Sundays as rest days, and protect a 7-day pre-exam revision buffer.
                </p>
              </div>

              {/* Verified Curriculum Status Pill */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#ECFDF5',
                color: '#065F46',
                border: '1px solid #A7F3D0',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '0.82rem',
                fontWeight: 700
              }}>
                <ShieldCheck size={16} color="#059669" />
                <span>Verified {board} Curriculum ({academicYear})</span>
              </div>
            </div>

            {/* Exam Date Picker & Runway Calculations */}
            <div className="card" style={{ padding: '28px', borderRadius: '16px', border: '1.5px solid var(--border-subtle)', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#1E293B', marginBottom: '8px' }}>
                    Select Your Exam Date:
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="date"
                      min={tomorrowDateStr}
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: '2px solid #4F46E5',
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: '#1E293B',
                        backgroundColor: '#F8FAFC',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <p style={{ fontSize: '0.84rem', color: '#4F46E5', fontWeight: 700, marginTop: '8px' }}>
                    You have {daysRemaining} days until your exam ({formattedExamDate}).
                  </p>
                </div>

                {/* Runway Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <div style={{ backgroundColor: '#EEF2FF', padding: '16px', borderRadius: '12px', border: '1px solid #C7D2FE' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase' }}>
                      Days Remaining
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#312E81', marginTop: '2px' }}>
                      {daysRemaining} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Days</span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#6366F1', marginTop: '2px' }}>
                      Until your examination
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#F0FDF4', padding: '16px', borderRadius: '12px', border: '1px solid #BBF7D0' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16A34A', textTransform: 'uppercase' }}>
                      Study Days
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#14532D', marginTop: '2px' }}>
                      {studyDays} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Days</span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#16A34A', marginTop: '2px' }}>
                      Active learning runway
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#FEF3C7', padding: '16px', borderRadius: '12px', border: '1px solid #FDE68A' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#D97706', textTransform: 'uppercase' }}>
                      Sunday Rest Days
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#92400E', marginTop: '2px' }}>
                      {sundays} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Days</span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#B45309', marginTop: '2px' }}>
                      Guaranteed rest & recovery
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#F5F3FF', padding: '16px', borderRadius: '12px', border: '1px solid #DDD6FE' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase' }}>
                      Revision Window
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#4C1D95', marginTop: '2px' }}>
                      {bufferDays} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Days</span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#7C3AED', marginTop: '2px' }}>
                      Target: {targetCompletionFormatted}
                    </div>
                  </div>
                </div>
              </div>

              {/* Conflict Notification if less than 7 days */}
              {hasConflict && (
                <div style={{
                  marginTop: '20px',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FCD34D',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  <AlertCircle size={20} color="#D97706" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#92400E' }}>
                      Tight Exam Schedule Detected ({daysRemaining} days remaining)
                    </h4>
                    <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#B45309', lineHeight: 1.4 }}>
                      A full 7-day revision buffer cannot be achieved without exceeding the exam date. The adaptive scheduler has dynamically compressed the buffer to {bufferDays} days so you still get focused revision and high-yield weak topic practice.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Academic Profile: Class, Board, Academic Year */}
            <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1.5px solid var(--border-subtle)', backgroundColor: '#FFFFFF' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', margin: '0 0 16px' }}>
                Academic Curriculum & Board Settings
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Class / Grade
                  </label>
                  <select
                    value={classLevel}
                    onChange={(e) => setClassLevel(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: '#1E293B',
                      backgroundColor: '#FFFFFF'
                    }}
                  >
                    {['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Curriculum Board
                  </label>
                  <select
                    value={board}
                    onChange={(e) => setBoard(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: '#1E293B',
                      backgroundColor: '#FFFFFF'
                    }}
                  >
                    <option value="CBSE">CBSE (Central Board)</option>
                    <option value="ICSE">ICSE / CISCE</option>
                    <option value="NCERT">NCERT Core</option>
                    <option value="State Board">State Board</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Academic Year
                  </label>
                  <select
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: '#1E293B',
                      backgroundColor: '#FFFFFF'
                    }}
                  >
                    <option value="2026-27">2026–27 (Current Active)</option>
                    <option value="2025-26">2025–26 (Prior Session)</option>
                    <option value="2024-25">2024–25</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Daily Study Time Preference Selector (Section 21) */}
            <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1.5px solid var(--border-subtle)', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                    How much time can you study each day?
                  </h3>
                  <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '4px 0 0' }}>
                    We calibrate a realistic, sustainable schedule that avoids student burnout.
                  </p>
                </div>
                <div style={{
                  backgroundColor: '#EEF2FF',
                  color: '#4F46E5',
                  padding: '6px 14px',
                  borderRadius: '999px',
                  fontSize: '0.85rem',
                  fontWeight: 800
                }}>
                  {dailyMinutesBudget} Minutes / Day ({(dailyMinutesBudget / 60).toFixed(1)} hrs)
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                {[
                  { label: '1 Hour', minutes: 60, desc: 'Light pace' },
                  { label: '1.5 Hours', minutes: 90, desc: 'Balanced' },
                  { label: '2 Hours', minutes: 120, desc: 'Recommended' },
                  { label: '3 Hours', minutes: 180, desc: 'Intensive' },
                  { label: '4+ Hours', minutes: 240, desc: 'Sprint' }
                ].map(opt => {
                  const isSelected = dailyMinutesBudget === opt.minutes;
                  return (
                    <button
                      key={opt.minutes}
                      type="button"
                      onClick={() => setDailyMinutesBudget(opt.minutes)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: isSelected ? '2px solid #4F46E5' : '1.5px solid #E2E8F0',
                        backgroundColor: isSelected ? '#F5F7FF' : '#FFFFFF',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontSize: '0.96rem', fontWeight: 800, color: isSelected ? '#4F46E5' : '#1E293B' }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: isSelected ? '#6366F1' : '#64748B', marginTop: '2px' }}>
                        {opt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
              <button
                onClick={() => setPlannerStep('subjects')}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: '1.5px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Back to Subjects
              </button>

              <button
                onClick={handleContinueFromExamDate}
                style={{
                  backgroundColor: '#4F46E5',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 32px',
                  fontSize: '1rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 8px 20px -4px rgba(79, 70, 229, 0.4)'
                }}
              >
                <span>Continue to Chapter Selection</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 3: CHAPTER & TOPIC SELECTION FROM VERIFIED CURRICULUM */}
        {/* =================================================================== */}
        {plannerStep === 'chapters' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <button
                  onClick={() => setPlannerStep('exam-date')}
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
                  <span>Back to Exam Date</span>
                </button>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                  Select Chapters & Topics
                </h2>
                <p style={{ color: '#64748B', fontSize: '0.92rem', marginTop: '2px' }}>
                  {hasAnyCustomUpload
                    ? `Grounded in your uploaded syllabus. Total ${totalSelectedChaptersCount} of ${totalAvailableChaptersCount} chapters selected.`
                    : `Grounded strictly in verified ${board} ${classLevel} (${academicYear}) curriculum. Total ${totalSelectedChaptersCount} of ${totalAvailableChaptersCount} chapters selected.`}
                </p>
              </div>

              {/* Upload Button and Complete Syllabus Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setPlannerStep('upload');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  style={{
                    backgroundColor: '#F8FAFC',
                    color: '#475569',
                    border: '1.5px solid #CBD5E1',
                    borderRadius: '10px',
                    padding: '10px 16px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <UploadCloud size={16} />
                  <span>Upload / Change Syllabus</span>
                </button>
                <button
                  onClick={handleSelectCompleteSyllabus}
                  style={{
                    backgroundColor: '#EEF2FF',
                    color: '#4F46E5',
                    border: '1.5px solid #C7D2FE',
                    borderRadius: '10px',
                    padding: '10px 18px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <CheckSquare size={16} />
                  <span>Select Complete Syllabus</span>
                </button>
              </div>
            </div>

            {/* Subject Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #E2E8F0', paddingBottom: '8px' }}>
              {selectedSubjects.map(sub => {
                const isActive = (activeCurriculumSubjectTab || selectedSubjects[0]) === sub;
                const count = (selectedChaptersBySubject[sub] || []).length;
                const uploadedChs = (uploadMap[sub]?.chapters && uploadMap[sub].chapters.length > 0)
                  ? uploadMap[sub].chapters
                  : (student.syllabusData?.[sub]?.topics && student.syllabusData[sub].topics.length > 0
                    ? getExistingChaptersForSubject(sub)
                    : null);
                const totalInSub = (uploadedChs && uploadedChs.length > 0)
                  ? uploadedChs.length
                  : getVerifiedChaptersForSubject(sub, board, classLevel, academicYear).length;

                return (
                  <button
                    key={sub}
                    onClick={() => setActiveCurriculumSubjectTab(sub)}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: isActive ? '#4F46E5' : 'transparent',
                      color: isActive ? '#FFFFFF' : '#64748B',
                      fontSize: '0.92rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{sub}</span>
                    <span style={{
                      backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : '#F1F5F9',
                      color: isActive ? '#FFFFFF' : '#475569',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem'
                    }}>
                      {count} / {totalInSub}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Subject Chapters List */}
            {(() => {
              const currentSubject = activeCurriculumSubjectTab || selectedSubjects[0];
              const uploadedChapters = (uploadMap[currentSubject]?.chapters && uploadMap[currentSubject].chapters.length > 0)
                ? uploadMap[currentSubject].chapters
                : (student.syllabusData?.[currentSubject]?.topics && student.syllabusData[currentSubject].topics.length > 0
                  ? getExistingChaptersForSubject(currentSubject)
                  : null);
              const verifiedChapters = (uploadedChapters && uploadedChapters.length > 0)
                ? uploadedChapters.map((c, i) => ({
                    id: c.chapterId || `ch_${i + 1}`,
                    chapterNumber: (c as any).chapterNumber || (i + 1),
                    name: c.chapterName,
                    description: '',
                    topics: (c.topics || []).map((t, ti) => ({
                      id: `top_${c.chapterId || i}_${ti}`,
                      name: typeof t === 'string' ? t : ((t as any).name || (t as any).topicName || `Topic ${ti + 1}`),
                      subtopics: (t as any)?.subtopics || []
                    }))
                  }))
                : getVerifiedChaptersForSubject(currentSubject, board, classLevel, academicYear);
              const selectedChs = selectedChaptersBySubject[currentSubject] || [];

              if (verifiedChapters.length === 0) {
                return (
                  <div style={{
                    padding: '40px 24px',
                    textAlign: 'center',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '16px',
                    border: '1.5px dashed #CBD5E1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <BookOpen size={40} color="#64748B" />
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                        Syllabus for {currentSubject} is not available yet
                      </h3>
                      <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '4px 0 0', maxWidth: '460px' }}>
                        Please upload your official syllabus PDF to auto-extract the actual chapters and topics for this subject.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setPlannerStep('upload');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{
                        backgroundColor: '#4F46E5',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '10px 22px',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginTop: '8px'
                      }}
                    >
                      <UploadCloud size={16} />
                      <span>Upload {currentSubject} Syllabus</span>
                    </button>
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Select All / Deselect All for this Subject */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                    <span style={{ fontSize: '0.86rem', color: '#64748B', fontWeight: 600 }}>
                      Showing {verifiedChapters.length} actual chapters for {currentSubject}:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={() => handleSelectAllForSubject(currentSubject)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#4F46E5',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Select All
                      </button>
                      <span style={{ color: '#CBD5E1' }}>•</span>
                      <button
                        onClick={() => handleDeselectAllForSubject(currentSubject)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#64748B',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {/* Chapter Accordion Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {verifiedChapters.map(ch => {
                      const isSelected = selectedChs.includes(ch.name);
                      const isExpanded = !!expandedCurriculumChapters[ch.name];
                      const selectedTopics = selectedTopicsByChapter[ch.name] || ch.topics.map(t => t.name);

                      // Check pre-assessment performance for chapter
                      let chapterScore: number | null = null;
                      if (preAssessmentResult) {
                        if (preAssessmentResult.chapterPerformance && preAssessmentResult.chapterPerformance[ch.name]) {
                          chapterScore = preAssessmentResult.chapterPerformance[ch.name].accuracy;
                        } else {
                          const related = preAssessmentResult.questionPerformance.filter(
                            q => q.subject.toLowerCase() === currentSubject.toLowerCase() &&
                                 (q.chapterName || '').toLowerCase() === ch.name.toLowerCase()
                          );
                          if (related.length > 0) {
                            chapterScore = Math.round((related.filter(q => q.isCorrect).length / related.length) * 100);
                          }
                        }
                      }

                      return (
                        <div
                          key={ch.name}
                          style={{
                            borderRadius: '14px',
                            border: isSelected ? '1.5px solid #4F46E5' : '1.5px solid var(--border-subtle)',
                            backgroundColor: isSelected ? '#FFFFFF' : '#FAFAFA',
                            boxShadow: isSelected ? '0 4px 12px rgba(79, 70, 229, 0.06)' : 'none',
                            transition: 'all 0.2s ease',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Chapter Header */}
                          <div style={{
                            padding: '16px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            backgroundColor: isSelected ? '#FAFBFF' : 'transparent'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                              {/* Chapter Checkbox */}
                              <div
                                onClick={() => handleToggleChapter(currentSubject, ch.name)}
                                style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '6px',
                                  border: isSelected ? '2px solid #4F46E5' : '2px solid #CBD5E1',
                                  backgroundColor: isSelected ? '#4F46E5' : '#FFFFFF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#FFFFFF',
                                  cursor: 'pointer',
                                  flexShrink: 0
                                }}
                              >
                                {isSelected && <Check size={14} strokeWidth={3} />}
                              </div>

                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6366F1', textTransform: 'uppercase' }}>
                                    Chapter {ch.chapterNumber}
                                  </span>
                                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1E293B' }}>
                                    {ch.name}
                                  </h4>

                                  {/* Diagnostic Score Tag */}
                                  {chapterScore !== null && (
                                    <span style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 800,
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      backgroundColor: chapterScore >= 75 ? '#DCFCE7' : chapterScore >= 50 ? '#FEF3C7' : '#FEE2E2',
                                      color: chapterScore >= 75 ? '#15803D' : chapterScore >= 50 ? '#B45309' : '#B91C1C'
                                    }}>
                                      Diagnostic: {chapterScore}% ({getPerformanceCategory(chapterScore)})
                                    </span>
                                  )}
                                </div>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                                  {ch.description} • {ch.topics.length} topics
                                </p>
                              </div>
                            </div>

                            {/* Expand Topics Chevron */}
                            <button
                              onClick={() => setExpandedCurriculumChapters(prev => ({ ...prev, [ch.name]: !prev[ch.name] }))}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: '1px solid #E2E8F0',
                                backgroundColor: '#FFFFFF',
                                color: '#475569',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              <span>{isExpanded ? 'Hide Topics' : `View Topics (${selectedTopics.length}/${ch.topics.length})`}</span>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          </div>

                          {/* Expanded Topics Checklist */}
                          {isExpanded && (
                            <div style={{
                              padding: '16px 20px 20px',
                              backgroundColor: '#FFFFFF',
                              borderTop: '1px solid #E2E8F0',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                                  Verified Curriculum Topics ({ch.topics.length})
                                </span>
                                <button
                                  onClick={() => handleSelectAllTopicsInChapter(ch.name, ch.topics.map(t => t.name))}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#4F46E5',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Select All Topics
                                </button>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' }}>
                                {ch.topics.map(topic => {
                                  const isTopicSelected = selectedTopics.includes(topic.name);
                                  return (
                                    <div
                                      key={topic.name}
                                      onClick={() => handleToggleTopic(ch.name, topic.name)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: isTopicSelected ? '1px solid #C7D2FE' : '1px solid #E2E8F0',
                                        backgroundColor: isTopicSelected ? '#F5F7FF' : '#FFFFFF',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: '18px',
                                          height: '18px',
                                          borderRadius: '4px',
                                          border: isTopicSelected ? '2px solid #4F46E5' : '1.5px solid #CBD5E1',
                                          backgroundColor: isTopicSelected ? '#4F46E5' : '#FFFFFF',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: '#FFFFFF',
                                          flexShrink: 0
                                        }}
                                      >
                                        {isTopicSelected && <Check size={12} strokeWidth={3} />}
                                      </div>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1E293B' }}>
                                        {topic.name}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
              <button
                onClick={() => setPlannerStep('exam-date')}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: '1.5px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Back to Exam Date
              </button>

              <button
                onClick={() => {
                  setPlannerStep('topics');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={totalSelectedChaptersCount === 0}
                style={{
                  backgroundColor: '#4F46E5',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 32px',
                  fontSize: '1rem',
                  fontWeight: 800,
                  cursor: totalSelectedChaptersCount === 0 ? 'not-allowed' : 'pointer',
                  opacity: totalSelectedChaptersCount === 0 ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 8px 20px -4px rgba(79, 70, 229, 0.4)'
                }}
              >
                <span>Continue to Configure Topics ({totalSelectedChaptersCount} chapters)</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 4: TOPIC UPLOAD & CHAPTER-WISE CONFIGURATION */}
        {/* =================================================================== */}
        {plannerStep === 'topics' && (() => {
          const currentSubject: SubjectType = (activeTopicSubjectTab && selectedSubjects.includes(activeTopicSubjectTab))
            ? activeTopicSubjectTab
            : (selectedSubjects[0] || 'Mathematics');
          const currentChapters = selectedChaptersBySubject[currentSubject] || [];

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Header and Title */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <button
                    onClick={() => {
                      setPlannerStep('chapters');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
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
                    <span>Back to Chapter Selection</span>
                  </button>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                    Chapter-Wise Topic Upload & Configuration
                  </h2>
                  <p style={{ color: '#64748B', fontSize: '0.92rem', marginTop: '2px' }}>
                    Review topics detected for your selected chapters, upload chapter-wise notes or documents, or add custom topics directly.
                    Your daily study plan will schedule learning sessions using these exact topics.
                  </p>
                </div>

                {/* Counters and Status Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#EEF2FF',
                    color: '#4F46E5',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    border: '1px solid #E0E7FF'
                  }}>
                    <BookOpen size={16} />
                    <span>{totalSelectedChaptersCount} Selected Chapters</span>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#ECFDF5',
                    color: '#059669',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    border: '1px solid #D1FAE5'
                  }}>
                    <Tag size={16} />
                    <span>{totalConfiguredTopicsCount} Total Topics Configured</span>
                  </div>
                </div>
              </div>

              {/* Subject Tabs */}
              {selectedSubjects.length > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderBottom: '2px solid #E2E8F0',
                  paddingBottom: '2px',
                  overflowX: 'auto'
                }}>
                  {selectedSubjects.map(sub => {
                    const isActive = sub === currentSubject;
                    const chCount = (selectedChaptersBySubject[sub] || []).length;
                    const topCount = (selectedChaptersBySubject[sub] || []).reduce((acc, ch) => acc + (selectedTopicsByChapter[ch]?.length || 0), 0);

                    return (
                      <button
                        key={sub}
                        onClick={() => setActiveTopicSubjectTab(sub)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 18px',
                          border: 'none',
                          borderBottom: isActive ? '3px solid #4F46E5' : '3px solid transparent',
                          backgroundColor: isActive ? '#EEF2FF' : 'transparent',
                          color: isActive ? '#4F46E5' : '#64748B',
                          fontWeight: isActive ? 800 : 600,
                          fontSize: '0.9rem',
                          borderRadius: '8px 8px 0 0',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <span>{sub}</span>
                        <span style={{
                          backgroundColor: isActive ? '#4F46E5' : '#E2E8F0',
                          color: isActive ? '#FFFFFF' : '#64748B',
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 700
                        }}>
                          {chCount} ch • {topCount} topics
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Subject Batch Action Toolbar */}
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                border: '1.5px solid var(--border-subtle)',
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B' }}>
                      {currentSubject} Topic Roadmap
                    </span>
                    <span style={{
                      backgroundColor: '#F1F5F9',
                      color: '#475569',
                      padding: '2px 10px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 700
                    }}>
                      {currentChapters.length} Chapters Active
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748B' }}>
                    Upload a syllabus or notes document to automatically distribute topics across chapters, or configure each chapter below.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Batch Upload Button */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#F8FAFC',
                    border: '1.5px solid #CBD5E1',
                    color: '#334155',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}>
                    <Upload size={15} color="#4F46E5" />
                    <span>Upload Topic Document for {currentSubject}</span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc,.txt,.text,.md"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleSubjectTopicsDocUpload(file, currentSubject);
                        e.target.value = '';
                      }}
                    />
                  </label>

                  {/* Reset to Curriculum Button */}
                  <button
                    onClick={() => handleResetSubjectTopics(currentSubject)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      color: '#64748B',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    title="Reset this subject's topics back to verified curriculum defaults"
                  >
                    <RotateCcw size={14} />
                    <span>Reset to Standard Curriculum</span>
                  </button>
                </div>

                {/* Batch Upload Feedback */}
                {batchSubjectUploadStatus[currentSubject] && (
                  <div style={{ width: '100%', marginTop: '4px' }}>
                    {batchSubjectUploadStatus[currentSubject].loading && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4F46E5', fontSize: '0.84rem' }}>
                        <Loader2 size={16} className="spin" />
                        <span>{batchSubjectUploadStatus[currentSubject].message}</span>
                      </div>
                    )}
                    {batchSubjectUploadStatus[currentSubject].message && !batchSubjectUploadStatus[currentSubject].loading && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontSize: '0.84rem', fontWeight: 600 }}>
                        <CheckCircle2 size={16} />
                        <span>{batchSubjectUploadStatus[currentSubject].message}</span>
                      </div>
                    )}
                    {batchSubjectUploadStatus[currentSubject].error && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', fontSize: '0.84rem' }}>
                        <AlertCircle size={16} />
                        <span>{batchSubjectUploadStatus[currentSubject].error}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Chapters List */}
              {currentChapters.length === 0 ? (
                <div style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  padding: '40px 20px',
                  textAlign: 'center',
                  border: '1.5px dashed #CBD5E1'
                }}>
                  <BookOpen size={40} color="#94A3B8" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#334155', fontWeight: 700 }}>
                    No chapters selected for {currentSubject}
                  </h3>
                  <p style={{ margin: '6px 0 16px', color: '#64748B', fontSize: '0.88rem' }}>
                    Please return to chapter selection to choose chapters for this subject.
                  </p>
                  <button
                    onClick={() => {
                      setPlannerStep('chapters');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{
                      backgroundColor: '#4F46E5',
                      color: '#FFFFFF',
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer'
                    }}
                  >
                    Select Chapters
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {currentChapters.map((chapterName, chIdx) => {
                    const topics = selectedTopicsByChapter[chapterName] || [];
                    const uploadStatus = chapterUploadStatusMap[chapterName];
                    const isPasteOpen = !!chapterPasteOpenMap[chapterName];

                    return (
                      <div
                        key={chapterName}
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: '16px',
                          border: '1.5px solid var(--border-subtle)',
                          padding: '20px 24px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                        }}
                      >
                        {/* Chapter Card Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              backgroundColor: '#EEF2FF',
                              color: '#4F46E5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.85rem'
                            }}>
                              {chIdx + 1}
                            </div>
                            <div>
                              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B' }}>
                                {chapterName}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: topics.length > 0 ? '#059669' : '#D97706', fontWeight: 600 }}>
                                {topics.length} topic{topics.length === 1 ? '' : 's'} assigned
                              </div>
                            </div>
                          </div>

                          {/* Quick Action Buttons for Chapter */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {/* Upload File for this Chapter */}
                            <label style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              backgroundColor: '#EEF2FF',
                              border: '1px solid #C7D2FE',
                              color: '#4338CA',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}>
                              <Upload size={14} />
                              <span>Upload Topic Notes</span>
                              <input
                                type="file"
                                accept=".pdf,.docx,.doc,.txt,.text,.md"
                                style={{ display: 'none' }}
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleChapterFileUpload(file, currentSubject, chapterName);
                                  e.target.value = '';
                                }}
                              />
                            </label>

                            {/* Paste Topics Button */}
                            <button
                              onClick={() => setChapterPasteOpenMap(prev => ({ ...prev, [chapterName]: !prev[chapterName] }))}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                backgroundColor: isPasteOpen ? '#F1F5F9' : '#FFFFFF',
                                border: '1px solid #CBD5E1',
                                color: '#475569',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              <FileText size={14} />
                              <span>{isPasteOpen ? 'Close Paste' : 'Paste Topics'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Chapter File Upload Feedback */}
                        {uploadStatus && (
                          <div style={{ fontSize: '0.82rem' }}>
                            {uploadStatus.loading && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4F46E5' }}>
                                <Loader2 size={14} className="spin" />
                                <span>{uploadStatus.message}</span>
                              </div>
                            )}
                            {uploadStatus.message && !uploadStatus.loading && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontWeight: 600 }}>
                                <CheckCircle2 size={14} />
                                <span>{uploadStatus.message}</span>
                              </div>
                            )}
                            {uploadStatus.error && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626' }}>
                                <AlertCircle size={14} />
                                <span>{uploadStatus.error}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Paste Topics Box */}
                        {isPasteOpen && (
                          <div style={{
                            backgroundColor: '#F8FAFC',
                            borderRadius: '10px',
                            padding: '14px',
                            border: '1px solid #E2E8F0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                          }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                              Paste topic list, notes headings, or bullet points for {chapterName}:
                            </div>
                            <textarea
                              rows={3}
                              value={chapterPasteTextMap[chapterName] || ''}
                              onChange={e => setChapterPasteTextMap(prev => ({ ...prev, [chapterName]: e.target.value }))}
                              placeholder="e.g. Fundamental Theorem of Arithmetic&#10;Proof of irrationality of √2&#10;Decimal expansions of rational numbers"
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1.5px solid #CBD5E1',
                                fontSize: '0.84rem',
                                outline: 'none',
                                boxSizing: 'border-box'
                              }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                onClick={() => handlePasteTopicsForChapter(chapterName)}
                                style={{
                                  backgroundColor: '#4F46E5',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  padding: '6px 14px',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                Extract & Add Topics
                              </button>
                              <button
                                onClick={() => setChapterPasteOpenMap(prev => ({ ...prev, [chapterName]: false }))}
                                style={{
                                  backgroundColor: 'transparent',
                                  border: '1px solid #CBD5E1',
                                  color: '#64748B',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Topic Pills List */}
                        <div>
                          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
                            Topics to be Scheduled ({topics.length}):
                          </div>

                          {topics.length === 0 ? (
                            <div style={{ fontSize: '0.84rem', color: '#94A3B8', fontStyle: 'italic', padding: '6px 0' }}>
                              No topics added yet. Add topics below or upload notes.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              {topics.map((topName, topIdx) => (
                                <span
                                  key={`${chapterName}_${topIdx}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    backgroundColor: '#F8FAFC',
                                    border: '1.5px solid #E2E8F0',
                                    color: '#334155',
                                    padding: '5px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.82rem',
                                    fontWeight: 600
                                  }}
                                >
                                  <span>{topName}</span>
                                  <button
                                    onClick={() => handleRemoveTopicFromChapter(chapterName, topIdx)}
                                    title={`Remove "${topName}"`}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#94A3B8',
                                      cursor: 'pointer',
                                      padding: 0,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                  >
                                    <X size={13} strokeWidth={2.5} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Inline Add Topic Input */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '4px',
                          borderTop: '1px solid #F1F5F9',
                          paddingTop: '12px'
                        }}>
                          <input
                            type="text"
                            value={chapterTopicInputValues[chapterName] || ''}
                            onChange={e => setChapterTopicInputValues(prev => ({ ...prev, [chapterName]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddTopicToChapter(chapterName);
                              }
                            }}
                            placeholder="Add topic (type name and press Enter, or enter multiple separated by commas)..."
                            style={{
                              flex: 1,
                              padding: '8px 14px',
                              borderRadius: '8px',
                              border: '1.5px solid #CBD5E1',
                              fontSize: '0.85rem',
                              outline: 'none'
                            }}
                          />
                          <button
                            onClick={() => handleAddTopicToChapter(chapterName)}
                            disabled={!(chapterTopicInputValues[chapterName] || '').trim()}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: (chapterTopicInputValues[chapterName] || '').trim() ? '#4F46E5' : '#E2E8F0',
                              color: (chapterTopicInputValues[chapterName] || '').trim() ? '#FFFFFF' : '#94A3B8',
                              border: 'none',
                              padding: '8px 16px',
                              borderRadius: '8px',
                              fontSize: '0.84rem',
                              fontWeight: 700,
                              cursor: (chapterTopicInputValues[chapterName] || '').trim() ? 'pointer' : 'not-allowed',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Plus size={15} />
                            <span>Add</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bottom Navigation */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '12px',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <button
                  onClick={() => {
                    setPlannerStep('chapters');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '10px',
                    border: '1.5px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ← Back to Chapter Selection
                </button>

                <button
                  onClick={() => {
                    setPlannerStep('preferences');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  style={{
                    backgroundColor: '#4F46E5',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px 34px',
                    fontSize: '1rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 8px 20px -4px rgba(79, 70, 229, 0.4)'
                  }}
                >
                  <span>Continue to Study Preferences ({totalConfiguredTopicsCount} topics across {totalSelectedChaptersCount} chapters)</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          );
        })()}

        {/* =================================================================== */}
        {/* STEP 5: STUDY PREFERENCES & SCHEDULING RULES */}
        {/* =================================================================== */}
        {plannerStep === 'preferences' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <button
                  onClick={() => {
                    setPlannerStep('topics');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
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
                  <span>Back to Topics</span>
                </button>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                  Study Preferences & Guarantees
                </h2>
                <p style={{ color: '#64748B', fontSize: '0.92rem', marginTop: '2px' }}>
                  Define your daily study capacity. Antigravity AI automatically enforces rest and revision rules.
                </p>
              </div>
            </div>

            {/* Daily Minutes Budget Card */}
            <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1.5px solid var(--border-subtle)', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Clock size={20} color="#4F46E5" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1E293B' }}>
                  Target Daily Study Time
                </h3>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: '#64748B' }}>
                How much focused study time can you dedicate per regular study day? Weak topics automatically receive relatively more learning and practice time.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {[
                  { mins: 60, label: '60 min (1 hour)' },
                  { mins: 90, label: '90 min (1.5 hours)' },
                  { mins: 120, label: '120 min (2 hours)' },
                  { mins: 150, label: '150 min (2.5 hours)' },
                  { mins: 180, label: '180 min (3 hours)' }
                ].map(opt => (
                  <button
                    key={opt.mins}
                    onClick={() => setDailyMinutesBudget(opt.mins)}
                    style={{
                      padding: '12px 20px',
                      borderRadius: '12px',
                      border: dailyMinutesBudget === opt.mins ? '2px solid #4F46E5' : '1.5px solid #CBD5E1',
                      backgroundColor: dailyMinutesBudget === opt.mins ? '#EEF2FF' : '#FFFFFF',
                      color: dailyMinutesBudget === opt.mins ? '#4F46E5' : '#475569',
                      fontSize: '0.92rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Core Deterministic Guarantees */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px' }}>
              {/* Sunday Rest Day Card */}
              <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1.5px solid #BBF7D0', backgroundColor: '#F0FDF4' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>🌿</span>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#14532D' }}>
                    Guaranteed Sunday Rest Days
                  </h4>
                </div>
                <p style={{ margin: '10px 0 0', fontSize: '0.86rem', color: '#166534', lineHeight: 1.5 }}>
                  Every Sunday is reserved for rest and recovery. The engine schedules 0 minutes of regular study. You can use Sundays for optional flashcards, light revision, reviewing mistakes, or catching up.
                </p>
                <div style={{ marginTop: '14px', fontSize: '0.8rem', fontWeight: 700, color: '#15803D' }}>
                  ✓ {sundays} Sunday rest days protected
                </div>
              </div>

              {/* 7-Day Pre-Exam Buffer Card */}
              <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1.5px solid #DDD6FE', backgroundColor: '#FAF5FF' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>🛡️</span>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#581C87' }}>
                    7-Day Pre-Exam Revision Buffer
                  </h4>
                </div>
                <p style={{ margin: '10px 0 0', fontSize: '0.86rem', color: '#6B21A8', lineHeight: 1.5 }}>
                  Target syllabus completion date is <strong>{targetCompletionFormatted}</strong>. The final {bufferDays} days before your exam ({formattedExamDate}) are exclusively reserved for mock tests, weak-topic drills, and final revision.
                </p>
                <div style={{ marginTop: '14px', fontSize: '0.8rem', fontWeight: 700, color: '#7E22CE' }}>
                  ✓ Syllabus completed {bufferDays} days prior to exam
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
              <button
                onClick={() => setPlannerStep('chapters')}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: '1.5px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Back to Chapters
              </button>

              <button
                onClick={() => setPlannerStep('generate')}
                style={{
                  backgroundColor: '#4F46E5',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 32px',
                  fontSize: '1rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 8px 20px -4px rgba(79, 70, 229, 0.4)'
                }}
              >
                <span>Continue to Plan Summary</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 5: LET'S BUILD YOUR LEARNING PATH */}
        {/* =================================================================== */}
        {plannerStep === 'generate' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ textAlign: 'center', margin: '8px 0 8px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#EEF2FF',
                color: '#4F46E5',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.82rem',
                fontWeight: 700,
                marginBottom: '10px'
              }}>
                <Sparkles size={16} />
                <span>Adaptive Learning Path Generator</span>
              </div>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                Let&apos;s Build Your Learning Path
              </h2>
              <p style={{ color: '#64748B', fontSize: '1.02rem', marginTop: '6px', maxWidth: '640px', marginInline: 'auto' }}>
                Your study plan will be mathematically optimized with verified curriculum topics, weak-topic weighting, Sunday rest days, and a 7-day revision buffer.
              </p>
            </div>

            {/* Plan Configuration Summary Card */}
            <div className="card" style={{ padding: '28px', borderRadius: '16px', border: '1.5px solid var(--border-subtle)', backgroundColor: '#FFFFFF' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E293B', margin: '0 0 18px', borderBottom: '1.5px solid #F1F5F9', paddingBottom: '12px' }}>
                Plan Parameters & Diagnostic Grounding
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                    Curriculum & Board
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B', marginTop: '2px' }}>
                    {board} • {classLevel}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                    Academic Year {academicYear} (Verified)
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                    Exam Date
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B', marginTop: '2px' }}>
                    {formattedExamDate}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#4F46E5', fontWeight: 600, marginTop: '2px' }}>
                    {daysRemaining} Days Remaining ({studyDays} active study days)
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                    Syllabus Target Completion
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B', marginTop: '2px' }}>
                    {targetCompletionFormatted}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#7C3AED', fontWeight: 600, marginTop: '2px' }}>
                    {bufferDays}-day revision & mock test window
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                    Daily Study Budget
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B', marginTop: '2px' }}>
                    {dailyMinutesBudget} min / study day
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#D97706', fontWeight: 600, marginTop: '2px' }}>
                    Sundays off ({sundays} rest days)
                  </div>
                </div>
              </div>

              {/* Subjects and Chapters Pill List */}
              <div style={{ marginTop: '22px', paddingTop: '18px', borderTop: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Selected Subjects & Syllabus Scope:
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedSubjects.map(sub => {
                    const count = (selectedChaptersBySubject[sub] || []).length;
                    const topCount = (selectedChaptersBySubject[sub] || []).reduce((acc, ch) => acc + (selectedTopicsByChapter[ch]?.length || 0), 0);
                    return (
                      <span
                        key={sub}
                        style={{
                          backgroundColor: '#EEF2FF',
                          color: '#4F46E5',
                          padding: '6px 14px',
                          borderRadius: '10px',
                          fontSize: '0.85rem',
                          fontWeight: 700
                        }}
                      >
                        {sub}: <strong>{count} chapters</strong> • <strong style={{ color: '#059669' }}>{topCount} topics</strong>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Diagnostic Grounding */}
              {preAssessmentResult && (
                <div style={{ marginTop: '16px', backgroundColor: '#F8FAFC', padding: '12px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Target size={16} color="#059669" />
                    <span style={{ fontSize: '0.84rem', color: '#334155', fontWeight: 600 }}>
                      Grounded in Pre-Assessment Results ({preAssessmentResult.overallScore}% overall across {preAssessmentResult.questionPerformance.length} questions)
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    Weak chapters automatically allocated up to 1.6x practice time
                  </span>
                </div>
              )}
            </div>

            {/* Error Message if Generation Failed */}
            {generationError && (
              <div style={{
                backgroundColor: '#FEF2F2',
                border: '1.5px solid #FECACA',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <AlertCircle size={20} color="#DC2626" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800, color: '#991B1B' }}>
                    Unable to generate your learning plan
                  </h4>
                  <p style={{ margin: '4px 0 10px', fontSize: '0.85rem', color: '#B91C1C' }}>
                    {generationError}
                  </p>
                  <button
                    onClick={handleGenerateStudyPlan}
                    style={{
                      backgroundColor: '#DC2626',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Retry Generation
                  </button>
                </div>
              </div>
            )}

            {/* Big Generation Action Button */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
              <button
                onClick={handleGenerateStudyPlan}
                disabled={isGeneratingPlan}
                style={{
                  backgroundColor: '#4F46E5',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '18px 48px',
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  cursor: isGeneratingPlan ? 'not-allowed' : 'pointer',
                  opacity: isGeneratingPlan ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: '0 12px 28px -6px rgba(79, 70, 229, 0.45)',
                  transition: 'all 0.2s ease'
                }}
              >
                {isGeneratingPlan ? (
                  <>
                    <Loader2 size={24} className="spin" />
                    <span>Creating your personalized learning plan...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={24} />
                    <span>Generate My Personalized Learning Path</span>
                    <ArrowRight size={20} />
                  </>
                )}
              </button>

              <button
                onClick={() => setPlannerStep('preferences')}
                disabled={isGeneratingPlan}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '6px 12px'
                }}
              >
                ← Back to Study Preferences
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* SYLLABUS UPLOAD STEP */}
        {/* =================================================================== */}
        {plannerStep === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <button
                  onClick={() => setPlannerStep('exam-date')}
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
                  <span>Back to Exam Date</span>
                </button>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                  {!isSameClass ? `Upload Syllabus for ${classLevel}` : 'Upload Your Syllabus'}
                </h2>
                <p style={{ color: '#64748B', fontSize: '0.92rem', marginTop: '2px' }}>
                  {!isSameClass
                    ? `You selected ${classLevel}, which is different from your registered ${signupGradeNorm}. Upload the syllabus PDF for each subject so chapters are 100% accurate.`
                    : `Upload official syllabus PDF for each subject to auto-extract your curriculum chapters.`}
                </p>
              </div>

              {/* Multi-subject quick AI button */}
              {selectedSubjects.some(sub => uploadMap[sub]?.status === 'ready') && (
                <button
                  onClick={handleRunAllAiAnalysis}
                  style={{
                    backgroundColor: '#10B981',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 20px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <Sparkles size={16} />
                  <span>Run AI Analysis on All Uploaded</span>
                </button>
              )}
            </div>

            {/* Subject Upload Containers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {selectedSubjects.map((subject) => {
                const upload = uploadMap[subject] || {
                  file: null,
                  fileName: '',
                  fileSize: 0,
                  status: 'idle',
                  progressMessage: '',
                  errorMessage: null,
                  extractedText: '',
                  chapters: [],
                  fromCache: false,
                  analyzing: false,
                  analysisComplete: false
                };

                const isReady = upload.status === 'ready';
                const isError = upload.status === 'error';
                const isExtracting = ['uploading', 'extracting', 'detecting'].includes(upload.status);
                const isAnalyzing = upload.analyzing;

                return (
                  <div
                    key={subject}
                    className="card"
                    style={{
                      padding: '28px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '16px',
                      border: '1.5px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px'
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          backgroundColor: '#EEF2FF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px'
                        }}>
                          {subject === 'Mathematics' && '📐'}
                          {subject === 'Science' && '🔬'}
                          {subject === 'English' && '📖'}
                          {subject === 'Computer Science' && '💻'}
                          {subject === 'Social Science' && '🌍'}
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                            {subject}
                          </h3>
                          <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0' }}>
                            Upload official school / board syllabus PDF
                          </p>
                        </div>
                      </div>

                      {/* Status Badges */}
                      {isReady && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: '#DCFCE7',
                            color: '#15803D',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '999px',
                            border: '1px solid #BBF7D0'
                          }}>
                            <CheckCircle2 size={14} />
                            <span>{upload.chapters.length} chapters detected</span>
                          </span>

                          {upload.fromCache && (
                            <span style={{ fontSize: '0.72rem', color: '#64748B', backgroundColor: '#F1F5F9', padding: '2px 8px', borderRadius: '4px' }}>
                              Cached
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Upload Drop Zone / Active Area */}
                    <div style={{
                      border: isReady ? '1.5px solid #A7F3D0' : isError ? '1.5px dashed #FCA5A5' : '2px dashed #CBD5E1',
                      borderRadius: '12px',
                      padding: '24px',
                      backgroundColor: isReady ? '#F0FDF4' : isError ? '#FEF2F2' : '#F8FAFC',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px'
                    }}>
                      {!isReady && !isExtracting && (
                        <>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            backgroundColor: isError ? '#FEE2E2' : '#EEF2FF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isError ? '#DC2626' : '#4F46E5'
                          }}>
                            {isError ? <AlertCircle size={24} /> : <UploadCloud size={24} />}
                          </div>

                          <div>
                            <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#1E293B' }}>
                              Select or drop {subject} syllabus PDF, Word, or Notes file
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '3px' }}>
                              PDF, Word (.doc, .docx), Text (.txt, .md) up to 25MB • Auto-extracts curriculum chapters & topics
                            </div>
                          </div>

                          <label style={{
                            backgroundColor: '#FFFFFF',
                            border: '1.5px solid #C7D2FE',
                            color: '#4F46E5',
                            padding: '8px 18px',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <span>Choose Document File</span>
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.txt,.text,.md,application/pdf"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileSelect(file, subject);
                                e.target.value = '';
                              }}
                            />
                          </label>

                          {isError && upload.errorMessage && (
                            <div style={{
                              marginTop: '8px',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              backgroundColor: '#FEE2E2',
                              border: '1px solid #FECACA',
                              color: '#991B1B',
                              fontSize: '0.84rem',
                              fontWeight: 600,
                              maxWidth: '540px'
                            }}>
                              {upload.errorMessage}
                            </div>
                          )}
                        </>
                      )}

                      {/* Granular Loading Extraction Pipeline States */}
                      {isExtracting && (
                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                          <Loader2 size={32} color="#4F46E5" style={{ animation: 'spin 1s linear infinite' }} />
                          <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#1E293B' }}>
                            {upload.progressMessage}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                            Running coordinate line reconstruction and chapter boundary verification...
                          </div>
                        </div>
                      )}

                      {/* Ready State */}
                      {isReady && (
                        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FileText size={22} color="#059669" />
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1E293B' }}>
                                {upload.fileName}
                              </div>
                              <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
                                {(upload.fileSize / 1024).toFixed(1)} KB • {upload.chapters.length} chapters extracted
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label style={{
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #E2E8F0',
                              color: '#64748B',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}>
                              <span>Replace PDF</span>
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileSelect(file, subject);
                                  e.target.value = '';
                                }}
                              />
                            </label>

                            {/* Section 15 & 16: AI Analysis Button for this Subject */}
                            <button
                              onClick={() => handleRunAiAnalysisForSubject(subject)}
                              disabled={isAnalyzing}
                              style={{
                                backgroundColor: '#4F46E5',
                                color: '#FFFFFF',
                                border: 'none',
                                padding: '8px 20px',
                                borderRadius: '8px',
                                fontSize: '0.88rem',
                                fontWeight: 800,
                                cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)'
                              }}
                            >
                              {isAnalyzing ? (
                                <>
                                  <Loader2 size={16} color="#FFFFFF" style={{ animation: 'spin 1s linear infinite' }} />
                                  <span>Analyzing...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles size={16} />
                                  <span>AI Analysis</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions for Upload Step */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
              <button
                onClick={() => setPlannerStep('exam-date')}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: '1.5px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Back to Exam Date
              </button>

              <button
                onClick={() => {
                  setPlannerStep('review-syllabus');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={!selectedSubjects.some(sub => uploadMap[sub]?.status === 'ready' && uploadMap[sub]?.chapters?.length > 0)}
                style={{
                  backgroundColor: '#4F46E5',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 28px',
                  fontSize: '0.96rem',
                  fontWeight: 800,
                  cursor: selectedSubjects.some(sub => uploadMap[sub]?.status === 'ready' && uploadMap[sub]?.chapters?.length > 0) ? 'pointer' : 'not-allowed',
                  opacity: selectedSubjects.some(sub => uploadMap[sub]?.status === 'ready' && uploadMap[sub]?.chapters?.length > 0) ? 1 : 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)'
                }}
              >
                <span>Review Extracted Syllabus</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP: REVIEW EXTRACTED SYLLABUS */}
        {/* =================================================================== */}
        {plannerStep === 'review-syllabus' && (
          <ReviewSyllabusView
            syllabusBySubject={(() => {
              const map: EditableSyllabusMap = {};
              selectedSubjects.forEach(sub => {
                if (uploadMap[sub]?.chapters && uploadMap[sub].chapters.length > 0) {
                  map[sub] = uploadMap[sub].chapters;
                } else {
                  map[sub] = getExistingChaptersForSubject(sub);
                }
              });
              return map;
            })()}
            classLevel={classLevel}
            board={board}
            onBack={() => {
              setPlannerStep('upload');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onConfirm={(confirmedSyllabus) => {
              // 1. Update uploadMap with confirmed chapters
              setUploadMap(prev => {
                const updated = { ...prev };
                Object.entries(confirmedSyllabus).forEach(([sub, chs]) => {
                  updated[sub] = {
                    ...(updated[sub] || {
                      file: null,
                      fileName: `${sub} Syllabus.pdf`,
                      fileSize: 1024 * 100,
                      errorMessage: null,
                      extractedText: '',
                      fromCache: false,
                      analyzing: false,
                      analysisComplete: false
                    }),
                    status: 'ready',
                    progressMessage: `${chs.length} chapters confirmed`,
                    chapters: chs
                  };
                });
                return updated;
              });

              // 2. Pre-select all confirmed chapters and topics
              const newChMap: Record<string, string[]> = {};
              const newTopMap: Record<string, string[]> = {};
              Object.entries(confirmedSyllabus).forEach(([sub, chs]) => {
                newChMap[sub] = chs.map(c => c.chapterName);
                chs.forEach(c => {
                  newTopMap[c.chapterName] = c.topics;
                });
              });

              setSelectedChaptersBySubject(prev => ({ ...prev, ...newChMap }));
              setSelectedTopicsByChapter(prev => ({ ...prev, ...newTopMap }));

              // 3. Move to Step 3: Chapter Selection
              setPlannerStep('chapters');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* =================================================================== */}
        {/* STEP 3: AI ANALYSIS RESULT SCREEN (YOUR LEARNING ANALYSIS) */}
        {/* =================================================================== */}
        {plannerStep === 'analysis' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <button
                  onClick={() => setPlannerStep('subjects')}
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
                  <span>Back to Subject Selection</span>
                </button>
                <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                  Your Learning Analysis
                </h2>
                <p style={{ color: '#64748B', fontSize: '0.92rem', marginTop: '2px' }}>
                  Synthesized from your verified syllabus (what to learn) and pre-assessment diagnostics (what you currently understand).
                </p>
              </div>

              {/* Action: Build My Learning Path */}
              <button
                onClick={() => {
                  if (activeAnalysisSubject) {
                    setActiveSubject(activeAnalysisSubject);
                  }
                  setActiveTab('learning-path');
                }}
                style={{
                  backgroundColor: '#4F46E5',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 24px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 8px 20px -4px rgba(79, 70, 229, 0.4)'
                }}
              >
                <span>Build My Learning Path</span>
                <ArrowRight size={18} />
              </button>
            </div>

            {/* Multi-Subject Tabs */}
            {selectedSubjects.length > 1 && (
              <div style={{
                display: 'flex',
                gap: '8px',
                borderBottom: '1px solid #E2E8F0',
                paddingBottom: '8px',
                overflowX: 'auto'
              }}>
                {selectedSubjects.map(sub => {
                  const isActive = sub === activeAnalysisSubject;
                  const profile = learningProfile?.subjects?.[sub];
                  return (
                    <button
                      key={sub}
                      onClick={() => setActiveAnalysisSubject(sub)}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        border: 'none',
                        borderBottom: isActive ? '3px solid #4F46E5' : '3px solid transparent',
                        backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                        color: isActive ? '#1E293B' : '#64748B',
                        fontWeight: isActive ? 800 : 600,
                        fontSize: '0.92rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>
                        {sub === 'Mathematics' && '📐'}
                        {sub === 'Science' && '🔬'}
                        {sub === 'English' && '📖'}
                        {sub === 'Computer Science' && '💻'}
                        {sub === 'Social Science' && '🌍'}
                      </span>
                      <span>{sub}</span>
                      {profile && (
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '999px',
                          backgroundColor: isActive ? '#EEF2FF' : '#F1F5F9',
                          color: isActive ? '#4F46E5' : '#64748B'
                        }}>
                          {profile.assessmentUnderstanding !== null ? `${profile.assessmentUnderstanding}%` : `${profile.totalChapters} ch`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Analysis Content for Active Subject */}
            {currentSubjectProfile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Subject Overview Card */}
                <div className="card" style={{
                  padding: '24px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1.5px solid var(--border-subtle)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px'
                }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>Total Syllabus Chapters</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1E293B', marginTop: '2px' }}>
                      {currentSubjectProfile.totalChapters}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
                      Extracted from {currentSubjectProfile.syllabusFileName || 'Syllabus PDF'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>Assessed in Pre-Assessment</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#4F46E5', marginTop: '2px' }}>
                      {currentSubjectProfile.assessedChaptersCount} Chapters
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                      {currentSubjectProfile.unassessedChaptersCount} chapters not yet assessed
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>Current Assessed Understanding</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: currentSubjectProfile.assessmentUnderstanding !== null && currentSubjectProfile.assessmentUnderstanding >= 70 ? '#059669' : '#D97706', marginTop: '2px' }}>
                      {currentSubjectProfile.assessmentUnderstanding !== null ? `${currentSubjectProfile.assessmentUnderstanding}%` : 'Not Assessed'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                      Based on actual diagnostic questions
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>Diagnostic Breakdown</div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#DCFCE7', color: '#15803D', fontWeight: 700 }}>
                        {currentSubjectProfile.strongAreasCount} Strong
                      </span>
                      <span style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#B45309', fontWeight: 700 }}>
                        {currentSubjectProfile.needsPracticeCount} Dev
                      </span>
                      <span style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#FEE2E2', color: '#B91C1C', fontWeight: 700 }}>
                        {currentSubjectProfile.needsAttentionCount} Gaps
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI Pedagogical Guidance if available */}
                {currentSubjectProfile.aiPedagogicalSummary && (
                  <div style={{
                    padding: '20px 24px',
                    borderRadius: '14px',
                    backgroundColor: '#F5F7FF',
                    border: '1.5px solid #C7D2FE',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4F46E5', fontWeight: 800, fontSize: '0.88rem' }}>
                      <Sparkles size={16} />
                      <span>AI Curriculum Advisor: Diagnostic Synthesis & Immediate Priorities</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                      {currentSubjectProfile.aiPedagogicalSummary.immediatePriorities.map((item, idx) => (
                        <div key={idx} style={{ padding: '10px 14px', backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E0E7FF', fontSize: '0.84rem', color: '#1E293B', fontWeight: 600 }}>
                          • {item}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chapter-Wise Understanding Table */}
                <div className="card" style={{
                  padding: '24px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1.5px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                      Chapter Understanding & Topic Mastery
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                      Click any chapter to view topics or transparent evidence
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {currentSubjectProfile.chapters.map((ch) => {
                      const isExpanded = !!expandedChapterIds[ch.chapterId];
                      const isEvidenceOpen = !!evidenceChapterIds[ch.chapterId];

                      const isNotAssessed = ch.status === 'not_assessed';
                      const statusColor = isNotAssessed
                        ? { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' }
                        : ch.status === 'strong'
                        ? { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' }
                        : ch.status === 'developing'
                        ? { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' }
                        : { bg: '#FEE2E2', text: '#B91C1C', border: '#FECACA' };

                      return (
                        <div
                          key={ch.chapterId}
                          style={{
                            border: '1px solid #E2E8F0',
                            borderRadius: '12px',
                            backgroundColor: '#F8FAFC',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Row Header */}
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
                                  alignItems: 'center'
                                }}
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
                                <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                                  {isNotAssessed ? (
                                    <span style={{ color: '#64748B', fontStyle: 'italic' }}>
                                      Present in syllabus • Not tested in diagnostic baseline
                                    </span>
                                  ) : (
                                    <span>
                                      {ch.questionCount} questions • Confidence: <strong>{ch.confidence}</strong>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Understanding & Status */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              {/* Progress bar or Not Assessed Pill */}
                              {isNotAssessed ? (
                                <div style={{
                                  padding: '4px 12px',
                                  borderRadius: '6px',
                                  backgroundColor: '#F1F5F9',
                                  color: '#64748B',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  border: '1px solid #E2E8F0'
                                }}>
                                  Not Assessed
                                </div>
                              ) : (
                                <div style={{ width: '120px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800 }}>
                                    <span>{ch.understanding}%</span>
                                    <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
                                      {ch.correctCount}/{ch.questionCount}
                                    </span>
                                  </div>
                                  <div style={{ height: '6px', backgroundColor: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
                                    <div style={{
                                      height: '100%',
                                      width: `${ch.understanding}%`,
                                      backgroundColor: ch.status === 'strong' ? '#10B981' : ch.status === 'developing' ? '#F59E0B' : '#EF4444',
                                      borderRadius: '999px'
                                    }} />
                                  </div>
                                </div>
                              )}

                              {/* Status Badge */}
                              <span style={{
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                backgroundColor: statusColor.bg,
                                color: statusColor.text,
                                border: `1px solid ${statusColor.border}`,
                                minWidth: '95px',
                                textAlign: 'center',
                                textTransform: 'capitalize'
                              }}>
                                {isNotAssessed ? 'Not Assessed' : ch.status.replace('_', ' ')}
                              </span>

                              {/* Evidence button */}
                              {!isNotAssessed && (
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
                                  {isEvidenceOpen ? 'Hide' : 'Why this score?'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Evidence Drawer */}
                          {isEvidenceOpen && !isNotAssessed && ch.difficultyBreakdown && (
                            <div style={{
                              padding: '12px 18px',
                              backgroundColor: '#F8FAFC',
                              borderTop: '1px solid #E2E8F0',
                              fontSize: '0.8rem',
                              color: '#475569'
                            }}>
                              <div style={{ fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                                Diagnostic Evidence for {ch.chapterName}:
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                                <div>• <strong>Questions Attempted:</strong> {ch.questionCount}</div>
                                <div>• <strong>Correct:</strong> {ch.correctCount} | <strong>Incorrect:</strong> {ch.incorrectCount}</div>
                                <div>• <strong>Easy:</strong> {ch.difficultyBreakdown.easy.correct}/{ch.difficultyBreakdown.easy.total} correct</div>
                                <div>• <strong>Moderate:</strong> {ch.difficultyBreakdown.moderate.correct}/{ch.difficultyBreakdown.moderate.total} correct</div>
                                <div>• <strong>Difficult:</strong> {ch.difficultyBreakdown.difficult.correct}/{ch.difficultyBreakdown.difficult.total} correct</div>
                              </div>
                            </div>
                          )}

                          {/* Expandable Topic Level Breakdown */}
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
                                Topics in this Chapter (from Syllabus PDF)
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {ch.topics.map((top, tIdx) => {
                                  const isTopNotAssessed = top.status === 'not_assessed' || top.understanding === null;
                                  return (
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

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {isTopNotAssessed ? (
                                          <span style={{
                                            fontSize: '0.74rem',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            backgroundColor: '#F1F5F9',
                                            color: '#64748B',
                                            fontWeight: 600
                                          }}>
                                            Not Assessed
                                          </span>
                                        ) : (
                                          <>
                                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: top.understanding! >= 80 ? '#059669' : top.understanding! >= 50 ? '#D97706' : '#DC2626' }}>
                                              {top.understanding}%
                                            </span>
                                            <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                              ({top.questionCount} Qs)
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom CTA to Personalize Path */}
                <div style={{
                  padding: '24px 28px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}>
                  <div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 4px', color: '#FFFFFF' }}>
                      Ready to Build Your Adaptive Learning Path?
                    </h3>
                    <p style={{ fontSize: '0.88rem', color: '#E0E7FF', margin: 0 }}>
                      Translate this chapter mastery matrix into an interactive step-by-step learning progression.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      if (activeAnalysisSubject) setActiveSubject(activeAnalysisSubject);
                      setActiveTab('learning-path');
                    }}
                    style={{
                      backgroundColor: '#FFFFFF',
                      color: '#4F46E5',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '12px 24px',
                      fontSize: '0.94rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>Start Learning</span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: '36px', textAlign: 'center', borderRadius: '16px' }}>
                <Info size={32} color="#4F46E5" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1E293B', margin: '0 0 6px' }}>
                  No Analysis Available Yet for {activeAnalysisSubject}
                </h3>
                <p style={{ fontSize: '0.88rem', color: '#64748B', maxWidth: '440px', margin: '0 auto 16px' }}>
                  Upload the syllabus PDF in Step 2 and click "AI Analysis" to generate your chapter-by-chapter mastery roadmap.
                </p>
                <button
                  onClick={() => setPlannerStep('subjects')}
                  className="btn btn-primary"
                  style={{ padding: '10px 20px', fontSize: '0.88rem' }}
                >
                  Back to Subject Selection
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
