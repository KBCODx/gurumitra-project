import {
  SubjectType,
  ExtractedChapter,
  PreAssessmentResult,
  SubjectLearningProfile,
  ChapterAnalysisItem,
  TopicAnalysisItem,
  UnderstandingStatus,
  UnderstandingConfidence,
  LearningProfile
} from '../types';
import { extractChaptersFromText, extractTopicsForChapter, getChapterBoundaries, cleanExtractedText } from '../lib/aiSyllabusParser';
import { extractTextFromPDF } from '../utils/pdfExtractor';
import { getStoredGeminiKey } from './preAssessmentService';

// ============================================================================
// CACHE FOR EXTRACTED SYLLABUS PDFS
// ============================================================================

interface CachedExtraction {
  fileName: string;
  fileSize: number;
  rawText: string;
  chapters: ExtractedChapter[];
  timestamp: number;
}

const extractionCache = new Map<string, CachedExtraction>();

export function getExtractionCacheKey(subject: SubjectType, fileName: string, fileSize: number): string {
  return `${subject}_${fileName.trim()}_${fileSize}`;
}

export function getCachedSyllabusExtraction(subject: SubjectType, fileName: string, fileSize: number): CachedExtraction | null {
  const key = getExtractionCacheKey(subject, fileName, fileSize);
  return extractionCache.get(key) || null;
}

export function setCachedSyllabusExtraction(
  subject: SubjectType,
  fileName: string,
  fileSize: number,
  rawText: string,
  chapters: ExtractedChapter[]
): void {
  const key = getExtractionCacheKey(subject, fileName, fileSize);
  extractionCache.set(key, {
    fileName,
    fileSize,
    rawText,
    chapters,
    timestamp: Date.now()
  });
}

// ============================================================================
// SUBJECT-SPECIFIC PDF RELEVANCE VALIDATION
// ============================================================================

const SUBJECT_KEYWORDS: Record<string, string[]> = {
  'Mathematics': [
    'mathematics', 'math', 'maths', 'algebra', 'geometry', 'equation', 'equations',
    'theorem', 'polynomial', 'polynomials', 'triangle', 'triangles', 'arithmetic',
    'trigonometry', 'calculus', 'probability', 'statistics', 'coordinate', 'matrix',
    'matrices', 'quadratic', 'quadratics', 'circle', 'circles', 'mensuration',
    'surface area', 'volume', 'volumes', 'integer', 'integers', 'real number', 'real numbers',
    'factorisation', 'tangent', 'secant', 'fraction', 'ratio', 'linear equation',
    'sets', 'relations', 'functions', 'integral', 'integrals', 'derivative', 'derivatives',
    'differentiation', 'vectors', 'vector', 'three dimensional', 'euclid', 'number systems',
    'quadrilateral', 'quadrilaterals', 'heron', 'angles', 'lines', 'surds', 'exponents',
    'logarithm', 'permutation', 'combination', 'binomial', 'determinant', 'determinants'
  ],
  'Science': [
    'science', 'physics', 'chemistry', 'biology', 'reaction', 'reactions', 'chemical',
    'cell', 'cells', 'energy', 'force', 'forces', 'atom', 'atoms', 'atomic', 'molecule',
    'molecules', 'acid', 'acids', 'base', 'bases', 'salt', 'salts', 'metal', 'metals',
    'non-metal', 'electricity', 'electric', 'light', 'reflection', 'refraction', 'magnetic',
    'magnetism', 'organ', 'ecosystem', 'tissue', 'tissues', 'reproduction', 'current',
    'resistance', 'resistor', 'motion', 'gravitation', 'heredity', 'evolution', 'photosynthesis',
    'carbon', 'compounds', 'periodic'
  ],
  'English': [
    'english', 'grammar', 'literature', 'reading', 'comprehension', 'poetry', 'poem',
    'prose', 'essay', 'writing', 'fiction', 'drama', 'vocabulary', 'tense', 'tenses',
    'speech', 'author', 'poet', 'novel', 'clause', 'clauses', 'sentence', 'sentences',
    'verb', 'verbs', 'noun', 'adjective', 'letter writing', 'dialogue', 'extract'
  ],
  'Computer Science': [
    'computer', 'programming', 'algorithm', 'algorithms', 'code', 'coding', 'python',
    'database', 'databases', 'network', 'networks', 'loop', 'loops', 'variable', 'variables',
    'software', 'logic', 'boolean', 'hardware', 'binary', 'array', 'arrays', 'function',
    'oop', 'cyber', 'data structure', 'sql', 'html', 'css', 'table', 'query'
  ],
  'Social Science': [
    'social science', 'history', 'geography', 'civics', 'economics', 'democracy',
    'democratic', 'constitution', 'empire', 'resource', 'resources', 'climate',
    'population', 'nationalism', 'revolution', 'judiciary', 'parliament', 'agriculture',
    'mineral', 'minerals', 'development', 'sectors', 'money', 'credit', 'federalism'
  ]
};

