import {
  ExtractedChapter,
  PreAssessmentQuestion,
  PreAssessmentDifficulty,
  SubjectType,
  AllowedContentMap,
  QuestionValidationResult,
  ChapterQuestionAllocation
} from '../types';
import { extractChaptersFromText, extractTopicsForChapter, getChapterBoundaries } from '../lib/aiSyllabusParser';

export type { ChapterQuestionAllocation };

export const TARGET_PRE_ASSESSMENT_QUESTIONS = 30;

/**
 * Calculates dynamic target question count: 12-13 questions per selected subject
 * 1 subject -> 13
 * 2 subjects -> 26
 * 3 subjects -> 39
 * 4 subjects -> 52
 */
export function getTargetQuestionsForSubjects(selectedSubjects: (SubjectType | string)[]): number {
  const count = selectedSubjects.length;
  if (count <= 0) return 13;
  return count * 13;
}

/**
 * Local client-side storage key for student's Gemini API Key
 */
export const GEMINI_API_KEY_STORAGE_KEY = 'gurumitra_gemini_api_key';

export function getStoredGeminiKey(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || '';
  }
  return '';
}

export function setStoredGeminiKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (key && key.trim()) {
      localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    }
  }
}

/**
 * Banned repetitive phrases from naive generation
 */
export const BANNED_BOILERPLATE_PHRASES = [
  'fundamental principle primarily defines',
  'defines the core rule and baseline properties',
  'applies solely to unrelated auxiliary systems',
  'contradicts standard mathematical and scientific axioms',
  'has no measurable influence on problem solving',
  'ignoring intermediate algebraic',
  'identifying given values, isolating the target variable',
  'boundary conditions causes a proportional shift',
  'boundary conditions have zero effect',
  'prerequisite relationships are completely discarded',
  'results are non-deterministic and cannot be reasoned logically',
  'spontaneous mass destruction',
  'continuous creation of free protons',
  'instant conversion of test tube glass',
  'parameter set',
  'perspective 1',
  'trial 1',
  'which of the following statements is mathematically true',
  'dividing by zero is permissible',
  'square of any real number is always negative',
  'negative quantity multiplied by a negative quantity yields a negative product',
  'color of the laboratory glassware exclusively',
  'atmospheric pressure of distant celestial bodies',
  'date of the calendar on which the experiment is performed'
];

/**
 * Builds a strict AllowedContentMap from user's selected subjects and verified chapters
 */
export function buildAllowedContentMap(
  selectedSubjects: SubjectType[],
  chaptersBySubject: Record<SubjectType, ExtractedChapter[]>
): AllowedContentMap {
  const allowedChapters: ExtractedChapter[] = [];
  const allowedTopics: { topic: string; chapterName: string; subject: SubjectType }[] = [];

  for (const subject of selectedSubjects) {
    const chs = chaptersBySubject[subject] || [];
    for (const ch of chs) {
      allowedChapters.push(ch);
      const topics = ch.topics && ch.topics.length > 0 ? ch.topics : [ch.chapterName];
      for (const t of topics) {
        allowedTopics.push({
          topic: t,
          chapterName: ch.chapterName,
          subject
        });
      }
    }
  }

  return {
    selectedSubjects: [...selectedSubjects],
    allowedChapters,
    allowedTopics
  };
}

/**
 * Validates a single question against strict academic standards and the allowed content map.
 * Rejects questions outside the user's selected subjects or chapters.
 */
export function validateQuestion(
  q: PreAssessmentQuestion,
  allowedMap?: AllowedContentMap
): QuestionValidationResult {
  const reasons: string[] = [];

  // Rule 1: Subject must be non-empty
  if (!q.subject) {
    reasons.push('Question is missing a subject');
  }

  // Rule 2: HARD BOUNDARY: If allowedMap is provided, question subject MUST be in selectedSubjects
  if (allowedMap && allowedMap.selectedSubjects.length > 0) {
    if (!allowedMap.selectedSubjects.includes(q.subject)) {
      reasons.push(`HARD BOUNDARY VIOLATION: Subject "${q.subject}" is not in selected subjects [${allowedMap.selectedSubjects.join(', ')}]`);
    }

    // Question chapter MUST match an allowed chapter
    const matchingChapter = allowedMap.allowedChapters.find(
      c => c.chapterName.toLowerCase() === (q.chapterName || '').toLowerCase() ||
           c.chapterId === q.chapterId
    );
    if (!matchingChapter) {
      reasons.push(`HARD BOUNDARY VIOLATION: Chapter "${q.chapterName}" is not in allowed chapters for ${q.subject}`);
    }
  }

  // Rule 3: Exactly 4 options
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    reasons.push(`Must have exactly 4 options (found ${q.options?.length || 0})`);
  }

  // Rule 4: Valid correctOption index (0..3)
  if (typeof q.correctOption !== 'number' || q.correctOption < 0 || q.correctOption > 3) {
    reasons.push(`correctOption must be an integer between 0 and 3 (got ${q.correctOption})`);
  } else if (q.options && (!q.options[q.correctOption] || q.options[q.correctOption].trim() === '')) {
    reasons.push('Correct option index points to an empty string');
  }

  // Rule 5: Option validity and diversity
  if (Array.isArray(q.options)) {
    const trimmed = q.options.map(o => (o || '').trim());
    const unique = new Set(trimmed.map(o => o.toLowerCase()));
    if (unique.size !== trimmed.length) {
      reasons.push('Contains duplicate options');
    }

    // Check minimum option length
    if (trimmed.some(o => o.length < 1)) {
      reasons.push('Contains empty or whitespace-only options');
    }

    // Check option diversity (not identical boilerplate)
    const isAssertionOrStatement = /assertion|statement\s+i/i.test(q.question || '');
    if (!isAssertionOrStatement) {
      for (let i = 0; i < trimmed.length; i++) {
        for (let j = i + 1; j < trimmed.length; j++) {
          const wordsA = new Set(trimmed[i].toLowerCase().split(/\s+/));
          const wordsB = new Set(trimmed[j].toLowerCase().split(/\s+/));
          if (wordsA.size > 4 && wordsB.size > 4) {
            let overlap = 0;
            wordsA.forEach(w => { if (wordsB.has(w)) overlap++; });
            const similarity = overlap / Math.min(wordsA.size, wordsB.size);
            if (similarity > 0.88) {
              reasons.push(`Options ${i + 1} and ${j + 1} are too similar (${Math.round(similarity * 100)}% word overlap)`);
            }
          }
        }
      }
    }
  }

  // Rule 6: Non-empty question text
  if (!q.question || q.question.trim().length < 12) {
    reasons.push('Question text is too short or empty');
  }

  // Rule 7: Explanation present
  if (!q.explanation || q.explanation.trim().length < 10) {
    reasons.push('Explanation is missing or insufficient');
  }

  // Rule 8: Anti-boilerplate filter
  const allText = `${q.question} ${(q.options || []).join(' ')}`.toLowerCase();
  for (const banned of BANNED_BOILERPLATE_PHRASES) {
    if (allText.includes(banned.toLowerCase())) {
      reasons.push(`Contains banned boilerplate phrase: "${banned}"`);
      break;
    }
  }

  return {
    valid: reasons.length === 0,
    reasons
  };
}

/**
 * Validates the entire assessment session against the allowed content map and distribution quotas
 */
export function validateAssessmentSession(
  questions: PreAssessmentQuestion[],
  allowedMap: AllowedContentMap,
  targetTotalQuestions: number = TARGET_PRE_ASSESSMENT_QUESTIONS
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check question count
  if (questions.length !== targetTotalQuestions) {
    reasons.push(`Expected exactly ${targetTotalQuestions} questions, but got ${questions.length}`);
  }

  // Check subject boundaries
  const selectedSet = new Set(allowedMap.selectedSubjects);
  const foreignSubjectQuestions = questions.filter(q => !selectedSet.has(q.subject));
  if (foreignSubjectQuestions.length > 0) {
    reasons.push(`Found ${foreignSubjectQuestions.length} questions from unselected subjects: ${[...new Set(foreignSubjectQuestions.map(q => q.subject))].join(', ')}`);
  }

  // Check chapter boundaries
  const allowedChapterNames = new Set(allowedMap.allowedChapters.map(c => c.chapterName.toLowerCase()));
  const foreignChapterQuestions = questions.filter(q => !allowedChapterNames.has(q.chapterName.toLowerCase()));
  if (foreignChapterQuestions.length > 0) {
    reasons.push(`Found ${foreignChapterQuestions.length} questions from unallowed chapters: ${[...new Set(foreignChapterQuestions.map(q => q.chapterName))].join(', ')}`);
  }

  // Check question uniqueness
  const questionStems = new Set<string>();
  const duplicateStems: string[] = [];
  questions.forEach(q => {
    const norm = q.question.trim().toLowerCase();
    if (questionStems.has(norm)) {
      duplicateStems.push(norm);
    }
    questionStems.add(norm);
  });
  if (duplicateStems.length > 0) {
    reasons.push(`Found ${duplicateStems.length} duplicate questions in test`);
  }

  return {
    valid: reasons.length === 0,
    reasons
  };
}

/**
 * Real school curriculum question bank organized by Chapter -> Questions
 */
interface StaticQuestionTemplate {
  topic: string;
  difficulty: PreAssessmentDifficulty;
  question: string;
  options: string[];
  correctOption: number;
  explanation: string;
}

