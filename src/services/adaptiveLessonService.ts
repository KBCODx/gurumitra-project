import {
  AdaptiveLessonContent,
  AdaptiveSubtopic,
  AdaptiveTheoryQuestion,
  AdaptivePracticeQuestion,
  AdaptiveTheoryReviewQuestion,
  StudySessionRecord,
  QuestionAttemptRecord,
  SubjectType,
  ClassLevel,
  BoardType,
  DifficultyLevel
} from '../types';
import { supabase } from '../lib/supabase';
import { buildSubjectCurriculumLesson } from './curriculumKnowledgePacks';

export interface GenerateLessonRequest {
  classLevel?: ClassLevel | string;
  board?: BoardType | string;
  subject: SubjectType | string;
  chapter: string;
  topic: string;
  subtopics?: string[];
  allocatedMinutes?: number;
  studentLevel?: 'Weak' | 'Average' | 'Strong';
  learningStyle?: string;
  forceRegenerate?: boolean;
}

const CACHE_PREFIX = 'gurumitra_lesson_';
const SESSIONS_STORAGE_KEY = 'gurumitra_study_sessions';
const ATTEMPTS_STORAGE_KEY = 'gurumitra_question_attempts';

/**
 * Normalizes and validates the lesson content structure
 */
function validateAndNormalizeLesson(
  lesson: any,
  fallbackContext: GenerateLessonRequest
): AdaptiveLessonContent {
  const subject = lesson.subject || fallbackContext.subject;
  const chapter = lesson.chapter || fallbackContext.chapter;
  const topic = lesson.topic || fallbackContext.topic;
  const studentLevel = lesson.studentLevel || fallbackContext.studentLevel || 'Average';
  const allocatedMinutes = lesson.allocatedMinutes || fallbackContext.allocatedMinutes || 45;

  // Use curriculum pack for rich subject/topic defaults
  const curriculumPack = buildSubjectCurriculumLesson({
    classLevel: fallbackContext.classLevel || '10th',
    board: fallbackContext.board || 'CBSE',
    subject,
    chapter,
    topic,
    subtopics: fallbackContext.subtopics,
    studentLevel,
    allocatedMinutes
  });

  // Validate subtopics (ensure 6-7 items if possible, at least 4)
  let subtopics: AdaptiveSubtopic[] = Array.isArray(lesson.subtopics) && lesson.subtopics.length >= 4
    ? lesson.subtopics
    : curriculumPack.subtopics;

  subtopics = subtopics.map((st, i) => ({
    id: st.id || `sub_${i + 1}`,
    title: st.title || `Concept ${i + 1}: ${topic}`,
    explanation: st.explanation || `Core theoretical explanation of ${topic}.`,
    formulaOrRule: st.formulaOrRule || '',
    intuition: st.intuition || '',
    example: st.example || '',
    commonMistake: st.commonMistake || '',
    importantPoints: Array.isArray(st.importantPoints) ? st.importantPoints : []
  }));

  // Validate theory review Q&A (conceptual theory questions with theoretical answers)
  let theory_qa: AdaptiveTheoryReviewQuestion[] = Array.isArray(lesson.theory_qa) && lesson.theory_qa.length > 0
    ? lesson.theory_qa
    : (curriculumPack.theory_qa || []);

  theory_qa = theory_qa.map((tqa, idx) => ({
    id: tqa.id || `tqa_${idx + 1}`,
    question: tqa.question || `Explain the core conceptual mechanism of ${topic}.`,
    theoreticalAnswer: tqa.theoreticalAnswer || `A comprehensive theoretical explanation aligned to standard syllabus expectations for ${topic}.`,
    keyPoints: Array.isArray(tqa.keyPoints) && tqa.keyPoints.length > 0 ? tqa.keyPoints : [`Core definition of ${topic}`, `Key conditions and rules`],
    boardMarkingTip: tqa.boardMarkingTip || `State the governing principle and provide a concrete example for full marks.`
  }));

  // Validate 10 theory quiz questions
  let questions: AdaptiveTheoryQuestion[] = Array.isArray(lesson.questions) && lesson.questions.length >= 8
    ? lesson.questions
    : curriculumPack.questions;

  if (questions.length < 10) {
    const existingIds = new Set(questions.map(q => q.id));
    for (const dq of curriculumPack.questions) {
      if (questions.length >= 10) break;
      if (!existingIds.has(dq.id)) {
        questions.push(dq);
      }
    }
  }

  questions = questions.map((q, idx) => {
    const options = Array.isArray(q.options) && q.options.length === 4
      ? q.options
      : ['Option A', 'Option B', 'Option C', 'Option D'];
    const correctOptionIndex = typeof q.correctOptionIndex === 'number' && q.correctOptionIndex >= 0 && q.correctOptionIndex < 4
      ? q.correctOptionIndex
      : (typeof (q as any).correctOption === 'number' ? (q as any).correctOption : 0);
    return {
      id: q.id || `q_th_${idx + 1}`,
      question: q.question || `Question ${idx + 1} regarding ${topic}`,
      difficulty: (q.difficulty || (idx < 4 ? 'easy' : idx < 7 ? 'moderate' : 'hard')).toLowerCase() as any,
      options,
      correctOptionIndex,
      answer: q.answer || options[correctOptionIndex],
      explanation: q.explanation || `Governed by the standard curriculum rules for ${topic}.`,
      conceptTested: q.conceptTested || `${topic} Foundations`
    };
  });

  // Validate summary
  let summary: string[] = Array.isArray(lesson.summary) && lesson.summary.length > 0
    ? lesson.summary
    : curriculumPack.summary;

  // Validate practice questions (5)
  let practice: AdaptivePracticeQuestion[] = Array.isArray(lesson.practice_questions) && lesson.practice_questions.length >= 3
    ? lesson.practice_questions
    : curriculumPack.practice_questions;

  practice = practice.map((p, idx) => {
    const options = Array.isArray(p.options) && p.options.length === 4
      ? p.options
      : ['Option A', 'Option B', 'Option C', 'Option D'];
    const correctOptionIndex = typeof p.correctOptionIndex === 'number' && p.correctOptionIndex >= 0 && p.correctOptionIndex < 4
      ? p.correctOptionIndex
      : 0;
    return {
      id: p.id || `q_pr_${idx + 1}`,
      question: p.question || `Practice problem ${idx + 1} on ${topic}`,
      difficulty: (p.difficulty || (idx < 2 ? 'easy' : idx < 4 ? 'moderate' : 'hard')).toLowerCase() as any,
      options,
      correctOptionIndex,
      answer: p.answer || options[correctOptionIndex],
      explanation: p.explanation || `Derived by applying the governing principles of ${topic}.`,
      hint: p.hint || `Recall the key formulas and conditions for ${topic}.`
    };
  });

  return {
    id: lesson.id || `lesson_${subject.slice(0, 3)}_${Date.now()}`,
    subject,
    chapter,
    topic,
    studentLevel,
    difficulty_level: lesson.difficulty_level || (studentLevel === 'Weak' ? 'Beginner' : studentLevel === 'Strong' ? 'Advanced' : 'Intermediate'),
    learning_objectives: Array.isArray(lesson.learning_objectives) && lesson.learning_objectives.length > 0
      ? lesson.learning_objectives
      : curriculumPack.learning_objectives,
    subtopics,
    theory: lesson.theory || curriculumPack.theory,
    theory_qa,
    questions,
    summary,
    practice_questions: practice,
    allocatedMinutes,
    source: lesson.source || 'ai_generated',
    createdAt: lesson.createdAt || new Date().toISOString()
  };
}