/**
 * Validates that an uploaded document appears to contain educational content
 * matching the selected subject, flagging completely unrelated documents.
 */
export function validateSubjectRelevance(
  text: string,
  subject: SubjectType
): { isRelevant: boolean; reason?: string } {
  if (!text || text.trim().length < 60) {
    return {
      isRelevant: false,
      reason: 'The uploaded file is empty or contains insufficient text.'
    };
  }

  const lowerText = text.toLowerCase();
  const subjectKey = Object.keys(SUBJECT_KEYWORDS).find(
    s => s.toLowerCase() === subject.toLowerCase()
  ) || subject;

  const targetKeywords = SUBJECT_KEYWORDS[subjectKey];
  if (!targetKeywords) {
    // If not a recognized core subject, do not falsely reject
    return { isRelevant: true };
  }

  // Count matches for target subject
  let targetMatchCount = 0;
  for (const kw of targetKeywords) {
    const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lowerText)) {
      targetMatchCount++;
    }
  }

  // Check competing subjects to detect completely mismatched uploads (e.g. Science uploaded as Math)
  let maxCompetitorSubject = '';
  let maxCompetitorCount = 0;

  for (const [otherSub, otherKeywords] of Object.entries(SUBJECT_KEYWORDS)) {
    if (otherSub.toLowerCase() === subjectKey.toLowerCase()) continue;
    let count = 0;
    for (const kw of otherKeywords) {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lowerText)) count++;
    }
    if (count > maxCompetitorCount) {
      maxCompetitorCount = count;
      maxCompetitorSubject = otherSub;
    }
  }

  // 1. If competitor subject strongly dominates over target subject
  if (maxCompetitorCount >= 3 && maxCompetitorCount > targetMatchCount * 2) {
    return {
      isRelevant: false,
      reason: `This document appears to contain ${maxCompetitorSubject} content instead of ${subject}. Please upload the correct ${subject} syllabus.`
    };
  }

  // 2. If target has zero matches and competitor has 2+ matches
  if (targetMatchCount === 0 && maxCompetitorCount >= 2) {
    return {
      isRelevant: false,
      reason: `This document appears to contain ${maxCompetitorSubject} content instead of ${subject}. Please upload the correct ${subject} syllabus.`
    };
  }

  // 3. If target has zero matches in a document of 40+ words
  const wordCount = lowerText.split(/\s+/).length;
  if (targetMatchCount === 0 && wordCount >= 40) {
    return {
      isRelevant: false,
      reason: `This document does not appear to match ${subject}. Please upload the correct syllabus.`
    };
  }

  // 4. Target subject has matches and is not dominated
  if (targetMatchCount >= 1) {
    return { isRelevant: true };
  }

  return { isRelevant: true };
}

// ============================================================================
// NORMALIZED SEMANTIC CHAPTER MATCHING
// ============================================================================

const CHAPTER_STOP_WORDS = new Set([
  'and', 'or', 'the', 'of', 'in', 'to', 'for', 'with', 'on', 'at', 'by', '&', '-', '–', '—', ':'
]);

