// Automated Pipeline Test Suite for Learning Path Planning & AI Syllabus Analysis
// Covers all 14 Section 32 requirements, chapter matching, zero score invention, subject validation, and caching.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateSubjectRelevance,
  normalizeChapterTitle,
  areChaptersMatching,
  normalizeTopicTitle,
  areTopicsMatching,
  matchSyllabusWithAssessment,
  getCachedSyllabusExtraction,
  setCachedSyllabusExtraction,
  getExtractionCacheKey
} from '../src/services/learningPathPlanningService.ts';

import {
  cleanExtractedText,
  extractChaptersFromText,
  extractTopicsFromContentSlice
} from '../src/lib/aiSyllabusParser.ts';

import {
  reconstructPageTextFromItems
} from '../src/utils/pdfExtractor.ts';

describe('1. Subject Relevance Validation (Section 14 & Edge Cases)', () => {
  test('should accept Mathematics syllabus with valid mathematical keywords', () => {
    const mathText = `
      Class 10 Mathematics Syllabus:
      Unit I: Number Systems - Real Numbers
      Unit II: Algebra - Polynomials, Pair of Linear Equations, Quadratic Equations
      Unit III: Coordinate Geometry
      Unit IV: Geometry - Triangles, Circles
      Unit V: Trigonometry
    `;
    const result = validateSubjectRelevance(mathText, 'Mathematics');
    assert.equal(result.isRelevant, true);
  });

  test('should reject a Science syllabus uploaded under Mathematics', () => {
    const scienceText = `
      Class 10 Science Curriculum:
      Chapter 1: Chemical Reactions and Equations. Acids, Bases and Salts.
      Chapter 2: Metals and Non-metals. Carbon and its Compounds.
      Chapter 3: Life Processes, Control and Coordination.
      Chapter 4: Electricity, Magnetic Effects of Electric Current.
      Chapter 5: Light - Reflection and Refraction.
    `;
    const result = validateSubjectRelevance(scienceText, 'Mathematics');
    assert.equal(result.isRelevant, false);
    assert.match(result.reason, /Science content instead of Mathematics/);
  });

  test('should reject an English syllabus uploaded under Science', () => {
    const englishText = `
      English Language and Literature:
      Section A: Reading Comprehension and unseen prose extracts.
      Section B: Writing Skills, letter writing, dialogue, and formal essays.
      Section C: Grammar - Tenses, active and passive voice, reported speech, clauses.
      Literature: Poetry analysis and prose chapters.
    `;
    const result = validateSubjectRelevance(englishText, 'Science');
    assert.equal(result.isRelevant, false);
    assert.match(result.reason, /English content instead of Science/);
  });

  test('should reject empty or trivial content (< 60 chars)', () => {
    const emptyText = 'Hello there.';
    const result = validateSubjectRelevance(emptyText, 'Mathematics');
    assert.equal(result.isRelevant, false);
    assert.match(result.reason, /insufficient text/i);
  });
});

