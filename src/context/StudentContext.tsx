import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  LearningStyle,
  SubjectType,
  DifficultyLevel,
  BoardType,
  StreamType,
  ClassLevel,
  SubjectData,
  RecommendationItem,
  StudyPlanItem,
  LearningPathNode,
  ActivityItem,
  QuizResult,
  SyllabusFile,
  ParsedMaterial,
  CurrentLearningContext,
  PreAssessmentResult,
  PreAssessmentQuestion,
  StudentProfile as AuthStudentProfile,
  LearningProfile,
  StudentLearningPlan,
  StudySessionRecord
} from '../types';
import { recordStudySession, getSavedStudySessions } from '../services/adaptiveLessonService';
import {
  INITIAL_SUBJECTS,
  INITIAL_RECOMMENDATIONS,
  INITIAL_STUDY_PLAN,
  INITIAL_LEARNING_PATH,
  INITIAL_ACTIVITIES,
  mockCurriculum
} from '../data/mockCurriculum';
import {
  getChapters,
  getRecommendations,
  getLearningPath,
  normalizeGrade
} from '../services/curriculumService';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { extractTextFromPDF } from '../utils/pdfExtractor';
import { parseSyllabusWithAI, getFallbackSyllabusParse } from '../lib/aiSyllabusParser';
import { processUploadedFile } from '../services/fileProcessingService';

// Extend the AuthStudentProfile with client-specific fields
export interface StudentProfile extends AuthStudentProfile {
  streak: number;
  totalPoints: number;
  rank: number;
  syllabusUploaded: boolean;
  syllabusData?: Record<string, {
    fileName: string;
    fileSize: number;
    uploadedAt: string;
    storagePath?: string;
    publicUrl?: string;
    extractedText: string;
    topics: string[];
    analysisComplete: boolean;
    [key: string]: any;
  }>;
}

export interface StudentContextType {
  student: StudentProfile;
  subjects: SubjectData[];
  recommendations: RecommendationItem[];
  studyPlan: StudyPlanItem[];
  learningPath: LearningPathNode[];
  activities: ActivityItem[];
  activeTab: string;
  activeSubject: SubjectType;
  lastQuizResult: QuizResult | null;
  quizHistory: QuizResult[];
  allStudySessions: StudySessionRecord[];
  notification: { message: string; type: 'success' | 'info' | 'warning' } | null;
  judgeDemoStep: number;
  syllabusData: Record<string, any>;
  syllabusUploaded: boolean;
  uploadedMaterial: ParsedMaterial | null;
  uploadState: 'idle' | 'uploading' | 'analyzing' | 'ready' | 'error';
  uploadError: string | null;
  currentLearningContext: CurrentLearningContext;
  setCurrentLearningContext: React.Dispatch<React.SetStateAction<CurrentLearningContext>>;
  setActiveTab: (tab: string) => void;
  setActiveSubject: (subject: SubjectType) => void;
  setPreferredStyle: (style: LearningStyle) => void;
  updateProfile: (name: string, grade: string, style: LearningStyle, board?: BoardType, stream?: StreamType) => void;
  toggleStudyPlanItem: (id: string) => void;
  recordQuizResult: (result: QuizResult) => void;
  setJudgeDemoStep: (step: number | ((prev: number) => number)) => void;
  completeSyllabusSetup: (filesRecord: Record<string, any>) => Promise<any>;
  extractAndAnalyzeTopics: (subject: SubjectType, text: string) => Promise<any>;
  setSyllabusAnalysis: (subject: SubjectType, data: any) => void;
  processAndSetFile: (file: File) => Promise<ParsedMaterial>;
  removeUploadedMaterial: () => void;
  clearUploadError: () => void;
  setTopicContext: (
    subject: SubjectType,
    chapter: string,
    topic: string,
    chapterId?: string,
    topicId?: string,
    difficulty?: DifficultyLevel,
    additional?: {
      allocatedMinutes?: number;
      taskId?: string;
      dayDate?: string;
      subtopics?: string[];
      isWeakTopic?: boolean;
      activityType?: string;
      studentLevel?: 'Weak' | 'Average' | 'Strong';
    }
  ) => void;
  completeTaskAndRecordSession: (session: StudySessionRecord) => Promise<void>;
  startQuizForCurrentTopic: (override?: Partial<CurrentLearningContext>) => void;
  setAcademicProfile: (
    grade: ClassLevel,
    board: BoardType,
    stream: StreamType,
    style?: LearningStyle,
    level?: DifficultyLevel
  ) => void;
  resetToDefault: () => void;
  resetDemo: () => void;
  clearNotification: () => void;
  preAssessmentResult: PreAssessmentResult | null;
  preAssessmentQuestions: PreAssessmentQuestion[];
  isGeneratingAssessment: boolean;
  setIsGeneratingAssessment: React.Dispatch<React.SetStateAction<boolean>>;
  recordPreAssessmentResult: (result: PreAssessmentResult) => void;
  clearPreAssessment: () => void;
  setPreAssessmentQuestions: React.Dispatch<React.SetStateAction<PreAssessmentQuestion[]>>;
  learningProfile: LearningProfile | null;
  plannerStep: 'subjects' | 'exam-date' | 'chapters' | 'topics' | 'preferences' | 'generate' | 'upload' | 'analysis' | 'review-syllabus';
  selectedPlannerSubjects: SubjectType[];
  setPlannerStep: (step: 'subjects' | 'exam-date' | 'chapters' | 'topics' | 'preferences' | 'generate' | 'upload' | 'analysis' | 'review-syllabus') => void;
  setSelectedPlannerSubjects: React.Dispatch<React.SetStateAction<SubjectType[]>>;
  recordLearningProfile: (profile: LearningProfile) => void;
  clearLearningProfile: () => void;
  activeLearningPlan: StudentLearningPlan | null;
  recordLearningPlan: (plan: StudentLearningPlan) => void;
  clearLearningPlan: () => void;
  toggleStudyTaskCompletion: (dayDate: string, taskId: string) => void;
  progressMetrics: RealProgressMetrics;
}