/**
 * Normalizes chapter title for strict semantic comparison
 * e.g., "Chapter 4 – Quadratic Equations" -> "quadratic equations"
 */
export function normalizeChapterTitle(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/^(?:chapter|unit|lesson|module|part|theme|section)\s*(?:[0-9]+|[ivx]+)?\s*[:.,\-–—\u2500\u2014\u2015]*\s*/i, '')
    .replace(/^(?:[0-9]{1,2}|[ivx]{1,5})\s*[\.\)\]\-–—\u2500\u2014\u2015:,]+\s*/i, '')
    .replace(/^(?:[0-9]{1,2}|[ivx]{1,5})\s+([a-z])/i, '$1')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenizes a chapter name into meaningful words (excluding stop words)
 */
function getChapterTokens(normTitle: string): string[] {
  return normTitle
    .split(/\s+/)
    .filter(token => token.length >= 2 && !CHAPTER_STOP_WORDS.has(token));
}

/**
 * Compares two chapter names and returns true if they refer to the same chapter.
 * Strictly prevents false positive matches across different chapters.
 */
export function areChaptersMatching(nameA: string, nameB: string): boolean {
  if (!nameA || !nameB) return false;

  const normA = normalizeChapterTitle(nameA);
  const normB = normalizeChapterTitle(nameB);

  // Exact normalized match
  if (normA === normB) return true;

  // STRICT NEGATIVE RULES: Check for mutually exclusive distinguishing keywords
  const exclusivePairs: [string, string][] = [
    ['linear', 'quadratic'],
    ['quadratic', 'cubic'],
    ['acids', 'metals'],
    ['acid', 'metal'],
    ['real', 'complex'],
    ['surface', 'circles'],
    ['circle', 'triangle'],
    ['reflection', 'current'],
    ['tenses', 'speech'],
    ['active', 'indirect']
  ];

  for (const [word1, word2] of exclusivePairs) {
    if (
      (normA.includes(word1) && normB.includes(word2)) ||
      (normA.includes(word2) && normB.includes(word1))
    ) {
      return false;
    }
  }

  // If one title is entirely contained within the other as a whole phrase
  if (normA.length >= 6 && normB.length >= 6) {
    if (normA.includes(normB) || normB.includes(normA)) {
      const lenRatio = Math.min(normA.length, normB.length) / Math.max(normA.length, normB.length);
      if (lenRatio >= 0.5) {
        return true;
      }
    }
  }

  // Token Jaccard overlap
  const tokensA = getChapterTokens(normA);
  const tokensB = getChapterTokens(normB);

  if (tokensA.length === 0 || tokensB.length === 0) return false;

  const setB = new Set(tokensB);
  const intersection = tokensA.filter(t => setB.has(t));
  const union = new Set([...tokensA, ...tokensB]);

  const jaccard = intersection.length / union.size;

  // If at least 2 key tokens match and overlap is >= 50%
  if (intersection.length >= 2 && jaccard >= 0.5) {
    return true;
  }

  // If one of the titles is only 1-2 words and all of its tokens are in the other
  const minTokens = Math.min(tokensA.length, tokensB.length);
  if (minTokens <= 2 && intersection.length === minTokens && jaccard >= 0.4) {
    return true;
  }

  return false;
}

/**
 * Normalizes topic title for matching
 */
export function normalizeTopicTitle(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/^(?:[0-9]{1,2}\.[0-9]{1,2}(?:\.[0-9]{1,2})?)\s*[:\-–—]?\s*/, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function areTopicsMatching(topicA: string, topicB: string): boolean {
  if (!topicA || !topicB) return false;
  const normA = normalizeTopicTitle(topicA);
  const normB = normalizeTopicTitle(topicB);

  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) {
    const minLen = Math.min(normA.length, normB.length);
    if (minLen >= 4) return true;
  }

  const tokA = getChapterTokens(normA);
  const tokB = getChapterTokens(normB);
  const setB = new Set(tokB);
  const matches = tokA.filter(t => setB.has(t));
  return matches.length >= 2 || (matches.length === 1 && tokA.length === 1 && tokB.length === 1);
}