/**
 * Fallback subtopic generator
 */
function generateDefaultSubtopics(
  topic: string,
  chapter: string,
  subject: string,
  studentLevel: 'Weak' | 'Average' | 'Strong'
): AdaptiveSubtopic[] {
  const titles = [
    `1. Definition & Core Meaning of ${topic}`,
    `2. Governing Rules & Key Equations in ${topic}`,
    `3. Step-by-Step Analytical Process`,
    `4. Real-World Applications & Observable Behavior`,
    `5. Connection with ${chapter} System`,
    `6. High-Yield Board Exam Problem Patterns`,
    `7. Boundary Constraints & Common Traps`
  ];

  return titles.map((title, i) => ({
    id: `sub_${i + 1}`,
    title,
    explanation: studentLevel === 'Weak'
      ? `Step ${i + 1} breaks down ${topic} using intuitive ideas and simple steps. When learning ${topic}, remember that every rule has a concrete everyday reason.`
      : `Section ${i + 1} formalizes the critical concepts of ${topic} in ${chapter}. Understanding the interaction between variables is key to solving complex exam questions.`,
    formulaOrRule: i === 1 ? `Standard ${subject} formula for ${topic}` : undefined,
    intuition: `Think of ${topic} as a logical rule connecting initial premises to observed outcomes.`,
    example: `A worked textbook example illustrating concept ${i + 1} of ${topic}.`,
    commonMistake: `Rushing calculations without verifying standard units and assumptions for ${topic}.`,
    importantPoints: [
      `Key definition according to curriculum standards`,
      `Governing condition for valid solutions`,
      `Verified by experimental and mathematical observation`
    ]
  }));
}

