import {
  PreAssessmentQuestion,
  PreAssessmentDifficulty,
  SubjectType,
  ClassLevel,
  BoardType,
  DailyStudyPlan,
  DailyStudyTask,
  WeeklyTestQuestion,
  StudentLearningPlan,
  WeeklyTestRecord
} from '../../types';
import { findQuestionBankTemplates } from '../preAssessmentService';

// ============================================================================
// LLM PROVIDER ABSTRACTION
// Configurable provider: GeminiProvider | OpenAIProvider | MockProvider
// Default: Gemini API (Free tier available). Fallback: MockProvider (Zero API cost).
// ============================================================================

export interface DiagnosticQuestionGenParams {
  subject: SubjectType;
  classLevel: ClassLevel | string;
  board?: BoardType | string;
  chapters: {
    chapterId: string;
    chapterName: string;
    topics: string[];
    easyCount?: number;
    moderateCount?: number;
    difficultCount?: number;
  }[];
  targetCount: number; // 12-13 per subject
}

export interface StudyPlanGenParams {
  student: {
    name: string;
    grade: string;
    board: string;
    academicYear: string;
  };
  examDate: string;
  remainingDays: number;
  targetCompletionDate: string;
  studyDaysCount: number;
  restDaysCount: number;
  revisionDaysCount: number;
  hasBufferConflict: boolean;
  selectedSubjects: SubjectType[];
  selectedChapters: Record<string, string[]>;
  performance: Record<string, number>;
  chapterPerformance: Record<string, number>;
  dailyMinutesBudget: number;
}

export interface WeeklyTestGenParams {
  subject: SubjectType;
  classLevel: string;
  weekNumber: number;
  topicsStudied: string[];
  weakTopics: string[];
  questionCount: number;
}

export interface AdaptPlanParams {
  currentPlan: StudentLearningPlan;
  weeklyTestResult?: WeeklyTestRecord;
  missedTasks?: DailyStudyTask[];
  remainingDays: number;
}

export interface SyllabusExtractionParams {
  subject: SubjectType | string;
  rawText: string;
  classLevel?: string;
  board?: string;
}

export interface ExtractedSyllabusTopic {
  topicName: string;
  subtopics?: string[];
}

export interface ExtractedSyllabusChapter {
  chapterNumber: number;
  chapterName: string;
  topics: ExtractedSyllabusTopic[];
}

export interface ExtractedSyllabusResult {
  subject: string;
  chapters: ExtractedSyllabusChapter[];
}

export interface LLMProvider {
  name: string;
  generateDiagnosticQuestions(params: DiagnosticQuestionGenParams): Promise<PreAssessmentQuestion[]>;
  generateStudyPlan(params: StudyPlanGenParams): Promise<DailyStudyPlan[]>;
  generateWeeklyTest(params: WeeklyTestGenParams): Promise<WeeklyTestQuestion[]>;
  adaptStudyPlan(params: AdaptPlanParams): Promise<DailyStudyPlan[]>;
  extractSyllabus(params: SyllabusExtractionParams): Promise<ExtractedSyllabusResult>;
}

// ----------------------------------------------------------------------------
// 1. MOCK PROVIDER (Deterministic, Zero Cost, NCERT-Curriculum Grounded)
// ----------------------------------------------------------------------------
export class MockProvider implements LLMProvider {
  name = 'MockProvider';