// ============================================================================
// SYLLABUS + ASSESSMENT COMBINER ENGINE
// Strictly grounds all scores in real assessment data. Never invents scores.
// ============================================================================

export function matchSyllabusWithAssessment(
  syllabusChapters: ExtractedChapter[],
  assessmentResult: PreAssessmentResult | null,
  subject: SubjectType,
  fileName?: string,
  fileSize?: number
): SubjectLearningProfile {
  // If no assessment result provided or no questions for this subject
  const subjectQuestions = assessmentResult
    ? assessmentResult.questionPerformance.filter(
        q => q.subject.toLowerCase() === subject.toLowerCase()
      )
    : [];

  const assessedChaptersList: ChapterAnalysisItem[] = [];

  let strongCount = 0;
  let devCount = 0;
  let needsAttnCount = 0;
  let assessedCount = 0;
  let unassessedCount = 0;

  for (const sCh of syllabusChapters) {
    // 1. Check if this syllabus chapter was assessed in pre-assessment
    let matchedChapterKey: string | null = null;
    let matchedPerformance: PreAssessmentResult['chapterPerformance'][string] | null = null;

    if (assessmentResult && assessmentResult.chapterPerformance) {
      for (const [key, perf] of Object.entries(assessmentResult.chapterPerformance)) {
        if (perf.subject.toLowerCase() === subject.toLowerCase()) {
          if (areChaptersMatching(sCh.chapterName, perf.chapterName)) {
            matchedChapterKey = key;
            matchedPerformance = perf;
            break;
          }
        }
      }
    }

    // 2. Gather question records specifically for this matched chapter
    const relatedQuestions = matchedChapterKey
      ? subjectQuestions.filter(
          q => q.chapterId === matchedChapterKey || areChaptersMatching(q.chapterName, sCh.chapterName)
        )
      : [];

    const isAssessed = relatedQuestions.length > 0 || matchedPerformance !== null;

    if (isAssessed) {
      assessedCount++;
      const totalQ = relatedQuestions.length > 0
        ? relatedQuestions.length
        : (matchedPerformance?.total || 0);

      const correctQ = relatedQuestions.length > 0
        ? relatedQuestions.filter(q => q.isCorrect).length
        : (matchedPerformance?.correct || 0);

      const incorrectQ = totalQ - correctQ;

      const accuracy = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;

      // Confidence evaluation based on question sample size
      let confidence: UnderstandingConfidence = 'low';
      if (totalQ >= 4) {
        confidence = 'high';
      } else if (totalQ >= 2) {
        confidence = 'medium';
      } else {
        confidence = 'low';
      }

      // Status evaluation
      let status: UnderstandingStatus = 'needs_attention';
      if (accuracy >= 80) {
        status = 'strong';
        strongCount++;
      } else if (accuracy >= 50) {
        status = 'developing';
        devCount++;
      } else {
        status = 'needs_attention';
        needsAttnCount++;
      }

      // Difficulty breakdown
      const difficultyBreakdown = {
        easy: {
          correct: relatedQuestions.filter(q => q.difficulty === 'easy' && q.isCorrect).length,
          total: relatedQuestions.filter(q => q.difficulty === 'easy').length
        },
        moderate: {
          correct: relatedQuestions.filter(q => q.difficulty === 'moderate' && q.isCorrect).length,
          total: relatedQuestions.filter(q => q.difficulty === 'moderate').length
        },
        difficult: {
          correct: relatedQuestions.filter(q => q.difficulty === 'difficult' && q.isCorrect).length,
          total: relatedQuestions.filter(q => q.difficulty === 'difficult').length
        }
      };

      // Evidence list for transparency
      const evidence = relatedQuestions.map((q, idx) => ({
        questionIndex: idx + 1,
        questionText: q.questionText || `${q.topic} diagnostic question`,
        difficulty: q.difficulty,
        isCorrect: q.isCorrect,
        userAnswerText: q.selectedOption !== null && q.options ? q.options[q.selectedOption] : 'Unanswered',
        correctAnswerText: q.options ? q.options[q.correctOption] : undefined
      }));

      // 3. Map topics
      const rawTopics = sCh.topics && sCh.topics.length > 0 ? sCh.topics : [sCh.chapterName];
      const topicsList: TopicAnalysisItem[] = rawTopics.map((topName, tIdx) => {
        const topQ = relatedQuestions.filter(q => areTopicsMatching(q.topic, topName));
        if (topQ.length > 0) {
          const tCorrect = topQ.filter(q => q.isCorrect).length;
          const tAcc = Math.round((tCorrect / topQ.length) * 100);
          const tStatus: UnderstandingStatus = tAcc >= 80 ? 'strong' : tAcc >= 50 ? 'developing' : 'needs_attention';
          return {
            topicId: `top_${sCh.chapterId}_${tIdx + 1}`,
            topicName: topName,
            understanding: tAcc,
            status: tStatus,
            questionCount: topQ.length,
            correctCount: tCorrect
          };
        } else {
          // Topic was not assessed in this chapter
          return {
            topicId: `top_${sCh.chapterId}_${tIdx + 1}`,
            topicName: topName,
            understanding: null, // NOT assessed
            status: 'not_assessed',
            questionCount: 0
          };
        }
      });

      let priority: ChapterAnalysisItem['priority'] = 'Practice';
      let recommendedAction = 'Continue targeted problem solving.';

      if (status === 'needs_attention') {
        priority = 'High Priority';
        recommendedAction = 'Review fundamental definitions and step-by-step worked examples before re-assessing.';
      } else if (status === 'strong') {
        priority = 'On Track';
        recommendedAction = 'Demonstrated solid command! Advance to higher-order application challenges.';
      } else {
        priority = 'Practice';
        recommendedAction = 'Solid conceptual base. Solve moderate practice problems to build speed and accuracy.';
      }

      assessedChaptersList.push({
        chapterId: sCh.chapterId,
        chapterName: sCh.chapterName,
        subject,
        understanding: accuracy,
        confidence,
        status,
        questionCount: totalQ,
        correctCount: correctQ,
        incorrectCount: incorrectQ,
        difficultyBreakdown,
        evidence,
        topics: topicsList,
        priority,
        recommendedAction
      });
    } else {
      // 4. Chapter was NOT assessed in pre-assessment
      unassessedCount++;
      const rawTopics = sCh.topics && sCh.topics.length > 0 ? sCh.topics : [sCh.chapterName];
      const topicsList: TopicAnalysisItem[] = rawTopics.map((topName, tIdx) => ({
        topicId: `top_${sCh.chapterId}_${tIdx + 1}`,
        topicName: topName,
        understanding: null, // STRICT RULE: null indicates Not Assessed, NEVER 0!
        status: 'not_assessed',
        questionCount: 0
      }));

      assessedChaptersList.push({
        chapterId: sCh.chapterId,
        chapterName: sCh.chapterName,
        subject,
        understanding: null, // STRICT RULE: null indicates Not Assessed, NEVER 0!
        confidence: 'none',
        status: 'not_assessed',
        questionCount: 0,
        correctCount: 0,
        incorrectCount: 0,
        topics: topicsList,
        priority: 'Explore',
        recommendedAction: 'Not assessed yet. Schedule as an upcoming learning milestone in your path.'
      });
    }
  }

  // Calculate subject overall understanding
  let subjectAssessmentUnderstanding: number | null = null;
  if (subjectQuestions.length > 0) {
    const totalSubjectCorrect = subjectQuestions.filter(q => q.isCorrect).length;
    subjectAssessmentUnderstanding = Math.round((totalSubjectCorrect / subjectQuestions.length) * 100);
  }

  return {
    subjectId: subject.toLowerCase().replace(/\s+/g, '-'),
    subjectName: subject,
    assessmentUnderstanding: subjectAssessmentUnderstanding,
    syllabusFileName: fileName,
    syllabusFileSize: fileSize,
    extractedAt: new Date().toISOString(),
    totalChapters: syllabusChapters.length,
    assessedChaptersCount: assessedCount,
    unassessedChaptersCount: unassessedCount,
    strongAreasCount: strongCount,
    needsPracticeCount: devCount,
    needsAttentionCount: needsAttnCount,
    chapters: assessedChaptersList,
    aiPedagogicalSummary: {
      strengths: assessedChaptersList.filter(c => c.status === 'strong').map(c => c.chapterName),
      gaps: assessedChaptersList.filter(c => c.status === 'needs_attention').map(c => c.chapterName),
      immediatePriorities: assessedChaptersList
        .filter(c => c.priority === 'High Priority')
        .map(c => `Strengthen ${c.chapterName} (current understanding: ${c.understanding}%)`)
    }
  };
}