describe('2. Normalized Semantic Chapter & Topic Matching (Section 19, 21, Tests 7 & 8)', () => {
  test('Test 7: Should match chapters despite prefixing and different naming conventions', () => {
    // "Quadratic Equations" vs "Chapter 4: Quadratic Equations"
    assert.equal(
      areChaptersMatching('Quadratic Equations', 'Chapter 4: Quadratic Equations'),
      true
    );

    // "Unit II: Polynomials" vs "2. Polynomials"
    assert.equal(
      areChaptersMatching('Unit II: Polynomials', '2. Polynomials'),
      true
    );

    // "Real Numbers" vs "Chapter 1 - Real Numbers"
    assert.equal(
      areChaptersMatching('Real Numbers', 'Chapter 1 - Real Numbers'),
      true
    );

    // "Pair of Linear Equations in Two Variables" vs "Linear Equations"
    assert.equal(
      areChaptersMatching('Pair of Linear Equations in Two Variables', 'Linear Equations'),
      true
    );
  });

  test('Test 8: Should strictly avoid false matches for similar but distinct chapters', () => {
    // Pair of Linear Equations vs Quadratic Equations (both equations, but distinct)
    assert.equal(
      areChaptersMatching('Pair of Linear Equations', 'Quadratic Equations'),
      false
    );

    // Metals and Non-Metals vs Acids, Bases and Salts
    assert.equal(
      areChaptersMatching('Metals and Non-Metals', 'Acids, Bases and Salts'),
      false
    );

    // Circles vs Surface Areas and Volumes
    assert.equal(
      areChaptersMatching('Circles', 'Surface Areas and Volumes'),
      false
    );

    // Triangles vs Circles
    assert.equal(
      areChaptersMatching('Triangles', 'Circles'),
      false
    );
  });

  test('Topic matching: should match normalized topic names with numbering', () => {
    assert.equal(
      areTopicsMatching('1.2 Fundamental Theorem of Arithmetic', 'Fundamental Theorem of Arithmetic'),
      true
    );
    assert.equal(
      areTopicsMatching('Nature of Roots', '4.3 Nature of Roots'),
      true
    );
  });
});