  async generateDiagnosticQuestions(params: DiagnosticQuestionGenParams): Promise<PreAssessmentQuestion[]> {
    const { subject, chapters, targetCount } = params;
    const questions: PreAssessmentQuestion[] = [];
    const difficulties: PreAssessmentDifficulty[] = ['easy', 'moderate', 'difficult'];

    let questionIdx = 1;
    const countPerChapter = Math.max(1, Math.ceil(targetCount / Math.max(1, chapters.length)));

    for (const ch of chapters) {
      const templates = findQuestionBankTemplates(ch.chapterName);
      const topics = ch.topics.length > 0 ? ch.topics : [ch.chapterName];

      for (let i = 0; i < countPerChapter; i++) {
        if (questions.length >= targetCount) break;
        const diff = difficulties[(questionIdx - 1) % difficulties.length];
        const topic = topics[i % topics.length];

        if (templates && templates.length > 0) {
          const matching = templates.filter(t => t.difficulty === diff);
          const pool = matching.length > 0 ? matching : templates;
          const chosen = pool[i % pool.length];

          questions.push({
            questionId: `q_${subject.toLowerCase().slice(0, 3)}_${questionIdx}`,
            subject,
            chapterId: ch.chapterId,
            chapterName: ch.chapterName,
            topic: chosen.topic || topic,
            difficulty: chosen.difficulty || diff,
            question: chosen.question,
            options: [...chosen.options],
            correctOption: chosen.correctOption,
            explanation: chosen.explanation,
            sourcePage: (questionIdx * 4) + 10
          });
        } else {
          // Fallback domain-aware generator if chapter is not directly in the curriculum bank
          const correctOpt = (questionIdx * 2 + 1) % 4;
          let questionText = `Regarding ${topic} in ${ch.chapterName}, which of the following is correct?`;
          let options: string[] = [];
          let explanation = `In standard ${subject} curriculum, the key principle for ${topic} is correctly stated in option ${correctOpt + 1}.`;

          if (subject === 'Social Science') {
            const ssItems = [
              {
                q: `In the study of "${ch.chapterName}" (${topic}), which factor played a central role in shaping historical or civic development?`,
                correct: `Organized collective movements and legal institutional reforms supported by civil society.`,
                distractors: [
                  `Complete isolation from international economic and diplomatic ties.`,
                  `Total reliance on individual arbitrary decisions without codified constitutional laws.`,
                  `The absence of any social, linguistic, or regional diversity among communities.`
                ],
                exp: `Social Science emphasizes collective civic participation and institutional constitutional frameworks.`
              },
              {
                q: `Under "${ch.chapterName}", how does governance or economic planning address disparities in "${topic}"?`,
                correct: `Through democratic decentralization, targeted public welfare programs, and equitable resource allocation.`,
                distractors: [
                  `By permanently eliminating local self-governing bodies and centralizing all decisions.`,
                  `By allowing monopolistic exploitation with zero statutory regulation or public oversight.`,
                  `By discouraging civic accountability and discontinuing public record transparency.`
                ],
                exp: `Democratic decentralization and equitable resource allocation are foundational tenets in CBSE Social Science.`
              },
              {
                q: `In the context of "${ch.chapterName}", what is an essential prerequisite for sustainable development in relation to "${topic}"?`,
                correct: `Balancing economic growth with ecological preservation and social equity for future generations.`,
                distractors: [
                  `Unregulated resource extraction until immediate commercial quotas are met.`,
                  `Ignoring scientific conservation models in national developmental policies.`,
                  `Prioritizing short-term industrial expansion while neglecting environmental degradation.`
                ],
                exp: `NCERT defines sustainable development as balancing socio-economic growth with ecological preservation.`
              }
            ];
            const item = ssItems[(questionIdx - 1) % ssItems.length];
            questionText = item.q;
            explanation = item.exp;
            const dist = item.distractors;
            options = [];
            let dIdx = 0;
            for (let opt = 0; opt < 4; opt++) {
              if (opt === correctOpt) {
                options.push(item.correct);
              } else {
                options.push(dist[dIdx++]);
              }
            }
          } else if (subject === 'Computer Science') {
            const csItems = [
              {
                q: `In computer systems regarding "${topic}" (${ch.chapterName}), what is the primary role of system protocols?`,
                correct: `Ensuring standardized, secure, and reliable communication and data handling across devices.`,
                distractors: [
                  `Preventing any computer from connecting to outside local network nodes.`,
                  `Hardcoding proprietary machine instructions permanently into random-access memory.`,
                  `Allowing unregulated data transmission without parity checks or encryption.`
                ],
                exp: `Network and computing protocols standardize safe data interchange across heterogeneous devices.`
              },
              {
                q: `When designing data structures or algorithms for "${topic}" in ${ch.chapterName}, which practice is recommended?`,
                correct: `Optimizing time and space complexity while maintaining clean, modular, and readable code.`,
                distractors: [
                  `Writing all statements in an infinite unhandled loop without base exit conditions.`,
                  `Relying on deprecated hardware interrupts instead of structured logic.`,
                  `Storing all user credentials as unencrypted plaintext in global variables.`
                ],
                exp: `Good computing practice prioritizes modular architecture, clean logic, and optimized complexity.`
              }
            ];
            const item = csItems[(questionIdx - 1) % csItems.length];
            questionText = item.q;
            explanation = item.exp;
            const dist = item.distractors;
            options = [];
            let dIdx = 0;
            for (let opt = 0; opt < 4; opt++) {
              if (opt === correctOpt) {
                options.push(item.correct);
              } else {
                options.push(dist[dIdx++]);
              }
            }
          } else {
            const defaultDistractors = [
              `It applies strictly in hypothetical limits without physical or analytical validity.`,
              `It contradicts standard conservation and equality axioms established for ${ch.chapterName}.`,
              `It fluctuates randomly without following verifiable scientific rules or formulas.`
            ];
            const correctText = `It represents the foundational law governing ${topic} according to standard ${subject} curriculum.`;
            options = [];
            let dIdx = 0;
            for (let opt = 0; opt < 4; opt++) {
              if (opt === correctOpt) {
                options.push(correctText);
              } else {
                options.push(defaultDistractors[dIdx++]);
              }
            }
          }

          questions.push({
            questionId: `q_${subject.toLowerCase().slice(0, 3)}_${questionIdx}`,
            subject,
            chapterId: ch.chapterId,
            chapterName: ch.chapterName,
            topic,
            difficulty: diff,
            question: questionText,
            options,
            correctOption: correctOpt,
            explanation,
            sourcePage: (questionIdx * 4) + 10
          });
        }

        questionIdx++;
      }
    }

    return questions.slice(0, targetCount);
  }