export const CURRICULUM_QUESTION_BANK: Record<string, StaticQuestionTemplate[]> = {
  // ================= MATHEMATICS =================
  'Number Systems': [
    {
      topic: 'Rational & Irrational Numbers',
      difficulty: 'easy',
      question: 'Which of the following numbers is an irrational number?',
      options: ['3.141414...', '√2', '22/7', '√16'],
      correctOption: 1,
      explanation: '√2 cannot be expressed in the form p/q where p and q are integers and q ≠ 0. Its decimal expansion is non-terminating and non-recurring.'
    },
    {
      topic: 'Real Numbers & Operations',
      difficulty: 'moderate',
      question: 'If x = 2 + √3, what is the value of x + 1/x?',
      options: ['2', '2√3', '4', '4 + 2√3'],
      correctOption: 2,
      explanation: '1/x = 1/(2 + √3) = 2 - √3. Therefore, x + 1/x = (2 + √3) + (2 - √3) = 4.'
    },
    {
      topic: 'Laws of Exponents for Real Numbers',
      difficulty: 'difficult',
      question: 'Evaluate the expression: (64/125)^(-2/3) × (256/625)^(1/4)',
      options: ['25/16', '5/4', '125/64', '4/5'],
      correctOption: 1,
      explanation: '(64/125)^(-2/3) = ((4/5)³)^(-2/3) = (4/5)^(-2) = 25/16. (256/625)^(1/4) = 4/5. Multiplying gives (25/16) × (4/5) = 5/4.'
    }
  ],

  'Real Numbers': [
    {
      topic: 'Fundamental Theorem of Arithmetic',
      difficulty: 'easy',
      question: 'The Fundamental Theorem of Arithmetic states that every composite number can be uniquely expressed as a product of:',
      options: ['Primes in any order', 'Even numbers only', 'Rational fractions', 'Consecutive integers'],
      correctOption: 0,
      explanation: 'Every composite number can be expressed as a unique product of prime factors, apart from the order in which the prime factors occur.'
    },
    {
      topic: 'HCF and LCM Relationship',
      difficulty: 'moderate',
      question: 'If the HCF of two numbers 306 and 657 is 9, what is their LCM?',
      options: ['22338', '24156', '18240', '19683'],
      correctOption: 0,
      explanation: 'HCF(a, b) × LCM(a, b) = a × b. LCM = (306 × 657) / 9 = 34 × 657 = 22338.'
    },
    {
      topic: 'Irrationality Proofs',
      difficulty: 'difficult',
      question: 'Which of the following numbers is an irrational number?',
      options: ['√49', '3 + √5', '2.353535...', '√0.04'],
      correctOption: 1,
      explanation: 'The sum of a rational number (3) and an irrational number (√5) is always an irrational number.'
    }
  ],

  'Polynomials': [
    {
      topic: 'Zeros of Polynomials',
      difficulty: 'easy',
      question: 'What is the zero of the linear polynomial p(x) = 3x - 12?',
      options: ['-4', '4', '12', '3'],
      correctOption: 1,
      explanation: 'Set p(x) = 0: 3x - 12 = 0 => 3x = 12 => x = 4.'
    },
    {
      topic: 'Relationship Between Zeros and Coefficients',
      difficulty: 'moderate',
      question: 'What are the zeros of the quadratic polynomial x² - 7x + 12?',
      options: ['3 and 4', '-3 and -4', '2 and 6', '1 and 12'],
      correctOption: 0,
      explanation: 'x² - 7x + 12 = (x - 3)(x - 4) = 0 => x = 3 and x = 4.'
    },
    {
      topic: 'Division Algorithm & Factor Theorem',
      difficulty: 'difficult',
      question: 'If α and β are the zeros of the polynomial f(x) = x² - 5x + k such that α - β = 1, find the value of k.',
      options: ['4', '6', '8', '10'],
      correctOption: 1,
      explanation: 'α + β = 5 and α - β = 1 => 2α = 6 => α = 3, β = 2. Product of zeros αβ = k => 3 × 2 = 6, so k = 6.'
    }
  ],

  'Linear Equations': [
    {
      topic: 'Solutions of Linear Equations',
      difficulty: 'easy',
      question: 'Which of the following points lies on the line 2x + 3y = 12?',
      options: ['(0, 4)', '(2, 3)', '(3, 3)', '(4, 2)'],
      correctOption: 0,
      explanation: 'Substitute (0, 4): 2(0) + 3(4) = 0 + 12 = 12, which satisfies the equation.'
    },
    {
      topic: 'Graphical Representation & Intersections',
      difficulty: 'moderate',
      question: 'At what point does the line 3x - 4y = 24 intersect the x-axis?',
      options: ['(0, -6)', '(8, 0)', '(-8, 0)', '(0, 8)'],
      correctOption: 1,
      explanation: 'On the x-axis, y = 0. Thus 3x - 4(0) = 24 => 3x = 24 => x = 8. The point is (8, 0).'
    },
    {
      topic: 'Conditions for Consistency',
      difficulty: 'difficult',
      question: 'For what value of k will the pair of linear equations 2x + 3y = 7 and 4x + ky = 14 represent coincident lines with infinitely many solutions?',
      options: ['3', '6', '9', '12'],
      correctOption: 1,
      explanation: 'For coincident lines, a₁/a₂ = b₁/b₂ = c₁/c₂. Here 2/4 = 3/k => 1/2 = 3/k => k = 6.'
    }
  ],

  'Quadratic Equations': [
    {
      topic: 'Roots of Quadratic Equation',
      difficulty: 'easy',
      question: 'What are the roots of the quadratic equation x² - 9 = 0?',
      options: ['3 only', '-3 only', '3 and -3', '9 and -9'],
      correctOption: 2,
      explanation: 'x² - 9 = 0 gives x² = 9, so x = ±√9 = ±3.'
    },
    {
      topic: 'Nature of Roots & Discriminant',
      difficulty: 'moderate',
      question: 'What is the nature of the roots for the quadratic equation 2x² - 4x + 3 = 0?',
      options: ['Two distinct real roots', 'Two equal real roots', 'No real roots', 'One real root only'],
      correctOption: 2,
      explanation: 'Discriminant D = b² - 4ac = (-4)² - 4(2)(3) = 16 - 24 = -8. Since D < 0, the equation has no real roots.'
    },
    {
      topic: 'Applied Quadratic Problems',
      difficulty: 'difficult',
      question: 'The sum of a positive number and its reciprocal is 10/3. What is the number?',
      options: ['2 or 1/2', '3 or 1/3', '4 or 1/4', '5 or 1/5'],
      correctOption: 1,
      explanation: 'Let the number be x: x + 1/x = 10/3 => 3x² - 10x + 3 = 0 => (3x - 1)(x - 3) = 0 => x = 3 or 1/3.'
    }
  ],

  'Arithmetic Progressions': [
    {
      topic: 'Common Difference & nth Term',
      difficulty: 'easy',
      question: 'What is the common difference of the AP: 7, 11, 15, 19, ...?',
      options: ['3', '4', '5', '-4'],
      correctOption: 1,
      explanation: 'Common difference d = a₂ - a₁ = 11 - 7 = 4.'
    },
    {
      topic: 'Specific nth Term Calculation',
      difficulty: 'moderate',
      question: 'What is the 20th term of the AP: 2, 5, 8, 11, ...?',
      options: ['57', '59', '61', '63'],
      correctOption: 1,
      explanation: 'a₂₀ = a + 19d. Here a = 2, d = 3. So a₂₀ = 2 + 19(3) = 2 + 57 = 59.'
    },
    {
      topic: 'Sum of n Terms',
      difficulty: 'difficult',
      question: 'How many terms of the AP: 24, 21, 18, ... must be taken so that their sum is 78?',
      options: ['4 terms only', '13 terms only', 'Both 4 and 13 terms', '7 terms'],
      correctOption: 2,
      explanation: 'Sₙ = (n/2)[2(24) + (n-1)(-3)] = 78 => 3n² - 51n + 156 = 0 => n² - 17n + 52 = 0 => (n - 4)(n - 13) = 0. Both n = 4 and n = 13 give sum 78 because terms from 5th to 13th cancel out to zero.'
    }
  ],

  'Triangles': [
    {
      topic: 'Basic Proportionality Theorem',
      difficulty: 'easy',
      question: 'In ΔABC, if DE ∥ BC intersecting AB at D and AC at E, then according to Thales Theorem:',
      options: ['AD / DB = AE / EC', 'AD / AB = EC / AE', 'AB / DB = AC / AE', 'AD × DB = AE × EC'],
      correctOption: 0,
      explanation: 'The Basic Proportionality Theorem states that if a line is drawn parallel to one side of a triangle, it divides the other two sides in the same ratio: AD/DB = AE/EC.'
    },
    {
      topic: 'Similarity Criteria',
      difficulty: 'moderate',
      question: 'If ΔABC ~ ΔDEF such that 2AB = DE and BC = 8 cm, what is the length of EF?',
      options: ['4 cm', '12 cm', '16 cm', '20 cm'],
      correctOption: 2,
      explanation: 'Since ΔABC ~ ΔDEF, AB/DE = BC/EF. Given DE = 2AB, AB/2AB = 8/EF => 1/2 = 8/EF => EF = 16 cm.'
    },
    {
      topic: 'Right Triangles and Altitudes',
      difficulty: 'difficult',
      question: 'In right-angled triangle ABC, ∠B = 90° and BD ⊥ AC. If AD = 4 cm and CD = 9 cm, find the length of BD.',
      options: ['5 cm', '6 cm', '6.5 cm', '36 cm'],
      correctOption: 1,
      explanation: 'In a right triangle with an altitude to the hypotenuse, BD² = AD × CD. BD² = 4 × 9 = 36 => BD = 6 cm.'
    }
  ],

  'Coordinate Geometry': [
    {
      topic: 'Distance Formula',
      difficulty: 'easy',
      question: 'What is the distance between the origin (0, 0) and the point (6, 8)?',
      options: ['7 units', '10 units', '14 units', '48 units'],
      correctOption: 1,
      explanation: 'Distance = √( (6 - 0)² + (8 - 0)² ) = √(36 + 64) = √100 = 10 units.'
    },
    {
      topic: 'Section Formula & Midpoints',
      difficulty: 'moderate',
      question: 'What are the coordinates of the midpoint of the line segment joining P(-2, 6) and Q(4, -2)?',
      options: ['(1, 2)', '(2, 4)', '(1, 4)', '(3, 2)'],
      correctOption: 0,
      explanation: 'Midpoint = ((x₁ + x₂)/2, (y₁ + y₂)/2) = ((-2 + 4)/2, (6 + -2)/2) = (2/2, 4/2) = (1, 2).'
    },
    {
      topic: 'Collinearity of Points',
      difficulty: 'difficult',
      question: 'For what value of k are the three points (1, 2), (k, 0), and (0, 3) collinear?',
      options: ['2', '3', '-1', '1.5'],
      correctOption: 1,
      explanation: 'For collinearity, slope between (1,2) and (0,3) equals slope between (0,3) and (k,0). Slope = (3 - 2)/(0 - 1) = -1. Then (0 - 3)/(k - 0) = -1 => -3/k = -1 => k = 3.'
    }
  ],

  'Introduction to Trigonometry': [
    {
      topic: 'Trigonometric Ratios',
      difficulty: 'easy',
      question: 'In a right-angled triangle, if sin θ = 3/5, what is the value of cos θ?',
      options: ['4/5', '5/3', '3/4', '4/3'],
      correctOption: 0,
      explanation: 'cos θ = √(1 - sin² θ) = √(1 - 9/25) = √(16/25) = 4/5.'
    },
    {
      topic: 'Specific Angle Values',
      difficulty: 'moderate',
      question: 'Evaluate: 2 tan² 45° + cos² 30° - sin² 60°',
      options: ['1', '2', '3/2', '√3'],
      correctOption: 1,
      explanation: 'tan 45° = 1, cos 30° = √3/2, sin 60° = √3/2. Expression = 2(1)² + (3/4) - (3/4) = 2.'
    },
    {
      topic: 'Trigonometric Identities',
      difficulty: 'difficult',
      question: 'Simplify the expression: (sec θ + tan θ)(1 - sin θ)',
      options: ['cos θ', 'sin θ', 'sec θ', 'cosec θ'],
      correctOption: 0,
      explanation: '(sec θ + tan θ)(1 - sin θ) = ((1 + sin θ)/cos θ)(1 - sin θ) = (1 - sin² θ)/cos θ = cos² θ / cos θ = cos θ.'
    }
  ],

  'Statistics': [
    {
      topic: 'Empirical Relationship',
      difficulty: 'easy',
      question: 'What is the empirical relationship between mean, median, and mode for a moderately skewed distribution?',
      options: [
        'Mode = 3 Median - 2 Mean',
        'Mode = 2 Median - 3 Mean',
        'Median = 3 Mode - 2 Mean',
        'Mean = 3 Median - Mode'
      ],
      correctOption: 0,
      explanation: 'The standard empirical formula connecting central tendencies is: Mode = 3 Median - 2 Mean.'
    },
    {
      topic: 'Mean of Observations',
      difficulty: 'moderate',
      question: 'If the mean of five observations x, x+2, x+4, x+6, and x+8 is 11, what is the value of x?',
      options: ['5', '7', '9', '11'],
      correctOption: 1,
      explanation: 'Sum = 5x + 20. Mean = (5x + 20)/5 = x + 4. x + 4 = 11 => x = 7.'
    },
    {
      topic: 'Median Class in Grouped Frequency',
      difficulty: 'difficult',
      question: 'In a grouped frequency distribution with total frequency N = 60, the median class is identified as the class whose cumulative frequency is:',
      options: [
        'Just greater than or equal to 30',
        'Strictly equal to 60',
        'Less than 30',
        'The class with the highest individual frequency'
      ],
      correctOption: 0,
      explanation: 'To locate the median class, calculate N/2 = 60/2 = 30 and locate the class interval whose cumulative frequency is just greater than or equal to N/2.'
    }
  ],

  'Probability': [
    {
      topic: 'Range of Probability',
      difficulty: 'easy',
      question: 'Which of the following numbers cannot represent the probability of an event?',
      options: ['2/3', '-1.5', '15%', '0.7'],
      correctOption: 1,
      explanation: 'The probability of any event E satisfies 0 ≤ P(E) ≤ 1. Probability can never be negative.'
    },
    {
      topic: 'Complementary Events',
      difficulty: 'moderate',
      question: 'If the probability of an event P(E) is 0.05, what is the probability of the complementary event "not E"?',
      options: ['0.95', '0.50', '0.05', '0.90'],
      correctOption: 0,
      explanation: 'P(not E) = 1 - P(E) = 1 - 0.05 = 0.95.'
    },
    {
      topic: 'Compound Probability',
      difficulty: 'difficult',
      question: 'A card is drawn from a well-shuffled deck of 52 playing cards. What is the probability of getting either a King or a Red Card?',
      options: ['28/52', '26/52', '30/52', '7/13'],
      correctOption: 3,
      explanation: 'Red cards = 26. Kings = 4 (2 red, 2 black). Total favorable outcomes = 26 + 2 = 28 cards. P = 28/52 = 7/13.'
    }
  ],

  'Integration': [
    {
      topic: 'Indefinite Integrals & Power Rule',
      difficulty: 'easy',
      question: 'What is the indefinite integral ∫ x³ dx?',
      options: ['(x⁴ / 4) + C', '3x² + C', '(x⁴ / 3) + C', '4x⁴ + C'],
      correctOption: 0,
      explanation: 'By the power rule for integration, ∫ xⁿ dx = (x^(n+1))/(n+1) + C for n ≠ -1. For n = 3, ∫ x³ dx = x⁴/4 + C.'
    },
    {
      topic: 'Definite Integrals',
      difficulty: 'moderate',
      question: 'Evaluate the definite integral ∫ from 0 to 2 of (3x² - 2x) dx.',
      options: ['4', '6', '8', '2'],
      correctOption: 0,
      explanation: '[x³ - x²] evaluated from 0 to 2 = (2³ - 2²) - (0) = 8 - 4 = 4.'
    },
    {
      topic: 'Integration by Substitution',
      difficulty: 'difficult',
      question: 'What is the integral ∫ (2x / (x² + 1)) dx?',
      options: ['ln(x² + 1) + C', 'arctan(x) + C', '2 ln|x| + C', '(x² + 1)² + C'],
      correctOption: 0,
      explanation: 'Let u = x² + 1, then du = 2x dx. The integral becomes ∫ (1/u) du = ln|u| + C = ln(x² + 1) + C.'
    }
  ],

  'Some Applications of Trigonometry': [
    {
      topic: 'Angle of Elevation & Heights',
      difficulty: 'easy',
      question: 'A vertical pole of length 6 m casts a shadow 2√3 m long on the ground. What is the sun\'s angle of elevation?',
      options: ['60°', '30°', '45°', '90°'],
      correctOption: 0,
      explanation: 'tan θ = Height / Shadow = 6 / (2√3) = 3 / √3 = √3. Therefore, θ = 60°.'
    },
    {
      topic: 'Heights and Distances with Observer Height',
      difficulty: 'moderate',
      question: 'An observer 1.5 m tall is 28.5 m away from a tower. The angle of elevation of the top of the tower from their eye is 45°. What is the height of the tower?',
      options: ['30 m', '28.5 m', '27 m', '31.5 m'],
      correctOption: 0,
      explanation: 'tan 45° = (h - 1.5) / 28.5 => 1 = (h - 1.5) / 28.5 => h - 1.5 = 28.5 => h = 30 m.'
    },
    {
      topic: 'Dual Angle of Depression Problem',
      difficulty: 'difficult',
      question: 'From the top of a 75 m high lighthouse, the angles of depression of two ships in the same line are 30° and 45°. What is the distance between the two ships?',
      options: ['75(√3 - 1) m', '75(√3 + 1) m', '150 m', '75√3 m'],
      correctOption: 0,
      explanation: 'd₁ = 75 cot 45° = 75 m. d₂ = 75 cot 30° = 75√3 m. Distance between them = d₂ - d₁ = 75(√3 - 1) m.'
    }
  ],

  'Circles': [
    {
      topic: 'Tangents to a Circle',
      difficulty: 'easy',
      question: 'How many tangents can be drawn to a circle from an external point outside the circle?',
      options: ['Exactly 2', 'Only 1', 'Infinitely many', 'Zero'],
      correctOption: 0,
      explanation: 'From any external point outside a circle, exactly two distinct tangents can be drawn to the circle.'
    },
    {
      topic: 'Lengths of Tangents from External Point',
      difficulty: 'moderate',
      question: 'The lengths of two tangents drawn from an external point to a circle are:',
      options: ['Always equal to each other', 'Inversely proportional to radius', 'Always unequal', 'Equal to the circle diameter'],
      correctOption: 0,
      explanation: 'Theorem 10.2: The lengths of tangents drawn from an external point to a circle are equal.'
    },
    {
      topic: 'Circumscribed Quadrilateral Properties',
      difficulty: 'difficult',
      question: 'A quadrilateral ABCD is drawn to circumscribe a circle. Which of the following relationships must be true?',
      options: ['AB + CD = AD + BC', 'AB + BC = CD + DA', 'AB × CD = BC × DA', 'AC = BD'],
      correctOption: 0,
      explanation: 'By equating tangent lengths from each vertex, the sum of opposite sides of a circumscribed quadrilateral is equal: AB + CD = AD + BC.'
    }
  ],

  'Areas Related to Circles': [
    {
      topic: 'Area of Sector of Circle',
      difficulty: 'easy',
      question: 'What is the area of a sector of a circle with radius r and central angle θ (in degrees)?',
      options: ['(θ / 360) × πr²', '(θ / 180) × πr²', '(θ / 360) × 2πr', '(θ / 180) × πr'],
      correctOption: 0,
      explanation: 'The area of a sector with central angle θ in degrees is given by (θ / 360°) × πr².'
    },
    {
      topic: 'Equating Perimeter and Area',
      difficulty: 'moderate',
      question: 'If the perimeter and the area of a circle are numerically equal, what is the radius of the circle?',
      options: ['2 units', 'π units', '4 units', '7 units'],
      correctOption: 0,
      explanation: '2πr = πr² => 2r = r² (since r ≠ 0) => r = 2 units.'
    },
    {
      topic: 'Clock Hand Area Swept',
      difficulty: 'difficult',
      question: 'The minute hand of a clock is 14 cm long. Find the area swept by the minute hand in 5 minutes (take π = 22/7).',
      options: ['154/3 cm²', '77 cm²', '154 cm²', '308/3 cm²'],
      correctOption: 0,
      explanation: 'In 60 minutes, the minute hand sweeps 360°, so in 5 minutes it sweeps 30°. Area = (30/360) × (22/7) × 14² = (1/12) × 616 = 154/3 cm².'
    }
  ],

  'Surface Areas and Volumes': [
    {
      topic: 'Surface Area of Hemisphere',
      difficulty: 'easy',
      question: 'What is the total surface area of a solid hemisphere of radius r?',
      options: ['3πr²', '2πr²', '4πr²', '⅔πr³'],
      correctOption: 0,
      explanation: 'A solid hemisphere has a curved surface area (2πr²) plus a flat circular base (πr²), giving total surface area = 3πr².'
    },
    {
      topic: 'Conversion of Solids (Sphere to Cylinder)',
      difficulty: 'moderate',
      question: 'A metallic sphere of radius 4.2 cm is melted and recast into the shape of a cylinder of radius 6 cm. What is the height of the cylinder?',
      options: ['2.74 cm', '3.24 cm', '1.82 cm', '4.12 cm'],
      correctOption: 0,
      explanation: 'Volume of sphere = Volume of cylinder: (4/3)π(4.2)³ = π(6)²h => (4/3) × 74.088 = 36h => 98.784 = 36h => h ≈ 2.74 cm.'
    },
    {
      topic: 'Volume of Frustum of Cone',
      difficulty: 'difficult',
      question: 'What is the volume of a frustum of a cone of height h with base radii R and r?',
      options: ['(1/3)πh (R² + r² + Rr)', '(1/3)πh (R² - r²)', 'πh (R + r)', '(2/3)πh (R² + r²)'],
      correctOption: 0,
      explanation: 'The volume of a frustum of a cone is (1/3)πh(R² + r² + Rr).'
    }
  ],

  // ================= SCIENCE =================
  'Chemical Reactions and Equations': [
    {
      topic: 'Types of Chemical Reactions',
      difficulty: 'easy',
      question: 'What type of chemical reaction is represented by: 2Mg + O₂ → 2MgO?',
      options: ['Decomposition reaction', 'Combination reaction', 'Displacement reaction', 'Double displacement reaction'],
      correctOption: 1,
      explanation: 'Two reactants combine to form a single compound product (MgO), which defines a combination reaction.'
    },
    {
      topic: 'Redox Reactions',
      difficulty: 'moderate',
      question: 'In the reaction CuO + H₂ → Cu + H₂O, which substance undergoes oxidation?',
      options: ['CuO', 'Cu', 'H₂', 'H₂O'],
      correctOption: 2,
      explanation: 'Hydrogen (H₂) gains oxygen to form H₂O, meaning hydrogen is oxidized. CuO loses oxygen and is reduced.'
    },
    {
      topic: 'Balancing Chemical Equations',
      difficulty: 'difficult',
      question: 'When balancing the equation Fe + H₂O → Fe₃O₄ + H₂, what is the stoichiometric coefficient of H₂O in the balanced equation?',
      options: ['2', '3', '4', '1'],
      correctOption: 2,
      explanation: 'The balanced equation is 3Fe + 4H₂O → Fe₃O₄ + 4H₂. The coefficient of H₂O is 4.'
    }
  ],

  'Acids, Bases and Salts': [
    {
      topic: 'Indicators & pH Scale',
      difficulty: 'easy',
      question: 'Which of the following solutions will turn blue litmus paper red?',
      options: ['Baking soda solution (pH ~ 8.5)', 'Lemon juice (pH ~ 2.2)', 'Soap solution (pH ~ 9.5)', 'Pure distilled water (pH 7)'],
      correctOption: 1,
      explanation: 'Acids turn blue litmus red. Lemon juice contains citric acid and has an acidic pH below 7.'
    },
    {
      topic: 'Metal Reactions with Acids',
      difficulty: 'moderate',
      question: 'Which gas is evolved when dilute hydrochloric acid reacts with zinc metal granules?',
      options: ['Oxygen gas', 'Carbon dioxide gas', 'Hydrogen gas', 'Chlorine gas'],
      correctOption: 2,
      explanation: 'Acid + Metal → Salt + Hydrogen gas. Zn + 2HCl → ZnCl₂ + H₂↑. Hydrogen gas burns with a characteristic pop sound.'
    },
    {
      topic: 'Water of Crystallization',
      difficulty: 'difficult',
      question: 'Heating Gypsum at 373 K yields Plaster of Paris. What is the chemical formula of Plaster of Paris?',
      options: ['CaSO₄ · 2H₂O', 'CaSO₄ · ½H₂O', 'CaSO₄ · 5H₂O', 'CaSO₄ · 7H₂O'],
      correctOption: 1,
      explanation: 'Plaster of Paris is calcium sulphate hemihydrate: CaSO₄ · ½H₂O.'
    }
  ],

  'Metals and Non-Metals': [
    {
      topic: 'Physical Properties of Metals',
      difficulty: 'easy',
      question: 'Which metal exists in liquid state at standard room temperature?',
      options: ['Mercury', 'Sodium', 'Lead', 'Aluminium'],
      correctOption: 0,
      explanation: 'Mercury (Hg) is the only metal that is liquid at room temperature (25°C).'
    },
    {
      topic: 'Reactivity Series & Displacement',
      difficulty: 'moderate',
      question: 'What happens when an iron nail is dipped into an aqueous blue copper sulphate solution for 30 minutes?',
      options: [
        'The solution turns pale green and a brown coating of copper deposits on the iron nail',
        'The solution turns dark blue and iron dissolves completely without coating',
        'No reaction occurs because copper is more reactive than iron',
        'A white precipitate of iron oxide forms immediately'
      ],
      correctOption: 0,
      explanation: 'Iron displaces copper from copper sulphate: Fe + CuSO₄ (blue) → FeSO₄ (pale green) + Cu (reddish-brown deposit).'
    },
    {
      topic: 'Ionic Compounds & Formation',
      difficulty: 'difficult',
      question: 'Why do solid ionic compounds like sodium chloride (NaCl) not conduct electricity, whereas they conduct in molten or aqueous state?',
      options: [
        'Solid NaCl lacks ions completely',
        'In the solid state, ions are locked in rigid crystal lattice positions and cannot move freely',
        'Solid NaCl has free electrons that scatter electric current',
        'Ionic bonds become covalent in the solid state'
      ],
      correctOption: 1,
      explanation: 'In solid state, electrostatic attraction holds ions firmly in fixed lattice positions. When molten or dissolved, ions become mobile to conduct electric current.'
    }
  ],

  'Life Processes': [
    {
      topic: 'Photosynthesis & Autotrophic Nutrition',
      difficulty: 'easy',
      question: 'Which gas is released by green plants during the light-dependent reaction of photosynthesis?',
      options: ['Carbon dioxide', 'Nitrogen', 'Oxygen', 'Methane'],
      correctOption: 2,
      explanation: 'Photolysis (splitting) of water molecules inside chloroplasts during light reactions releases molecular oxygen (O₂).'
    },
    {
      topic: 'Cellular Respiration',
      difficulty: 'moderate',
      question: 'Where does the complete aerobic breakdown of pyruvate into CO₂, water, and energy occur inside eukaryotic cells?',
      options: ['Cytoplasm', 'Mitochondria', 'Chloroplast', 'Endoplasmic reticulum'],
      correctOption: 1,
      explanation: 'Glycolysis occurs in the cytoplasm, while the aerobic breakdown of pyruvate occurs inside the mitochondria.'
    },
    {
      topic: 'Human Circulatory System',
      difficulty: 'difficult',
      question: 'Why do the ventricles in the human heart have substantially thicker muscular walls than the atria?',
      options: [
        'To store larger volumes of blood permanently',
        'Because ventricles have to pump blood to distant body organs under high pressure',
        'To prevent oxygenated blood from mixing with deoxygenated blood',
        'Because atria generate the electrical pacemaker rhythm'
      ],
      correctOption: 1,
      explanation: 'Ventricles pump blood across long distances against high resistance, requiring thicker muscular walls.'
    }
  ],

  'Control and Coordination': [
    {
      topic: 'Neurons and Synapses',
      difficulty: 'easy',
      question: 'What is the junction or gap between two adjacent neurons called?',
      options: ['Dendrite', 'Synapse', 'Axon', 'Myelin'],
      correctOption: 1,
      explanation: 'The microscopic gap across which electrical impulses are transmitted via neurotransmitters is called a synapse.'
    },
    {
      topic: 'Plant Hormones',
      difficulty: 'moderate',
      question: 'Which plant hormone promotes cell division and is present in greater concentration in areas of rapid cell division like fruits and seeds?',
      options: ['Auxin', 'Gibberellin', 'Cytokinin', 'Abscisic acid'],
      correctOption: 2,
      explanation: 'Cytokinins promote cell division and are found in highest concentrations in actively dividing tissues like fruits and root tips.'
    },
    {
      topic: 'Endocrine System and Feedback Mechanisms',
      difficulty: 'difficult',
      question: 'Which hormone is secreted by the pancreas to regulate blood glucose levels, and what condition results from its deficiency?',
      options: [
        'Insulin; Diabetes Mellitus',
        'Thyroxine; Goitre',
        'Adrenaline; Hypertension',
        'Growth Hormone; Dwarfism'
      ],
      correctOption: 0,
      explanation: 'Insulin secreted by beta cells of the pancreas lowers blood glucose. Insufficient insulin causes Diabetes Mellitus.'
    }
  ],

  'Light - Reflection and Refraction': [
    {
      topic: 'Spherical Mirrors & Focal Length',
      difficulty: 'easy',
      question: 'A concave mirror has a radius of curvature of 30 cm. What is its focal length?',
      options: ['60 cm', '30 cm', '15 cm', '7.5 cm'],
      correctOption: 2,
      explanation: 'For spherical mirrors, focal length f = R / 2. Therefore, f = 30 / 2 = 15 cm.'
    },
    {
      topic: 'Refraction & Snell\'s Law',
      difficulty: 'moderate',
      question: 'Light travels from vacuum into glass with a refractive index of 1.5. If the speed of light in vacuum is 3 × 10⁸ m/s, what is its speed in glass?',
      options: ['2 × 10⁸ m/s', '4.5 × 10⁸ m/s', '1.5 × 10⁸ m/s', '3 × 10⁸ m/s'],
      correctOption: 0,
      explanation: 'v = c / n = (3 × 10⁸ m/s) / 1.5 = 2 × 10⁸ m/s.'
    },
    {
      topic: 'Lens Power',
      difficulty: 'difficult',
      question: 'A convex lens has a focal length of +25 cm. What is its optical power in dioptres (D)?',
      options: ['+4 D', '-4 D', '+0.25 D', '+2.5 D'],
      correctOption: 0,
      explanation: 'Power P = 1 / f(in meters). f = +25 cm = +0.25 m. P = 1 / 0.25 = +4 D.'
    }
  ],

  'Electricity': [
    {
      topic: 'Ohm\'s Law',
      difficulty: 'easy',
      question: 'According to Ohm\'s Law, at constant temperature, the electric current passing through a metallic conductor is:',
      options: [
        'Directly proportional to the applied potential difference across its ends',
        'Inversely proportional to the circuit resistance alone',
        'Independent of voltage and varying with temperature only',
        'Proportional to the square root of electrical power'
      ],
      correctOption: 0,
      explanation: 'Ohm\'s Law states V = IR, meaning current I is directly proportional to potential difference V.'
    },
    {
      topic: 'Resistors in Parallel',
      difficulty: 'moderate',
      question: 'Two resistors of 6 Ω and 3 Ω are connected in parallel across a circuit. What is their equivalent resistance?',
      options: ['9 Ω', '2 Ω', '18 Ω', '4.5 Ω'],
      correctOption: 1,
      explanation: '1/R_eq = 1/6 + 1/3 = 1/6 + 2/6 = 3/6 = 1/2. Therefore R_eq = 2 Ω.'
    },
    {
      topic: 'Joule\'s Heating and Power',
      difficulty: 'difficult',
      question: 'An electric bulb is rated 220 V and 100 W. When it is operated on 110 V, what power will it consume?',
      options: ['50 W', '75 W', '25 W', '40 W'],
      correctOption: 2,
      explanation: 'Resistance R = V² / P = (220)² / 100 = 484 Ω. At 110 V: P = V² / R = (110)² / 484 = 12100 / 484 = 25 W.'
    }
  ],

  'Magnetic Effects of Electric Current': [
    {
      topic: 'Magnetic Field Lines',
      difficulty: 'easy',
      question: 'Outside a bar magnet, magnetic field lines emerge from the:',
      options: ['North pole and merge at South pole', 'South pole and merge at North pole', 'Center and radiate outward', 'North pole and diverge infinitely'],
      correctOption: 0,
      explanation: 'By convention, magnetic field lines emerge from the north pole and merge at the south pole outside the magnet.'
    },
    {
      topic: 'Right-Hand Thumb Rule',
      difficulty: 'moderate',
      question: 'According to Maxwell\'s Right-Hand Thumb Rule, if the thumb points in the direction of electric current, the wrapped fingers show the direction of:',
      options: ['Induced electromotive force', 'Magnetic field lines', 'Electrostatic potential', 'Gravitational force'],
      correctOption: 1,
      explanation: 'The wrapped fingers point in the direction of concentric magnetic field lines encircling the current-carrying conductor.'
    },
    {
      topic: 'Electromagnetic Induction & Fleming\'s Left-Hand Rule',
      difficulty: 'difficult',
      question: 'In Fleming\'s Left-Hand Rule, what do the thumb, forefinger, and middle finger represent respectively?',
      options: [
        'Thumb: Motion/Force, Forefinger: Magnetic Field, Middle Finger: Current',
        'Thumb: Current, Forefinger: Motion, Middle Finger: Magnetic Field',
        'Thumb: Magnetic Field, Forefinger: Current, Middle Finger: Motion',
        'Thumb: Voltage, Forefinger: Current, Middle Finger: Resistance'
      ],
      correctOption: 0,
      explanation: 'Left-Hand Rule: Forefinger = Field, Middle finger = Current, Thumb = Thrust or Motion.'
    }
  ],

  'Carbon and Its Compounds': [
    {
      topic: 'Covalent Bonding in Carbon',
      difficulty: 'easy',
      question: 'Why does carbon predominantly form covalent bonds rather than ionic bonds in its compounds?',
      options: [
        'Carbon requires too much energy to gain or lose 4 electrons to form stable C⁴⁻ or C⁴⁺ ions',
        'Carbon has zero valence electrons in its outer shell',
        'Carbon bonds exclusively with heavy transition metals',
        'Carbon has a radioactive nucleus that expels valence electrons'
      ],
      correctOption: 0,
      explanation: 'Carbon has atomic number 6 with 4 valence electrons. Losing or gaining 4 electrons requires prohibitive amounts of ionization energy or lattice energy, so carbon shares electrons forming stable covalent bonds.'
    },
    {
      topic: 'Structural Isomerism in Hydrocarbons',
      difficulty: 'moderate',
      question: 'What are structural isomers in organic chemistry?',
      options: [
        'Compounds with the same molecular formula but different structural connectivity of atoms',
        'Molecules with different molecular weights but identical boiling points',
        'Elements that possess different numbers of neutrons in the atomic nucleus',
        'Salts formed exclusively by neutralization of weak organic acids'
      ],
      correctOption: 0,
      explanation: 'Isomers are chemical compounds that possess the exact same molecular formula but have distinct three-dimensional structural arrangements of their constituent atoms.'
    },
    {
      topic: 'Functional Groups (Aldehydes, Ketones, Carboxylic Acids)',
      difficulty: 'difficult',
      question: 'Which functional group characterizes aldehydes such as ethanal (acetaldehyde)?',
      options: ['-CHO', '-COOH', '-OH', '-CO-'],
      correctOption: 0,
      explanation: 'Aldehydes contain the terminal carbonyl group -CHO. (-COOH is carboxylic acid, -OH is alcohol, and -CO- is ketone).'
    }
  ],

  'Reproduction': [
    {
      topic: 'Modes of Asexual Reproduction',
      difficulty: 'easy',
      question: 'Which mode of asexual reproduction is typically observed in Hydra and yeast?',
      options: ['Budding', 'Binary fission', 'Spore formation', 'Fragmentation'],
      correctOption: 0,
      explanation: 'Hydra and yeast reproduce asexually by budding, in which an outgrowth (bud) develops due to repeated cell division at one specific site.'
    },
    {
      topic: 'Human Reproductive System & Hormonal Cycles',
      difficulty: 'moderate',
      question: 'In human females, which pituitary hormone surge directly triggers ovulation during the menstrual cycle?',
      options: ['Luteinizing Hormone (LH)', 'Progesterone', 'Oxytocin', 'Prolactin'],
      correctOption: 0,
      explanation: 'A rapid surge in Luteinizing Hormone (LH surge) from the anterior pituitary gland directly triggers the release of a mature ovum (ovulation).'
    },
    {
      topic: 'Post-Fertilization Changes in Angiosperms',
      difficulty: 'difficult',
      question: 'What is the developmental fate of the ovule and the ovary after successful fertilization in flowering angiosperms?',
      options: [
        'The ovule develops into a seed, and the ovary develops into a fruit',
        'The ovule develops into petals, and the ovary develops into a seed',
        'Both ovule and ovary degenerate completely',
        'The ovary forms pollen grains, and the ovule forms the flower style'
      ],
      correctOption: 0,
      explanation: 'Following double fertilization in angiosperms, the fertilized ovule matures into a seed containing the embryo, and the surrounding ovary ripens into the fruit.'
    }
  ],

  'Heredity': [
    {
      topic: 'Mendelian Genetics & Dominant Traits',
      difficulty: 'easy',
      question: 'According to Gregor Mendel\'s experiments on garden pea plants, which of the following is a dominant trait?',
      options: ['Tall stem height', 'Dwarf stem height', 'Wrinkled green seed', 'White flower color'],
      correctOption: 0,
      explanation: 'In garden peas (Pisum sativum), tall stem height (T) is dominant over dwarf stem height (t).'
    },
    {
      topic: 'Sex Determination in Humans',
      difficulty: 'moderate',
      question: 'In humans, what determines the biological sex of a newly conceived offspring?',
      options: [
        'The sex chromosome (X or Y) contributed by the father\'s sperm',
        'The sex chromosome contributed by the mother\'s egg exclusively',
        'The age of the mother at conception',
        'Environmental temperature during embryonic incubation'
      ],
      correctOption: 0,
      explanation: 'Mothers always contribute an X chromosome. The sperm from the father carries either an X or a Y chromosome. Fertilization with a Y-bearing sperm produces a male (XY); an X-bearing sperm produces a female (XX).'
    },
    {
      topic: 'Monohybrid Cross & Phenotypic Ratios',
      difficulty: 'difficult',
      question: 'A cross between a homozygous tall plant (TT) and a homozygous dwarf plant (tt) produces F1 progeny. When F1 self-pollinates, what is the phenotypic ratio in F2?',
      options: ['3 Tall : 1 Dwarf', '1 Tall : 2 Medium : 1 Dwarf', '9 : 3 : 3 : 1', 'All Dwarf'],
      correctOption: 0,
      explanation: 'The F2 generation of a monohybrid cross yields a genotypic ratio of 1 TT : 2 Tt : 1 tt, resulting in a 3:1 phenotypic ratio (3 tall plants to 1 dwarf plant).'
    }
  ],

  'Our Environment': [
    {
      topic: 'Trophic Levels in Ecosystems',
      difficulty: 'easy',
      question: 'In a terrestrial ecosystem, which organisms occupy the first trophic level?',
      options: ['Autotrophic green plants (Producers)', 'Herbivores (Primary consumers)', 'Carnivores (Secondary consumers)', 'Decomposers'],
      correctOption: 0,
      explanation: 'Green plants produce organic food through photosynthesis using solar energy and occupy the first trophic level.'
    },
    {
      topic: '10 Percent Law of Energy Transfer',
      difficulty: 'moderate',
      question: 'According to Lindeman\'s 10% Law of energy transfer between trophic levels:',
      options: [
        'Only approximately 10% of the energy entering one trophic level is transferred to the next higher level',
        '90% of energy is transferred to the next level while 10% is lost as heat',
        'Energy transfer efficiency increases exponentially at higher trophic levels',
        'Top carnivores store 10 times more energy than primary producers'
      ],
      correctOption: 0,
      explanation: 'On average, only about 10% of the energy consumed is transformed into new biomass available to the next trophic level; the remaining 90% is consumed in respiration, digestion, and heat loss.'
    },
    {
      topic: 'Ozone Layer Depletion',
      difficulty: 'difficult',
      question: 'Which chemical compounds were primarily responsible for the anthropogenic depletion of the stratospheric ozone layer?',
      options: ['Chlorofluorocarbons (CFCs)', 'Carbon dioxide (CO₂)', 'Methane (CH₄)', 'Sulphur dioxide (SO₂)'],
      correctOption: 0,
      explanation: 'Chlorofluorocarbons (CFCs) release reactive chlorine radicals under high-altitude UV radiation that catalytically break down ozone molecules (O₃) into oxygen gas.'
    }
  ],

  'Human Eye': [
    {
      topic: 'Structure of the Eye & Pupil Regulation',
      difficulty: 'easy',
      question: 'Which part of the human eye actively regulates and controls the amount of light entering the pupil?',
      options: ['Iris', 'Cornea', 'Retina', 'Ciliary muscles'],
      correctOption: 0,
      explanation: 'The iris is a dark muscular diaphragm that adjusts the diameter of the pupil to regulate the amount of light entering the eye.'
    },
    {
      topic: 'Defects of Vision (Hypermetropia & Myopia)',
      difficulty: 'moderate',
      question: 'A person cannot focus on nearby objects clearly but sees distant objects distinctly. Which corrective lens remedies this defect (Hypermetropia)?',
      options: ['Convex lens of suitable focal length', 'Concave lens of suitable focal length', 'Bifocal cylindrical lens', 'Plano-convex mirror'],
      correctOption: 0,
      explanation: 'Hypermetropia (farsightedness) occurs when light from nearby objects focuses behind the retina. A convex lens converges the light rays so they focus correctly on the retina.'
    },
    {
      topic: 'Atmospheric Refraction & Rayleigh Scattering',
      difficulty: 'difficult',
      question: 'Why does the clear sky appear blue during daytime on Earth?',
      options: [
        'Atmospheric gas molecules scatter shorter wavelengths (blue light) much more strongly than longer red wavelengths',
        'Blue light is selectively absorbed and re-emitted by stratospheric ozone',
        'Surface water bodies reflect blue light upward into the atmosphere',
        'The sun emits only blue light in the visible spectrum'
      ],
      correctOption: 0,
      explanation: 'According to Rayleigh scattering, the scattering intensity is proportional to 1/λ⁴. Shorter blue wavelengths (λ ≈ 400 nm) scatter much more intensely than longer red wavelengths (λ ≈ 700 nm).'
    }
  ],

  'Sources of Energy': [
    {
      topic: 'Renewable vs Non-Renewable Sources',
      difficulty: 'easy',
      question: 'Which of the following is an inexhaustible, renewable source of energy?',
      options: ['Solar energy', 'Coal', 'Petroleum', 'Natural gas'],
      correctOption: 0,
      explanation: 'Solar energy is continuously replenished by the sun and generates power without depleting fossil fuel reserves or producing greenhouse emissions.'
    },
    {
      topic: 'Biogas Generation & Composition',
      difficulty: 'moderate',
      question: 'What is the primary combustible gas present in bio-gas produced from anaerobic decomposition of organic waste?',
      options: ['Methane (CH₄, up to 75%)', 'Carbon monoxide (CO)', 'Hydrogen sulphide (H₂S)', 'Nitrogen dioxide (NO₂)'],
      correctOption: 0,
      explanation: 'Bio-gas consists of up to 75% methane (CH₄), which burns without smoke and leaves no residue, making it an efficient domestic fuel.'
    },
    {
      topic: 'Nuclear Energy & Control Rods',
      difficulty: 'difficult',
      question: 'In a nuclear fission reactor, which material is commonly used in control rods to absorb excess neutrons and regulate the fission rate?',
      options: ['Cadmium or Boron', 'Heavy water (D₂O)', 'Graphite', 'Enriched Uranium-235'],
      correctOption: 0,
      explanation: 'Cadmium and boron have very high neutron capture cross-sections, allowing them to absorb excess neutrons to maintain a stable, controlled fission reaction.'
    }
  ],

  // ================= ENGLISH =================
  'Grammar & Sentence Structure': [
    {
      topic: 'Subject-Verb Agreement',
      difficulty: 'easy',
      question: 'Identify the sentence with correct subject-verb agreement:',
      options: [
        'Neither the teacher nor the students was present in the auditorium.',
        'Neither the teacher nor the students were present in the auditorium.',
        'Neither the teacher nor the students is present in the auditorium.',
        'Neither the teacher nor the students are being present in the auditorium.'
      ],
      correctOption: 1,
      explanation: 'When subjects are joined by "neither... nor", the verb agrees with the nearer subject ("students", plural -> "were").'
    },
    {
      topic: 'Active and Passive Voice',
      difficulty: 'moderate',
      question: 'Choose the correct passive voice: "The committee has approved the revised scholarship policy."',
      options: [
        'The revised scholarship policy was approved by the committee.',
        'The revised scholarship policy had been approved by the committee.',
        'The revised scholarship policy has been approved by the committee.',
        'The revised scholarship policy is approved by the committee.'
      ],
      correctOption: 2,
      explanation: 'Present perfect active ("has approved") changes to present perfect passive ("has been approved").'
    },
    {
      topic: 'Direct and Indirect Speech',
      difficulty: 'difficult',
      question: 'Convert to indirect speech: The doctor said to the patient, "Do you exercise regularly?"',
      options: [
        'The doctor asked the patient whether he exercised regularly.',
        'The doctor asked the patient that if he exercises regularly.',
        'The doctor ordered the patient whether he had exercised regularly.',
        'The doctor inquired the patient did he exercise regularly.'
      ],
      correctOption: 0,
      explanation: 'Interrogatives without question words use "if" or "whether", the verb shifts to past ("exercised").'
    }
  ],

  // ================= SOCIAL SCIENCE =================
  'Nationalism in India': [
    {
      topic: 'Rowlatt Act 1919',
      difficulty: 'easy',
      question: 'What was the primary repressive provision introduced by the Rowlatt Act passed by the Imperial Legislative Council in 1919?',
      options: [
        'It permitted the detention of political prisoners without trial for up to two years.',
        'It completely banned all vernacular newspapers and printing presses in British India.',
        'It made military service compulsory for all Indian male college students.',
        'It doubled land revenue taxes and seized private farmland in Punjab.'
      ],
      correctOption: 0,
      explanation: 'The Rowlatt Act of 1919 gave the British government enormous powers to repress political activities and allowed detention of political prisoners without trial for up to two years.'
    },
    {
      topic: 'Jallianwala Bagh Massacre',
      difficulty: 'moderate',
      question: 'Why had a large peaceful crowd gathered in the enclosed ground of Jallianwala Bagh in Amritsar on 13 April 1919 before General Dyer opened fire?',
      options: [
        'To attend the annual Baisakhi fair and peacefully protest the arrest of national leaders.',
        'To violently storm the British municipal police headquarters in Amritsar.',
        'To demand an immediate declaration of war against the Ottoman Empire.',
        'To celebrate the successful repeal of the Inland Emigration Act.'
      ],
      correctOption: 0,
      explanation: 'On 13 April 1919, a crowd gathered at Jallianwala Bagh in Amritsar—some to protest against the government repressive Rowlatt Act and arrests of Dr. Saifuddin Kitchlew and Dr. Satyapal, and others to attend the annual Baisakhi fair.'
    },
    {
      topic: 'Chauri Chaura Incident',
      difficulty: 'easy',
      question: 'Which violent incident in February 1922 compelled Mahatma Gandhi to immediately call off the Non-Cooperation Movement?',
      options: [
        'The burning of a police station by an agitated crowd at Chauri Chaura in Gorakhpur.',
        'The armed raid on the Chittagong armoury led by Surya Sen.',
        'The execution of Bhagat Singh, Sukhdev, and Rajguru in Lahore.',
        'The police lathi charge on the Simon Commission demonstration in Lahore.'
      ],
      correctOption: 0,
      explanation: 'At Chauri Chaura in Gorakhpur (UP), a peaceful demonstration turned into a violent clash where a police station was set on fire, killing 22 policemen. Hearing this, Mahatma Gandhi called off the Non-Cooperation Movement in February 1922.'
    },
    {
      topic: 'Simon Commission Boycott',
      difficulty: 'moderate',
      question: 'Why was the Indian Statutory Commission (Simon Commission) greeted with black flags and the slogan "Go Back Simon" upon arriving in India in 1928?',
      options: [
        'It did not include a single Indian member among its commissioners.',
        'It refused to negotiate trade treaties with Indian business merchants.',
        'It was appointed specifically to dissolve the Indian National Congress.',
        'It recommended shifting the national capital from Delhi back to Calcutta.'
      ],
      correctOption: 0,
      explanation: 'The Simon Commission, appointed by the British Tory government under Sir John Simon to review the functioning of the constitutional system in India, was boycotted by all Indian parties because all of its members were British.'
    },
    {
      topic: 'Poona Pact 1932',
      difficulty: 'difficult',
      question: 'What was the historic compromise agreed upon between Mahatma Gandhi and Dr. B.R. Ambedkar in the Poona Pact of September 1932?',
      options: [
        'Reserved seats for Depressed Classes in general provincial and central legislatures instead of separate electorates.',
        'Establishment of completely separate sovereign electorates for Depressed Classes for thirty years.',
        'Formation of an autonomous independent state for minority communities in western India.',
        'Reservation of half of the British Executive Council seats exclusively for Dalit leaders.'
      ],
      correctOption: 0,
      explanation: 'The Poona Pact of September 1932 resolved Gandhi and Ambedkar’s dispute over the British Communal Award by giving the Depressed Classes reserved seats in provincial and central legislative councils, to be voted on by the general electorate.'
    },
    {
      topic: 'Lahore Congress Session 1929',
      difficulty: 'moderate',
      question: 'What historic resolution was formalized at the Lahore Congress Session of December 1929 under the presidency of Jawaharlal Nehru?',
      options: [
        'The formal demand for "Purna Swaraj" (complete independence) for India.',
        'The formal acceptance of Dominion Status under the British Crown.',
        'The launching of the Rowlatt Satyagraha nationwide.',
        'The merging of the Swaraj Party with the Muslim League.'
      ],
      correctOption: 0,
      explanation: 'In December 1929, under the presidency of Jawaharlal Nehru, the Lahore Congress formalized the demand of "Purna Swaraj" or complete independence and declared 26 January 1930 as Independence Day.'
    }
  ],

  'The Rise of Nationalism in Europe': [
    {
      topic: 'Napoleonic Civil Code 1804',
      difficulty: 'moderate',
      question: 'Which of the following was a key reform introduced across French-controlled territories by the Napoleonic Code of 1804?',
      options: [
        'Abolition of all birth-based privileges, establishment of equality before law, and securing property rights.',
        'Introduction of universal adult franchise including voting rights for all adult women.',
        'Restoration of feudal dues, serfdom, and aristocratic guild restrictions.',
        'Mandatory adoption of the Latin language for all state school curricula.'
      ],
      correctOption: 0,
      explanation: 'The Civil Code of 1804 (Napoleonic Code) did away with all privileges based on birth, established equality before the law, secured the right to property, and abolished the feudal system across regions under French control.'
    },
    {
      topic: 'Zollverein Customs Union',
      difficulty: 'difficult',
      question: 'In 1834, a customs union known as the "Zollverein" was initiated in German states under Prussian leadership to:',
      options: [
        'Abolish tariff barriers and reduce the number of regional currencies from over thirty to two.',
        'Impose heavy naval blockades on British manufactured cotton imports.',
        'Establish a unified Austrian military command over southern European borders.',
        'Collect ecclesiastical taxes for the Papal States in Rome.'
      ],
      correctOption: 0,
      explanation: 'The Zollverein customs union abolished internal tariff barriers and reduced currencies from over thirty to two, creating economic unity that strengthened national sentiment in Germany.'
    },
    {
      topic: 'Unification of Germany',
      difficulty: 'moderate',
      question: 'Who was the chief minister of Prussia widely regarded as the architect of German unification carried out through the policy of "Blood and Iron"?',
      options: [
        'Otto von Bismarck',
        'Giuseppe Garibaldi',
        'Klemens von Metternich',
        'Count Camillo de Cavour'
      ],
      correctOption: 0,
      explanation: 'Otto von Bismarck, Chief Minister of Prussia, led the process of German unification using the Prussian army and bureaucracy through three wars over seven years with Austria, Denmark, and France.'
    },
    {
      topic: 'National Allegories',
      difficulty: 'easy',
      question: 'In 19th-century Europe, which female allegory was depicted wearing a crown of oak leaves to represent German heroism?',
      options: [
        'Germania',
        'Marianne',
        'Britannia',
        'Columbia'
      ],
      correctOption: 0,
      explanation: 'Germania became the allegory of the German nation. In visual representations, Germania wears a crown of oak leaves, as the German oak stands for heroism.'
    }
  ],

  'Resources and Development': [
    {
      topic: 'Black Soil Characteristics',
      difficulty: 'easy',
      question: 'Which type of Indian soil is typically black in color, clayey, develops deep cracks during hot weather, and is renowned for cotton cultivation?',
      options: [
        'Black Soil (Regur Soil)',
        'Laterite Soil',
        'Arid Soil',
        'Red and Yellow Soil'
      ],
      correctOption: 0,
      explanation: 'Black soil, also known as Regur soil, is formed from Deccan Trap basalt weathering, has high water-retentive clayey capacity, and is ideally suited for cotton cultivation.'
    },
    {
      topic: 'Alluvial Soil Classification',
      difficulty: 'moderate',
      question: 'How do geographers differentiate between "Khadar" and "Bhangar" alluvial soils of the Northern Plains?',
      options: [
        'Khadar is newer, more fertile alluvium, while Bhangar is older alluvium containing higher Kanker nodules.',
        'Khadar is found strictly on mountain hilltops, while Bhangar lines coastal beaches.',
        'Khadar is completely barren clay, while Bhangar consists of desert sand dunes.',
        'Khadar has an acidic pH below 4, while Bhangar is rich in volcanic iron ore.'
      ],
      correctOption: 0,
      explanation: 'According to age, alluvial soils are classified into Bhangar (old alluvium, higher concentration of calcareous Kanker nodules) and Khadar (new alluvium, more fertile and fine-grained).'
    },
    {
      topic: 'Land Degradation Causes',
      difficulty: 'moderate',
      question: 'What is the principal cause of severe land degradation observed in the states of Punjab, Haryana, and western Uttar Pradesh?',
      options: [
        'Over-irrigation leading to waterlogging, increased soil salinity, and alkalinity.',
        'Excessive deforestation driven by opencast bauxite mining.',
        'Severe overgrazing by nomadic livestock in arid pastures.',
        'Heavy industrial toxic discharge from petroleum refineries.'
      ],
      correctOption: 0,
      explanation: 'In Punjab, Haryana, and western UP, excessive canal and tubewell irrigation has resulted in waterlogging, increasing salinity and alkalinity in the soil.'
    },
    {
      topic: 'Rio Earth Summit 1992',
      difficulty: 'difficult',
      question: 'What global action plan was adopted at the United Nations Conference on Environment and Development (UNCED) at Rio de Janeiro in 1992 to achieve global sustainable development?',
      options: [
        'Agenda 21',
        'Kyoto Protocol',
        'Paris Climate Accord',
        'Montreal Protocol'
      ],
      correctOption: 0,
      explanation: 'In June 1992, more than 100 heads of states met in Rio de Janeiro, Brazil, and endorsed the global Forest Principles and adopted Agenda 21 for achieving Sustainable Development in the 21st century.'
    }
  ],

  'Power Sharing & Federalism': [
    {
      topic: 'Belgium Model of Power Sharing',
      difficulty: 'moderate',
      question: 'Which constitutional arrangement was adopted in Belgium to avoid ethnic conflict between Dutch-speaking and French-speaking communities?',
      options: [
        'Equal number of Dutch and French-speaking ministers in the Central Government with special majority protections.',
        'Complete expulsion of minority French speakers from the capital city of Brussels.',
        'Declaration of the Dutch language as the sole official language of the country.',
        'Concentration of all executive power in a single hereditary monarch.'
      ],
      correctOption: 0,
      explanation: 'The Belgian Constitution prescribes that the number of Dutch and French-speaking ministers shall be equal in the central government so no single community can make decisions unilaterally.'
    },
    {
      topic: 'Horizontal vs Vertical Power Sharing',
      difficulty: 'easy',
      question: 'In a modern democracy, power sharing among the Legislature, Executive, and Judiciary is formally termed as:',
      options: [
        'Horizontal distribution of power (System of Checks and Balances)',
        'Vertical division of federal power',
        'Community power sharing mechanism',
        'Authoritarian separation of functions'
      ],
      correctOption: 0,
      explanation: 'Power shared among different organs of government placed at the same level—legislature, executive, and judiciary—is called horizontal distribution, allowing each organ to check the others.'
    },
    {
      topic: 'Legislative Lists in Indian Constitution',
      difficulty: 'moderate',
      question: 'Under the Indian Constitution, subjects of common interest such as Education, Forests, and Trade Unions are placed in which list?',
      options: [
        'Concurrent List (both Union and State legislatures can make laws)',
        'Union List (strictly Parliament only)',
        'State List (strictly State legislatures only)',
        'Residuary Powers List'
      ],
      correctOption: 0,
      explanation: 'The Concurrent List includes subjects of common interest to both the Union and State governments, such as education, forest, trade unions, marriage, adoption, and succession.'
    },
    {
      topic: '1992 Decentralization Amendment',
      difficulty: 'difficult',
      question: 'Which constitutional reform was made mandatory by the 73rd and 74th Constitutional Amendment Acts in India in 1992 to empower local government?',
      options: [
        'Mandatory regular local elections, reservation of at least 1/3rd seats for women, and state revenue sharing.',
        'Abolition of all Gram Panchayats in favor of direct district magistrate rule.',
        'Complete privatization of all rural irrigation and water bodies.',
        'Nomination of all municipal corporators directly by the Central Union Cabinet.'
      ],
      correctOption: 0,
      explanation: 'A major step toward decentralisation was taken in 1992 with the 73rd and 74th amendments, making regular elections mandatory, reserving at least one-third of all seats for women, and establishing State Election Commissions.'
    }
  ],

  'Development, Sectors of Economy & Money and Credit': [
    {
      topic: 'Disguised Unemployment in Agriculture',
      difficulty: 'moderate',
      question: 'What is meant by "disguised unemployment" (underemployment) commonly prevalent in India\'s primary agricultural sector?',
      options: [
        'More workers are engaged on a farm than required; removing a few does not decrease total production.',
        'Workers are actively employed only for two weeks during the monsoon and unemployed the rest of the year.',
        'Educated university graduates are unable to find any employment in urban software parks.',
        'Workers lose their jobs due to the sudden closure of a large textile mill.'
      ],
      correctOption: 0,
      explanation: 'Disguised unemployment occurs when more people are working in an activity than required. Each person appears to work, but their marginal productivity is zero; withdrawing them leaves total agricultural output unchanged.'
    },
    {
      topic: 'Formal vs Informal Credit Role of RBI',
      difficulty: 'moderate',
      question: 'Which apex institution strictly supervises the functioning of formal sources of loans (commercial banks) in India to ensure affordable credit reaches small borrowers?',
      options: [
        'Reserve Bank of India (RBI)',
        'State Bank of India (SBI)',
        'Ministry of Finance',
        'NITI Aayog'
      ],
      correctOption: 0,
      explanation: 'The Reserve Bank of India (RBI) supervises the functioning of formal sources of loans. It monitors that banks maintain cash balances and lend not just to profit-making businesses, but also to small cultivators and cottage industries.'
    },
    {
      topic: 'World Bank Development Criteria',
      difficulty: 'easy',
      question: 'What criterion is used by the World Bank in its World Development Reports to classify countries as rich or low-income?',
      options: [
        'Per Capita Income (Average Income)',
        'Infant Mortality Rate',
        'Gross Enrolment Ratio in Secondary Schools',
        'Total Gold Reserves held in the Central Treasury'
      ],
      correctOption: 0,
      explanation: 'In World Development Reports brought out by the World Bank, per capita income (total national income divided by total population) is used in classifying countries.'
    },
    {
      topic: 'MGNREGA 2005 Guarantee',
      difficulty: 'easy',
      question: 'How many days of guaranteed wage employment in a year are provided under the Mahatma Gandhi National Rural Employment Guarantee Act (MGNREGA 2005)?',
      options: [
        '100 days of guaranteed wage employment',
        '50 days of guaranteed wage employment',
        '200 days of guaranteed wage employment',
        '365 days of guaranteed wage employment'
      ],
      correctOption: 0,
      explanation: 'Under MGNREGA 2005, all those who are able to and are in need of work in rural areas are guaranteed 100 days of employment in a year by the government. If the government fails to provide it, it gives unemployment allowances.'
    },
    {
      topic: 'Terms of Credit - Collateral',
      difficulty: 'moderate',
      question: 'In financial banking, an asset that a borrower owns (such as land, building, vehicle, or bank deposit) and pledges to a lender as a guarantee until the loan is repaid is termed as:',
      options: [
        'Collateral',
        'Interest dividend',
        'Demand draft',
        'Promissory share'
      ],
      correctOption: 0,
      explanation: 'Collateral is an asset that the borrower owns and uses as a guarantee to a lender until the loan is repaid. If the borrower fails to repay, the lender has the legal right to sell the asset to obtain payment.'
    }
  ],

  // ================= COMPUTER SCIENCE / IT =================
  'Introduction to Computer Applications': [
    {
      topic: 'Network Protocol - HTTP vs HTTPS',
      difficulty: 'easy',
      question: 'Which network protocol provides encrypted communication over computer networks using SSL/TLS security certificates on port 443?',
      options: [
        'HTTPS (HyperText Transfer Protocol Secure)',
        'HTTP (HyperText Transfer Protocol)',
        'FTP (File Transfer Protocol)',
        'SMTP (Simple Mail Transfer Protocol)'
      ],
      correctOption: 0,
      explanation: 'HTTPS encrypts data exchanged between web browser and web server using SSL/TLS certificates, preventing eavesdropping and tampering.'
    },
    {
      topic: 'Cyber Ethics - Plagiarism Definition',
      difficulty: 'easy',
      question: 'The unethical act of presenting someone else’s work, code, or ideas as one’s own without giving proper attribution or credit is known as:',
      options: [
        'Plagiarism',
        'Open-source licensing',
        'Phishing',
        'Data encryption'
      ],
      correctOption: 0,
      explanation: 'Plagiarism is the practice of taking someone else’s work or ideas and passing them off as one’s own without citing the original source.'
    },
    {
      topic: 'Cyber Security - Phishing Attack',
      difficulty: 'moderate',
      question: 'What type of fraudulent cyber attack involves sending deceptive emails or messages masquerading as a legitimate bank or institution to steal sensitive credentials?',
      options: [
        'Phishing',
        'DDoS Attack',
        'Trojan Horse',
        'Spyware'
      ],
      correctOption: 0,
      explanation: 'Phishing is a social engineering attack where attackers impersonate trustworthy entities to deceive victims into revealing sensitive information like login credentials and credit card numbers.'
    },
    {
      topic: 'HTML Hyperlink Tag',
      difficulty: 'easy',
      question: 'In HTML, which element tag and attribute are used to create a hyperlink to another web page?',
      options: [
        '<a href="url">Link Text</a>',
        '<link src="url">Link Text</link>',
        '<href url="link">Link Text</href>',
        '<anchor to="url">Link Text</anchor>'
      ],
      correctOption: 0,
      explanation: 'The <a> (anchor) tag with the href (hypertext reference) attribute specifies the target URL of the link.'
    },
    {
      topic: 'Python Mutable vs Immutable Data Types',
      difficulty: 'moderate',
      question: 'In Python programming, which of the following standard data types is MUTABLE (can be modified in-place after creation)?',
      options: [
        'List',
        'Tuple',
        'String',
        'Integer'
      ],
      correctOption: 0,
      explanation: 'Lists in Python are mutable, meaning their elements can be added, removed, or changed in-place. Tuples, strings, and integers are immutable.'
    },
    {
      topic: 'DNS Function in Networking',
      difficulty: 'difficult',
      question: 'What is the primary role of the Domain Name System (DNS) in computer networking?',
      options: [
        'Translating human-readable domain names (like www.example.com) into numerical IP addresses.',
        'Allocating physical MAC addresses to network interface cards in a local LAN.',
        'Encrypting packet payloads traveling across international undersea cables.',
        'Converting AC current into DC power inside computer power supply units.'
      ],
      correctOption: 0,
      explanation: 'DNS serves as the internet’s phone book by mapping human-readable domain names (e.g. www.google.com) to machine-readable IP addresses (e.g. 142.250.190.46).'
    }
  ],

  'Networking Basics & Cyber Ethics': [
    {
      topic: 'Network Topologies',
      difficulty: 'moderate',
      question: 'In which computer network topology are all client nodes directly connected to a single centralized device such as a hub or switch?',
      options: [
        'Star Topology',
        'Bus Topology',
        'Ring Topology',
        'Mesh Topology'
      ],
      correctOption: 0,
      explanation: 'In a Star topology, each device has a dedicated point-to-point link to a central controller (hub or switch). Failure of one node does not disrupt the network.'
    },
    {
      topic: 'Open Source Software vs Proprietary',
      difficulty: 'easy',
      question: 'Which of the following describes Free and Open-Source Software (FOSS)?',
      options: [
        'Software whose source code is freely available for inspection, modification, and redistribution.',
        'Commercial software whose source code is kept strictly private and legally protected.',
        'Trial software that stops working after a thirty-day evaluation period.',
        'Malicious software that secretly logs user keystrokes.'
      ],
      correctOption: 0,
      explanation: 'Open-source software (such as Linux, Python, or LibreOffice) provides source code openly under licenses (like GPL or MIT) allowing inspection, modification, and redistribution.'
    },
    {
      topic: 'Firewall Network Security',
      difficulty: 'moderate',
      question: 'What is the main function of a network Firewall in a computer system?',
      options: [
        'Monitoring and filtering incoming and outgoing network traffic based on predefined security rules.',
        'Increasing broadband internet download speeds by compressing video streams.',
        'Physically cooling server racks to prevent processor overheating.',
        'Defragmenting magnetic hard drives to reclaim unallocated storage sectors.'
      ],
      correctOption: 0,
      explanation: 'A firewall is a network security device that monitors and filters incoming and outgoing network traffic based on an organization’s previously established security policies.'
    }
  ],

  'HTML & CSS Web Authoring': [
    {
      topic: 'HTML Table Structure',
      difficulty: 'moderate',
      question: 'In HTML tables, which tag is used to define a table header cell that renders text as bold and centered by default?',
      options: [
        '<th>',
        '<td>',
        '<tr>',
        '<head>'
      ],
      correctOption: 0,
      explanation: 'The <th> element defines a header cell in an HTML table, rendering text bold and horizontally centered by default.'
    },
    {
      topic: 'CSS Box Model',
      difficulty: 'moderate',
      question: 'In the standard CSS Box Model, what is the space between the content boundary and the element border called?',
      options: [
        'Padding',
        'Margin',
        'Outline',
        'Gutter'
      ],
      correctOption: 0,
      explanation: 'Padding is the space between the content of the element and its border, whereas margin is the space outside the border.'
    }
  ],

  'Python Computational Thinking & Data Logic': [
    {
      topic: 'Python Arithmetic Floor Division',
      difficulty: 'easy',
      question: 'What is the output of the Python expression: 17 // 4?',
      options: [
        '4',
        '4.25',
        '1',
        '4.0'
      ],
      correctOption: 0,
      explanation: 'The // operator performs floor division, discarding any fractional remainder and returning the integer quotient (17 // 4 = 4).'
    },
    {
      topic: 'Python Loop Control Break',
      difficulty: 'moderate',
      question: 'In Python programming, which keyword is used to terminate a loop immediately and transfer execution to the statement following the loop?',
      options: [
        'break',
        'continue',
        'pass',
        'exit'
      ],
      correctOption: 0,
      explanation: 'The "break" statement in Python brings control out of the loop immediately, whereas "continue" skips only the current iteration.'
    }
  ]
};