export interface RealProgressMetrics {
  todayCompletedTasks: number;
  todayTotalTasks: number;
  todayProgressPct: number;
  weekCompletedTasks: number;
  weekTotalTasks: number;
  weekProgressPct: number;
  overallCompletedTasks: number;
  overallTotalTasks: number;
  overallProgressPct: number;
  totalQuizzesTaken: number;
  averageQuizScorePct: number;
  totalStudyMinutes: number;
  totalTopicsCount: number;
  completedTopicsCount: number;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Initialize student profile with data from auth user (if available) and defaults for client-specific fields
  const [student, setStudent] = useState<StudentProfile>({
    // Auth fields (from user or defaults)
    id: user ? user.id : 'user-demo-sally-sharma',
    name: user ? user.name : 'Sally Sharma',
    email: user ? user.email : 'sally.demo@example.com',
    grade: user ? user.grade : 'Class 10',
    board: user ? (user.board || 'CBSE') : 'CBSE',
    stream: user ? (user.stream || 'Not applicable') : 'Not applicable',
    level: user ? user.level : 'Intermediate',
    preferredSubjects: user ? user.preferredSubjects : ['Mathematics', 'Science', 'English', 'Computer Science', 'Social Science'],
    preferredStyle: user ? user.preferredStyle : 'Simple',
    isDemo: user ? user.isDemo : true,
    emailVerified: user ? user.emailVerified : true,
    createdAt: user ? (user.createdAt || user.created_at || new Date().toISOString()) : new Date().toISOString(),
    // Client-specific fields with defaults
    streak: 4,
    totalPoints: 1420,
    rank: 76,
    syllabusUploaded: false,
    syllabusData: {}
  });