/**
 * Fallback theory questions generator (ensures 10 questions)
 */
function generateDefaultTheoryQuestions(
  topic: string,
  chapter: string,
  subject: string,
  board: string
): AdaptiveTheoryQuestion[] {
  const diffs: ('easy' | 'moderate' | 'hard')[] = [
    'easy', 'easy', 'easy', 'easy',
    'moderate', 'moderate', 'moderate',
    'hard', 'hard', 'hard'
  ];

  return diffs.map((diff, i) => {
    const correctIdx = (i * 2 + 1) % 4;
    const opts = [
      `It satisfies the authoritative governing principle of ${topic} as established in ${board} curriculum.`,
      `It contradicts fundamental conservation and algebraic properties of ${topic}.`,
      `It applies exclusively to null cases and has no practical validity in ${chapter}.`,
      `It produces undefined values across all standard physical and mathematical models.`
    ];
    // Rotate to position correctIdx
    const rotated = [...opts];
    const temp = rotated[0];
    rotated[0] = rotated[correctIdx];
    rotated[correctIdx] = temp;

    return {
      id: `q_th_${i + 1}`,
      question: `Question ${i + 1}: In the study of ${topic} (${chapter}), which statement accurately reflects curriculum principles?`,
      difficulty: diff,
      options: rotated,
      correctOptionIndex: correctIdx,
      answer: rotated[correctIdx],
      explanation: `According to ${board} ${subject} guidelines, ${topic} is correctly characterized by Option ${String.fromCharCode(65 + correctIdx)}.`,
      conceptTested: `${topic} Concept ${i + 1}`
    };
  });
}

/**
 * Fallback practice questions generator (5 questions)
 */
function generateDefaultPracticeQuestions(
  topic: string,
  chapter: string,
  subject: string
): AdaptivePracticeQuestion[] {
  return [1, 2, 3, 4, 5].map((idx) => {
    const cIdx = (idx * 3) % 4;
    const opts = [
      `It verifies the standard analytical solution for ${topic}.`,
      `It violates the basic boundary limit required for ${topic}.`,
      `It generates an inverted result unsupported by evidence.`,
      `It yields an indeterminate outcome under standard conditions.`
    ];
    const rotated = [...opts];
    const temp = rotated[0];
    rotated[0] = rotated[cIdx];
    rotated[cIdx] = temp;

    return {
      id: `q_pr_${idx}`,
      question: `Practice Exercise ${idx}: Apply the rules of ${topic} in ${chapter} to identify the correct statement:`,
      difficulty: idx <= 2 ? 'easy' : idx <= 4 ? 'moderate' : 'hard',
      options: rotated,
      correctOptionIndex: cIdx,
      answer: rotated[cIdx],
      explanation: `Applying the standard rules for ${topic} establishes Option ${String.fromCharCode(65 + cIdx)} as the correct resolution.`,
      hint: `Recall the governing formula and boundary conditions for ${topic}.`
    };
  });
}

/**
 * Retrieves a cached lesson or generates a new one via the API / curriculum engine
 */