/**
 * Resolves curriculum question bank templates for any chapter title or alias
 * Supports numbered prefixes, partial names, and curriculum synonyms
 */
export function findQuestionBankTemplates(chapterName: string): StaticQuestionTemplate[] | null {
  if (!chapterName) return null;
  const norm = chapterName.trim().toLowerCase();

  // 1. Direct or substring match
  for (const [key, templates] of Object.entries(CURRICULUM_QUESTION_BANK)) {
    const keyNorm = key.toLowerCase();
    if (keyNorm === norm || norm.includes(keyNorm) || keyNorm.includes(norm)) {
      return templates;
    }
  }

  // 2. Common aliases & partial matches
  const aliases: [RegExp, string][] = [
    [/\bnationalism\s*in\s*india/i, 'Nationalism in India'],
    [/\bnationalism.*europe|\brise\s*of\s*nationalism/i, 'The Rise of Nationalism in Europe'],
    [/\bresource.*development/i, 'Resources and Development'],
    [/\bpower\s*sharing/i, 'Power Sharing & Federalism'],
    [/\bfederal/i, 'Power Sharing & Federalism'],
    [/\bdevelopment.*sector|\bsector.*economy|\bmoney.*credit/i, 'Development, Sectors of Economy & Money and Credit'],
    [/\bdevelopment\b/i, 'Development, Sectors of Economy & Money and Credit'],
    [/\bsector/i, 'Development, Sectors of Economy & Money and Credit'],
    [/\bmoney|\bcredit/i, 'Development, Sectors of Economy & Money and Credit'],
    [/\bcomput.*applicat|\bintroduction\s*to\s*computer/i, 'Introduction to Computer Applications'],
    [/\bnetwork|\bcyber/i, 'Networking Basics & Cyber Ethics'],
    [/\bhtml|\bcss|\bweb/i, 'HTML & CSS Web Authoring'],
    [/\bpython|\bdata\s*logic/i, 'Python Computational Thinking & Data Logic'],
    [/\bquadrat/i, 'Quadratic Equations'],
    [/\bintegrat/i, 'Integration'],
    [/\bcalculus\b/i, 'Integration'],
    [/\bstatist/i, 'Statistics'],
    [/\bprobab/i, 'Probability'],
    [/\blinear\s*equation/i, 'Linear Equations'],
    [/\bpolynomial/i, 'Polynomials'],
    [/\breal\s*number/i, 'Real Numbers'],
    [/\barithmetic\s*progression|\bap\b/i, 'Arithmetic Progressions'],
    [/\btriangle/i, 'Triangles'],
    [/\bcoordinate/i, 'Coordinate Geometry'],
    [/\bsome\s*applications\s*of\s*trigonometry|\bheights\s*and\s*distance/i, 'Some Applications of Trigonometry'],
    [/\btrigonometr/i, 'Introduction to Trigonometry'],
    [/\barea.*circle/i, 'Areas Related to Circles'],
    [/\bcircle/i, 'Circles'],
    [/\bsurface\s*area|\bvolume/i, 'Surface Areas and Volumes'],
    [/\bchemical\s*reaction/i, 'Chemical Reactions and Equations'],
    [/\bacid/i, 'Acids, Bases and Salts'],
    [/\bmetal/i, 'Metals and Non-Metals'],
    [/\bcarbon/i, 'Carbon and Its Compounds'],
    [/\blife\s*process/i, 'Life Processes'],
    [/\bcontrol/i, 'Control and Coordination'],
    [/\breproduct/i, 'Reproduction'],
    [/\bheredit/i, 'Heredity'],
    [/\benvironment/i, 'Our Environment'],
    [/\bhuman\s*eye/i, 'Human Eye'],
    [/\blight\b/i, 'Light - Reflection and Refraction'],
    [/\belectric/i, 'Electricity'],
    [/\bmagnetic/i, 'Magnetic Effects of Electric Current'],
    [/\bsource.*energy/i, 'Sources of Energy']
  ];

  for (const [pattern, targetKey] of aliases) {
    if (pattern.test(norm)) {
      if (CURRICULUM_QUESTION_BANK[targetKey]) {
        return CURRICULUM_QUESTION_BANK[targetKey];
      }
    }
  }

  return null;
}