  const [subjects, setSubjects] = useState<SubjectData[]>(INITIAL_SUBJECTS);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(INITIAL_RECOMMENDATIONS);
  const [studyPlan, setStudyPlan] = useState<StudyPlanItem[]>(INITIAL_STUDY_PLAN);
  const [learningPath, setLearningPath] = useState<LearningPathNode[]>(INITIAL_LEARNING_PATH);
  const [activities, setActivities] = useState<ActivityItem[]>(INITIAL_ACTIVITIES);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeSubject, setActiveSubjectState] = useState<SubjectType>('Mathematics');
  const [lastQuizResult, setLastQuizResult] = useState<QuizResult | null>(null);
  const [quizHistory, setQuizHistory] = useState<QuizResult[]>([]);
  const [allStudySessions, setAllStudySessions] = useState<StudySessionRecord[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);
  const [judgeDemoStep, setJudgeDemoStep] = useState<number>(0);
  const [syllabusData, setSyllabusData] = useState<Record<string, any>>({});

  // Pre-Assessment state
  const [preAssessmentResult, setPreAssessmentResult] = useState<PreAssessmentResult | null>(null);
  const [preAssessmentQuestions, setPreAssessmentQuestions] = useState<PreAssessmentQuestion[]>([]);
  const [isGeneratingAssessment, setIsGeneratingAssessment] = useState<boolean>(false);

  // Learning Path Planner & AI Syllabus Analysis state
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);
  const [plannerStep, setPlannerStep] = useState<'subjects' | 'exam-date' | 'chapters' | 'topics' | 'preferences' | 'generate' | 'upload' | 'analysis' | 'review-syllabus'>('subjects');
  const [selectedPlannerSubjects, setSelectedPlannerSubjects] = useState<SubjectType[]>([]);
  const [activeLearningPlan, setActiveLearningPlan] = useState<StudentLearningPlan | null>(null);

  // Material upload state
  const [uploadedMaterial, setUploadedMaterial] = useState<ParsedMaterial | null>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'analyzing' | 'ready' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Active learning context
  const [currentLearningContext, setCurrentLearningContext] = useState<CurrentLearningContext>(() => ({
    classLevel: 'Class 9',
    board: 'CBSE',
    stream: 'Not applicable',
    subject: 'Mathematics',
    chapter: 'Number Systems',
    chapterId: 'cbse-9-math-ch1',
    topic: 'Irrational Numbers and Decimal Expansions',
    topicId: 'cbse-9-math-t1',
    learningStyle: 'Simple',
    difficulty: 'Intermediate'
  }));

  const processAndSetFile = async (file: File): Promise<ParsedMaterial> => {
    setUploadState('uploading');
    setUploadError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      setUploadState('analyzing');

      const parsed = await processUploadedFile(file);

      await new Promise((resolve) => setTimeout(resolve, 600));

      setUploadedMaterial(parsed);
      setUploadState('ready');

      // Seamlessly register parsed topics into student syllabus data for learning path planning
      const textToScan = `${file.name} ${parsed.extractedText.slice(0, 2000)}`.toLowerCase();
      let inferredSubject: SubjectType = activeSubject || 'Science';
      if (/math|algebra|geometry|calculus|trigonometry|equation|fraction|arithmetic|polynomial/i.test(textToScan)) {
        inferredSubject = 'Mathematics';
      } else if (/physics|chem|bio|science|reaction|cell|atom|motion|organ|photosynthesis|acid|base/i.test(textToScan)) {
        inferredSubject = 'Science';
      } else if (/computer|program|python|code|database|algorithm|software|network|loop|array/i.test(textToScan)) {
        inferredSubject = 'Computer Science';
      } else if (/history|geography|civics|economics|democracy|constitution|empire|resource|parliament/i.test(textToScan)) {
        inferredSubject = 'Social Science';
      } else if (/english|grammar|prose|poem|poetry|literature|comprehension|essay|tense/i.test(textToScan)) {
        inferredSubject = 'English';
      }

      const topicsList = parsed.topics.map(t => t.title);
      const examFocusedTopics: Record<string, string[]> = {};
      const structuredChapters = parsed.topics.map((t, idx) => {
        const subList = t.concepts ? t.concepts.split(/[,.;\n]/).map(s => s.trim()).filter(s => s.length > 3).slice(0, 5) : [];
        const fullTopics = subList.length > 0 ? [t.title, ...subList] : [t.title];
        examFocusedTopics[t.title] = fullTopics;
        return {
          chapterId: `ch_${inferredSubject.toLowerCase().replace(/\s+/g, '_').slice(0, 4)}_${idx + 1}`,
          chapterName: t.title,
          subject: inferredSubject,
          topics: fullTopics,
          sourceMethod: 'heading_detection'
        };
      });

      const syllabusEntry = {
        subject: inferredSubject,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        extractedText: parsed.extractedText.slice(0, 5000),
        topics: topicsList,
        chapters: structuredChapters,
        examFocusedTopics,
        storagePath: '',
        publicUrl: '',
        analysisComplete: true
      };

      setStudent(prev => {
        const updated = {
          ...prev,
          syllabusData: {
            ...(prev.syllabusData || {}),
            [inferredSubject]: syllabusEntry
          },
          syllabusUploaded: true
        };
        try {
          const key = user?.id ? `student_profile_${user.id}` : 'student_profile_guest';
          localStorage.setItem(key, JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
      setSyllabusData(prev => ({
        ...prev,
        [inferredSubject]: syllabusEntry
      }));

      setNotification({
        message: `Successfully analyzed "${file.name}" (${parsed.wordCount} words, ${parsed.topics.length} topics found). Connected to AI Tutor & Study Planner!`,
        type: 'success'
      });

      return parsed;
    } catch (err: any) {
      setUploadState('error');
      const msg = err?.message || 'Could not read this file. Please try another supported file.';
      setUploadError(msg);
      setNotification({
        message: msg,
        type: 'warning'
      });
      throw err;
    }
  };

  const removeUploadedMaterial = () => {
    setUploadedMaterial(null);
    setUploadState('idle');
    setUploadError(null);
    setNotification({
      message: 'Uploaded material removed from AI Tutor session.',
      type: 'info'
    });
  };

  const clearUploadError = () => {
    setUploadError(null);
    if (uploadState === 'error') {
      setUploadState('idle');
    }
  };

  const setActiveSubject = (subject: SubjectType) => {
    setActiveSubjectState(subject);
    const updatedRecs = getRecommendations(normalizeGrade(student.grade), student.board || 'CBSE', student.stream || 'Not applicable', subject);
    if (updatedRecs && updatedRecs.length > 0) {
      setRecommendations(updatedRecs);
    }
    const updatedPath = getLearningPath(normalizeGrade(student.grade), student.board || 'CBSE', student.stream || 'Not applicable', subject);
    if (updatedPath && updatedPath.length > 0) {
      setLearningPath(updatedPath);
    }

    const chs = getChapters(normalizeGrade(student.grade), student.board || 'CBSE', student.stream || 'Not applicable', subject);
    const firstCh = chs[0];
    const firstTop = firstCh?.topics[0];
    if (firstCh && firstTop) {
      setCurrentLearningContext((prev) => ({
        ...prev,
        subject,
        chapter: firstCh.title,
        chapterId: firstCh.id,
        topic: firstTop.title,
        topicId: firstTop.id
      }));
    } else {
      setCurrentLearningContext((prev) => ({
        ...prev,
        subject
      }));
    }
  };

  const setTopicContext = (
    subject: SubjectType,
    chapter: string,
    topic: string,
    chapterId?: string,
    topicId?: string,
    difficulty?: DifficultyLevel,
    additional?: {
      allocatedMinutes?: number;
      taskId?: string;
      dayDate?: string;
      subtopics?: string[];
      isWeakTopic?: boolean;
      activityType?: string;
      studentLevel?: 'Weak' | 'Average' | 'Strong';
    }
  ) => {
    setActiveSubjectState(subject);
    setCurrentLearningContext((prev) => ({
      ...prev,
      subject,
      chapter,
      topic,
      chapterId: chapterId || prev.chapterId,
      topicId: topicId || prev.topicId,
      difficulty: difficulty || prev.difficulty,
      allocatedMinutes: additional?.allocatedMinutes ?? prev.allocatedMinutes,
      taskId: additional?.taskId ?? prev.taskId,
      dayDate: additional?.dayDate ?? prev.dayDate,
      subtopics: additional?.subtopics ?? prev.subtopics,
      isWeakTopic: additional?.isWeakTopic ?? prev.isWeakTopic,
      activityType: additional?.activityType ?? prev.activityType,
      studentLevel: additional?.studentLevel ?? prev.studentLevel
    }));
  };

  const startQuizForCurrentTopic = (override?: Partial<CurrentLearningContext>) => {
    if (override) {
      setCurrentLearningContext((prev) => ({ ...prev, ...override }));
      if (override.subject) {
        setActiveSubjectState(override.subject);
      }
    }
    setActiveTab('quiz');
  };

  const setAcademicProfile = (
    grade: ClassLevel,
    board: BoardType,
    stream: StreamType,
    style?: LearningStyle,
    level?: DifficultyLevel
  ) => {
    setStudent(prev => ({
      ...prev,
      grade,
      board,
      stream,
      preferredStyle: style || prev.preferredStyle,
      level: level || prev.level
    }));
    if (style) {
      setPreferredStyle(style);
    }
  };

  // Topic extraction helper (client-side matching against curriculum)
  const extractAndAnalyzeTopics = async (subject: SubjectType, text: string): Promise<any> => {
    try {
      const curriculum = mockCurriculum[subject];
      if (!curriculum || !curriculum.topics) return [];

      const textLower = text.toLowerCase();
      const detected = curriculum.topics.filter(topic =>
        textLower.includes(topic.toLowerCase())
      );
      return detected.length > 0 ? detected : curriculum.topics.slice(0, 6);
    } catch (error) {
      console.error('Error in topic extraction:', error);
      return [];
    }
  };

  // Helper to update analysis for a subject
  const setSyllabusAnalysis = (subject: SubjectType, analysisData: any) => {
    setStudent(prev => ({
      ...prev,
      syllabusData: {
        ...(prev.syllabusData || {}),
        [subject]: {
          ...(prev.syllabusData?.[subject] || {}),
          ...analysisData
        }
      }
    }));
  };

  // Enhanced syllabus setup with Supabase storage and fallback
  const completeSyllabusSetup = async (filesRecord: Record<string, any>) => {
    try {
      const currentUserId = user?.id || 'guest_student';

      const uploadPromises = Object.entries(filesRecord).map(async ([subjectKey, fileData]) => {
        if (!fileData) return null;

        let storagePath = '';
        let publicUrl = '';
        let extractedText = `Syllabus for ${subjectKey}. Covered units: ${mockCurriculum[subjectKey as SubjectType]?.topics?.join(', ')}`;

        // Attempt Supabase Storage Upload if file object is present and supabase is configured
        if (fileData.file && supabase) {
          try {
            const fileName = `${currentUserId}/${subjectKey}/${Date.now()}-${fileData.name}`;
            const { data: uploadData, error: uploadError } = await supabase
              .storage
              .from('syllabus-uploads')
              .upload(fileName, fileData.file, {
                contentType: fileData.type || 'application/pdf',
                upsert: true
              });

            if (!uploadError && uploadData) {
              storagePath = fileName;
              const { data: urlData } = supabase
                .storage
                .from('syllabus-uploads')
                .getPublicUrl(fileName);
              publicUrl = urlData?.publicUrl || '';

              // Try Supabase Function for extraction if available
              try {
                const { data: extractionData } = await supabase.functions.invoke(
                  'extract-pdf-text',
                  { body: { filePath: fileName } }
                );
                if (extractionData?.text) {
                  extractedText = extractionData.text;
                }
              } catch (funcErr) {
                console.warn('PDF text extraction edge function skipped, using fallback parsing:', funcErr);
              }
            }
          } catch (storageErr) {
            console.warn('Supabase storage upload skipped or failed, using local in-memory fallback:', storageErr);
          }
        }

        // Extract actual text and generate AI-powered syllabus analysis if we have the file
        if (fileData.file) {
          try {
            // Extract raw text from PDF
            const { rawText } = await extractTextFromPDF(fileData.file);
            extractedText = rawText;

            // Use AI-powered syllabus parser to extract chapters and generate exam-focused topics
            const parsedSyllabus = parseSyllabusWithAI(rawText, subjectKey as SubjectType);

            return {
              subject: subjectKey,
              fileName: fileData.name,
              fileSize: fileData.size,
              uploadedAt: fileData.uploadedAt || new Date().toISOString(),
              storagePath,
              publicUrl,
              extractedText: parsedSyllabus.rawText,
              topics: parsedSyllabus.chapters, // Chapters as topics for backward compatibility
              analysisComplete: true
            };
          } catch (pdfErr) {
            console.warn('Client-side PDF extraction failed, using fallback:', pdfErr);
          }
        }

        // Fallback: Use AI-powered fallback syllabus parser (FREE - zero API cost)
        const fallbackSyllabus = getFallbackSyllabusParse(subjectKey as SubjectType);

        return {
          subject: subjectKey,
          fileName: fileData.name,
          fileSize: fileData.size,
          uploadedAt: fileData.uploadedAt || new Date().toISOString(),
          storagePath,
          publicUrl,
          extractedText: fallbackSyllabus.rawText,
          topics: fallbackSyllabus.chapters,
          analysisComplete: true
        };
      });

      const results = await Promise.all(uploadPromises);
      const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null);
      const syllabusMap = Object.fromEntries(validResults.map(r => [r.subject, r]));

      // Update state
      setStudent(prev => ({
        ...prev,
        syllabusData: syllabusMap,
        syllabusUploaded: true
      }));
      setSyllabusData(syllabusMap);

      // Save to per-user localStorage key
      if (user?.id) {
        const userSyllabusKey = `gurumitra_syllabus_data_${user.id}`;
        localStorage.setItem(userSyllabusKey, JSON.stringify(syllabusMap));
      }

      setNotification({
        message: 'Syllabus uploaded and analyzed successfully with AI!',
        type: 'success'
      });

      return validResults;
    } catch (error) {
      console.error('Syllabus setup failed:', error);
      throw error;
    }
  };

  // Synchronize student profile whenever auth user changes (e.g. login, signup, demo)
  useEffect(() => {
    if (user) {
      setStudent((prev) => ({
        ...prev,
        // Update auth-dependent fields
        id: user.id,
        name: user.name,
        email: user.email,
        grade: user.grade || '10th',
        level: user.level || 'Intermediate',
        preferredSubjects: user.preferredSubjects,
        preferredStyle: user.preferredStyle,
        isDemo: user.isDemo,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt || user.created_at || new Date().toISOString()
      }));

      // If user selected preferred subjects, set active subject to first one if available
      if (user.preferredSubjects && user.preferredSubjects.length > 0) {
        setActiveSubjectState(user.preferredSubjects[0]);
      }

      // Restore syllabus data from localStorage using per-user key
      const userSyllabusKey = `gurumitra_syllabus_data_${user.id}`;
      try {
        const savedSyllabusData = localStorage.getItem(userSyllabusKey);
        if (savedSyllabusData) {
          const parsedData = JSON.parse(savedSyllabusData);
          setSyllabusData(parsedData);
          setStudent((prev) => ({ ...prev, syllabusData: parsedData, syllabusUploaded: true }));
        } else {
          // No syllabus for this user — reset to fresh state
          setSyllabusData({});
          setStudent((prev) => ({ ...prev, syllabusData: {}, syllabusUploaded: false }));
        }
      } catch (err) {
        console.error('Failed to restore syllabus data:', err);
        setSyllabusData({});
        setStudent((prev) => ({ ...prev, syllabusData: {}, syllabusUploaded: false }));
      }

      // Restore pre-assessment result from localStorage
      const userAssessKey = `gurumitra_pre_assessment_${user.id}`;
      try {
        const savedAssess = localStorage.getItem(userAssessKey);
        if (savedAssess) {
          setPreAssessmentResult(JSON.parse(savedAssess));
        } else {
          setPreAssessmentResult(null);
        }
      } catch {
        setPreAssessmentResult(null);
      }

      // Restore learning profile from localStorage
      const userProfileKey = `gurumitra_learning_profile_${user.id}`;
      try {
        const savedProfile = localStorage.getItem(userProfileKey);
        if (savedProfile) {
          setLearningProfile(JSON.parse(savedProfile));
        } else {
          setLearningProfile(null);
        }
      } catch {
        setLearningProfile(null);
      }
      // Restore learning plan from localStorage
      const userPlanKey = `gurumitra_learning_plan_${user.id}`;
      try {
        const savedPlan = localStorage.getItem(userPlanKey);
        if (savedPlan) {
          setActiveLearningPlan(JSON.parse(savedPlan));
        } else {
          setActiveLearningPlan(null);
        }
      } catch {
        setActiveLearningPlan(null);
      }

      // Restore quiz history from localStorage
      const userQuizKey = `gurumitra_quiz_history_${user.id}`;
      try {
        const savedQuizzes = localStorage.getItem(userQuizKey);
        if (savedQuizzes) {
          const parsed = JSON.parse(savedQuizzes);
          setQuizHistory(parsed);
          if (parsed.length > 0) {
            setLastQuizResult(parsed[0]);
          }
        } else {
          setQuizHistory([]);
          setLastQuizResult(null);
        }
      } catch {
        setQuizHistory([]);
        setLastQuizResult(null);
      }

      // Restore study sessions
      setAllStudySessions(getSavedStudySessions(user.id));
    } else {
      // User logged out — reset syllabus and assessment state completely
      setSyllabusData({});
      setStudent((prev) => ({ ...prev, syllabusData: {}, syllabusUploaded: false }));
      setPreAssessmentResult(null);
      setLearningProfile(null);
      setActiveLearningPlan(null);
      setQuizHistory([]);
      setAllStudySessions([]);
      setLastQuizResult(null);
    }
  }, [user]);

  const recordPreAssessmentResult = (result: PreAssessmentResult) => {
    setPreAssessmentResult(result);
    const userId = user?.id || 'guest_student';
    try {
      localStorage.setItem(`gurumitra_pre_assessment_${userId}`, JSON.stringify(result));
    } catch (e) {
      console.warn('Could not persist pre-assessment to localStorage:', e);
    }

    // Update student diagnostic baseline level
    const newLevel: DifficultyLevel = result.overallScore <= 50 ? 'Beginner' : result.overallScore <= 75 ? 'Intermediate' : 'Advanced';
    setStudent(prev => ({
      ...prev,
      level: newLevel,
      overallAccuracy: result.knowledgeScore
    }));

    // Seamlessly adapt Recommendations based on identified diagnostic gaps
    if (result.identifiedGaps.length > 0) {
      const adaptedRecs: RecommendationItem[] = result.identifiedGaps.slice(0, 4).map((gap, i) => ({
        id: `rec_diag_${gap.id}_${i}`,
        topic: gap.topic,
        subject: gap.subject,
        difficulty: gap.priority === 'High Priority' ? 'Beginner' : 'Intermediate',
        reason: gap.prerequisite
          ? `Diagnostic Gap: Master ${gap.prerequisite} before returning to ${gap.chapterName}.`
          : `Diagnostic Gap (${gap.accuracy}% accuracy in pre-assessment).`,
        duration: '15 mins',
        priority: gap.priority === 'High Priority' ? 'High Priority' : 'Practice',
        completed: false
      }));
      setRecommendations(prev => [...adaptedRecs, ...prev.filter(p => !p.id.startsWith('rec_diag_'))]);
    }

    // Add activity record
    const newActivity: ActivityItem = {
      id: `act_${Date.now()}`,
      type: 'adaptation',
      title: 'Diagnostic Pre-Assessment Completed',
      subtitle: `Scored ${result.overallScore}% (${result.learningLevel}) across ${result.totalQuestions} questions.`,
      time: 'Just now',
      tag: 'Pre-Assessment',
      badgeType: 'High Priority'
    };
    setActivities(prev => [newActivity, ...prev]);

    setNotification({
      message: `Diagnostic pre-assessment complete! Scored ${result.overallScore}%. Adaptive learning path updated.`,
      type: 'success'
    });
  };

  const clearPreAssessment = () => {
    setPreAssessmentResult(null);
    const userId = user?.id || 'guest_student';
    try {
      localStorage.removeItem(`gurumitra_pre_assessment_${userId}`);
    } catch {}
  };

  const recordLearningProfile = (profile: LearningProfile) => {
    setLearningProfile(profile);
    const userId = user?.id || 'guest_student';
    try {
      localStorage.setItem(`gurumitra_learning_profile_${userId}`, JSON.stringify(profile));
    } catch (e) {
      console.warn('Could not persist learning profile to localStorage:', e);
    }
  };

  const clearLearningProfile = () => {
    setLearningProfile(null);
    const userId = user?.id || 'guest_student';
    try {
      localStorage.removeItem(`gurumitra_learning_profile_${userId}`);
    } catch {}
  };

  const recordLearningPlan = (plan: StudentLearningPlan) => {
    setActiveLearningPlan(plan);
    const userId = user?.id || 'guest_student';
    try {
      localStorage.setItem(`gurumitra_learning_plan_${userId}`, JSON.stringify(plan));
    } catch (e) {
      console.warn('Could not persist learning plan to localStorage:', e);
    }
  };

  const clearLearningPlan = () => {
    setActiveLearningPlan(null);
    const userId = user?.id || 'guest_student';
    try {
      localStorage.removeItem(`gurumitra_learning_plan_${userId}`);
    } catch {}
  };

  const toggleStudyTaskCompletion = (dayDate: string, taskId: string) => {
    if (!activeLearningPlan) return;

    let isCompletedNow = false;
    const updatedDailyPlans = activeLearningPlan.dailyPlans.map(day => {
      if (day.date !== dayDate) return day;
      const updatedTasks = day.tasks.map(t => {
        if (t.id === taskId) {
          isCompletedNow = !t.completed;
          return {
            ...t,
            completed: isCompletedNow,
            completedAt: isCompletedNow ? new Date().toISOString() : undefined
          };
        }
        return t;
      });
      const allDone = updatedTasks.length > 0 && updatedTasks.every(t => t.completed);
      return {
        ...day,
        tasks: updatedTasks,
        isCompleted: allDone
      };
    });

    const updatedPlan: StudentLearningPlan = {
      ...activeLearningPlan,
      dailyPlans: updatedDailyPlans,
      updatedAt: new Date().toISOString()
    };

    recordLearningPlan(updatedPlan);
  };

  const completeTaskAndRecordSession = async (session: StudySessionRecord) => {
    const userId = user?.id || 'guest_student';
    // 1. Record the session persistently with user scoping
    await recordStudySession(session, userId);
    setAllStudySessions(getSavedStudySessions(userId));

    // 2. Mark the corresponding daily task as completed in activeLearningPlan
    if (activeLearningPlan) {
      let targetTaskId = session.taskId;
      if (!targetTaskId) {
        for (const day of activeLearningPlan.dailyPlans) {
          const match = day.tasks.find(t => !t.completed && t.subject === session.subject && (t.topic === session.topic || t.chapter === session.chapter));
          if (match) {
            targetTaskId = match.id;
            break;
          }
        }
      }

      if (targetTaskId) {
        const updatedDailyPlans = activeLearningPlan.dailyPlans.map(day => {
          const hasTask = day.tasks.some(t => t.id === targetTaskId);
          if (!hasTask) return day;

          const updatedTasks = day.tasks.map(t => {
            if (t.id === targetTaskId) {
              return {
                ...t,
                completed: true,
                completedAt: session.completedAt || new Date().toISOString()
              };
            }
            return t;
          });

          const allDone = updatedTasks.length > 0 && updatedTasks.every(t => t.completed);
          return {
            ...day,
            tasks: updatedTasks,
            isCompleted: allDone
          };
        });

        const updatedPlan: StudentLearningPlan = {
          ...activeLearningPlan,
          dailyPlans: updatedDailyPlans,
          updatedAt: new Date().toISOString()
        };

        recordLearningPlan(updatedPlan);
      }
    }
  };

  // Real progress metrics calculation derived from actual daily task completions and quiz history
  const progressMetrics = useMemo<RealProgressMetrics>(() => {
    const totalQuizzesTaken = quizHistory.length;
    const averageQuizScorePct = quizHistory.length > 0
      ? Math.round(quizHistory.reduce((acc, q) => acc + q.accuracy, 0) / quizHistory.length)
      : (student.overallAccuracy || 0);
    const totalStudyMinutes = allStudySessions.reduce((acc, s) => acc + (s.actualMinutes || s.allocatedMinutes || 0), 0) + (quizHistory.length * 10);
    const totalTopicsCount = subjects.reduce((acc, s) => acc + s.totalTopics, 0);
    const completedTopicsCount = subjects.reduce((acc, s) => acc + s.completedTopics, 0);

    if (!activeLearningPlan || !activeLearningPlan.dailyPlans || activeLearningPlan.dailyPlans.length === 0) {
      return {
        todayCompletedTasks: 0,
        todayTotalTasks: 0,
        todayProgressPct: 0,
        weekCompletedTasks: 0,
        weekTotalTasks: 0,
        weekProgressPct: 0,
        overallCompletedTasks: 0,
        overallTotalTasks: 0,
        overallProgressPct: 0,
        totalQuizzesTaken,
        averageQuizScorePct,
        totalStudyMinutes,
        totalTopicsCount,
        completedTopicsCount
      };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const allDays = activeLearningPlan.dailyPlans;

    // All scheduled tasks
    const allTasks = allDays.flatMap(d => d.tasks);
    const overallTotalTasks = allTasks.length;
    const overallCompletedTasks = allTasks.filter(t => t.completed).length;
    const overallProgressPct = overallTotalTasks > 0 ? Math.round((overallCompletedTasks / overallTotalTasks) * 100) : 0;

    // Today's tasks (matched to current date or active day)
    let todayPlan = allDays.find(d => d.date === todayStr);
    if (!todayPlan && allDays.length > 0) {
      todayPlan = allDays.find(d => d.tasks.some(t => !t.completed)) || allDays[0];
    }
    const todayTasks = todayPlan ? todayPlan.tasks : [];
    const todayTotalTasks = todayTasks.length;
    const todayCompletedTasks = todayTasks.filter(t => t.completed).length;
    const todayProgressPct = todayTotalTasks > 0 ? Math.round((todayCompletedTasks / todayTotalTasks) * 100) : 0;

    // Current week's tasks (first 7 days runway)
    const weekPlans = allDays.slice(0, 7);
    const weekTasks = weekPlans.flatMap(d => d.tasks);
    const weekTotalTasks = weekTasks.length;
    const weekCompletedTasks = weekTasks.filter(t => t.completed).length;
    const weekProgressPct = weekTotalTasks > 0 ? Math.round((weekCompletedTasks / weekTotalTasks) * 100) : 0;

    return {
      todayCompletedTasks,
      todayTotalTasks,
      todayProgressPct,
      weekCompletedTasks,
      weekTotalTasks,
      weekProgressPct,
      overallCompletedTasks,
      overallTotalTasks,
      overallProgressPct,
      totalQuizzesTaken,
      averageQuizScorePct,
      totalStudyMinutes,
      totalTopicsCount,
      completedTopicsCount
    };
  }, [activeLearningPlan, quizHistory, allStudySessions, subjects, student.overallAccuracy]);

  // Recalculate real subject progress whenever learning plan or pre-assessment updates
  useEffect(() => {
    if (!activeLearningPlan || !activeLearningPlan.dailyPlans) return;

    const allTasks = activeLearningPlan.dailyPlans.flatMap(d => d.tasks);
    if (allTasks.length === 0) return;

    setSubjects(prev =>
      prev.map(sub => {
        const subTasks = allTasks.filter(t => t.subject.toLowerCase() === sub.name.toLowerCase());
        if (subTasks.length === 0) return sub;

        const completedCount = subTasks.filter(t => t.completed).length;
        const totalCount = subTasks.length;
        const calculatedProgress = Math.round((completedCount / totalCount) * 100);

        // Derive mastery from preAssessment diagnostic or active performance
        let calculatedAccuracy = sub.accuracy;
        if (preAssessmentResult) {
          const subQs = preAssessmentResult.questionPerformance.filter(
            q => q.subject.toLowerCase() === sub.name.toLowerCase()
          );
          if (subQs.length > 0) {
            calculatedAccuracy = Math.round((subQs.filter(q => q.isCorrect).length / subQs.length) * 100);
          }
        }

        return {
          ...sub,
          progress: calculatedProgress,
          completedTopics: completedCount,
          totalTopics: totalCount,
          accuracy: calculatedAccuracy
        };
      })
    );

    // Update overallProgress on student profile
    const totalScheduled = allTasks.length;
    const totalDone = allTasks.filter(t => t.completed).length;
    const calculatedOverall = totalScheduled > 0 ? Math.round((totalDone / totalScheduled) * 100) : 0;

    setStudent(prev => ({
      ...prev,
      overallProgress: calculatedOverall,
      completedLessons: totalDone
    }));
  }, [activeLearningPlan, preAssessmentResult]);

  const clearNotification = () => setNotification(null);

  const setPreferredStyle = (style: LearningStyle) => {
    setStudent((prev) => ({ ...prev, preferredStyle: style }));
    setNotification({
      message: `Preferred learning style updated to "${style}". AI content adapted!`,
      type: 'info'
    });
  };

  const updateProfile = (name: string, grade: string, style: LearningStyle, board?: BoardType, stream?: StreamType) => {
    setStudent((prev) => ({
      ...prev,
      name,
      grade,
      preferredStyle: style,
      board: board || prev.board,
      stream: stream || prev.stream
    }));
    setNotification({
      message: 'Student profile updated successfully!',
      type: 'success'
    });
  };

  const toggleStudyPlanItem = (id: string) => {
    setStudyPlan((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  // CORE USP: DYNAMIC ADAPTATION ENGINE
  const recordQuizResult = (result: QuizResult) => {
    const enrichedResult: QuizResult = {
      ...result,
      id: result.id || `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: result.timestamp || new Date().toISOString()
    };

    setLastQuizResult(enrichedResult);

    const userId = user?.id || 'guest_student';
    const userQuizKey = `gurumitra_quiz_history_${userId}`;
    setQuizHistory((prev) => {
      const updated = [enrichedResult, ...prev.filter(q => q.id !== enrichedResult.id)].slice(0, 50);
      try {
        localStorage.setItem(userQuizKey, JSON.stringify(updated));
      } catch (e) {
        console.warn('Could not persist quiz history:', e);
      }
      return updated;
    });

    const { accuracy, score, totalQuestions, subject, topic } = enrichedResult;

    let newLevel: DifficultyLevel = student.level;
    let adaptationMsg = '';
    let notificationType: 'success' | 'info' | 'warning' = 'info';

    if (accuracy > 80) {
      newLevel = 'Advanced';
      adaptationMsg = 'Great performance! Difficulty increased to Advanced. Unlocked advanced challenges!';
      notificationType = 'success';
    } else if (accuracy >= 60) {
      newLevel = 'Intermediate';
      adaptationMsg = "You're progressing steadily. Continue at Intermediate level.";
      notificationType = 'info';
    } else {
      newLevel = 'Beginner';
      adaptationMsg = "Let's strengthen the basics before moving ahead. Difficulty adjusted to Beginner (Revision).";
      notificationType = 'warning';
    }

    // 1. Update Student Profile
    const xpGained = accuracy >= 80 ? 150 : accuracy >= 60 ? 80 : 40;
    setStudent((prev) => {
      const currentAcc = prev.overallAccuracy ?? 80;
      const currentProg = prev.overallProgress ?? 70;
      const currentXp = prev.xp ?? 1000;
      const currentLessons = prev.completedLessons ?? 10;
      const newAcc = Math.round((currentAcc * 4 + accuracy) / 5);
      const newProg = Math.min(100, currentProg + 2);
      return {
        ...prev,
        level: newLevel,
        overallAccuracy: newAcc,
        overallProgress: newProg,
        xp: currentXp + xpGained,
        completedLessons: currentLessons + 1
      };
    });

    // 2. Update Subject Matrix
    setSubjects((prev) =>
      prev.map((sub) => {
        if (sub.name === subject) {
          const updatedStrengths = [...sub.strengths];
          const updatedWeaknesses = [...sub.weaknesses];

          if (accuracy >= 80) {
            if (!updatedStrengths.includes(topic)) updatedStrengths.push(topic);
            const idx = updatedWeaknesses.indexOf(topic);
            if (idx > -1) updatedWeaknesses.splice(idx, 1);
          } else if (accuracy < 60) {
            if (!updatedWeaknesses.includes(topic)) updatedWeaknesses.push(topic);
            const idx = updatedStrengths.indexOf(topic);
            if (idx > -1) updatedStrengths.splice(idx, 1);
          }

          return {
            ...sub,
            accuracy: Math.round((sub.accuracy + accuracy) / 2),
            level: newLevel,
            completedTopics: Math.min(sub.totalTopics, sub.completedTopics + 1),
            strengths: updatedStrengths,
            weaknesses: updatedWeaknesses
          };
        }
        return sub;
      })
    );

    // 3. Update Recommendations Queue Dynamically
    if (accuracy < 60) {
      const remedialRec: RecommendationItem = {
        id: `rec-${Date.now()}`,
        topic: `${topic} Basics`,
        subject: subject,
        difficulty: 'Beginner',
        reason: `Recommended because your recent accuracy in ${topic} was ${accuracy}%.`,
        duration: '15 min',
        priority: 'High Priority'
      };
      setRecommendations((prev) => [remedialRec, ...prev.slice(0, 4)]);

      // Add high priority study plan item
      const newPlanItem: StudyPlanItem = {
        id: `plan-${Date.now()}`,
        title: `Revise ${topic} Basics`,
        duration: '15 min',
        type: 'High Priority',
        subject: subject,
        completed: false
      };
      setStudyPlan((prev) => [newPlanItem, ...prev.slice(0, 3)]);

      // Update Learning Path to insert remedial revision
      setLearningPath((prev) =>
        prev.map((node) => {
          if (node.title.toLowerCase().includes(topic.toLowerCase()) || node.id === 'path-4') {
            return {
              ...node,
              status: 'revision',
              description: `AI flagged this node for remedial reinforcement (${accuracy}% accuracy).`
            };
          }
          return node;
        })
      );
    } else if (accuracy >= 80) {
      const advancedRec: RecommendationItem = {
        id: `rec-${Date.now()}`,
        topic: `Advanced ${topic} & Applications`,
        subject: subject,
        difficulty: 'Advanced',
        reason: `High mastery demonstrated (${accuracy}%). Advancing to deep-dive applications!`,
        duration: '20 min',
        priority: 'On Track'
      };
      setRecommendations((prev) => [advancedRec, ...prev.slice(0, 4)]);

      // Unlock next node in Learning Path
      setLearningPath((prev) =>
        prev.map((node, index) => {
          if (node.status === 'locked' && index <= 4) {
            return { ...node, status: 'current', description: 'Unlocked based on high performance!' };
          }
          return node;
        })
      );
    }

    // 4. Add Activity Log
    const newActivity: ActivityItem = {
      id: `act-${Date.now()}`,
      type: 'quiz',
      title: `Quiz completed: ${topic}`,
      subtitle: `${subject} • Score: ${score}/${totalQuestions} (${accuracy}%)`,
      time: 'Just now',
      tag: `Accuracy: ${accuracy}%`,
      badgeType: accuracy >= 80 ? 'On Track' : accuracy >= 60 ? 'Practice' : 'High Priority'
    };

    const adaptationActivity: ActivityItem = {
      id: `act-adapt-${Date.now()}`,
      type: 'adaptation',
      title: 'AI Engine Adapted Curriculum',
      subtitle: adaptationMsg,
      time: 'Just now',
      tag: newLevel,
      badgeType: accuracy >= 80 ? 'On Track' : accuracy >= 60 ? 'Practice' : 'High Priority'
    };

    setActivities((prev) => [newActivity, adaptationActivity, ...prev.slice(0, 4)]);

    // 5. Trigger System Notification
    setNotification({
      message: `Quiz Submitted: ${score}/${totalQuestions} (${accuracy}%). ${adaptationMsg}`,
      type: notificationType
    });
  };

  const resetToDefault = () => {
    setStudent({
      // Auth fields (from user or defaults)
      id: user ? user.id : 'user-demo-sally-sharma',
      name: user ? user.name : 'Sally Sharma',
      email: user ? user.email : 'sally.demo@example.com',
      grade: user ? user.grade : 'Class 10',
      board: user ? (user.board || 'CBSE') : 'CBSE',
      stream: user ? (user.stream || 'Not applicable') : 'Not applicable',
      level: user ? user.level : 'Intermediate',
      preferredSubjects: user ? user.preferredSubjects : ['Mathematics', 'Science', 'English', 'Computer Science', 'Social Science'],
      preferredStyle: user ? user.preferredStyle : 'Simple',
      isDemo: user ? user.isDemo : true,
      emailVerified: user ? user.emailVerified : true,
      createdAt: user ? (user.createdAt || user.created_at || new Date().toISOString()) : new Date().toISOString(),
      // Client-specific fields with defaults
      streak: 4,
      totalPoints: 1420,
      rank: 76,
      syllabusUploaded: false,
      syllabusData: {}
    });
    setSubjects(INITIAL_SUBJECTS);
    setRecommendations(INITIAL_RECOMMENDATIONS);
    setStudyPlan(INITIAL_STUDY_PLAN);
    setLearningPath(INITIAL_LEARNING_PATH);
    setActivities(INITIAL_ACTIVITIES);
    setLastQuizResult(null);
    setQuizHistory([]);
    setAllStudySessions([]);
    setJudgeDemoStep(0);
    setUploadedMaterial(null);
    setUploadState('idle');
    setUploadError(null);
    setNotification({
      message: 'State reset to initial baseline successfully!',
      type: 'info'
    });
  };

  const resetDemo = () => {
    const demoId = user?.id || 'user-demo-sally-sharma';
    const keysToRemove = [
      `gurumitra_syllabus_data_${demoId}`,
      `gurumitra_quiz_history_${demoId}`,
      `gurumitra_study_sessions_${demoId}`,
      `gurumitra_pre_assessment_${demoId}`,
      `gurumitra_learning_plan_${demoId}`,
      `gurumitra_learning_profile_${demoId}`,
      `student_profile_${demoId}`
    ];
    keysToRemove.forEach(k => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });

    setStudent({
      id: demoId,
      name: 'Sally Sharma',
      email: 'sally.demo@example.com',
      grade: 'Class 10',
      board: 'CBSE',
      stream: 'Not applicable',
      level: 'Intermediate',
      preferredSubjects: ['Mathematics', 'Science', 'English', 'Computer Science', 'Social Science'],
      preferredStyle: 'Simple',
      isDemo: true,
      emailVerified: true,
      createdAt: new Date().toISOString(),
      streak: 4,
      totalPoints: 1420,
      rank: 76,
      syllabusUploaded: false,
      syllabusData: {}
    });

    setSubjects(INITIAL_SUBJECTS);
    setRecommendations(INITIAL_RECOMMENDATIONS);
    setStudyPlan(INITIAL_STUDY_PLAN);
    setLearningPath(INITIAL_LEARNING_PATH);
    setActivities(INITIAL_ACTIVITIES);
    setLastQuizResult(null);
    setQuizHistory([]);
    setAllStudySessions([]);
    setPreAssessmentResult(null);
    setLearningProfile(null);
    setActiveLearningPlan(null);
    setJudgeDemoStep(0);
    setUploadedMaterial(null);
    setUploadState('idle');
    setUploadError(null);
    setActiveTab('dashboard');

    setNotification({
      message: 'Demo mode reset to fresh presentation baseline! Ready for complete onboarding flow.',
      type: 'info'
    });
  };

  return (
    <StudentContext.Provider
      value={{
        student,
        subjects,
        recommendations,
        studyPlan,
        learningPath,
        activities,
        activeTab,
        activeSubject,
        lastQuizResult,
        quizHistory,
        allStudySessions,
        notification,
        judgeDemoStep,
        syllabusData,
        syllabusUploaded: student.syllabusUploaded,
        uploadedMaterial,
        uploadState,
        uploadError,
        currentLearningContext,
        setCurrentLearningContext,
        setActiveTab,
        setActiveSubject,
        setPreferredStyle,
        updateProfile,
        toggleStudyPlanItem,
        recordQuizResult,
        setJudgeDemoStep,
        completeSyllabusSetup,
        extractAndAnalyzeTopics,
        setSyllabusAnalysis,
        processAndSetFile,
        removeUploadedMaterial,
        clearUploadError,
        setTopicContext,
        startQuizForCurrentTopic,
        setAcademicProfile,
        resetToDefault,
        resetDemo,
        clearNotification,
        preAssessmentResult,
        preAssessmentQuestions,
        isGeneratingAssessment,
        setIsGeneratingAssessment,
        recordPreAssessmentResult,
        clearPreAssessment,
        setPreAssessmentQuestions,
        learningProfile,
        plannerStep,
        selectedPlannerSubjects,
        setPlannerStep,
        setSelectedPlannerSubjects,
        recordLearningProfile,
        clearLearningProfile,
        activeLearningPlan,
        recordLearningPlan,
        clearLearningPlan,
        toggleStudyTaskCompletion,
        completeTaskAndRecordSession,
        progressMetrics
      }}
    >
      {children}
    </StudentContext.Provider>
  );
};

export const useStudent = () => {
  const context = useContext(StudentContext);
  if (!context) {
    throw new Error('useStudent must be used within a StudentProvider');
  }
  return context;
};