export type LearningStyle = 'Simple' | 'Analogy' | 'Visual' | 'Exam-oriented';

export type ClassLevel =
  | 'Class 6'
  | 'Class 7'
  | 'Class 8'
  | 'Class 9'
  | 'Class 10'
  | 'Class 11'
  | 'Class 12';

export type BoardType = 'CBSE' | 'ICSE' | 'UP Board';

export type StreamType = 'Science' | 'Commerce' | 'Humanities / Arts' | 'Not applicable';

export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export type SubjectType =
  | 'Mathematics'
  | 'Science'
  | 'Physics'
  | 'Chemistry'
  | 'Biology'
  | 'English'
  | 'Computer Science'
  | 'Social Science'
  | 'Accountancy'
  | 'Business Studies'
  | 'Economics'
  | 'Hindi'
  | 'History'
  | 'Political Science'
  | 'Geography'
  | string;

export interface CurriculumTopic {
  id: string;
  title: string;
  difficulty: DifficultyLevel;
  keyPoints: string[];
  formulas?: string[];
  summary: string;
}

export interface CurriculumChapter {
  id: string;
  number: number;
  title: string;
  subject: string;
  classLevel: ClassLevel;
  board: BoardType;
  stream?: StreamType;
  description: string;
  topics: CurriculumTopic[];
}

export interface PedagogicalStyleContent {
  heading: string;
  paragraph: string;
  subtext: string;
  tip: string;
  bulletPoints?: string[];
  exampleBox?: string;
  analogyDetails?: {
    analogyTitle: string;
    analogyStory: string;
    conceptMapping: { realWorld: string; concept: string }[];
  };
  visualDiagram?: string;
  comparisonTable?: {
    headers: string[];
    rows: string[][];
  };
  visualSteps?: string[];
  examBreakdown?: {
    definition: string;
    keyPoints: string[];
    formulas: string[];
    importantFacts?: string[];
    commonMistakes: string[];
    examTips: string[];
    practiceQuestions: { question: string; marks: string; solution: string }[];
  };
}

export interface CurriculumLessonContent {
  subject: string;
  classLevel: ClassLevel;
  board: BoardType;
  stream: StreamType;
  chapterId: string;
  chapterTitle: string;
  topicId: string;
  topicTitle: string;
  difficulty: DifficultyLevel;
  progress: number;
  styles: Record<LearningStyle, PedagogicalStyleContent>;
}

export interface CurrentLearningContext {
  classLevel: ClassLevel;
  board: BoardType;
  stream: StreamType;
  subject: SubjectType;
  chapter: string;
  chapterId?: string;
  topic: string;
  topicId?: string;
  learningStyle: LearningStyle;
  difficulty: DifficultyLevel;
  allocatedMinutes?: number;
  taskId?: string;
  dayDate?: string;
  subtopics?: string[];
  isWeakTopic?: boolean;
  activityType?: string;
  studentLevel?: 'Weak' | 'Average' | 'Strong';
}

export interface StudentAcademicProfile {
  grade: ClassLevel;
  board: BoardType;
  stream: StreamType;
  preferredStyle: LearningStyle;
  level: DifficultyLevel;
}

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  grade: string;
  level: DifficultyLevel;
  preferredSubjects: SubjectType[];
  preferredStyle: LearningStyle;
  isDemo?: boolean;
  emailVerified?: boolean;
  createdAt: string;
  created_at?: string;
  streak: number;
  totalPoints?: number;
  rank?: number;
  overallProgress?: number;
  overallAccuracy?: number;
  completedLessons?: number;
  xp?: number;
  board?: BoardType;
  stream?: StreamType;
  classLevel?: ClassLevel;
  syllabusUploaded?: boolean;
  syllabusData?: Record<string, any>;
}

export interface SubjectData {
  id: string;
  name: SubjectType;
  progress: number;
  level: DifficultyLevel;
  accuracy: number;
  completedTopics: number;
  totalTopics: number;
  strengths: string[];
  weaknesses: string[];
  icon: string;
  color: string;
  bgLight: string;
  description: string;
  topics?: string[];
}

export interface RecommendationItem {
  id: string;
  topic: string;
  subject: SubjectType;
  difficulty: DifficultyLevel;
  reason: string;
  duration: string;
  priority: 'High Priority' | 'Practice' | 'On Track';
  completed?: boolean;
}