/**
 * Deterministically computes balanced 30-question allocation across extracted chapters and difficulty levels.
 * Handles single or multiple subjects and any number of chapters (including n > totalQuestions, e.g. 31 chapters).
 * Guarantees zero negative counts, zero infinite loops, and exact quota match.
 */
export function computeChapterQuestionAllocations(
  chapters: ExtractedChapter[],
  totalQuestions: number = TARGET_PRE_ASSESSMENT_QUESTIONS
): ChapterQuestionAllocation[] {
  if (!chapters || chapters.length === 0) return [];

  const n = chapters.length;

  // Group chapters by subject
  const subjects: SubjectType[] = [];
  const subjectMap = new Map<SubjectType, ExtractedChapter[]>();
  for (const ch of chapters) {
    const sub = ch.subject || 'Mathematics';
    if (!subjectMap.has(sub)) {
      subjectMap.set(sub, []);
      subjects.push(sub);
    }
    subjectMap.get(sub)!.push(ch);
  }

  // 1. Allocate quotas per subject: 12-13 questions per selected subject
  const subjectQuotas = new Map<SubjectType, number>();
  if (subjects.length === 1) {
    subjectQuotas.set(subjects[0], totalQuestions);
  } else {
    const basePerSub = Math.floor(totalQuestions / subjects.length);
    let remainder = totalQuestions % subjects.length;
    for (const sub of subjects) {
      const quota = basePerSub + (remainder > 0 ? 1 : 0);
      subjectQuotas.set(sub, Math.max(1, quota));
      if (remainder > 0) remainder--;
    }
  }

  // 2. Allocate quotas per chapter within each subject
  const allocations: ChapterQuestionAllocation[] = [];
  const globalEasyTarget = Math.round(totalQuestions * 0.30); // ~9
  const globalDiffTarget = Math.round(totalQuestions * 0.23); // ~7
  const globalModTarget = totalQuestions - globalEasyTarget - globalDiffTarget; // ~14

  let currentEasy = 0;
  let currentDiff = 0;
  let currentMod = 0;

  for (const sub of subjects) {
    const chList = subjectMap.get(sub)!;
    const subQuota = subjectQuotas.get(sub) || 0;
    const m = chList.length;

    const chapterQuotas: number[] = [];
    if (m <= subQuota) {
      const basePerCh = Math.floor(subQuota / m);
      const rem = subQuota % m;
      for (let i = 0; i < m; i++) {
        chapterQuotas.push(basePerCh + (i < rem ? 1 : 0));
      }
    } else {
      // More chapters than questions for this subject: first subQuota chapters get 1, rest get 0
      for (let i = 0; i < m; i++) {
        chapterQuotas.push(i < subQuota ? 1 : 0);
      }
    }

    for (let i = 0; i < m; i++) {
      const ch = chList[i];
      const qCount = chapterQuotas[i];

      let easy = 0;
      let diff = 0;
      let mod = 0;

      if (qCount === 1) {
        // Allocate the difficulty level that is most behind its global quota
        const easyDeficit = globalEasyTarget - currentEasy;
        const modDeficit = globalModTarget - currentMod;
        const diffDeficit = globalDiffTarget - currentDiff;

        if (modDeficit >= easyDeficit && modDeficit >= diffDeficit) {
          mod = 1;
          currentMod++;
        } else if (easyDeficit >= diffDeficit) {
          easy = 1;
          currentEasy++;
        } else {
          diff = 1;
          currentDiff++;
        }
      } else if (qCount === 2) {
        easy = 1;
        mod = 1;
        currentEasy++;
        currentMod++;
      } else if (qCount >= 3) {
        easy = Math.max(1, Math.round(qCount * 0.30));
        diff = Math.max(1, Math.round(qCount * 0.23));
        mod = qCount - easy - diff;
        if (mod < 1) {
          if (easy > 1) { easy--; mod++; }
          else if (diff > 1) { diff--; mod++; }
        }
        currentEasy += easy;
        currentMod += mod;
        currentDiff += diff;
      }

      allocations.push({
        chapterId: ch.chapterId,
        chapterName: ch.chapterName,
        subject: ch.subject,
        easyCount: easy,
        moderateCount: mod,
        difficultCount: diff,
        totalCount: qCount,
        topics: ch.topics && ch.topics.length > 0 ? ch.topics : [ch.chapterName]
      });
    }
  }

  // 3. Exact total question balance guarantee (safety check)
  const actualTotal = allocations.reduce((acc, a) => acc + a.easyCount + a.moderateCount + a.difficultCount, 0);
  let discrepancy = totalQuestions - actualTotal;
  let adjustIdx = 0;
  while (discrepancy !== 0 && adjustIdx < 50) {
    const alloc = allocations[adjustIdx % allocations.length];
    if (discrepancy > 0) {
      alloc.moderateCount++;
      alloc.totalCount++;
      discrepancy--;
    } else if (discrepancy < 0 && alloc.totalCount > 0) {
      if (alloc.moderateCount > 0) {
        alloc.moderateCount--;
        alloc.totalCount--;
        discrepancy++;
      } else if (alloc.easyCount > 0) {
        alloc.easyCount--;
        alloc.totalCount--;
        discrepancy++;
      } else if (alloc.difficultCount > 0) {
        alloc.difficultCount--;
        alloc.totalCount--;
        discrepancy++;
      }
    }
    adjustIdx++;
  }

  return allocations;
}