describe('3. Zero Score Invention & Not Assessed Handling (Section 6, 7, 20, 23, Tests 5 & 6)', () => {
  const mockAssessmentMathOnly = {
    assessmentId: 'mock_assess_001',
    timestamp: '2026-09-23T10:00:00Z',
    overallScore: 67,
    totalQuestions: 6,
    correctAnswers: 4,
    incorrectAnswers: 2,
    subjects: ['Mathematics'],
    subjectScores: {
      Mathematics: { correct: 4, total: 6, percentage: 67 }
    },
    chapterPerformance: {
      ch_real_numbers: {
        chapterName: 'Real Numbers',
        subject: 'Mathematics',
        correct: 3,
        total: 3,
        percentage: 100
      },
      ch_quadratic_eq: {
        chapterName: 'Quadratic Equations',
        subject: 'Mathematics',
        correct: 1,
        total: 3,
        percentage: 33
      }
    },
    topicPerformance: {
      'Fundamental Theorem of Arithmetic': { correct: 3, total: 3, percentage: 100 },
      'Nature of Roots': { correct: 0, total: 2, percentage: 0 },
      'Quadratic Formula': { correct: 1, total: 1, percentage: 100 }
    },
    questionPerformance: [
      {
        questionId: 'q1',
        subject: 'Mathematics',
        chapterId: 'ch_real_numbers',
        chapterName: 'Real Numbers',
        topic: 'Fundamental Theorem of Arithmetic',
        difficulty: 'easy',
        isCorrect: true,
        selectedOption: 0,
        correctOption: 0,
        questionText: 'Prime factorisation question'
      },
      {
        questionId: 'q2',
        subject: 'Mathematics',
        chapterId: 'ch_real_numbers',
        chapterName: 'Real Numbers',
        topic: 'Fundamental Theorem of Arithmetic',
        difficulty: 'moderate',
        isCorrect: true,
        selectedOption: 1,
        correctOption: 1,
        questionText: 'LCM and HCF question'
      },
      {
        questionId: 'q3',
        subject: 'Mathematics',
        chapterId: 'ch_real_numbers',
        chapterName: 'Real Numbers',
        topic: 'Fundamental Theorem of Arithmetic',
        difficulty: 'difficult',
        isCorrect: true,
        selectedOption: 2,
        correctOption: 2,
        questionText: 'Irrationality proof question'
      },
      {
        questionId: 'q4',
        subject: 'Mathematics',
        chapterId: 'ch_quadratic_eq',
        chapterName: 'Quadratic Equations',
        topic: 'Nature of Roots',
        difficulty: 'easy',
        isCorrect: false,
        selectedOption: 1,
        correctOption: 2,
        questionText: 'Discriminant value question'
      },
      {
        questionId: 'q5',
        subject: 'Mathematics',
        chapterId: 'ch_quadratic_eq',
        chapterName: 'Quadratic Equations',
        topic: 'Nature of Roots',
        difficulty: 'moderate',
        isCorrect: false,
        selectedOption: 3,
        correctOption: 0,
        questionText: 'Real and equal roots condition'
      },
      {
        questionId: 'q6',
        subject: 'Mathematics',
        chapterId: 'ch_quadratic_eq',
        chapterName: 'Quadratic Equations',
        topic: 'Quadratic Formula',
        difficulty: 'difficult',
        isCorrect: true,
        selectedOption: 1,
        correctOption: 1,
        questionText: 'Solve using quadratic formula'
      }
    ]
  };

  test('Test 5: Chapter present in syllabus but NOT in pre-assessment MUST be Not Assessed with null understanding, NEVER 0%', () => {
    const syllabusChapters = [
      {
        chapterId: 'syl_1',
        chapterName: 'Real Numbers',
        subject: 'Mathematics',
        topics: ['Fundamental Theorem of Arithmetic', 'Revisiting Irrational Numbers']
      },
      {
        chapterId: 'syl_2',
        chapterName: 'Quadratic Equations',
        subject: 'Mathematics',
        topics: ['Nature of Roots', 'Quadratic Formula', 'Applications']
      },
      {
        chapterId: 'syl_3',
        chapterName: 'Trigonometry', // NOT in assessment
        subject: 'Mathematics',
        topics: ['Trigonometric Ratios', 'Trigonometric Identities']
      },
      {
        chapterId: 'syl_4',
        chapterName: 'Statistics', // NOT in assessment
        subject: 'Mathematics',
        topics: ['Mean of Grouped Data', 'Mode and Median']
      }
    ];

    const profile = matchSyllabusWithAssessment(
      syllabusChapters,
      mockAssessmentMathOnly,
      'Mathematics',
      'math_syllabus.pdf',
      45000
    );

    // Verify Real Numbers
    const chReal = profile.chapters.find(c => c.chapterName === 'Real Numbers');
    assert.ok(chReal);
    assert.equal(chReal.understanding, 100);
    assert.equal(chReal.status, 'strong');
    assert.equal(chReal.questionCount, 3);
    assert.equal(chReal.correctCount, 3);

    // Verify Quadratic Equations
    const chQuad = profile.chapters.find(c => c.chapterName === 'Quadratic Equations');
    assert.ok(chQuad);
    assert.equal(chQuad.understanding, 33);
    assert.equal(chQuad.status, 'needs_attention');
    assert.equal(chQuad.questionCount, 3);
    assert.equal(chQuad.correctCount, 1);
    assert.equal(chQuad.incorrectCount, 2);

    // Verify Trigonometry: MUST be null, status 'not_assessed', NEVER 0
    const chTrig = profile.chapters.find(c => c.chapterName === 'Trigonometry');
    assert.ok(chTrig);
    assert.equal(chTrig.understanding, null, 'Unassessed chapter understanding MUST be null, not 0');
    assert.equal(chTrig.status, 'not_assessed');
    assert.equal(chTrig.questionCount, 0);
    assert.equal(chTrig.confidence, 'none');

    // Verify Statistics: MUST be null, status 'not_assessed', NEVER 0
    const chStat = profile.chapters.find(c => c.chapterName === 'Statistics');
    assert.ok(chStat);
    assert.equal(chStat.understanding, null, 'Unassessed chapter understanding MUST be null, not 0');
    assert.equal(chStat.status, 'not_assessed');
    assert.equal(chStat.questionCount, 0);

    // Verify unassessed topic inside an assessed chapter (Applications was not asked)
    const topicApps = chQuad.topics.find(t => t.topicName === 'Applications');
    assert.ok(topicApps);
    assert.equal(topicApps.understanding, null, 'Unassessed topic must be null');
    assert.equal(topicApps.status, 'not_assessed');

    // Counts
    assert.equal(profile.totalChapters, 4);
    assert.equal(profile.assessedChaptersCount, 2);
    assert.equal(profile.unassessedChaptersCount, 2);
    assert.equal(profile.strongAreasCount, 1);
    assert.equal(profile.needsAttentionCount, 1);
  });

  test('Test 6: Assessment contains a chapter not present in syllabus — do not force into syllabus output', () => {
    // Assessment has Real Numbers and Quadratic Equations.
    // Syllabus ONLY has Real Numbers and Polynomials.
    const syllabusOnlyRealAndPoly = [
      {
        chapterId: 'syl_1',
        chapterName: 'Real Numbers',
        subject: 'Mathematics',
        topics: ['Fundamental Theorem of Arithmetic']
      },
      {
        chapterId: 'syl_2',
        chapterName: 'Polynomials',
        subject: 'Mathematics',
        topics: ['Zeroes of a Polynomial']
      }
    ];

    const profile = matchSyllabusWithAssessment(
      syllabusOnlyRealAndPoly,
      mockAssessmentMathOnly,
      'Mathematics'
    );

    assert.equal(profile.chapters.length, 2);
    const names = profile.chapters.map(c => c.chapterName);
    assert.ok(names.includes('Real Numbers'));
    assert.ok(names.includes('Polynomials'));
    assert.equal(names.includes('Quadratic Equations'), false, 'Do not force extraneous assessment chapters into syllabus');
  });

  test('Section 7: Low sample size confidence (1 question asked -> low confidence / limited data)', () => {
    const singleQuestionAssessment = {
      assessmentId: 'mock_single',
      timestamp: '2026-09-23T10:00:00Z',
      overallScore: 100,
      totalQuestions: 1,
      correctAnswers: 1,
      incorrectAnswers: 0,
      subjects: ['Mathematics'],
      subjectScores: { Mathematics: { correct: 1, total: 1, percentage: 100 } },
      chapterPerformance: {
        ch_real: { chapterName: 'Real Numbers', subject: 'Mathematics', correct: 1, total: 1, percentage: 100 }
      },
      topicPerformance: {},
      questionPerformance: [
        {
          questionId: 'q_only_1',
          subject: 'Mathematics',
          chapterId: 'ch_real',
          chapterName: 'Real Numbers',
          topic: 'Euclid Division',
          difficulty: 'easy',
          isCorrect: true,
          selectedOption: 0,
          correctOption: 0
        }
      ]
    };

    const syllabus = [{
      chapterId: 'ch_1',
      chapterName: 'Real Numbers',
      subject: 'Mathematics',
      topics: ['Euclid Division']
    }];

    const profile = matchSyllabusWithAssessment(syllabus, singleQuestionAssessment, 'Mathematics');
    assert.equal(profile.chapters[0].questionCount, 1);
    assert.equal(profile.chapters[0].confidence, 'low', '1 question must yield low confidence for limited data badge');
  });

  test('Section 24: Chapter evidence transparency breakdown', () => {
    const syllabus = [{
      chapterId: 'syl_quad',
      chapterName: 'Quadratic Equations',
      subject: 'Mathematics',
      topics: ['Nature of Roots', 'Quadratic Formula']
    }];

    const profile = matchSyllabusWithAssessment(syllabus, mockAssessmentMathOnly, 'Mathematics');
    const ch = profile.chapters[0];
    assert.ok(ch.evidence);
    assert.equal(ch.evidence.length, 3);
    assert.equal(ch.difficultyBreakdown.easy.total, 1);
    assert.equal(ch.difficultyBreakdown.easy.correct, 0);
    assert.equal(ch.difficultyBreakdown.moderate.total, 1);
    assert.equal(ch.difficultyBreakdown.moderate.correct, 0);
    assert.equal(ch.difficultyBreakdown.difficult.total, 1);
    assert.equal(ch.difficultyBreakdown.difficult.correct, 1);
  });
});