export interface StudyPlanItem {
  id: string;
  title: string;
  duration: string;
  type: 'High Priority' | 'Practice' | 'All Topics' | 'Summary';
  subject?: SubjectType;
  completed: boolean;
}

export interface LearningPathNode {
  id: string;
  title: string;
  subject: SubjectType;
  status: 'completed' | 'current' | 'locked' | 'revision';
  level: DifficultyLevel;
  description: string;
  stepNumber: number;
}

export interface ActivityItem {
  id: string;
  type: 'quiz' | 'plan' | 'lesson' | 'adaptation';
  title: string;
  subtitle: string;
  time: string;
  tag?: string;
  badgeType?: 'High Priority' | 'Practice' | 'On Track';
}

export interface QuizQuestion {
  id: string;
  subject: SubjectType;
  topic: string;
  difficulty: DifficultyLevel;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hint?: string;
  chapter?: string;
  board?: BoardType;
  classLevel?: ClassLevel;
}

export interface QuizResult {
  id?: string;
  timestamp?: string;
  chapter?: string;
  timeSpentSeconds?: number;
  score: number;
  totalQuestions: number;
  accuracy: number;
  subject: SubjectType;
  topic: string;
  difficulty: DifficultyLevel;
  strongTopics: string[];
  weakTopics: string[];
  adaptationMessage: string;
  newDifficulty: DifficultyLevel;
  recommendedTopic: string;
  userAnswers: { questionIndex: number; selectedIndex: number; isCorrect: boolean }[];
}

export interface ParsedMaterial {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileSizeFormatted: string;
  extractedText: string;
  summaryPreview: string;
  wordCount: number;
  topics: {
    title: string;
    concepts: string;
  }[];
  uploadedAt: string;
}

export interface TutorMessage {
  id: string;
  sender: 'student' | 'tutor';
  text: string;
  timestamp: string;
  subject?: SubjectType;
  styleUsed?: LearningStyle;
  attachedFile?: any;
  structuredResponse?: {
    responseType?: 'conceptual' | 'mathematical' | 'programming' | 'document' | 'general' | string;
    crossSubjectNotice?: any;
    directAnswer: string;
    simpleExplanation: string;
    example?: string;
    stepByStep?: string[];
    analogy?: string;
    keyConcept: string;
    formulaOrCode?: string;
    codeExplanation?: string;
    complexity?: {
      time: string;
      space: string;
    };
    visualDiagram?: string;
    relevantContentFound?: any;
    documentReference?: any;
    followUpQuestions?: string[];
    practiceQuestion?: {
      question: string;
      options?: string[];
      answer: string;
    };
  };
}