/**
 * Synthesizes an authentic question grounded in the actual text slice of an uploaded chapter
 */
export function generateGroundedQuestionFromSlice(
  chapter: ExtractedChapter,
  topic: string,
  difficulty: PreAssessmentDifficulty,
  counter: number
): PreAssessmentQuestion {
  const content = chapter.contentSlice || '';
  const sentences = content.split(/[.?!]\s+/).map(s => s.trim()).filter(s => s.length > 25 && s.length < 160);
  const targetOptionIndex = (counter * 3 + 1) % 4;

  // If we have factual sentences from the chapter's content slice, use them to form authentic questions
  if (sentences.length >= 3) {
    const keySentence = sentences[counter % sentences.length];
    const words = keySentence.split(/\s+/);

    if (difficulty === 'easy') {
      const question = `According to the discussion on "${topic}" in ${chapter.chapterName}, which of the following is correct?`;
      const correct = keySentence.endsWith('.') ? keySentence : keySentence + '.';
      const distractors = [
        `This concept operates inversely and is disregarded in standard analysis.`,
        `This relationship applies exclusively under zero-energy non-physical conditions.`,
        `This process produces no measurable changes under standard conditions.`
      ];

      return {
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic,
        difficulty: 'easy',
        question,
        options: buildShuffledOptions(correct, distractors, targetOptionIndex),
        correctOption: targetOptionIndex,
        explanation: `As stated in ${chapter.chapterName}: "${keySentence}".`,
        subject: chapter.subject
      };
    }

    if (difficulty === 'moderate') {
      const question = `When analyzing "${topic}", what is the primary relationship established in ${chapter.chapterName}?`;
      const correct = `It governs the key behavior and foundational principles described in the chapter.`;
      const distractors = [
        `It acts as an independent factor that has zero influence on the outcome.`,
        `It remains constant regardless of any variations in the system.`,
        `It contradicts standard conservation rules and is omitted from evaluation.`
      ];

      return {
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic,
        difficulty: 'moderate',
        question,
        options: buildShuffledOptions(correct, distractors, targetOptionIndex),
        correctOption: targetOptionIndex,
        explanation: `In ${chapter.chapterName}, the topic "${topic}" establishes the core relationship: ${keySentence}.`,
        subject: chapter.subject
      };
    }
  }

  // Fallback domain-tailored authentic question
  return generateDomainAuthenticQuestion(chapter, topic, difficulty, counter);
}

/**
 * Synthesizes an authentic domain question across NCERT cognitive styles.
 * Prioritizes curriculum question bank templates, followed by topic-grounded academic generators.
 * Guarantees zero duplicate questions by checking against usedStems.
 */