  async generateStudyPlan(params: StudyPlanGenParams): Promise<DailyStudyPlan[]> {
    const {
      examDate,
      targetCompletionDate,
      selectedSubjects = [],
      selectedChapters = {},
      performance = {},
      dailyMinutesBudget = 120
    } = params;

    const dailyPlans: DailyStudyPlan[] = [];
    const startDate = new Date();
    const endDate = new Date(examDate);
    const targetComp = targetCompletionDate ? new Date(targetCompletionDate) : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    let currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + 1); // Start tomorrow

    let dayCounter = 1;

    // Collect all selected chapters across subjects
    const subjectQueue: { subject: SubjectType; chapter: string; topics: string[]; score: number }[] = [];
    for (const sub of selectedSubjects) {
      const chList = (selectedChapters && selectedChapters[sub])
        ? selectedChapters[sub]
        : ((params as any).selectedCurriculum?.find((c: any) => c.subject === sub)?.chapters?.map((ch: any) => ch.chapterName || ch.name) || [`${sub} Core Fundamentals`]);
      const subScore = (performance && performance[sub] !== undefined) ? performance[sub] : 50;
      chList.forEach((ch: string) => {
        subjectQueue.push({
          subject: sub,
          chapter: ch,
          topics: ['Concept & Foundation', 'Core Formulas & Methods', 'Practice & Problem Solving'],
          score: subScore
        });
      });
    }

    // Sort queue so lower-scoring subjects come first for priority
    subjectQueue.sort((a, b) => a.score - b.score);
    let queueIdx = 0;

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
      const isSunday = currentDate.getDay() === 0;
      const isRevision = currentDate > targetComp;