export async function fetchOrGenerateAdaptiveLesson(
  params: GenerateLessonRequest
): Promise<AdaptiveLessonContent> {
  const cacheKey = `${CACHE_PREFIX}${params.subject}_${params.chapter}_${params.topic}_${params.studentLevel || 'Average'}_${params.learningStyle || 'Simple'}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');

  // 1. Check local cache unless forceRegenerate is true
  if (!params.forceRegenerate && typeof window !== 'undefined') {
    try {
      const cachedStr = localStorage.getItem(cacheKey);
      if (cachedStr) {
        const cachedObj = JSON.parse(cachedStr);
        if (cachedObj && cachedObj.questions && cachedObj.questions.length >= 8) {
          return {
            ...cachedObj,
            source: 'cached'
          };
        }
      }
    } catch (e) {
      console.warn('Failed reading lesson from cache:', e);
    }
  }

  // 2. Fetch from backend endpoint /api/ai/adaptive-lesson/generate
  let generated: any = null;
  if (typeof window !== 'undefined') {
    try {
      const clientKey = localStorage.getItem('gurumitra_gemini_api_key') || '';
      const res = await fetch('/api/ai/adaptive-lesson/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(clientKey ? { 'x-gemini-api-key': clientKey } : {})
        },
        body: JSON.stringify({
          classLevel: params.classLevel || '10th',
          board: params.board || 'CBSE',
          subject: params.subject,
          chapter: params.chapter,
          topic: params.topic,
          subtopics: params.subtopics || [],
          allocatedMinutes: params.allocatedMinutes || 45,
          studentLevel: params.studentLevel || 'Average',
          learningStyle: params.learningStyle || 'Simple',
          apiKey: clientKey || undefined
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json?.lesson) {
          generated = json.lesson;
        }
      }
    } catch (err) {
      console.warn('Fetch to adaptive lesson API endpoint failed, generating client fallback:', err);
    }
  }

  // 3. Fallback normalization if API was unreachable or offline
  const finalLesson = validateAndNormalizeLesson(generated || {}, params);

  // 4. Save to localStorage cache
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(finalLesson));
    } catch (e) {
      console.warn('Failed saving lesson to cache:', e);
    }
  }

  return finalLesson;
}

/**
 * Saves a completed or updated study session
 */
export async function recordStudySession(session: StudySessionRecord, userId?: string): Promise<void> {
  const uid = userId || session.userId;
  // 1. Save to local storage
  if (typeof window !== 'undefined') {
    try {
      const userKey = uid ? `gurumitra_study_sessions_${uid}` : SESSIONS_STORAGE_KEY;
      const existingStr = localStorage.getItem(userKey);
      const existing: StudySessionRecord[] = existingStr ? JSON.parse(existingStr) : [];
      const updated = [session, ...existing.filter(s => s.id !== session.id)].slice(0, 50);
      localStorage.setItem(userKey, JSON.stringify(updated));
      // Also update generic key for backwards compatibility
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed saving study session to localStorage:', e);
    }
  }

  // 2. Save to Supabase if connected
  try {
    if (supabase) {
      const { error } = await supabase.from('study_sessions').upsert({
        id: session.id,
        student_id: session.userId,
        task_id: session.taskId,
        date: session.date,
        subject: session.subject,
        chapter: session.chapter,
        topic: session.topic,
        allocated_minutes: session.allocatedMinutes,
        actual_minutes: session.actualMinutes,
        started_at: session.startedAt,
        completed_at: session.completedAt,
        status: session.status,
        theory_completed: session.theoryCompleted,
        questions_attempted: session.questionsAttempted,
        questions_correct: session.questionsCorrect,
        practice_attempted: session.practiceAttempted,
        practice_correct: session.practiceCorrect,
        difficulty_level: session.difficultyLevel,
        topic_understanding: session.topicUnderstanding
      });
      if (error) {
        // Table may not exist yet in local development, soft fail
        console.warn('Supabase study_sessions upsert notice:', error.message);
      }
    }
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Saves an individual question attempt
 */
export async function recordQuestionAttempt(attempt: QuestionAttemptRecord): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      const existingStr = localStorage.getItem(ATTEMPTS_STORAGE_KEY);
      const existing: QuestionAttemptRecord[] = existingStr ? JSON.parse(existingStr) : [];
      const updated = [attempt, ...existing].slice(0, 200);
      localStorage.setItem(ATTEMPTS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed saving question attempt to localStorage:', e);
    }
  }

  try {
    if (supabase) {
      await supabase.from('question_attempts').insert({
        id: attempt.id,
        student_id: attempt.userId,
        question_id: attempt.questionId,
        type: attempt.type,
        subject: attempt.subject,
        chapter: attempt.chapter,
        topic: attempt.topic,
        difficulty: attempt.difficulty,
        selected_option: attempt.selectedOption,
        is_correct: attempt.isCorrect,
        time_spent_seconds: attempt.timeSpentSeconds || 0,
        attempted_at: attempt.attemptedAt
      });
    }
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Retrieves historical sessions
 */
export function getSavedStudySessions(userId?: string): StudySessionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    if (userId) {
      const userKey = `gurumitra_study_sessions_${userId}`;
      const rawUser = localStorage.getItem(userKey);
      if (rawUser) return JSON.parse(rawUser);
    }
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