export interface UserProfile {
  id: string;
  full_name: string;
  learning_level: DifficultyLevel;
  preferred_subjects: SubjectType[];
  grade?: ClassLevel | string;
  board?: BoardType;
  stream?: StreamType;
  created_at?: string;
  updated_at?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  grade: string;
  level: DifficultyLevel;
  preferredSubjects: SubjectType[];
  preferredStyle: LearningStyle;
  isDemo?: boolean;
  emailVerified?: boolean;
  createdAt: string;
  created_at?: string;
  board?: BoardType;
  stream?: StreamType;
  classLevel?: ClassLevel;
  syllabusData?: Record<string, {
    fileName: string;
    fileSize: number;
    uploadedAt: string;
    storagePath?: string;
    publicUrl?: string;
    extractedText: string;
    topics: string[]; // Detected topics from PDF
    examFocusedTopics?: Record<string, string[]>; // Chapter -> exam-focused topics (4-5 per chapter)
    analysisComplete: boolean;
    [key: string]: any;
  }>;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignUpData {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
  grade?: ClassLevel | string;
  board?: BoardType;
  stream?: StreamType;
  level: DifficultyLevel;
  preferredSubjects: SubjectType[];
}

export interface SyllabusFile {
  subjectName: SubjectType;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
}

// ============================================================================
// AI-POWERED PRE-ASSESSMENT & DIAGNOSTIC FOUNDATION TYPES
// ============================================================================

export type PreAssessmentDifficulty = 'easy' | 'moderate' | 'difficult';

export interface ExtractedChapter {
  chapterId: string;
  chapterName: string;
  subject: SubjectType;
  topics: string[];
  prerequisites?: string[];
  importantConcepts?: string[];
  classLevel?: string;
  pageNumber?: number;
  pageRange?: { startPage: number; endPage?: number };
  sourceMethod?: 'table_of_contents' | 'heading_detection' | 'document_structure';
  contentSlice?: string;
}

export interface ChapterContentBoundary {
  chapterId: string;
  chapterName: string;
  subject: SubjectType;
  startOffset: number;
  endOffset: number;
  pageRange?: { startPage: number; endPage?: number };
  topics: string[];
  contentSlice: string;
}

export interface AllowedContentMap {
  selectedSubjects: SubjectType[];
  allowedChapters: ExtractedChapter[];
  allowedTopics: {
    topic: string;
    chapterName: string;
    subject: SubjectType;
  }[];
  chapterBoundaries?: Record<string, ChapterContentBoundary>;
}

export interface QuestionValidationResult {
  valid: boolean;
  reasons: string[];
}

export interface PreAssessmentQuestion {
  questionId: string;
  chapterId: string;
  chapterName: string;
  topic: string;
  difficulty: PreAssessmentDifficulty;
  question: string;
  options: string[]; // Exactly 4 options
  correctOption: number; // 0, 1, 2, or 3
  explanation: string;
  sourcePage?: number;
  subject: SubjectType;
  cognitiveType?: QuestionCognitiveType;
}

export type QuestionCognitiveType =
  | 'definition'
  | 'formula'
  | 'calculation'
  | 'conceptual'
  | 'correct_statement'
  | 'incorrect_statement'
  | 'example'
  | 'classification'
  | 'assertion'
  | 'matching';

export interface QuestionPerformanceRecord {
  questionId: string;
  chapterId: string;
  chapterName: string;
  topic: string;
  subject: SubjectType;
  difficulty: PreAssessmentDifficulty;
  selectedOption: number | null;
  correctOption: number;
  isCorrect: boolean;
  timeSpentSeconds: number;
  expectedTimeSeconds: number;
  questionText?: string;
  options?: string[];
  explanation?: string;
}

export interface LearningGapEvidence {
  questionIndex: number;
  questionText: string;
  difficulty: PreAssessmentDifficulty;
  isCorrect: boolean;
  userAnswerText?: string;
  correctAnswerText?: string;
}

export interface LearningGapItem {
  id: string;
  subject: SubjectType;
  chapterId: string;
  chapterName: string;
  topic: string;
  priority: 'High Priority' | 'Needs Practice' | 'Developing' | 'Strong';
  accuracy: number;
  totalQuestions: number;
  incorrectQuestions: number;
  evidence: LearningGapEvidence[];
  prerequisite?: string;
}

export type LearningLevelCategory =
  | 'Needs Foundation'
  | 'Beginner'
  | 'Developing'
  | 'Proficient'
  | 'Strong';

export interface RecommendedNextAction {
  step: number;
  title: string;
  description: string;
  actionType: 'review' | 'practice' | 'reassess';
  topic: string;
  chapter: string;
  subject: SubjectType;
}

export interface PreAssessmentResult {
  studentId: string;
  assessmentId: string;
  overallScore: number; // 0-100
  learningLevel: LearningLevelCategory;
  knowledgeScore: number; // 0-100 (80% weight)
  timeEfficiencyScore: number; // 0-100 (20% weight)
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredAnswers: number;
  totalTimeSeconds: number;
  averageTimeSeconds: number;
  chapterPerformance: Record<string, {
    chapterName: string;
    subject: SubjectType;
    accuracy: number;
    total: number;
    correct: number;
    easyAccuracy: number;
    moderateAccuracy: number;
    difficultAccuracy: number;
  }>;
  topicPerformance: Record<string, {
    topicName: string;
    chapterName: string;
    subject: SubjectType;
    accuracy: number;
    total: number;
    correct: number;
  }>;
  subjectPerformance?: Record<string, {
    total: number;
    correct: number;
    percentage: number;
  }>;
  difficultyPerformance: {
    easy: { correct: number; total: number; accuracy: number };
    moderate: { correct: number; total: number; accuracy: number };
    difficult: { correct: number; total: number; accuracy: number };
  };
  questionPerformance: QuestionPerformanceRecord[];
  identifiedGaps: LearningGapItem[];
  strengths: string[];
  recommendedNextActions: RecommendedNextAction[];
  aiRecommendation?: {
    summary: string;
    strengthSummary: string;
    gapSummary: string;
    nextSteps: string[];
  };
  isDemoMode?: boolean;
  createdAt: string;
}

export interface ChapterQuestionAllocation {
  chapterId: string;
  chapterName: string;
  subject: SubjectType;
  topics: string[];
  totalQuestions?: number;
  totalCount: number;
  easyCount: number;
  moderateCount: number;
  difficultCount: number;
}

// ============================================================================
// LEARNING PATH PLANNING & AI SYLLABUS ANALYSIS TYPES
// ============================================================================

export type UnderstandingStatus =
  | 'strong'
  | 'developing'
  | 'needs_attention'
  | 'not_assessed';

export type UnderstandingConfidence = 'high' | 'medium' | 'low' | 'none';

export interface TopicAnalysisItem {
  topicId: string;
  topicName: string;
  understanding: number | null; // null indicates 'Not Assessed', NEVER 0
  status: UnderstandingStatus;
  questionCount: number;
  correctCount?: number;
}

export interface ChapterAnalysisItem {
  chapterId: string;
  chapterName: string;
  subject: SubjectType;
  understanding: number | null; // null indicates 'Not Assessed', NEVER 0
  confidence: UnderstandingConfidence;
  status: UnderstandingStatus;
  questionCount: number;
  correctCount: number;
  incorrectCount: number;
  difficultyBreakdown?: {
    easy: { correct: number; total: number };
    moderate: { correct: number; total: number };
    difficult: { correct: number; total: number };
  };
  evidence?: {
    questionIndex: number;
    questionText: string;
    difficulty: PreAssessmentDifficulty;
    isCorrect: boolean;
    userAnswerText?: string;
    correctAnswerText?: string;
  }[];
  topics: TopicAnalysisItem[];
  priority?: 'High Priority' | 'Practice' | 'On Track' | 'Explore';
  recommendedAction?: string;
}

export interface SubjectLearningProfile {
  subjectId: string;
  subjectName: SubjectType;
  assessmentUnderstanding: number | null; // Overall subject diagnostic understanding %
  syllabusFileName?: string;
  syllabusFileSize?: number;
  extractedAt?: string;
  totalChapters: number;
  assessedChaptersCount: number;
  unassessedChaptersCount: number;
  strongAreasCount: number;
  needsPracticeCount: number;
  needsAttentionCount: number;
  chapters: ChapterAnalysisItem[];
  aiPedagogicalSummary?: {
    strengths: string[];
    gaps: string[];
    immediatePriorities: string[];
  };
}

export interface LearningProfile {
  studentId: string;
  updatedAt: string;
  subjects: Record<string, SubjectLearningProfile>;
}

// ============================================================================
// VERIFIED CURRICULUM & ADAPTIVE COMPANION ENGINE TYPES
// ============================================================================

export type PerformanceCategory =
  | 'Needs Significant Improvement'
  | 'Needs Improvement'
  | 'Developing'
  | 'Strong'
  | 'Mastered';

export interface CurriculumTopicRecord {
  id: string;
  name: string;
  subtopics?: string[];
}

export interface CurriculumChapterRecord {
  id: string;
  name: string;
  chapterNumber: number;
  description?: string;
  topics: CurriculumTopicRecord[];
}

export interface CurriculumSubjectRecord {
  id: string;
  name: SubjectType;
  code?: string;
  icon?: string;
  color?: string;
  chapters: CurriculumChapterRecord[];
}

export interface CurriculumVersion {
  id: string;
  board: BoardType | string;
  classLevel: ClassLevel | string;
  academicYear: string; // '2026-27'
  sourceName: string; // 'CBSE Academic Official'
  sourceUrl: string;
  version: string;
  isActive: boolean;
  lastVerifiedAt: string;
  subjects: CurriculumSubjectRecord[];
}

export interface DailyStudyTask {
  id: string;
  subject: SubjectType;
  chapter: string;
  topic: string;
  subtopic?: string;
  subtopics?: string[];
  activity: 'Learn' | 'Practice' | 'Learn + Practice' | 'Revision' | 'Weekly Test' | 'Remedial Review';
  durationMinutes: number;
  completed: boolean;
  missed?: boolean;
  isMissed?: boolean;
  rescheduled?: boolean;
  isRevision?: boolean;
  isWeakTopic?: boolean;
  priority?: 'High Priority' | 'Moderate' | 'Light';
  completedAt?: string;
}

export interface DailyStudyPlan {
  date: string; // YYYY-MM-DD
  day: string; // 'Monday', 'Sunday'
  dayOfWeek?: string;
  isRestDay: boolean; // Sunday
  restDayNote?: string;
  isRevisionPeriod?: boolean; // Final 7 days buffer
  isWeeklyTestDay?: boolean;
  isCompleted?: boolean;
  tasks: DailyStudyTask[];
  totalStudyMinutes: number;
}

export interface StudentLearningPlan {
  id: string;
  studentId: string;
  curriculumVersionId: string;
  academicYear: string;
  classLevel: ClassLevel | string;
  board: BoardType | string;
  examDate: string; // YYYY-MM-DD
  targetCompletionDate: string; // YYYY-MM-DD
  syllabusCompletionTarget?: string;
  daysAvailable: number;
  studyDaysCount?: number;
  restDaysCount?: number;
  revisionDaysCount?: number;
  hasBufferConflict: boolean;
  conflictMessage?: string;
  selectedSubjects: SubjectType[];
  selectedChapters: Record<string, string[]>; // Subject -> chapter names
  selectedChaptersCount?: number;
  dailyMinutesBudget?: number;
  dailyPlans: DailyStudyPlan[];
  performanceSnapshot: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyTestQuestion {
  id: string;
  subject: SubjectType;
  chapter: string;
  topic: string;
  difficulty: PreAssessmentDifficulty;
  question: string;
  options: string[];
  correctOption: number;
  explanation: string;
}

export interface WeeklyTestRecord {
  id: string;
  studentId: string;
  weekNumber: number;
  subject: SubjectType;
  score: number;
  totalQuestions: number;
  percentage: number;
  weakTopics: string[];
  strongTopics: string[];
  questionsData: WeeklyTestQuestion[];
  studentAnswers: Record<string, number>;
  adaptedPlanGenerated: boolean;
  completedAt: string;
}

// -------------------------------------------------------------
// AI ADAPTIVE STUDY SESSION TYPES
// -------------------------------------------------------------

export interface AdaptiveSubtopic {
  id: string;
  title: string;
  explanation: string;
  formulaOrRule?: string;
  intuition?: string;
  example?: string;
  commonMistake?: string;
  importantPoints?: string[];
}

export interface AdaptiveTheoryQuestion {
  id: string;
  question: string;
  difficulty: 'easy' | 'moderate' | 'hard';
  options: string[];
  correctOptionIndex: number;
  answer: string;
  explanation: string;
  conceptTested?: string;
}

export interface AdaptivePracticeQuestion {
  id: string;
  question: string;
  difficulty: 'easy' | 'moderate' | 'hard';
  options: string[];
  correctOptionIndex: number;
  answer: string;
  explanation: string;
  hint?: string;
}

export interface AdaptiveTheoryReviewQuestion {
  id: string;
  question: string;
  theoreticalAnswer: string;
  keyPoints?: string[];
  boardMarkingTip?: string;
}

export interface AdaptiveLessonContent {
  id: string;
  subject: string;
  chapter: string;
  topic: string;
  studentLevel?: 'Weak' | 'Average' | 'Strong';
  difficulty_level: string;
  learning_objectives: string[];
  subtopics: AdaptiveSubtopic[];
  theory: string;
  theory_qa?: AdaptiveTheoryReviewQuestion[];
  questions: AdaptiveTheoryQuestion[];
  summary: string[];
  practice_questions: AdaptivePracticeQuestion[];
  allocatedMinutes: number;
  source?: 'ai_generated' | 'curriculum_fallback' | 'cached';
  createdAt: string;
}

export interface StudySessionRecord {
  id: string;
  userId: string;
  date: string;
  subject: string;
  chapter: string;
  topic: string;
  allocatedMinutes: number;
  actualMinutes: number;
  startedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  theoryCompleted: boolean;
  questionsAttempted: number;
  questionsCorrect: number;
  practiceAttempted: number;
  practiceCorrect: number;
  difficultyLevel: string;
  topicUnderstanding: 'Strong' | 'Developing' | 'Needs Revision';
  taskId?: string;
}

export interface QuestionAttemptRecord {
  id: string;
  userId: string;
  lessonId: string;
  questionId: string;
  type: 'theory' | 'practice';
  subject: string;
  chapter: string;
  topic: string;
  difficulty: 'easy' | 'moderate' | 'hard';
  selectedOption: number;
  isCorrect: boolean;
  timeSpentSeconds?: number;
  attemptedAt: string;
}