export function generateDomainAuthenticQuestion(
  chapter: ExtractedChapter,
  topic: string,
  difficulty: PreAssessmentDifficulty,
  counter: number,
  usedStems?: Set<string>
): PreAssessmentQuestion {
  const subject = chapter.subject || 'Mathematics';
  const targetOptionIndex = (counter * 7 + 1) % 4;

  // 1. Try curriculum question bank for either the topic or chapter name
  const bankTemplates = findQuestionBankTemplates(topic) || findQuestionBankTemplates(chapter.chapterName);
  if (bankTemplates && bankTemplates.length > 0) {
    const diffMatches = bankTemplates.filter(t => t.difficulty === difficulty);
    const pool = diffMatches.length > 0 ? diffMatches : bankTemplates;
    const available = usedStems
      ? pool.filter(t => !usedStems.has(t.question.trim().toLowerCase()))
      : pool;

    if (available.length > 0) {
      const chosen = available[counter % available.length];
      return {
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: chosen.topic || topic,
        difficulty,
        question: chosen.question,
        options: [...chosen.options],
        correctOption: chosen.correctOption,
        explanation: chosen.explanation,
        subject
      };
    }
  }

  // Helper to pick the first unused question from an array of generators
  const pickFirstUnused = (generators: (() => PreAssessmentQuestion)[]): PreAssessmentQuestion => {
    for (let i = 0; i < generators.length; i++) {
      const gen = generators[(counter + i) % generators.length];
      const candidate = gen();
      const norm = candidate.question.trim().toLowerCase();
      if (!usedStems || !usedStems.has(norm)) {
        return candidate;
      }
    }
    // If all generators were used, generate an offset parameterized question guaranteed to be unique
    const num = (counter * 7) + 11;
    if (subject === 'Mathematics') {
      return {
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic,
        difficulty,
        question: `In mathematical algebra under "${chapter.chapterName}", evaluate the expression 2x + ${num} when x = 3:`,
        options: buildShuffledOptions(`${6 + num}`, [`${5 + num}`, `${7 + num}`, `${8 + num}`], targetOptionIndex),
        correctOption: targetOptionIndex,
        explanation: `Substitute x = 3: 2(3) + ${num} = 6 + ${num} = ${6 + num}.`,
        subject
      };
    } else if (subject === 'English') {
      const vocabWords = [
        { word: 'meticulous', correct: 'showing great attention to detail', distractors: ['acting carelessly in haste', 'indifferent to outcomes', 'openly hostile'] },
        { word: 'resilient', correct: 'able to recover quickly from difficulties', distractors: ['fragile and easily broken', 'unwilling to adapt', 'chronically fatigued'] },
        { word: 'pragmatic', correct: 'dealing with things sensibly and realistically', distractors: ['guided purely by superstition', 'impractical and visionary', 'indecisive in crises'] },
        { word: 'articulate', correct: 'expressing thoughts clearly and fluently', distractors: ['mumbling incoherently', 'unable to write', 'speaking in fragments'] },
        { word: 'compassionate', correct: 'feeling or showing sympathy and concern for others', distractors: ['indifferent and cruel', 'demanding strict isolation', 'jealous of successes'] }
      ];
      const entry = vocabWords[(counter + num) % vocabWords.length];
      return {
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic,
        difficulty,
        question: `In literary reading and language comprehension for "${chapter.chapterName}", what is the meaning of the word "${entry.word}"?`,
        options: buildShuffledOptions(entry.correct, entry.distractors, targetOptionIndex),
        correctOption: targetOptionIndex,
        explanation: `In standard English usage, "${entry.word}" means "${entry.correct}".`,
        subject
      };
    } else {
      return {
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic,
        difficulty,
        question: `In scientific observations of "${chapter.chapterName}", if an experiment yields a measurement of ${num} units with uncertainty ±1, what is the nominal value?`,
        options: buildShuffledOptions(`${num} units`, [`${num + 2} units`, `${num - 2} units`, `${num * 2} units`], targetOptionIndex),
        correctOption: targetOptionIndex,
        explanation: `The nominal center value of the measurement is directly ${num} units.`,
        subject
      };
    }
  };

  // 2. Specialized Math generation if chapter/topic belongs to Mathematics
  if (subject === 'Mathematics') {
    const combinedContext = `${chapter.chapterName} ${topic}`.toLowerCase();

    // Quadratic Equations
    if (/quadrat/i.test(combinedContext)) {
      return pickFirstUnused([
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Standard Form',
          difficulty: 'easy',
          question: 'What is the standard algebraic form of a quadratic equation in variable x?',
          options: buildShuffledOptions('ax² + bx + c = 0 (where a ≠ 0)', ['ax + b = 0 (where a ≠ 0)', 'ax³ + bx² + cx + d = 0', 'a/x² + b/x + c = 0'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'The standard quadratic equation is ax² + bx + c = 0 with a, b, c as real coefficients and a ≠ 0.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Factorisation',
          difficulty: 'moderate',
          question: 'What are the real roots of the quadratic equation x² - 5x + 6 = 0?',
          options: buildShuffledOptions('x = 2 and x = 3', ['x = -2 and x = -3', 'x = 1 and x = 6', 'x = -1 and x = -6'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Factorizing: (x - 2)(x - 3) = 0 yields x = 2 and x = 3.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Nature of Roots',
          difficulty: 'difficult',
          question: 'For what condition of the discriminant D = b² - 4ac does a quadratic equation possess two equal and real roots?',
          options: buildShuffledOptions('D = 0', ['D > 0', 'D < 0', 'D ≤ -1'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'When discriminant D = b² - 4ac = 0, the quadratic formula yields coincident real roots x = -b/(2a).',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Quadratic Formula',
          difficulty: 'moderate',
          question: 'Which formula gives the roots of any quadratic equation ax² + bx + c = 0?',
          options: buildShuffledOptions('x = (-b ± √(b² - 4ac)) / (2a)', ['x = (-b ± √(b² + 4ac)) / (2a)', 'x = (b ± √(b² - 4ac)) / (2a)', 'x = (-b ± √(b² - 4ac)) / a'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'The quadratic formula (Sridharacharya formula) is x = (-b ± √(b² - 4ac)) / (2a).',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Roots and Coefficients',
          difficulty: 'easy',
          question: 'If α and β are the roots of the quadratic equation ax² + bx + c = 0, what is the sum of roots (α + β)?',
          options: buildShuffledOptions('-b/a', ['b/a', 'c/a', '-c/a'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'According to the relationship between roots and coefficients, sum of roots α + β = -b/a.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Roots and Coefficients',
          difficulty: 'easy',
          question: 'If α and β are the roots of the quadratic equation ax² + bx + c = 0, what is the product of roots (αβ)?',
          options: buildShuffledOptions('c/a', ['-c/a', 'b/a', '-b/a'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'The product of roots αβ = c/a for any quadratic equation ax² + bx + c = 0.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Discriminant',
          difficulty: 'moderate',
          question: 'What is the discriminant value of the quadratic equation 2x² - 4x + 3 = 0?',
          options: buildShuffledOptions('-8', ['8', '16', '-16'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Discriminant D = b² - 4ac = (-4)² - 4(2)(3) = 16 - 24 = -8.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Equal Roots Condition',
          difficulty: 'difficult',
          question: 'Find the non-zero value of k for which the quadratic equation x² - kx + 9 = 0 has equal real roots.',
          options: buildShuffledOptions('k = ±6', ['k = ±3', 'k = ±9', 'k = ±18'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'For equal roots, D = 0 => (-k)² - 4(1)(9) = 0 => k² - 36 = 0 => k = ±6.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Square Roots',
          difficulty: 'easy',
          question: 'What are the real roots of the quadratic equation x² - 16 = 0?',
          options: buildShuffledOptions('x = ±4', ['x = 4 only', 'x = 16 only', 'x = ±8'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'x² = 16 => x = ±√16 = ±4.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Real Roots Maximum',
          difficulty: 'easy',
          question: 'A quadratic equation in a single real variable can have at most how many real roots?',
          options: buildShuffledOptions('2', ['1', '3', 'Infinitely many'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'By the Fundamental Theorem of Algebra, a polynomial equation of degree 2 has at most 2 roots.',
          subject
        })
      ]);
    }

    // Real Numbers / Number Systems
    if (/real\s*number|number\s*system/i.test(combinedContext)) {
      return pickFirstUnused([
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Fundamental Theorem of Arithmetic',
          difficulty: 'easy',
          question: 'The Fundamental Theorem of Arithmetic asserts that every composite number can be uniquely expressed as a product of:',
          options: buildShuffledOptions('Primes in any order', ['Even numbers only', 'Rational fractions', 'Consecutive integers'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Every composite number can be factored uniquely as a product of prime numbers, disregarding the order of factors.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'HCF and LCM Relationship',
          difficulty: 'moderate',
          question: 'If the HCF of two numbers is 6 and their product is 180, what is their LCM?',
          options: buildShuffledOptions('30', ['36', '24', '15'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'HCF × LCM = Product of two numbers. LCM = 180 / 6 = 30.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Irrational Numbers',
          difficulty: 'difficult',
          question: 'Which of the following numbers is an irrational number?',
          options: buildShuffledOptions('3 + √5', ['√49', '2.353535...', '√0.04'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'The sum of a rational number (3) and an irrational number (√5) is always irrational.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Euclid Division Lemma',
          difficulty: 'easy',
          question: 'In Euclid’s division lemma a = bq + r, what range must the remainder r satisfy?',
          options: buildShuffledOptions('0 ≤ r < b', ['0 < r ≤ b', '0 ≤ r ≤ b', 'r > b'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Euclid’s lemma states that for positive integers a and b, unique integers q and r exist with a = bq + r where 0 ≤ r < b.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Consecutive Natural Numbers HCF',
          difficulty: 'easy',
          question: 'What is the Highest Common Factor (HCF) of any two consecutive natural numbers n and n + 1?',
          options: buildShuffledOptions('1', ['2', 'n', 'n + 1'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Two consecutive natural numbers are always coprime; their HCF is strictly 1.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Terminating Decimal Condition',
          difficulty: 'moderate',
          question: 'A rational number p/q in lowest terms has a terminating decimal expansion if the prime factors of denominator q are of the form:',
          options: buildShuffledOptions('2^n × 5^m (where n, m are non-negative integers)', ['3^n × 5^m', '2^n × 3^m', '7^n × 11^m'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'A rational fraction terminates if and only if prime factorisation of the denominator contains only 2s and 5s.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Prime Factorisation',
          difficulty: 'moderate',
          question: 'What is the prime factorisation of the composite number 140?',
          options: buildShuffledOptions('2² × 5 × 7', ['2 × 5² × 7', '2³ × 5 × 7', '2² × 3 × 7'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: '140 = 2 × 70 = 2 × 2 × 35 = 2² × 5 × 7.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Non-Terminating Repeating',
          difficulty: 'difficult',
          question: 'Which of the following rational numbers has a non-terminating repeating decimal expansion?',
          options: buildShuffledOptions('13 / 30', ['7 / 80', '13 / 125', '23 / 200'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: '30 = 2 × 3 × 5; the factor 3 causes the decimal expansion to be non-terminating and repeating.',
          subject
        })
      ]);
    }

    // Polynomials
    if (/polynomial/i.test(combinedContext)) {
      return pickFirstUnused([
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Zeros of Linear Polynomial',
          difficulty: 'easy',
          question: 'What is the zero of the linear polynomial p(x) = 3x - 12?',
          options: buildShuffledOptions('4', ['-4', '12', '3'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Set p(x) = 0: 3x - 12 = 0 => 3x = 12 => x = 4.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Zeros of Quadratic Polynomial',
          difficulty: 'moderate',
          question: 'What are the zeros of the quadratic polynomial x² - 7x + 12?',
          options: buildShuffledOptions('3 and 4', ['-3 and -4', '2 and 6', '1 and 12'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'x² - 7x + 12 = (x - 3)(x - 4) = 0 => x = 3 and x = 4.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Polynomial Coefficient Relations',
          difficulty: 'difficult',
          question: 'If α and β are zeros of f(x) = x² - 5x + k such that α - β = 1, find the value of k.',
          options: buildShuffledOptions('6', ['4', '8', '10'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'α + β = 5 and α - β = 1 => 2α = 6 => α = 3, β = 2. Product αβ = k => 3 × 2 = 6.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Maximum Zeros',
          difficulty: 'easy',
          question: 'What is the maximum number of zeroes that a polynomial of degree n can possess?',
          options: buildShuffledOptions('n', ['n + 1', 'n - 1', '2n'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'A polynomial of degree n has at most n real zeroes.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Degree of Polynomial',
          difficulty: 'easy',
          question: 'What is the degree of a non-zero constant polynomial like p(x) = 7?',
          options: buildShuffledOptions('0', ['1', 'Undefined', '7'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'p(x) = 7 = 7x⁰; the degree of a non-zero constant polynomial is 0.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Graph Shape',
          difficulty: 'moderate',
          question: 'What geometric shape represents the graph of a quadratic polynomial y = ax² + bx + c (a ≠ 0)?',
          options: buildShuffledOptions('Parabola', ['Straight line', 'Circle', 'Hyperbola'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'The graph of any quadratic polynomial is a U-shaped parabola opening upwards (if a > 0) or downwards (if a < 0).',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Remainder Theorem',
          difficulty: 'difficult',
          question: 'By the Remainder Theorem, when polynomial P(x) is divided by linear divisor (x - 2), what is the remainder?',
          options: buildShuffledOptions('P(2)', ['P(-2)', '0', 'P(0)'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Dividing P(x) by (x - a) yields remainder R = P(a). Here a = 2, so R = P(2).',
          subject
        })
      ]);
    }

    // Integration / Calculus
    if (/integrat|calculus/i.test(combinedContext)) {
      return pickFirstUnused([
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Power Rule of Integration',
          difficulty: 'easy',
          question: 'What is the indefinite integral of the power function f(x) = x with respect to x?',
          options: buildShuffledOptions('x²/2 + C', ['x² + C', '1 + C', '2x + C'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Using the power rule: ∫ x^n dx = x^(n+1)/(n+1) + C. For n = 1, ∫ x dx = x²/2 + C.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Definite Integral',
          difficulty: 'moderate',
          question: 'Evaluate the definite integral ∫ from 0 to 2 of (3x²) dx.',
          options: buildShuffledOptions('8', ['6', '12', '4'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'The antiderivative of 3x² is x³. Evaluating from 0 to 2 gives 2³ - 0³ = 8.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Logarithmic Antiderivative',
          difficulty: 'difficult',
          question: 'What is the integral of f(x) = 1/x with respect to x for x > 0?',
          options: buildShuffledOptions('ln(x) + C', ['-1/x² + C', 'e^x + C', 'x + C'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'The antiderivative of 1/x is the natural logarithmic function ln|x| + C.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Trigonometric Integral',
          difficulty: 'moderate',
          question: 'What is the indefinite integral ∫ cos(x) dx?',
          options: buildShuffledOptions('sin(x) + C', ['-sin(x) + C', 'tan(x) + C', '-cos(x) + C'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Since d/dx [sin(x)] = cos(x), the indefinite integral ∫ cos(x) dx = sin(x) + C.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Exponential Integral',
          difficulty: 'easy',
          question: 'What is the indefinite integral ∫ e^x dx?',
          options: buildShuffledOptions('e^x + C', ['xe^(x-1) + C', 'e^(x+1) + C', 'ln(x) + C'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'The exponential function e^x is its own antiderivative; ∫ e^x dx = e^x + C.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Constant Integration',
          difficulty: 'easy',
          question: 'What is the value of the indefinite integral ∫ 1 dx?',
          options: buildShuffledOptions('x + C', ['0 + C', '1 + C', 'x²/2 + C'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'The derivative of x is 1, so the antiderivative of 1 is x + C.',
          subject
        })
      ]);
    }

    // Statistics
    if (/statist|mean|median|mode/i.test(combinedContext)) {
      return pickFirstUnused([
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Class Mark',
          difficulty: 'easy',
          question: 'What is the formula for calculating the class mark of a continuous class interval?',
          options: buildShuffledOptions('(Upper class limit + Lower class limit) / 2', ['Upper class limit - Lower class limit', 'Upper class limit × Lower class limit', '(Upper class limit - Lower class limit) / 2'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'The class mark (midpoint) of a class interval is half the sum of its upper and lower limits.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Empirical Relationship',
          difficulty: 'moderate',
          question: 'Which empirical relationship connects the three central tendencies (Mean, Median, and Mode)?',
          options: buildShuffledOptions('Mode = 3 Median - 2 Mean', ['Mode = 2 Median - 3 Mean', 'Mean = 3 Mode - 2 Median', 'Median = 3 Mode + 2 Mean'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'For moderately skewed distributions, the empirical relationship is Mode = 3 Median - 2 Mean.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Ogive Curves',
          difficulty: 'difficult',
          question: 'The intersection point of the "less than ogive" and "more than ogive" curves on the horizontal axis corresponds to the:',
          options: buildShuffledOptions('Median', ['Mean', 'Mode', 'Standard Deviation'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'The abscissa (x-coordinate) of the point of intersection of less than and more than cumulative frequency curves represents the median.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Mean of Natural Numbers',
          difficulty: 'easy',
          question: 'What is the arithmetic mean of the first five natural numbers (1, 2, 3, 4, 5)?',
          options: buildShuffledOptions('3', ['2.5', '3.5', '15'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Mean = (1 + 2 + 3 + 4 + 5) / 5 = 15 / 5 = 3.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Modal Class',
          difficulty: 'moderate',
          question: 'In a grouped frequency distribution, the modal class is defined as the class interval having:',
          options: buildShuffledOptions('Maximum frequency', ['Lowest frequency', 'Cumulative frequency of N/2', 'Highest class mark'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'The modal class corresponds to the interval with the highest individual frequency.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Data Range',
          difficulty: 'easy',
          question: 'In statistics, the range of an observation data set is defined as:',
          options: buildShuffledOptions('Maximum value - Minimum value', ['Maximum value + Minimum value', '(Maximum value - Minimum value) / 2', 'Average of all values'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Range is the difference between the highest and lowest values in a data set.',
          subject
        })
      ]);
    }

    // Probability
    if (/probab/i.test(combinedContext)) {
      return pickFirstUnused([
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Impossible Event',
          difficulty: 'easy',
          question: 'What is the probability of an impossible event occurring in any random experiment?',
          options: buildShuffledOptions('0', ['1', '0.5', '-1'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'An impossible event has zero favorable outcomes, hence its probability is strictly 0.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Die Roll Prime Outcome',
          difficulty: 'moderate',
          question: 'If a fair six-sided die is rolled once, what is the probability of obtaining a prime number?',
          options: buildShuffledOptions('1/2', ['1/3', '1/6', '2/3'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Prime outcomes on a die are {2, 3, 5} (3 favorable outcomes). Probability = 3/6 = 1/2.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Two Coins Toss',
          difficulty: 'difficult',
          question: 'If two fair coins are tossed simultaneously, what is the probability of getting at least one head?',
          options: buildShuffledOptions('3/4', ['1/2', '1/4', '1'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Sample space S = {HH, HT, TH, TT}. Favorable outcomes with at least one head are {HH, HT, TH} (3 outcomes). P = 3/4.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Complementary Event',
          difficulty: 'easy',
          question: 'For any event E in a random experiment, what is the value of P(E) + P(not E)?',
          options: buildShuffledOptions('1', ['0', '0.5', '2'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'The sum of the probabilities of an event and its complementary event is always equal to 1.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Deck of Cards King',
          difficulty: 'moderate',
          question: 'A card is drawn from a well-shuffled standard deck of 52 playing cards. What is the probability of drawing a King?',
          options: buildShuffledOptions('1/13', ['1/52', '1/4', '4/13'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'There are 4 kings in a deck of 52 cards. Probability = 4/52 = 1/13.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Sure Event',
          difficulty: 'easy',
          question: 'What is the probability of a sure (certain) event?',
          options: buildShuffledOptions('1', ['0', '0.99', '100'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'A certain event contains all outcomes of the sample space, so its probability is strictly 1.',
          subject
        })
      ]);
    }
  }

  // 3. Specialized Science generation
  if (subject === 'Science' || subject === 'Physics' || subject === 'Chemistry' || subject === 'Biology') {
    const combinedContext = `${chapter.chapterName} ${topic}`.toLowerCase();

    // Chemistry
    if (/chemical|reaction|acid|base|metal|carbon|compound/i.test(combinedContext)) {
      return pickFirstUnused([
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Neutral pH',
          difficulty: 'easy',
          question: 'What is the pH value of a completely neutral aqueous solution at 25°C?',
          options: buildShuffledOptions('7', ['0', '14', '1'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'A neutral aqueous solution has [H⁺] = [OH⁻] = 10⁻⁷ M, corresponding to pH = 7.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Displacement Reaction',
          difficulty: 'moderate',
          question: 'Which chemical reaction type is represented by: Fe(s) + CuSO₄(aq) → FeSO₄(aq) + Cu(s)?',
          options: buildShuffledOptions('Displacement reaction', ['Decomposition reaction', 'Combination reaction', 'Double displacement reaction'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Iron is more reactive than copper and displaces copper from copper sulphate solution in a single displacement reaction.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Catenation Property',
          difficulty: 'difficult',
          question: 'What property of carbon enables it to form long chains and branched structures with other carbon atoms?',
          options: buildShuffledOptions('Catenation', ['Allotropy', 'Sublimation', 'Paramagnetism'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Catenation is the unique self-linking ability of carbon atoms via strong covalent C-C bonds to form chains, rings, and complex structures.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Baking Soda Formula',
          difficulty: 'easy',
          question: 'What is the chemical formula of baking soda (sodium hydrogen carbonate)?',
          options: buildShuffledOptions('NaHCO₃', ['Na₂CO₃', 'NaOH', 'CaOCl₂'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Baking soda is sodium hydrogen carbonate with chemical formula NaHCO₃.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Combination Reaction',
          difficulty: 'easy',
          question: 'What type of chemical reaction is represented by 2Mg + O₂ → 2MgO?',
          options: buildShuffledOptions('Combination reaction', ['Decomposition reaction', 'Displacement reaction', 'Redox displacement'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Two reactants (magnesium and oxygen) combine to synthesize a single compound (magnesium oxide).',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Precipitation Reaction',
          difficulty: 'moderate',
          question: 'When aqueous sodium sulphate reacts with aqueous barium chloride, what white insoluble precipitate forms?',
          options: buildShuffledOptions('Barium sulphate (BaSO₄)', ['Sodium chloride (NaCl)', 'Barium oxide (BaO)', 'Sodium sulphate (Na₂SO₄)'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'BaCl₂ + Na₂SO₄ → BaSO₄(s) + 2NaCl(aq). Barium sulphate precipitates as an insoluble white solid.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Thermal Decomposition',
          difficulty: 'moderate',
          question: 'What gases are evolved upon the thermal decomposition of solid lead nitrate [2Pb(NO₃)₂]?',
          options: buildShuffledOptions('Nitrogen dioxide (NO₂) and Oxygen (O₂)', ['Nitrogen monoxide and Carbon dioxide', 'Ammonia and Hydrogen', 'Nitrous oxide and Ozone'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: '2Pb(NO₃)₂ → 2PbO + 4NO₂(brown fumes) + O₂.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Rusting Prevention',
          difficulty: 'easy',
          question: 'The metallurgical method of protecting iron from rusting by coating it with a thin layer of zinc is called:',
          options: buildShuffledOptions('Galvanisation', ['Electroplating', 'Alloying', 'Anodising'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Galvanisation is the process of applying a protective zinc coating to steel or iron to prevent rusting.',
          subject
        })
      ]);
    }

    // Biology
    if (/life|process|control|coordinat|reproduct|heredit|environment/i.test(combinedContext)) {
      return pickFirstUnused([
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Photosynthesis Byproduct',
          difficulty: 'easy',
          question: 'Which gas is released into the atmosphere as a direct byproduct of oxygenic photosynthesis?',
          options: buildShuffledOptions('Oxygen (O₂)', ['Carbon dioxide (CO₂)', 'Nitrogen (N₂)', 'Methane (CH₄)'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'During the light reactions of photosynthesis, photolysis of water releases oxygen gas into the atmosphere.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Kidney Filtration Unit',
          difficulty: 'moderate',
          question: 'What is the structural and functional microscopic filtration unit of the human kidney?',
          options: buildShuffledOptions('Nephron', ['Neuron', 'Alveolus', 'Villus'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Each kidney contains approximately 1 million nephrons responsible for ultrafiltration, selective reabsorption, and urine excretion.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Trophic Efficiency',
          difficulty: 'difficult',
          question: 'According to Lindeman’s ecological trophic efficiency rule, what percentage of energy is transferred from one trophic level to the next?',
          options: buildShuffledOptions('10%', ['50%', '25%', '1%'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'The 10% Law states that an average of only about 10% of the energy stored as biomass in one trophic level is passed on to the next trophic level.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Vascular Transport',
          difficulty: 'easy',
          question: 'In vascular plants, which specialized complex permanent tissue conducts water and dissolved minerals from roots to leaves?',
          options: buildShuffledOptions('Xylem', ['Phloem', 'Parenchyma', 'Collenchyma'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Xylem vessels and tracheids conduct water unidirectionally from the roots to all aerial parts of the plant.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Translocation in Plants',
          difficulty: 'moderate',
          question: 'The transport of soluble products of photosynthesis (sucrose and amino acids) through phloem sieve tubes is called:',
          options: buildShuffledOptions('Translocation', ['Transpiration', 'Evaporation', 'Diffusion'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'Translocation is the movement of soluble organic nutrients produced in leaves through phloem sieve tubes using ATP energy.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Heart Chambers',
          difficulty: 'easy',
          question: 'How many muscular chambers are present in a normal human heart?',
          options: buildShuffledOptions('4 chambers (2 atria, 2 ventricles)', ['2 chambers', '3 chambers', '5 chambers'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'The human heart is divided into four chambers: right atrium, right ventricle, left atrium, and left ventricle to prevent mixing of oxygenated and deoxygenated blood.',
          subject
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Cellular Energy',
          difficulty: 'easy',
          question: 'What is the primary cellular energy carrier molecule synthesized during cellular respiration?',
          options: buildShuffledOptions('ATP (Adenosine Triphosphate)', ['DNA', 'Glucose', 'Hemoglobin'], targetOptionIndex),
          correctOption: targetOptionIndex,
          explanation: 'ATP (Adenosine Triphosphate) is the universal cellular energy currency synthesized during aerobic and anaerobic cellular respiration.',
          subject
        })
      ]);
    }

    // Physics
    return pickFirstUnused([
      () => ({
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: 'Potential Difference Unit',
        difficulty: 'easy',
        question: 'What is the SI unit of electric potential difference (voltage)?',
        options: buildShuffledOptions('Volt (V)', ['Ampere (A)', 'Ohm (Ω)', 'Watt (W)'], targetOptionIndex),
        correctOption: targetOptionIndex,
        explanation: 'The SI unit of electric potential difference is the Volt, defined as one joule of work per coulomb of charge (1 V = 1 J/C).',
        subject
      }),
      () => ({
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: 'Ohm’s Law Relationship',
        difficulty: 'moderate',
        question: 'According to Ohm’s Law, how is the current (I) through a metallic conductor related to the potential difference (V) across its ends at constant temperature?',
        options: buildShuffledOptions('Current is directly proportional to potential difference (V ∝ I)', ['Current is inversely proportional to potential difference', 'Current is proportional to the square of potential difference', 'Current remains completely independent of potential difference'], targetOptionIndex),
        correctOption: targetOptionIndex,
        explanation: 'Ohm’s law states that V = IR; current is directly proportional to potential difference provided temperature and physical conditions remain constant.',
        subject
      }),
      () => ({
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: 'Lens Power Calculation',
        difficulty: 'difficult',
        question: 'What is the focal length of a convex spherical lens having an optical power of +2.0 Dioptres?',
        options: buildShuffledOptions('+50 cm (0.5 m)', ['+20 cm (0.2 m)', '+100 cm (1.0 m)', '-50 cm (-0.5 m)'], targetOptionIndex),
        correctOption: targetOptionIndex,
        explanation: 'Power P = 1/f (with f in metres). Therefore, f = 1/P = 1/(+2.0) = +0.5 m = +50 cm.',
        subject
      }),
      () => ({
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: 'Resistance in Series',
        difficulty: 'moderate',
        question: 'If two resistors of 4 Ω and 6 Ω are connected in series across a circuit, what is their equivalent total resistance?',
        options: buildShuffledOptions('10 Ω', ['2.4 Ω', '24 Ω', '2 Ω'], targetOptionIndex),
        correctOption: targetOptionIndex,
        explanation: 'In a series combination, total equivalent resistance R_s = R₁ + R₂ = 4 Ω + 6 Ω = 10 Ω.',
        subject
      }),
      () => ({
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: 'Joule’s Heating Effect',
        difficulty: 'moderate',
        question: 'According to Joule’s Law of Heating, the thermal heat H generated in a resistor of resistance R carrying current I for time t is given by:',
        options: buildShuffledOptions('H = I²Rt', ['H = IRt', 'H = I²R/t', 'H = IR²t'], targetOptionIndex),
        correctOption: targetOptionIndex,
        explanation: 'Joule’s Law states that heat produced in a resistor is proportional to the square of current, resistance, and time: H = I²Rt.',
        subject
      }),
      () => ({
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: 'Near Point of Human Eye',
        difficulty: 'easy',
        question: 'What is the least distance of distinct vision (near point) for a normal young adult human eye?',
        options: buildShuffledOptions('25 cm', ['2.5 cm', '25 m', 'Infinity'], targetOptionIndex),
        correctOption: targetOptionIndex,
        explanation: 'The comfortable near point of distinct vision without eye strain for a normal eye is approximately 25 cm.',
        subject
      }),
      () => ({
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: 'Commercial Energy Unit',
        difficulty: 'easy',
        question: 'What is the commercial unit of electrical energy commonly referred to as a "unit" in domestic electricity bills?',
        options: buildShuffledOptions('Kilowatt-hour (kWh)', ['Joule (J)', 'Watt (W)', 'Volt-ampere'], targetOptionIndex),
        correctOption: targetOptionIndex,
        explanation: '1 commercial unit of electricity = 1 kilowatt-hour (kWh) = 3.6 × 10⁶ Joules.',
        subject
      })
    ]);
  }

  // 4. Specialized Social Science generation (History, Geography, Political Science/Civics, Economics)
  const isSocialScience = subject === 'Social Science' ||
    /social|history|geograph|politic|civic|econom/i.test(subject) ||
    /nationalism|europe|india|resource|development|soil|power\s*sharing|federal|sector|money|credit|agriculture|forest|water|mineral|manufactur|globalis|democracy/i.test(`${chapter.chapterName} ${topic}`);

  if (isSocialScience) {
    const sstContext = `${chapter.chapterName} ${topic}`.toLowerCase();

    // History - Nationalism in India & Europe
    if (/india|nationalism|satyagraha|movement|khilafat|swaraj|rowlatt|simon|dandi|poona|europe|napoleon|bismarck/i.test(sstContext)) {
      return pickFirstUnused([
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Rowlatt Act 1919 Provisions',
          difficulty: 'easy',
          question: 'What was the primary repressive provision introduced by the Rowlatt Act passed by the Imperial Legislative Council in 1919?',
          options: buildShuffledOptions(
            'It permitted the detention of political prisoners without trial for up to two years.',
            [
              'It completely banned all vernacular newspapers and printing presses in British India.',
              'It made military service compulsory for all Indian male college students.',
              'It doubled land revenue taxes and seized private farmland in Punjab.'
            ],
            targetOptionIndex
          ),
          correctOption: targetOptionIndex,
          explanation: 'The Rowlatt Act of 1919 gave the British government enormous powers to repress political activities and allowed detention of political prisoners without trial for up to two years.',
          subject: 'Social Science' as SubjectType
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Jallianwala Bagh Massacre',
          difficulty: 'moderate',
          question: 'Why had a large peaceful crowd gathered in the enclosed ground of Jallianwala Bagh on 13 April 1919 before General Dyer opened fire?',
          options: buildShuffledOptions(
            'To attend the annual Baisakhi fair and peacefully protest the arrest of national leaders.',
            [
              'To violently storm the British municipal police headquarters in Amritsar.',
              'To demand an immediate declaration of war against the Ottoman Empire.',
              'To celebrate the successful repeal of the Inland Emigration Act.'
            ],
            targetOptionIndex
          ),
          correctOption: targetOptionIndex,
          explanation: 'On 13 April 1919, a crowd gathered at Jallianwala Bagh in Amritsar—some to protest against the government repressive Rowlatt Act and arrests of Dr. Saifuddin Kitchlew and Dr. Satyapal, and others to attend the annual Baisakhi fair.',
          subject: 'Social Science' as SubjectType
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Chauri Chaura Incident',
          difficulty: 'easy',
          question: 'Which violent incident in February 1922 compelled Mahatma Gandhi to immediately call off the Non-Cooperation Movement?',
          options: buildShuffledOptions(
            'The burning of a police station by an agitated crowd at Chauri Chaura in Gorakhpur.',
            [
              'The armed raid on the Chittagong armoury led by Surya Sen.',
              'The execution of Bhagat Singh, Sukhdev, and Rajguru in Lahore.',
              'The police lathi charge on the Simon Commission demonstration in Lahore.'
            ],
            targetOptionIndex
          ),
          correctOption: targetOptionIndex,
          explanation: 'At Chauri Chaura in Gorakhpur (UP), a peaceful demonstration turned into a violent clash where a police station was set on fire, killing 22 policemen. Hearing this, Mahatma Gandhi called off the Non-Cooperation Movement in February 1922.',
          subject: 'Social Science' as SubjectType
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Simon Commission Boycott',
          difficulty: 'moderate',
          question: 'Why was the Indian Statutory Commission (Simon Commission) greeted with the slogan "Go Back Simon" upon its arrival in India in 1928?',
          options: buildShuffledOptions(
            'It did not include a single Indian member among its commissioners.',
            [
              'It refused to negotiate trade treaties with Indian business merchants.',
              'It was appointed specifically to dissolve the Indian National Congress.',
              'It recommended shifting the national capital from Delhi back to Calcutta.'
            ],
            targetOptionIndex
          ),
          correctOption: targetOptionIndex,
          explanation: 'The Simon Commission, appointed by the British Tory government under Sir John Simon to review the functioning of the constitutional system in India, was boycotted by all Indian parties because all of its members were British.',
          subject: 'Social Science' as SubjectType
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Poona Pact 1932',
          difficulty: 'difficult',
          question: 'What was the historic compromise agreed upon between Mahatma Gandhi and Dr. B.R. Ambedkar in the Poona Pact of September 1932?',
          options: buildShuffledOptions(
            'Reserved seats for Depressed Classes in general provincial and central legislatures instead of separate electorates.',
            [
              'Establishment of completely separate sovereign electorates for Depressed Classes for thirty years.',
              'Formation of an autonomous independent state for minority communities in western India.',
              'Reservation of half of the British Executive Council seats exclusively for Dalit leaders.'
            ],
            targetOptionIndex
          ),
          correctOption: targetOptionIndex,
          explanation: 'The Poona Pact of September 1932 resolved Gandhi and Ambedkar’s dispute over the British Communal Award by giving the Depressed Classes reserved seats in provincial and central legislative councils, to be voted on by the general electorate.',
          subject: 'Social Science' as SubjectType
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Lahore Congress Session 1929',
          difficulty: 'moderate',
          question: 'What momentous resolution was formalized at the historic Lahore Congress Session of December 1929 under Jawaharlal Nehru’s presidency?',
          options: buildShuffledOptions(
            'The formal demand for "Purna Swaraj" (complete independence) for India.',
            [
              'The formal acceptance of Dominion Status under the British Crown.',
              'The launching of the Rowlatt Satyagraha nationwide.',
              'The merging of the Swaraj Party with the Muslim League.'
            ],
            targetOptionIndex
          ),
          correctOption: targetOptionIndex,
          explanation: 'In December 1929, under the presidency of Jawaharlal Nehru, the Lahore Congress formalized the demand of "Purna Swaraj" or complete independence and declared 26 January 1930 as Independence Day.',
          subject: 'Social Science' as SubjectType
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Napoleonic Civil Code 1804',
          difficulty: 'moderate',
          question: 'Which of the following was a key reform introduced across French-controlled territories by the Napoleonic Code of 1804?',
          options: buildShuffledOptions(
            'Abolition of all birth-based privileges, establishment of equality before law, and securing property rights.',
            [
              'Introduction of universal adult franchise including voting rights for all adult women.',
              'Restoration of feudal dues, serfdom, and aristocratic guild restrictions.',
              'Mandatory adoption of the Latin language for all state school curricula.'
            ],
            targetOptionIndex
          ),
          correctOption: targetOptionIndex,
          explanation: 'The Civil Code of 1804 (Napoleonic Code) did away with all privileges based on birth, established equality before the law, secured the right to property, and abolished the feudal system across regions under French control.',
          subject: 'Social Science' as SubjectType
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Zollverein Customs Union',
          difficulty: 'difficult',
          question: 'In 1834, a customs union known as the "Zollverein" was initiated in German states under Prussian leadership to:',
          options: buildShuffledOptions(
            'Abolish tariff barriers and reduce the number of regional currencies from over thirty to two.',
            [
              'Impose heavy naval blockades on British manufactured cotton imports.',
              'Establish a unified Austrian military command over southern European borders.',
              'Collect ecclesiastical taxes for the Papal States in Rome.'
            ],
            targetOptionIndex
          ),
          correctOption: targetOptionIndex,
          explanation: 'The Zollverein customs union abolished internal tariff barriers and reduced currencies from over thirty to two, creating economic unity that strengthened national sentiment in Germany.',
          subject: 'Social Science' as SubjectType
        })
      ]);
    }

    // Geography - Soils, Resources, Agriculture, Water
    if (/soil|resource|agriculture|water|forest|mineral|environment|land|crop/i.test(sstContext)) {
      return pickFirstUnused([
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Black Soil Characteristics',
          difficulty: 'easy',
          question: 'Which type of Indian soil is typically black in color, clayey, develops deep cracks during hot weather, and is renowned for cotton cultivation?',
          options: buildShuffledOptions(
            'Black Soil (Regur Soil)',
            ['Laterite Soil', 'Arid Soil', 'Red and Yellow Soil'],
            targetOptionIndex
          ),
          correctOption: targetOptionIndex,
          explanation: 'Black soil, also known as Regur soil, is formed from Deccan Trap basalt weathering, has high water-retentive clayey capacity, and is ideally suited for cotton cultivation.',
          subject: 'Social Science' as SubjectType
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Alluvial Soil Classification',
          difficulty: 'moderate',
          question: 'How do geographers differentiate between "Khadar" and "Bhangar" alluvial soils of the Northern Plains?',
          options: buildShuffledOptions(
            'Khadar is newer, more fertile alluvium, while Bhangar is older alluvium containing higher Kanker nodules.',
            [
              'Khadar is found strictly on mountain hilltops, while Bhangar lines coastal beaches.',
              'Khadar is completely barren clay, while Bhangar consists of desert sand dunes.',
              'Khadar has an acidic pH below 4, while Bhangar is rich in volcanic iron ore.'
            ],
            targetOptionIndex
          ),
          correctOption: targetOptionIndex,
          explanation: 'According to age, alluvial soils are classified into Bhangar (old alluvium, higher concentration of calcareous Kanker nodules) and Khadar (new alluvium, more fertile and fine-grained).',
          subject: 'Social Science' as SubjectType
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Land Degradation Causes',
          difficulty: 'moderate',
          question: 'What is the principal cause of severe land degradation observed in the states of Punjab, Haryana, and western Uttar Pradesh?',
          options: buildShuffledOptions(
            'Over-irrigation leading to waterlogging, increased soil salinity, and alkalinity.',
            [
              'Excessive deforestation driven by opencast bauxite mining.',
              'Severe overgrazing by nomadic livestock in arid pastures.',
              'Heavy industrial toxic discharge from petroleum refineries.'
            ],
            targetOptionIndex
          ),
          correctOption: targetOptionIndex,
          explanation: 'In Punjab, Haryana, and western UP, excessive canal and tubewell irrigation has resulted in waterlogging, increasing salinity and alkalinity in the soil.',
          subject: 'Social Science' as SubjectType
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Rabi vs Kharif Crops',
          difficulty: 'easy',
          question: 'Which of the following sets of crops represents major "Rabi" crops sown in winter (October–December) and harvested in summer in India?',
          options: buildShuffledOptions(
            'Wheat, Barley, Peas, Gram, and Mustard',
            [
              'Paddy (Rice), Maize, Jowar, Bajra, and Cotton',
              'Watermelon, Muskmelon, Cucumber, and Fodder crops',
              'Rubber, Tea, Coffee, and Jute'
            ],
            targetOptionIndex
          ),
          correctOption: targetOptionIndex,
          explanation: 'Rabi crops are sown in winter from October to December and harvested in summer from April to June. Important Rabi crops include wheat, barley, peas, gram, and mustard.',
          subject: 'Social Science' as SubjectType
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Rio Earth Summit 1992',
          difficulty: 'difficult',
          question: 'What global action plan was adopted at the United Nations Conference on Environment and Development (UNCED) at Rio de Janeiro in 1992 to achieve global sustainable development?',
          options: buildShuffledOptions(
            'Agenda 21',
            ['Kyoto Protocol', 'Paris Climate Accord', 'Montreal Protocol'],
            targetOptionIndex
          ),
          correctOption: targetOptionIndex,
          explanation: 'In June 1992, more than 100 heads of states met in Rio de Janeiro, Brazil, and endorsed the global Forest Principles and adopted Agenda 21 for achieving Sustainable Development in the 21st century.',
          subject: 'Social Science' as SubjectType
        })
      ]);
    }

    // Civics / Political Science - Power Sharing & Federalism
    if (/power|shar|federal|constitut|democra|decentral|panchayat|govern|elect/i.test(sstContext)) {
      return pickFirstUnused([
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Belgium Model of Power Sharing',
          difficulty: 'moderate',
          question: 'Which constitutional arrangement was adopted in Belgium to avoid ethnic conflict between Dutch-speaking and French-speaking communities?',
          options: buildShuffledOptions(
            'Equal number of Dutch and French-speaking ministers in the Central Government with special majority protections.',
            [
              'Complete expulsion of minority French speakers from the capital city of Brussels.',
              'Declaration of the Dutch language as the sole official language of the country.',
              'Concentration of all executive power in a single hereditary monarch.'
            ],
            targetOptionIndex
          ),
          correctOption: targetOptionIndex,
          explanation: 'The Belgian Constitution prescribes that the number of Dutch and French-speaking ministers shall be equal in the central government so no single community can make decisions unilaterally.',
          subject: 'Social Science' as SubjectType
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Horizontal vs Vertical Power Sharing',
          difficulty: 'easy',
          question: 'In a modern democracy, power sharing among the Legislature, Executive, and Judiciary is formally termed as:',
          options: buildShuffledOptions(
            'Horizontal distribution of power (System of Checks and Balances)',
            [
              'Vertical division of federal power',
              'Community power sharing mechanism',
              'Authoritarian separation of functions'
            ],
            targetOptionIndex
          ),
          correctOption: targetOptionIndex,
          explanation: 'Power shared among different organs of government placed at the same level—legislature, executive, and judiciary—is called horizontal distribution, allowing each organ to check the others.',
          subject: 'Social Science' as SubjectType
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: 'Legislative Lists in Indian Constitution',
          difficulty: 'moderate',
          question: 'Under the Indian Constitution, subjects of common interest such as Education, Forests, and Trade Unions are placed in which list?',
          options: buildShuffledOptions(
            'Concurrent List (both Union and State legislatures can make laws)',
            [
              'Union List (strictly Parliament only)',
              'State List (strictly State legislatures only)',
              'Residuary Powers List'
            ],
            targetOptionIndex
          ),
          correctOption: targetOptionIndex,
          explanation: 'The Concurrent List includes subjects of common interest to both the Union and State governments, such as education, forest, trade unions, marriage, adoption, and succession.',
          subject: 'Social Science' as SubjectType
        }),
        () => ({
          questionId: `q_${String(counter).padStart(3, '0')}`,
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          topic: '1992 Decentralization Amendment',
          difficulty: 'difficult',
          question: 'Which constitutional reform was made mandatory by the 73rd and 74th Constitutional Amendment Acts in India in 1992 to empower local government?',
          options: buildShuffledOptions(
            'Mandatory regular local elections, reservation of at least 1/3rd seats for women, and state revenue sharing.',
            [
              'Abolition of all Gram Panchayats in favor of direct district magistrate rule.',
              'Complete privatization of all rural irrigation and water bodies.',
              'Nomination of all municipal corporators directly by the Central Union Cabinet.'
            ],
            targetOptionIndex
          ),
          correctOption: targetOptionIndex,
          explanation: 'A major step toward decentralisation was taken in 1992 with the 73rd and 74th amendments, making regular elections mandatory, reserving at least one-third of all seats for women, and establishing State Election Commissions.',
          subject: 'Social Science' as SubjectType
        })
      ]);
    }

    // Economics - Development, Sectors of Economy, Money and Credit
    return pickFirstUnused([
      () => ({
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: 'Disguised Unemployment in Agriculture',
        difficulty: 'moderate',
        question: 'What is meant by "disguised unemployment" (underemployment) commonly prevalent in India\'s primary agricultural sector?',
        options: buildShuffledOptions(
          'More workers are engaged on a farm than required; removing a few does not decrease total production.',
          [
            'Workers are actively employed only for two weeks during the monsoon and unemployed the rest of the year.',
            'Educated university graduates are unable to find any employment in urban software parks.',
            'Workers lose their jobs due to the sudden closure of a large textile mill.'
          ],
          targetOptionIndex
        ),
        correctOption: targetOptionIndex,
        explanation: 'Disguised unemployment occurs when more people are working in an activity than required. Each person appears to work, but their marginal productivity is zero; withdrawing them leaves total agricultural output unchanged.',
        subject: 'Social Science' as SubjectType
      }),
      () => ({
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: 'Formal vs Informal Credit Role of RBI',
        difficulty: 'moderate',
        question: 'Which apex institution strictly supervises the functioning of formal sources of loans (commercial banks) in India to ensure affordable credit reaches small borrowers?',
        options: buildShuffledOptions(
          'Reserve Bank of India (RBI)',
          ['State Bank of India (SBI)', 'Ministry of Finance', 'NITI Aayog'],
          targetOptionIndex
        ),
        correctOption: targetOptionIndex,
        explanation: 'The Reserve Bank of India (RBI) supervises the functioning of formal sources of loans. It monitors that banks maintain cash balances and lend not just to profit-making businesses, but also to small cultivators and cottage industries.',
        subject: 'Social Science' as SubjectType
      }),
      () => ({
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: 'World Bank Development Criteria',
        difficulty: 'easy',
        question: 'What criterion is used by the World Bank in its World Development Reports to classify countries as rich or low-income?',
        options: buildShuffledOptions(
          'Per Capita Income (Average Income)',
          ['Infant Mortality Rate', 'Gross Enrolment Ratio in Secondary Schools', 'Total Gold Reserves held in the Central Treasury'],
          targetOptionIndex
        ),
        correctOption: targetOptionIndex,
        explanation: 'In World Development Reports brought out by the World Bank, per capita income (total national income divided by total population) is used in classifying countries.',
        subject: 'Social Science' as SubjectType
      }),
      () => ({
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: 'MGNREGA 2005 Guarantee',
        difficulty: 'easy',
        question: 'How many days of guaranteed wage employment in a year are provided under the Mahatma Gandhi National Rural Employment Guarantee Act (MGNREGA 2005)?',
        options: buildShuffledOptions(
          '100 days of guaranteed wage employment',
          ['50 days of guaranteed wage employment', '200 days of guaranteed wage employment', '365 days of guaranteed wage employment'],
          targetOptionIndex
        ),
        correctOption: targetOptionIndex,
        explanation: 'Under MGNREGA 2005, all those who are able to and are in need of work in rural areas are guaranteed 100 days of employment in a year by the government. If the government fails to provide it, it gives unemployment allowances.',
        subject: 'Social Science' as SubjectType
      }),
      () => ({
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: 'Terms of Credit - Collateral',
        difficulty: 'moderate',
        question: 'In financial banking, an asset that a borrower owns (such as land, building, vehicle, or bank deposit) and pledges to a lender as a guarantee until the loan is repaid is termed as:',
        options: buildShuffledOptions(
          'Collateral',
          ['Interest dividend', 'Demand draft', 'Promissory share'],
          targetOptionIndex
        ),
        correctOption: targetOptionIndex,
        explanation: 'Collateral is an asset that the borrower owns and uses as a guarantee to a lender until the loan is repaid. If the borrower fails to repay, the lender has the legal right to sell the asset to obtain payment.',
        subject: 'Social Science' as SubjectType
      })
    ]);
  }

  // 5. Specialized Computer Science / IT generation
  const isComputerScience = subject === 'Computer Science' ||
    /comput|tech|network|cyber|html|python|software|it\b/i.test(subject) ||
    /comput|network|cyber|html|python|internet|protocol|browser|hardware|coding|data/i.test(`${chapter.chapterName} ${topic}`);

  if (isComputerScience) {
    return pickFirstUnused([
      () => ({
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: 'Network Protocol - HTTP vs HTTPS',
        difficulty: 'easy',
        question: 'Which network protocol provides encrypted communication over computer networks using SSL/TLS security certificates on port 443?',
        options: buildShuffledOptions(
          'HTTPS (HyperText Transfer Protocol Secure)',
          ['HTTP (HyperText Transfer Protocol)', 'FTP (File Transfer Protocol)', 'SMTP (Simple Mail Transfer Protocol)'],
          targetOptionIndex
        ),
        correctOption: targetOptionIndex,
        explanation: 'HTTPS encrypts data exchanged between web browser and web server using SSL/TLS certificates, preventing eavesdropping and tampering.',
        subject: 'Computer Science' as SubjectType
      }),
      () => ({
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: 'Cyber Ethics - Plagiarism Definition',
        difficulty: 'easy',
        question: 'The unethical act of presenting someone else’s work, code, or ideas as one’s own without giving proper attribution or credit is known as:',
        options: buildShuffledOptions(
          'Plagiarism',
          ['Open-source licensing', 'Phishing', 'Data encryption'],
          targetOptionIndex
        ),
        correctOption: targetOptionIndex,
        explanation: 'Plagiarism is the practice of taking someone else’s work or ideas and passing them off as one’s own without citing the original source.',
        subject: 'Computer Science' as SubjectType
      }),
      () => ({
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: 'Cyber Security - Phishing Attack',
        difficulty: 'moderate',
        question: 'What type of fraudulent cyber attack involves sending deceptive emails or messages masquerading as a legitimate bank or institution to steal sensitive credentials?',
        options: buildShuffledOptions(
          'Phishing',
          ['DDoS Attack', 'Trojan Horse', 'Spyware'],
          targetOptionIndex
        ),
        correctOption: targetOptionIndex,
        explanation: 'Phishing is a social engineering attack where attackers impersonate trustworthy entities to deceive victims into revealing sensitive information like login credentials and credit card numbers.',
        subject: 'Computer Science' as SubjectType
      }),
      () => ({
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: 'HTML Hyperlink Tag',
        difficulty: 'easy',
        question: 'In HTML, which element tag and attribute are used to create a hyperlink to another web page?',
        options: buildShuffledOptions(
          '<a href="url">Link Text</a>',
          ['<link src="url">Link Text</link>', '<href url="link">Link Text</href>', '<anchor to="url">Link Text</anchor>'],
          targetOptionIndex
        ),
        correctOption: targetOptionIndex,
        explanation: 'The <a> (anchor) tag with the href (hypertext reference) attribute specifies the target URL of the link.',
        subject: 'Computer Science' as SubjectType
      }),
      () => ({
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: 'Python Mutable vs Immutable Data Types',
        difficulty: 'moderate',
        question: 'In Python programming, which of the following standard data types is MUTABLE (can be modified in-place after creation)?',
        options: buildShuffledOptions(
          'List',
          ['Tuple', 'String', 'Integer'],
          targetOptionIndex
        ),
        correctOption: targetOptionIndex,
        explanation: 'Lists in Python are mutable, meaning their elements can be added, removed, or changed in-place. Tuples, strings, and integers are immutable.',
        subject: 'Computer Science' as SubjectType
      }),
      () => ({
        questionId: `q_${String(counter).padStart(3, '0')}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        topic: 'DNS Function in Networking',
        difficulty: 'difficult',
        question: 'What is the primary role of the Domain Name System (DNS) in computer networking?',
        options: buildShuffledOptions(
          'Translating human-readable domain names (like www.example.com) into numerical IP addresses.',
          ['Allocating physical MAC addresses to network interface cards in a local LAN.', 'Encrypting packet payloads traveling across international undersea cables.', 'Converting AC current into DC power inside computer power supply units.'],
          targetOptionIndex
        ),
        correctOption: targetOptionIndex,
        explanation: 'DNS serves as the internet’s phone book by mapping human-readable domain names (e.g. www.google.com) to machine-readable IP addresses (e.g. 142.250.190.46).',
        subject: 'Computer Science' as SubjectType
      })
    ]);
  }

  // 6. English / Humanities fallback
  return pickFirstUnused([
    () => ({
      questionId: `q_${String(counter).padStart(3, '0')}`,
      chapterId: chapter.chapterId,
      chapterName: chapter.chapterName,
      topic,
      difficulty,
      question: `Which of the following sentences demonstrates correct subject-verb agreement in formal writing related to "${chapter.chapterName}"?`,
      options: buildShuffledOptions(
        'Neither the author nor the critics were able to dispute the documented evidence.',
        [
          'Neither the author nor the critics was able to dispute the documented evidence.',
          'Neither the author nor the critics is able to dispute the documented evidence.',
          'Neither the author nor the critics has been able to dispute the documented evidence.'
        ],
        targetOptionIndex
      ),
      correctOption: targetOptionIndex,
      explanation: 'When subjects are connected by "neither... nor", the verb agrees with the nearer subject ("critics", plural -> "were").',
      subject
    }),
    () => ({
      questionId: `q_${String(counter).padStart(3, '0')}`,
      chapterId: chapter.chapterId,
      chapterName: chapter.chapterName,
      topic: 'Active and Passive Voice',
      difficulty: 'moderate',
      question: `Identify the correct passive voice transformation of: "The protagonist overcame immense adversity in '${chapter.chapterName}'."`,
      options: buildShuffledOptions(
        'Immense adversity was overcome by the protagonist.',
        [
          'Immense adversity had been overcome by the protagonist.',
          'Immense adversity is overcome by the protagonist.',
          'Immense adversity was being overcome by the protagonist.'
        ],
        targetOptionIndex
      ),
      correctOption: targetOptionIndex,
      explanation: 'Simple past active ("overcame") transforms into simple past passive ("was overcome").',
      subject
    }),
    () => ({
      questionId: `q_${String(counter).padStart(3, '0')}`,
      chapterId: chapter.chapterId,
      chapterName: chapter.chapterName,
      topic: 'Reported Speech',
      difficulty: 'moderate',
      question: `Choose the correct indirect speech form for: He said, "I have completed reading the chapter."`,
      options: buildShuffledOptions(
        'He said that he had completed reading the chapter.',
        [
          'He said that he has completed reading the chapter.',
          'He said that he had been completing reading the chapter.',
          'He said that he would complete reading the chapter.'
        ],
        targetOptionIndex
      ),
      correctOption: targetOptionIndex,
      explanation: 'Present perfect ("have completed") shifts back to past perfect ("had completed") in indirect speech.',
      subject
    }),
    () => ({
      questionId: `q_${String(counter).padStart(3, '0')}`,
      chapterId: chapter.chapterId,
      chapterName: chapter.chapterName,
      topic: 'Vocabulary in Context',
      difficulty: 'moderate',
      question: `In formal academic analysis of "${chapter.chapterName}", choose the word that most accurately replaces the phrase "show clearly and convincingly":`,
      options: buildShuffledOptions(
        'Demonstrate',
        ['Contemplate', 'Exaggerate', 'Procrastinate'],
        targetOptionIndex
      ),
      correctOption: targetOptionIndex,
      explanation: '"Demonstrate" means to show clearly and deliberately by evidence or reasoning.',
      subject
    }),
    () => ({
      questionId: `q_${String(counter).padStart(3, '0')}`,
      chapterId: chapter.chapterId,
      chapterName: chapter.chapterName,
      topic: 'Conditional Clauses',
      difficulty: 'difficult',
      question: 'Complete the sentence with the correct subjunctive conditional form: "If she _______ more time, she would have revised the manuscript."',
      options: buildShuffledOptions(
        'had had',
        ['had', 'would have', 'has had'],
        targetOptionIndex
      ),
      correctOption: targetOptionIndex,
      explanation: 'Third conditional requires "had + past participle" ("had had") in the if-clause to express unreal past conditions.',
      subject
    }),
    () => ({
      questionId: `q_${String(counter).padStart(3, '0')}`,
      chapterId: chapter.chapterId,
      chapterName: chapter.chapterName,
      topic: 'Determiners and Quantifiers',
      difficulty: 'easy',
      question: 'Choose the correct determiner: "There is _______ hope of recovery, as the critical indicators remain positive."',
      options: buildShuffledOptions(
        'a little',
        ['little', 'few', 'a few'],
        targetOptionIndex
      ),
      correctOption: targetOptionIndex,
      explanation: '"A little" is used with uncountable nouns ("hope") to indicate a positive, small quantity.',
      subject
    })
  ]);
}

function buildShuffledOptions(correct: string, distractors: string[], targetIndex: number): string[] {
  const result: string[] = [];
  const safeFallbacks = [
    'None of the stated conditions are valid under standard physical constraints.',
    'The observed values deviate unpredictably due to external interference.',
    'The condition holds true only under theoretical zero-mass states.'
  ];
  let dIdx = 0;
  for (let i = 0; i < 4; i++) {
    if (i === targetIndex) {
      result.push(correct);
    } else {
      result.push(distractors[dIdx] || safeFallbacks[dIdx % safeFallbacks.length]);
      dIdx++;
    }
  }
  return result;
}

/**
 * Extracts structured chapters strictly from document text
 * NEVER adds external chapters that do not exist in the uploaded material.
 */
export async function extractChaptersFromMaterial(
  text: string,
  subject: SubjectType,
  classLevel?: string
): Promise<{ chapters: ExtractedChapter[]; isDemoMode: boolean }> {
  if (!text || text.trim().length === 0) {
    return {
      chapters: [],
      isDemoMode: true
    };
  }

  // 1. Try server-side Gemini endpoint (browser environment only)
  if (typeof window !== 'undefined') {
    try {
      const apiKey = getStoredGeminiKey();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['x-gemini-api-key'] = apiKey;
      }

      const res = await fetch('/api/ai/extract-chapters', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, subject, classLevel, apiKey })
      });

      if (res.ok) {
        const data = await res.json();
        if (!data.isDemoMode && data.data?.chapters && data.data.chapters.length > 0) {
          const chapters: ExtractedChapter[] = data.data.chapters.map((ch: any, idx: number) => ({
            chapterId: ch.chapterId || `ch_${idx + 1}`,
            chapterName: ch.chapterName || `Chapter ${idx + 1}`,
            subject,
            topics: Array.isArray(ch.topics) && ch.topics.length > 0
              ? ch.topics
              : extractTopicsForChapter(ch.chapterName || `Chapter ${idx + 1}`, idx, [], text),
            prerequisites: ch.prerequisites || [],
            importantConcepts: ch.importantConcepts || [],
            classLevel,
            sourceMethod: 'document_structure'
          }));

          // Attach content boundaries
          const boundaries = getChapterBoundaries(text, chapters.map(c => c.chapterName), subject);
          chapters.forEach(ch => {
            if (boundaries[ch.chapterId]?.contentSlice) {
              ch.contentSlice = boundaries[ch.chapterId].contentSlice;
            }
          });

          return { chapters, isDemoMode: false };
        }
      }
    } catch (err) {
      console.warn('Server AI chapter extraction unavailable, using deterministic local engine:', err);
    }
  }

  // 2. Deterministic local chapter extraction (TOC + Headings + Boundary Slicing)
  const parsedTitles = extractChaptersFromText(text, subject);
  if (parsedTitles.length === 0) {
    return {
      chapters: [],
      isDemoMode: true
    };
  }

  const boundaries = getChapterBoundaries(text, parsedTitles, subject);

  const chapters: ExtractedChapter[] = parsedTitles.map((title, index) => {
    const chapterId = `ch_${subject.toLowerCase().slice(0, 3)}_${index + 1}`;
    const boundary = boundaries[chapterId];
    const topics = boundary?.topics && boundary.topics.length > 0
      ? boundary.topics
      : extractTopicsForChapter(title, index, parsedTitles, text);

    return {
      chapterId,
      chapterName: title,
      subject,
      topics,
      prerequisites: index > 0 ? [parsedTitles[index - 1]] : [],
      classLevel: classLevel || 'Class 10',
      sourceMethod: 'heading_detection',
      contentSlice: boundary?.contentSlice
    };
  });

  return {
    chapters,
    isDemoMode: true
  };
}

/**
 * Generates a balanced 30-question diagnostic assessment strictly from verified chapters.
 * Enforces hard boundaries on user subject and chapter selections.
 */
export async function generateCombinedQuestions(
  chaptersBySubject: Record<SubjectType, ExtractedChapter[]>,
  selectedSubjects: SubjectType[],
  classLevel?: string,
  targetTotalQuestions?: number
): Promise<{
  questions: PreAssessmentQuestion[];
  isDemoMode: boolean;
  allocations: ChapterQuestionAllocation[];
  allowedMap: AllowedContentMap;
}> {
  const effectiveTarget = targetTotalQuestions || getTargetQuestionsForSubjects(selectedSubjects);
  // 1. Build the strict Allowed Content Map
  const allowedMap = buildAllowedContentMap(selectedSubjects, chaptersBySubject);
  const allChapters = allowedMap.allowedChapters;

  if (allChapters.length === 0) {
    return {
      questions: [],
      isDemoMode: true,
      allocations: [],
      allowedMap
    };
  }

  let generatedQuestions: PreAssessmentQuestion[] = [];
  let isDemoMode = false;

  // 2. Compute exact question allocation across verified chapters and difficulty levels
  const allocations = computeChapterQuestionAllocations(allChapters, effectiveTarget);

  // 3. Attempt Gemini Generation via server endpoint if available (browser only)
  if (typeof window !== 'undefined') {
    try {
      const apiKey = getStoredGeminiKey();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['x-gemini-api-key'] = apiKey;
      }

      const res = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chapters: allChapters,
          subject: selectedSubjects.join(' & '),
          classLevel,
          chapterAllocations: allocations,
          targetTotalQuestions: effectiveTarget,
          apiKey
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (!data.isDemoMode && Array.isArray(data.data?.questions) && data.data.questions.length > 0) {
          const validated: PreAssessmentQuestion[] = [];

          data.data.questions.forEach((q: any) => {
            const qObj: PreAssessmentQuestion = {
              questionId: q.questionId || `q_${Math.random().toString(36).substr(2, 6)}`,
              chapterId: q.chapterId || allChapters[0].chapterId,
              chapterName: q.chapterName || allChapters[0].chapterName,
              topic: q.topic || 'Core Concept',
              difficulty: (['easy', 'moderate', 'difficult'].includes(q.difficulty) ? q.difficulty : 'moderate') as PreAssessmentDifficulty,
              question: q.question,
              options: q.options,
              correctOption: Number(q.correctOption),
              explanation: q.explanation,
              sourcePage: q.sourcePage,
              subject: (allChapters.find(c => c.chapterId === q.chapterId)?.subject || q.subject || selectedSubjects[0]) as SubjectType
            };

            // HARD BOUNDARY VALIDATION
            const check = validateQuestion(qObj, allowedMap);
            if (check.valid) {
              validated.push(qObj);
            } else {
              console.warn(`Rejected invalid question for [${qObj.chapterName} - ${qObj.difficulty}]:`, check.reasons);
            }
          });

          if (validated.length >= Math.min(24, effectiveTarget)) {
            generatedQuestions = validated.slice(0, effectiveTarget);
            isDemoMode = false;
          }
        }
      }
    } catch (err) {
      console.warn('AI question generation unavailable, using authentic curriculum bank:', err);
      isDemoMode = true;
    }
  }

  // 4. Curriculum Question Bank + Grounded Content Slices
  if (generatedQuestions.length < effectiveTarget) {
    isDemoMode = true;
    const usedStems = new Set<string>();
    generatedQuestions.forEach(q => usedStems.add(q.question.trim().toLowerCase()));

    let qCounter = generatedQuestions.length + 1;

    allocations.forEach((alloc) => {
      if (alloc.totalCount <= 0) return;
      const chapter = allChapters.find(c => c.chapterId === alloc.chapterId) || {
        chapterId: alloc.chapterId,
        chapterName: alloc.chapterName,
        subject: alloc.subject,
        topics: alloc.topics
      };

      // Check if curriculum bank has templates for this chapter
      const templates = findQuestionBankTemplates(chapter.chapterName);

      const diffPlan: PreAssessmentDifficulty[] = [
        ...Array(Math.max(0, alloc.easyCount)).fill('easy'),
        ...Array(Math.max(0, alloc.moderateCount)).fill('moderate'),
        ...Array(Math.max(0, alloc.difficultCount)).fill('difficult')
      ];

      let topicCursor = 0;
      diffPlan.forEach((diff) => {
        const topic = alloc.topics[topicCursor % alloc.topics.length] || chapter.chapterName;
        topicCursor++;

        let validQuestion: PreAssessmentQuestion | null = null;
        let attempt = 0;

        while (attempt < 8 && !validQuestion) {
          let candidate: PreAssessmentQuestion;
          const currentCounter = qCounter + attempt * 17;

          // Try chapter templates
          const availableTemplates = (templates || []).filter(
            t => t.difficulty === diff && !usedStems.has(t.question.trim().toLowerCase())
          );

          // Try topic templates if chapter templates are exhausted
          let topicTemplates = availableTemplates;
          if (topicTemplates.length === 0 && topic && topic !== chapter.chapterName) {
            const tBank = findQuestionBankTemplates(topic);
            if (tBank) {
              topicTemplates = tBank.filter(
                t => t.difficulty === diff && !usedStems.has(t.question.trim().toLowerCase())
              );
            }
          }

          if (topicTemplates.length > 0 && attempt === 0) {
            candidate = {
              questionId: `q_${String(currentCounter).padStart(3, '0')}`,
              chapterId: chapter.chapterId,
              chapterName: chapter.chapterName,
              topic: topicTemplates[0].topic || topic,
              difficulty: diff,
              question: topicTemplates[0].question,
              options: [...topicTemplates[0].options],
              correctOption: topicTemplates[0].correctOption,
              explanation: topicTemplates[0].explanation,
              subject: chapter.subject
            };
          } else if (chapter.contentSlice && chapter.contentSlice.length > 120) {
            candidate = generateGroundedQuestionFromSlice(chapter, topic, diff, currentCounter);
          } else {
            candidate = generateDomainAuthenticQuestion(chapter, topic, diff, currentCounter, usedStems);
          }

          const norm = candidate.question.trim().toLowerCase();
          if (!usedStems.has(norm)) {
            const check = validateQuestion(candidate, allowedMap);
            if (check.valid) {
              validQuestion = candidate;
              usedStems.add(norm);
              break;
            }
          }
          attempt++;
        }

        if (validQuestion) {
          generatedQuestions.push(validQuestion);
        } else {
          // Guaranteed fallback using clean domain question
          const fallbackClean = generateDomainAuthenticQuestion(chapter, topic, diff, qCounter + 101, usedStems);
          usedStems.add(fallbackClean.question.trim().toLowerCase());
          generatedQuestions.push(fallbackClean);
        }
        qCounter++;
      });
    });

    // 4b. Filler loop to ensure exact quota if any slots were somehow missed
    let fillAttempt = 0;
    while (generatedQuestions.length < effectiveTarget && fillAttempt < 60) {
      const chapter = allChapters[fillAttempt % allChapters.length];
      const topic = chapter.topics && chapter.topics.length > 0
        ? chapter.topics[fillAttempt % chapter.topics.length]
        : chapter.chapterName;
      const diffCycle: PreAssessmentDifficulty[] = ['moderate', 'easy', 'difficult'];
      const diff = diffCycle[fillAttempt % diffCycle.length];
      const candidate = generateDomainAuthenticQuestion(chapter, topic, diff, 2000 + fillAttempt, usedStems);

      const norm = candidate.question.trim().toLowerCase();
      if (!usedStems.has(norm)) {
        const check = validateQuestion(candidate, allowedMap);
        if (check.valid) {
          usedStems.add(norm);
          generatedQuestions.push(candidate);
        }
      }
      fillAttempt++;
    }
  }

  // 5. Subject Interleaving & Difficulty Ramp
  // When multiple subjects are present, interleave questions smoothly across subjects
  const groupedBySubject: Record<string, PreAssessmentQuestion[]> = {};
  selectedSubjects.forEach(s => { groupedBySubject[s] = []; });

  generatedQuestions.forEach(q => {
    if (groupedBySubject[q.subject]) {
      groupedBySubject[q.subject].push(q);
    }
  });

  // Sort each subject group by difficulty (easy -> moderate -> difficult)
  const diffOrder: Record<PreAssessmentDifficulty, number> = { easy: 1, moderate: 2, difficult: 3 };
  Object.values(groupedBySubject).forEach(list => {
    list.sort((a, b) => diffOrder[a.difficulty] - diffOrder[b.difficulty]);
  });

  // Interleave subjects
  const interleaved: PreAssessmentQuestion[] = [];
  let hasMore = true;
  let cursor = 0;
  while (hasMore && interleaved.length < effectiveTarget) {
    hasMore = false;
    for (const sub of selectedSubjects) {
      const list = groupedBySubject[sub] || [];
      if (cursor < list.length) {
        interleaved.push(list[cursor]);
        hasMore = true;
      }
    }
    cursor++;
  }

  // If interleaved somehow has fewer than effectiveTarget, fill from generatedQuestions
  if (interleaved.length < effectiveTarget) {
    for (const q of generatedQuestions) {
      if (!interleaved.some(existing => existing.questionId === q.questionId)) {
        interleaved.push(q);
        if (interleaved.length >= effectiveTarget) break;
      }
    }
  }

  // Ensure exact question count
  const finalQuestions = interleaved.slice(0, effectiveTarget).map((q, idx) => ({
    ...q,
    questionId: `q_${String(idx + 1).padStart(3, '0')}`
  }));

  return {
    questions: finalQuestions,
    isDemoMode,
    allocations,
    allowedMap
  };
}

export default {
  TARGET_PRE_ASSESSMENT_QUESTIONS,
  buildAllowedContentMap,
  validateQuestion,
  validateAssessmentSession,
  computeChapterQuestionAllocations,
  extractChaptersFromMaterial,
  generateCombinedQuestions
};