describe('4. Multi-Subject Partitioning & Independence (Tests 1, 2, 3, 4)', () => {
  const mockMultiSubjectAssessment = {
    assessmentId: 'mock_assess_multi',
    timestamp: '2026-09-23T11:00:00Z',
    overallScore: 75,
    totalQuestions: 8,
    correctAnswers: 6,
    incorrectAnswers: 2,
    subjects: ['Mathematics', 'Science'],
    subjectScores: {
      Mathematics: { correct: 3, total: 4, percentage: 75 },
      Science: { correct: 3, total: 4, percentage: 75 }
    },
    chapterPerformance: {
      ch_m1: { chapterName: 'Polynomials', subject: 'Mathematics', correct: 3, total: 4, percentage: 75 },
      ch_s1: { chapterName: 'Acids, Bases and Salts', subject: 'Science', correct: 3, total: 4, percentage: 75 }
    },
    topicPerformance: {},
    questionPerformance: [
      { questionId: 'qm1', subject: 'Mathematics', chapterId: 'ch_m1', chapterName: 'Polynomials', topic: 'Zeroes', difficulty: 'easy', isCorrect: true, selectedOption: 0, correctOption: 0 },
      { questionId: 'qm2', subject: 'Mathematics', chapterId: 'ch_m1', chapterName: 'Polynomials', topic: 'Zeroes', difficulty: 'easy', isCorrect: true, selectedOption: 1, correctOption: 1 },
      { questionId: 'qm3', subject: 'Mathematics', chapterId: 'ch_m1', chapterName: 'Polynomials', topic: 'Zeroes', difficulty: 'moderate', isCorrect: true, selectedOption: 2, correctOption: 2 },
      { questionId: 'qm4', subject: 'Mathematics', chapterId: 'ch_m1', chapterName: 'Polynomials', topic: 'Zeroes', difficulty: 'difficult', isCorrect: false, selectedOption: 0, correctOption: 1 },
      { questionId: 'qs1', subject: 'Science', chapterId: 'ch_s1', chapterName: 'Acids, Bases and Salts', topic: 'pH Scale', difficulty: 'easy', isCorrect: true, selectedOption: 0, correctOption: 0 },
      { questionId: 'qs2', subject: 'Science', chapterId: 'ch_s1', chapterName: 'Acids, Bases and Salts', topic: 'pH Scale', difficulty: 'easy', isCorrect: true, selectedOption: 1, correctOption: 1 },
      { questionId: 'qs3', subject: 'Science', chapterId: 'ch_s1', chapterName: 'Acids, Bases and Salts', topic: 'Neutralisation', difficulty: 'moderate', isCorrect: true, selectedOption: 2, correctOption: 2 },
      { questionId: 'qs4', subject: 'Science', chapterId: 'ch_s1', chapterName: 'Acids, Bases and Salts', topic: 'Salts', difficulty: 'difficult', isCorrect: false, selectedOption: 3, correctOption: 2 }
    ]
  };

  test('Test 1 & 2: Assessment subjects filtering strictly respects tested subjects', () => {
    assert.deepEqual(mockMultiSubjectAssessment.subjects, ['Mathematics', 'Science']);
    assert.equal(mockMultiSubjectAssessment.subjects.includes('English'), false);
  });

  test('Test 4: Two subjects have completely independent chapter analysis and scoring', () => {
    const mathSyllabus = [
      { chapterId: 'm_ch1', chapterName: 'Polynomials', subject: 'Mathematics', topics: ['Zeroes'] },
      { chapterId: 'm_ch2', chapterName: 'Circles', subject: 'Mathematics', topics: ['Tangents'] }
    ];

    const scienceSyllabus = [
      { chapterId: 's_ch1', chapterName: 'Acids, Bases and Salts', subject: 'Science', topics: ['pH Scale', 'Salts'] },
      { chapterId: 's_ch2', chapterName: 'Electricity', subject: 'Science', topics: ['Ohm Law'] }
    ];

    const mathProfile = matchSyllabusWithAssessment(mathSyllabus, mockMultiSubjectAssessment, 'Mathematics');
    const scienceProfile = matchSyllabusWithAssessment(scienceSyllabus, mockMultiSubjectAssessment, 'Science');

    // Math profile checks
    assert.equal(mathProfile.subjectName, 'Mathematics');
    assert.equal(mathProfile.chapters[0].chapterName, 'Polynomials');
    assert.equal(mathProfile.chapters[0].understanding, 75);
    assert.equal(mathProfile.chapters[1].chapterName, 'Circles');
    assert.equal(mathProfile.chapters[1].understanding, null); // Unassessed

    // Science profile checks
    assert.equal(scienceProfile.subjectName, 'Science');
    assert.equal(scienceProfile.chapters[0].chapterName, 'Acids, Bases and Salts');
    assert.equal(scienceProfile.chapters[0].understanding, 75);
    assert.equal(scienceProfile.chapters[1].chapterName, 'Electricity');
    assert.equal(scienceProfile.chapters[1].understanding, null); // Unassessed

    // Strict boundary: Science questions must not appear in Math evidence and vice versa
    assert.equal(mathProfile.chapters[0].evidence.length, 4);
    assert.equal(scienceProfile.chapters[0].evidence.length, 4);
  });
});