// ============================================================================
// AI SYLLABUS ANALYSIS CALLER
// Enforces zero-score invention while generating pedagogical insights.
// ============================================================================

export async function runAiSyllabusAnalysis(
  subject: SubjectType,
  syllabusChapters: ExtractedChapter[],
  assessmentResult: PreAssessmentResult | null,
  fileName?: string,
  fileSize?: number
): Promise<SubjectLearningProfile> {
  // First compute pure deterministic grounded baseline
  const profile = matchSyllabusWithAssessment(
    syllabusChapters,
    assessmentResult,
    subject,
    fileName,
    fileSize
  );

  // Attempt server AI synthesis for rich pedagogical insights
  if (typeof window !== 'undefined') {
    try {
      const apiKey = getStoredGeminiKey();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['x-gemini-api-key'] = apiKey;
      }

      const res = await fetch('/api/ai/analyze-syllabus', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          subject,
          chaptersSummary: profile.chapters.map(c => ({
            chapter: c.chapterName,
            understanding: c.understanding,
            status: c.status,
            questionCount: c.questionCount,
            topics: c.topics.map(t => ({ topic: t.topicName, understanding: t.understanding, status: t.status }))
          }))
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.data?.aiPedagogicalSummary) {
          // Enrich profile without mutating any numerical scores
          profile.aiPedagogicalSummary = data.data.aiPedagogicalSummary;
        }
      }
    } catch (err) {
      console.warn('AI syllabus analysis server endpoint unavailable, using deterministic synthesizer:', err);
    }
  }

  return profile;
}