      if (isSunday) {
        // SUNDAY RULE: Strict Rest & Recovery day
        dailyPlans.push({
          date: dateStr,
          day: dayName,
          isRestDay: true,
          isRevisionPeriod: isRevision,
          tasks: [],
          totalStudyMinutes: 0
        });
      } else if (isRevision) {
        // 7-DAY BUFFER: Revision, weak-topic mock tests & recap
        dailyPlans.push({
          date: dateStr,
          day: dayName,
          isRestDay: false,
          isRevisionPeriod: true,
          isWeeklyTestDay: dayCounter % 6 === 0,
          tasks: [
            {
              id: `task_rev_${dayCounter}_1`,
              subject: selectedSubjects[dayCounter % selectedSubjects.length],
              chapter: 'High-Yield Revision',
              topic: 'Exam-Style Mock Questions & Formula Sheet',
              activity: 'Revision',
              durationMinutes: Math.round(dailyMinutesBudget * 0.6),
              completed: false,
              priority: 'High Priority'
            },
            {
              id: `task_rev_${dayCounter}_2`,
              subject: selectedSubjects[(dayCounter + 1) % selectedSubjects.length],
              chapter: 'Weak Areas Drill',
              topic: 'Past Mistakes Review & Error Analysis',
              activity: 'Remedial Review',
              durationMinutes: Math.round(dailyMinutesBudget * 0.4),
              completed: false,
              priority: 'High Priority'
            }
          ],
          totalStudyMinutes: dailyMinutesBudget
        });
      } else {
        // REGULAR STUDY DAY: Distribute up to 3 distinct subjects per day
        const tasks: DailyStudyTask[] = [];
        let allocatedMinutes = 0;

        // When 3 or more subjects are chosen, include 3 different subjects per study day
        const targetSubjectsCount = Math.min(3, selectedSubjects.length);
        const todaysItems: typeof subjectQueue = [];
        const usedSubjects = new Set<string>();

        for (let s = 0; s < subjectQueue.length && todaysItems.length < targetSubjectsCount; s++) {
          const candidate = subjectQueue[(queueIdx + s) % subjectQueue.length];
          if (!usedSubjects.has(candidate.subject)) {
            usedSubjects.add(candidate.subject);
            todaysItems.push(candidate);
          }
        }
        queueIdx = (queueIdx + Math.max(1, todaysItems.length)) % Math.max(1, subjectQueue.length);

        if (todaysItems.length > 0) {
          const weights = todaysItems.map(item => (item.score < 50 ? 1.5 : (item.score < 75 ? 1.0 : 0.8)));
          const totalWeight = weights.reduce((acc, w) => acc + w, 0);

          todaysItems.forEach((item, idx) => {
            const rawMins = Math.round((weights[idx] / totalWeight) * dailyMinutesBudget);
            // Ensure minimum 20 mins and allocate remainder on last item
            const duration = idx === todaysItems.length - 1
              ? Math.max(20, dailyMinutesBudget - allocatedMinutes)
              : Math.max(20, rawMins);

            const isWeak = item.score < 50;
            tasks.push({
              id: `task_${dayCounter}_${idx + 1}`,
              subject: item.subject,
              chapter: item.chapter,
              topic: item.topics[dayCounter % item.topics.length],
              activity: isWeak ? 'Learn + Practice' : 'Practice',
              durationMinutes: duration,
              completed: false,
              priority: isWeak ? 'High Priority' : 'Moderate'
            });

            allocatedMinutes += duration;
          });
        }

        dailyPlans.push({
          date: dateStr,
          day: dayName,
          isRestDay: false,
          isRevisionPeriod: false,
          isWeeklyTestDay: dayCounter % 7 === 6,
          tasks,
          totalStudyMinutes: allocatedMinutes
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
      dayCounter++;
    }

    return dailyPlans;
  }

  async generateWeeklyTest(params: WeeklyTestGenParams): Promise<WeeklyTestQuestion[]> {
    const { subject, topicsStudied, weakTopics, questionCount } = params;
    const questions: WeeklyTestQuestion[] = [];
    const pool = topicsStudied.length > 0 ? topicsStudied : weakTopics.length > 0 ? weakTopics : ['Fundamental Concepts'];

    for (let i = 0; i < questionCount; i++) {
      const topic = pool[i % pool.length];
      const isWeak = weakTopics.includes(topic);
      const difficulty: PreAssessmentDifficulty = isWeak ? 'moderate' : (i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'moderate' : 'difficult');
      const correctOpt = i % 4;

      questions.push({
        id: `wt_${subject.toLowerCase().slice(0, 3)}_q${i + 1}`,
        subject,
        chapter: `Weekly Milestone: ${topic}`,
        topic,
        difficulty,
        question: `[Weekly Test Q${i + 1}] For ${subject} on "${topic}": Which of the following statements is scientifically and mathematically valid?`,
        options: [
          `Option A: Core verified theorem for ${topic} with balanced conditions.`,
          `Option B: Neglects fundamental conservation laws under standard temperature and pressure.`,
          `Option C: Alters fundamental algebraic proportionality rules.`,
          `Option D: Assumes non-linear distortion without experimental foundation.`
        ],
        correctOption: correctOpt,
        explanation: `Topic "${topic}" adheres to standard curriculum definitions where option ${String.fromCharCode(65 + correctOpt)} is correct.`
      });
    }

    return questions;
  }

  async adaptStudyPlan(params: AdaptPlanParams): Promise<DailyStudyPlan[]> {
    const { currentPlan, weeklyTestResult, missedTasks } = params;
    const updated = JSON.parse(JSON.stringify(currentPlan.dailyPlans)) as DailyStudyPlan[];

    // If weekly test showed weak areas (< 60%), inject remedial tasks into upcoming SUNDAY (not weekdays!)
    if (weeklyTestResult && weeklyTestResult.percentage < 60 && weeklyTestResult.weakTopics.length > 0) {
      let injected = 0;
      for (const day of updated) {
        const isSun = day.day === 'Sunday' || day.isRestDay;
        if (isSun && injected < 3) {
          const weakTopic = weeklyTestResult.weakTopics[injected % weeklyTestResult.weakTopics.length];
          day.tasks.push({
            id: `task_remedial_sunday_${Date.now()}_${injected}`,
            subject: weeklyTestResult.subject,
            chapter: 'Remedial Reinforcement',
            topic: weakTopic,
            activity: 'Remedial Review',
            durationMinutes: 30,
            completed: false,
            priority: 'High Priority'
          });
          day.totalStudyMinutes += 30;
          injected++;
        }
      }
    }

    // If missed tasks exist, reschedule them into upcoming SUNDAYS (not weekdays!)
    if (missedTasks && missedTasks.length > 0) {
      let taskIdx = 0;
      for (const day of updated) {
        const isSun = day.day === 'Sunday' || day.isRestDay;
        if (isSun && taskIdx < missedTasks.length) {
          const missed = missedTasks[taskIdx];
          day.tasks.push({
            ...missed,
            id: `task_remedial_sunday_${day.date}_${Date.now()}_${taskIdx}`,
            activity: 'Remedial Review',
            completed: false,
            priority: 'High Priority'
          });
          day.totalStudyMinutes += missed.durationMinutes;
          taskIdx++;
        }
      }
    }

    return updated;
  }

  async extractSyllabus(params: SyllabusExtractionParams): Promise<ExtractedSyllabusResult> {
    const { subject, rawText } = params;
    const cleanText = (rawText || '').trim();
    const chapters: ExtractedSyllabusChapter[] = [];

    // Parse lines to detect chapter headings and section titles
    const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let currentChapter: ExtractedSyllabusChapter | null = null;
    let chNum = 1;

    const hasExplicitChapters = lines.some(l => /^chapter\s+\d+/i.test(l));

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Exclude page numbers, footers, and very long textbook paragraphs (> 14 words)
      if (/^page\s*\d+/i.test(line) || /^\d+\s*$/i.test(line) || line.split(/\s+/).length > 14) {
        continue;
      }

      // If document has explicit chapters, skip Unit headers
      if (hasExplicitChapters && /^unit\s+/i.test(line)) {
        continue;
      }

      // Check if line looks like a chapter header (e.g. "Chapter 1: Real Numbers", "1. Real Numbers", "Unit 1: Real Numbers")
      const chPrefixMatch = line.match(/^(?:chapter|unit|lesson|module|theme|part)\s*(\d+|[ivx]+)?\s*[:.\-–—]\s*(.+)$/i);
      const numDotMatch = line.match(/^(\d+)\.\s+([A-Za-z].+)$/);

      if ((chPrefixMatch && line.length < 80) || (numDotMatch && line.length < 80)) {
        let name = chPrefixMatch ? chPrefixMatch[2].trim() : (numDotMatch ? numDotMatch[2].trim() : line);
        name = name.replace(/[:.,\-–—]+$/, '').trim();

        if (name.length > 2 && !chapters.some(c => c.chapterName.toLowerCase() === name.toLowerCase())) {
          currentChapter = {
            chapterNumber: chNum++,
            chapterName: name,
            topics: []
          };
          chapters.push(currentChapter);
          continue;
        }
      }

      // If we are inside a chapter and find a topic/bullet point
      if (currentChapter) {
        const topMatch = line.match(/^[•\-\*▪►\d+.]\s*(.+)$/);
        let topName = topMatch ? topMatch[1].trim() : line;
        topName = topName.replace(/[:.,\-–—]+$/, '').trim();

        if (
          topName.length >= 3 &&
          topName.length <= 90 &&
          !currentChapter.topics.some(t => t.topicName.toLowerCase() === topName.toLowerCase())
        ) {
          currentChapter.topics.push({ topicName: topName });
        }
      }
    }

    // Ensure every chapter has at least 1 topic (fall back to chapter name or core concepts)
    chapters.forEach(ch => {
      if (ch.topics.length === 0) {
        ch.topics.push({ topicName: `Fundamentals of ${ch.chapterName}` });
        ch.topics.push({ topicName: `Applications and Problem Solving in ${ch.chapterName}` });
      }
    });

    // If zero chapters could be detected from raw text headings, create structured chapter from the subject
    if (chapters.length === 0) {
      chapters.push({
        chapterNumber: 1,
        chapterName: `${subject} Core Fundamentals`,
        topics: [
          { topicName: 'Foundational Principles and Concepts' },
          { topicName: 'Methods, Analysis, and Applications' },
          { topicName: 'Standard Practice Problems' }
        ]
      });
    }

    return {
      subject: typeof subject === 'string' ? subject : 'General',
      chapters
    };
  }
}