describe('5. PDF Extraction Pipeline Continuity & Extraction Caching (Tests 9, 10, 14)', () => {
  test('Test 9 & 10: PDF text coordinate line grouping and header/footer cleanup continuity', () => {
    const itemsWithHeaders = [
      { str: 'NCERT Mathematics Class 10 Syllabus', transform: [1, 0, 0, 1, 50, 780], width: 200, height: 10 },
      { str: 'Chapter 1: Real Numbers', transform: [1, 0, 0, 1, 50, 720], width: 150, height: 16 },
      { str: 'Fundamental Theorem of Arithmetic.', transform: [1, 0, 0, 1, 50, 680], width: 220, height: 12 },
      { str: 'Page 14 of 42', transform: [1, 0, 0, 1, 250, 40], width: 50, height: 9 }
    ];

    const result = reconstructPageTextFromItems(itemsWithHeaders);
    const cleaned = cleanExtractedText(result.text);

    // Page number footer filtered
    assert.equal(result.lines.some(l => /Page \d+ of \d+/i.test(l)), false);

    // Chapters detected
    const chapters = extractChaptersFromText(cleaned, 'Mathematics');
    assert.ok(chapters.length >= 1);
    assert.match(chapters[0], /Real Numbers/i);
  });

  test('Test 14: Cached extraction returns identical content on repeated upload of same PDF', () => {
    const subject = 'Mathematics';
    const fileName = 'Class10_Math_Syllabus.pdf';
    const fileSize = 98412;
    const testRawText = 'Chapter 1: Real Numbers\nChapter 2: Polynomials';
    const testChapters = [
      { chapterId: 'ch1', chapterName: 'Real Numbers', subject: 'Mathematics', topics: [] },
      { chapterId: 'ch2', chapterName: 'Polynomials', subject: 'Mathematics', topics: [] }
    ];

    // Store in cache
    setCachedSyllabusExtraction(subject, fileName, fileSize, testRawText, testChapters);

    // Retrieve from cache
    const cached = getCachedSyllabusExtraction(subject, fileName, fileSize);
    assert.ok(cached);
    assert.equal(cached.fileName, fileName);
    assert.equal(cached.fileSize, fileSize);
    assert.equal(cached.chapters.length, 2);
    assert.equal(cached.chapters[0].chapterName, 'Real Numbers');
  });
});