// ============================================================================
// PDF EXTRACTION PIPELINE WITH CACHING
// Reuses the identical PDF extraction engine.
// ============================================================================

export async function extractSyllabusPdfWithCache(
  file: File,
  subject: SubjectType
): Promise<{
  rawText: string;
  chapters: ExtractedChapter[];
  fromCache: boolean;
}> {
  // 1. Check cache first
  const cached = getCachedSyllabusExtraction(subject, file.name, file.size);
  if (cached && cached.chapters.length > 0) {
    return {
      rawText: cached.rawText,
      chapters: cached.chapters,
      fromCache: true
    };
  }

  // 2. Run existing coordinate-aware PDF extraction
  const { rawText } = await extractTextFromPDF(file, subject);
  const cleaned = cleanExtractedText(rawText);

  // 3. Extract verified chapters
  const parsedTitles = extractChaptersFromText(cleaned, subject);
  const boundaries = getChapterBoundaries(cleaned, parsedTitles, subject);

  const chapters: ExtractedChapter[] = parsedTitles.map((title, index) => {
    const chapterId = `ch_${subject.toLowerCase().slice(0, 3)}_${index + 1}`;
    const boundary = boundaries[chapterId];
    const topics = boundary?.topics && boundary.topics.length > 0
      ? boundary.topics
      : extractTopicsForChapter(title, index, parsedTitles, cleaned);

    return {
      chapterId,
      chapterName: title,
      subject,
      topics,
      sourceMethod: 'heading_detection',
      contentSlice: boundary?.contentSlice
    };
  });

  // 4. Save into cache
  setCachedSyllabusExtraction(subject, file.name, file.size, cleaned, chapters);

  return {
    rawText: cleaned,
    chapters,
    fromCache: false
  };
}