// ----------------------------------------------------------------------------
// 2. GEMINI PROVIDER (Real AI Generation via Vite Server API / Direct Proxy)
// ----------------------------------------------------------------------------
export class GeminiProvider implements LLMProvider {
  name = 'GeminiProvider';
  private fallbackMock = new MockProvider();

  async generateDiagnosticQuestions(params: DiagnosticQuestionGenParams): Promise<PreAssessmentQuestion[]> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/ai/generate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: params.subject,
            classLevel: params.classLevel,
            chapters: params.chapters,
            targetTotalQuestions: params.targetCount
          })
        });

        if (res.ok) {
          const json = await res.json();
          if (json?.data?.questions && Array.isArray(json.data.questions) && json.data.questions.length > 0) {
            // Format and return questions
            return json.data.questions.map((q: any, i: number) => ({
              id: q.questionId || `q_${params.subject.toLowerCase().slice(0, 3)}_${i + 1}`,
              subject: params.subject,
              chapterId: q.chapterId || params.chapters[0]?.chapterId || 'ch_01',
              chapterName: q.chapterName || params.chapters[0]?.chapterName || 'General',
              topic: q.topic || 'Core Concept',
              difficulty: (q.difficulty?.toLowerCase() as PreAssessmentDifficulty) || 'moderate',
              question: q.question,
              options: q.options || [],
              correctOption: typeof q.correctOption === 'number' ? q.correctOption : 0,
              explanation: q.explanation || 'Verified curriculum explanation.',
              sourcePage: q.sourcePage
            }));
          }
        }
      } catch (err) {
        console.warn('Gemini question generation failed, using mock provider:', err);
      }
    }
    return this.fallbackMock.generateDiagnosticQuestions(params);
  }

  async generateStudyPlan(params: StudyPlanGenParams): Promise<DailyStudyPlan[]> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/ai/study-plan/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });

        if (res.ok) {
          const json = await res.json();
          if (json?.data?.dailyPlans && Array.isArray(json.data.dailyPlans)) {
            return json.data.dailyPlans;
          }
        }
      } catch (err) {
        console.warn('Gemini study plan generation failed, using mock provider:', err);
      }
    }
    return this.fallbackMock.generateStudyPlan(params);
  }

  async generateWeeklyTest(params: WeeklyTestGenParams): Promise<WeeklyTestQuestion[]> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/ai/weekly-test/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });

        if (res.ok) {
          const json = await res.json();
          if (json?.data?.questions && Array.isArray(json.data.questions)) {
            return json.data.questions;
          }
        }
      } catch (err) {
        console.warn('Gemini weekly test generation failed, using mock provider:', err);
      }
    }
    return this.fallbackMock.generateWeeklyTest(params);
  }

  async adaptStudyPlan(params: AdaptPlanParams): Promise<DailyStudyPlan[]> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/ai/study-plan/adapt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });

        if (res.ok) {
          const json = await res.json();
          if (json?.data?.dailyPlans && Array.isArray(json.data.dailyPlans)) {
            return json.data.dailyPlans;
          }
        }
      } catch (err) {
        console.warn('Gemini study plan adaptation failed, using mock provider:', err);
      }
    }
    return this.fallbackMock.adaptStudyPlan(params);
  }

  async extractSyllabus(params: SyllabusExtractionParams): Promise<ExtractedSyllabusResult> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/ai/extract-chapters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: params.rawText,
            subject: params.subject,
            classLevel: params.classLevel
          })
        });

        if (res.ok) {
          const json = await res.json();
          if (json?.chapters && Array.isArray(json.chapters) && json.chapters.length > 0) {
            const formattedChapters: ExtractedSyllabusChapter[] = json.chapters.map((ch: any, idx: number) => ({
              chapterNumber: ch.chapterNumber || idx + 1,
              chapterName: ch.chapterName || ch.title || `Chapter ${idx + 1}`,
              topics: Array.isArray(ch.topics)
                ? ch.topics.map((t: any) => ({
                    topicName: typeof t === 'string' ? t : (t.name || t.topicName || String(t))
                  }))
                : [{ topicName: 'Core Principles' }]
            }));

            return {
              subject: json.subject || (typeof params.subject === 'string' ? params.subject : 'Subject'),
              chapters: formattedChapters
            };
          }
        }
      } catch (err) {
        console.warn('Gemini syllabus extraction failed, using mock provider:', err);
      }
    }

    return this.fallbackMock.extractSyllabus(params);
  }
}

// ----------------------------------------------------------------------------
// 3. FACTORY HELPER: GET CURRENT ACTIVE LLM PROVIDER
// ----------------------------------------------------------------------------
export function getLLMProvider(): LLMProvider {
  let providerType = 'gemini';
  try {
    const proc = (globalThis as any).process;
    if (proc?.env?.LLM_PROVIDER) {
      providerType = proc.env.LLM_PROVIDER;
    } else if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_LLM_PROVIDER) {
      providerType = (import.meta as any).env.VITE_LLM_PROVIDER;
    }
  } catch {
    // fallback to gemini
  }

  if (providerType.toLowerCase() === 'mock') {
    return new MockProvider();
  }

  return new GeminiProvider();
}

export const llmProvider = getLLMProvider();
