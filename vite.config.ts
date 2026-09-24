import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { buildSubjectCurriculumLesson } from './src/services/curriculumKnowledgePacks';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const geminiApiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
  const geminiModel = env.GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  return {
    plugins: [
      react(),
      {
        name: 'gemini-api-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith('/api/ai/')) {
              return next();
            }

            const sendJson = (status: number, data: any) => {
              res.statusCode = status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            };

            const readBody = (): Promise<any> => {
              return new Promise((resolve, reject) => {
                let data = '';
                req.on('data', chunk => { data += chunk; });
                req.on('end', () => {
                  try {
                    resolve(data ? JSON.parse(data) : {});
                  } catch (e) {
                    reject(e);
                  }
                });
                req.on('error', reject);
              });
            };

            const createServerCurriculumLessonFallback = (params: any) => {
              return buildSubjectCurriculumLesson(params);
            };

            try {
              // 0. Server-side PDF Text Extraction Endpoint (Runs locally in Node.js, zero external API key needed)
              if (req.url === '/api/ai/extract-pdf-text' && req.method === 'POST') {
                const body = await readBody();
                const base64 = body.base64 || body.base64Data || body.data;
                if (!base64) {
                  return sendJson(400, { error: 'No base64 PDF data provided.' });
                }

                try {
                  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
                  const buffer = Buffer.from(base64, 'base64');
                  const loadingTask = pdfjsLib.getDocument({
                    data: new Uint8Array(buffer),
                    disableFontFace: true
                  });
                  const pdf = await loadingTask.promise;
                  const extractedPages: { pageNumber: number; text: string; lines: string[] }[] = [];
                  const totalPages = Math.min(pdf.numPages, 100);

                  function reconstructPageLines(items: any[]): { text: string; lines: string[] } {
                    if (!items || items.length === 0) return { text: '', lines: [] };
                    const valid: any[] = [];
                    for (const item of items) {
                      if (typeof item?.str !== 'string') continue;
                      if (!item.str && item.str !== ' ') continue;
                      const transform = item.transform || [1, 0, 0, 1, 0, 0];
                      const x = transform[4] || 0;
                      const y = transform[5] || 0;
                      const height = Math.abs(transform[3]) || 12;
                      const width = item.width || (item.str.length * (height * 0.5));
                      valid.push({ str: item.str, x, y, width, height });
                    }
                    if (valid.length === 0) return { text: '', lines: [] };

                    valid.sort((a, b) => {
                      if (Math.abs(b.y - a.y) > 3) return b.y - a.y;
                      return a.x - b.x;
                    });

                    const lineClusters: any[][] = [];
                    let currentCluster: any[] = [];
                    let currentY: number | null = null;
                    for (const item of valid) {
                      if (currentY === null) {
                        currentCluster = [item];
                        currentY = item.y;
                      } else if (Math.abs(item.y - currentY) <= 3.5) {
                        currentCluster.push(item);
                        currentY = (currentY * (currentCluster.length - 1) + item.y) / currentCluster.length;
                      } else {
                        lineClusters.push(currentCluster);
                        currentCluster = [item];
                        currentY = item.y;
                      }
                    }
                    if (currentCluster.length > 0) lineClusters.push(currentCluster);

                    const lines: string[] = [];
                    let prevLineY: number | null = null;
                    let prevHeight = 12;

                    for (const cluster of lineClusters) {
                      cluster.sort((a, b) => a.x - b.x);
                      let lineStr = '';
                      let prevEnd: number | null = null;
                      for (const item of cluster) {
                        if (item.str === '') continue;
                        if (prevEnd !== null) {
                          const gap = item.x - prevEnd;
                          if (gap > 1.8 && !lineStr.endsWith(' ') && !item.str.startsWith(' ')) {
                            lineStr += ' ';
                          }
                        }
                        lineStr += item.str;
                        prevEnd = item.x + item.width;
                      }
                      const trimmed = lineStr.trim();
                      if (!trimmed) continue;
                      if (/^(?:page\s*)?\d+(?:\s*(?:of|\/)\s*\d+)?$/i.test(trimmed) && cluster[0].y < 45) continue;

                      const avgY = cluster.reduce((sum: number, it: any) => sum + it.y, 0) / cluster.length;
                      const avgH = cluster.reduce((sum: number, it: any) => sum + it.height, 0) / cluster.length || prevHeight;
                      if (prevLineY !== null) {
                        const vGap = prevLineY - avgY;
                        if (vGap > avgH * 1.85 && lines.length > 0) {
                          lines.push('');
                        }
                      }
                      lines.push(trimmed);
                      prevLineY = avgY;
                      prevHeight = avgH;
                    }
                    return {
                      text: lines.join('\n'),
                      lines: lines.filter(l => l.length > 0)
                    };
                  }

                  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    const { text: pageText, lines: pageLines } = reconstructPageLines(textContent.items as any[]);
                    if (pageText.trim()) {
                      extractedPages.push({ pageNumber: pageNum, text: pageText, lines: pageLines });
                    }
                  }

                  const fullText = extractedPages.map(p => `[Page ${p.pageNumber}]\n${p.text}`).join('\n\n');
                  return sendJson(200, {
                    success: true,
                    totalPages: pdf.numPages,
                    extractedPagesCount: extractedPages.length,
                    text: fullText,
                    pages: extractedPages
                  });
                } catch (pdfErr: any) {
                  console.error('Server-side PDF extraction error:', pdfErr);
                  return sendJson(500, { error: pdfErr?.message || 'Failed to parse PDF on server' });
                }
              }

              const clientHeaderApiKey = (req.headers['x-gemini-api-key'] as string) || '';

              // Endpoint: /api/ai/check-status
              if (req.url.startsWith('/api/ai/check-status') && req.method === 'GET') {
                const effectiveKey = clientHeaderApiKey || geminiApiKey;
                if (!effectiveKey) {
                  return sendJson(200, {
                    configured: false,
                    valid: false,
                    status: 'not_configured',
                    source: 'none',
                    message: 'No Gemini API key provided. Using offline NCERT curriculum engine.'
                  });
                }

                const urlObj = new URL(req.url, 'http://localhost');
                const shouldValidate = urlObj.searchParams.get('validate') === 'true';

                if (shouldValidate) {
                  try {
                    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash?key=${effectiveKey}`;
                    const testRes = await fetch(testUrl);
                    if (testRes.ok) {
                      return sendJson(200, {
                        configured: true,
                        valid: true,
                        status: 'active',
                        source: clientHeaderApiKey ? 'client' : (geminiApiKey ? 'server' : 'none'),
                        model: geminiModel || 'gemini-1.5-flash',
                        message: 'API Key is Active & Valid! Successfully connected to Google Gemini.'
                      });
                    } else if (testRes.status === 400 || testRes.status === 403) {
                      const errData = await testRes.json().catch(() => null);
                      const detailMsg = errData?.error?.message || 'API key not valid or expired';
                      return sendJson(200, {
                        configured: false,
                        valid: false,
                        status: 'invalid_or_expired',
                        source: clientHeaderApiKey ? 'client' : (geminiApiKey ? 'server' : 'none'),
                        message: `Key Expired/Invalid: ${detailMsg}. Please generate a new key on Google AI Studio.`
                      });
                    } else if (testRes.status === 429) {
                      return sendJson(200, {
                        configured: true,
                        valid: false,
                        status: 'quota_exceeded',
                        source: clientHeaderApiKey ? 'client' : (geminiApiKey ? 'server' : 'none'),
                        message: 'Quota Exceeded: Your Google Gemini free tier rate limit was reached. Quota resets daily.'
                      });
                    } else {
                      return sendJson(200, {
                        configured: true,
                        valid: false,
                        status: 'error',
                        message: `Google Gemini responded with HTTP status ${testRes.status}.`
                      });
                    }
                  } catch (netErr: any) {
                    return sendJson(200, {
                      configured: true,
                      valid: false,
                      status: 'network_error',
                      message: `Network error connecting to Gemini API: ${netErr?.message || 'Unknown network error'}`
                    });
                  }
                }

                return sendJson(200, {
                  configured: true,
                  source: clientHeaderApiKey ? 'client' : (geminiApiKey ? 'server' : 'none'),
                  model: geminiModel || 'gemini-1.5-flash'
                });
              }

              // Endpoint: /api/ai/extract-chapters
              if (req.url === '/api/ai/extract-chapters' && req.method === 'POST') {
                const body = await readBody();
                const effectiveApiKey = clientHeaderApiKey || body.apiKey || geminiApiKey;
                const effectiveModel = body.model || geminiModel || 'gemini-1.5-flash';

                if (!effectiveApiKey) {
                  return sendJson(200, {
                    isDemoMode: true,
                    message: 'GEMINI_API_KEY not configured. Running in Demo Mode.'
                  });
                }

                const { text, subject, classLevel } = body;

                if (!text || text.trim().length < 15) {
                  return sendJson(400, { error: 'Text content is too short to extract chapters.' });
                }

                const prompt = `You are an expert curriculum parser for Indian and international school curricula (NCERT/CBSE/ICSE/State Boards, Classes 6-12).
Analyze the following extracted textbook/syllabus text for ${subject || 'General Studies'} (Class ${classLevel || 'General'}).

CRITICAL SOURCE-OF-TRUTH EXTRACTION RULES:
1. FIRST check for a Table of Contents (TOC) / Index / Syllabus Outline at the beginning of the text. If a Table of Contents is present, use it as the primary chapter map!
2. Two-Line Headings: If a line with "Chapter 1" or "Unit I" is followed by the chapter title on the next line (e.g. "Number Systems"), consolidate them into ONE chapter titled "Number Systems". Do NOT create separate entries for "Chapter 1" and "Number Systems".
3. STRICT NEGATIVE CONSTRAINT: Extract ONLY chapters that are physically present in this provided document text. DO NOT add or invent chapters from NCERT/CBSE memory if they are not in this document! If the document contains only 2 or 3 chapters, extract ONLY those 2 or 3 chapters.
4. Filter out explanatory prose sentences, definitions, and formulas (e.g. "A rational number can be written in the form p/q...").
5. For each verified chapter, extract 3 to 6 key core topics/sections that are actually discussed in the text under that chapter.

Return ONLY a valid JSON object matching this schema:
{
  "subject": "${subject || 'Subject'}",
  "class": "${classLevel || 'General'}",
  "chapters": [
    {
      "chapterId": "ch_01",
      "chapterName": "...",
      "topics": ["topic 1", "topic 2"],
      "prerequisites": ["prereq 1"],
      "importantConcepts": ["concept 1"]
    }
  ]
}

Document Text to analyze (up to 12000 chars):
${text.slice(0, 12000)}`;

                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${effectiveApiKey}`;
                const apiRes = await fetch(geminiUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                      responseMimeType: 'application/json',
                      temperature: 0.2
                    }
                  })
                });

                if (!apiRes.ok) {
                  const errText = await apiRes.text();
                  console.warn(`Gemini API error ${apiRes.status}:`, errText);
                  return sendJson(200, { isDemoMode: true, error: `Gemini API returned ${apiRes.status}` });
                }

                const result = await apiRes.json();
                const rawJson = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!rawJson) {
                  return sendJson(200, { isDemoMode: true, error: 'Empty response from Gemini' });
                }

                const parsed = JSON.parse(rawJson);
                return sendJson(200, { isDemoMode: false, data: parsed });
              }

              // Endpoint: /api/ai/generate-questions
              if (req.url === '/api/ai/generate-questions' && req.method === 'POST') {
                const body = await readBody();
                const effectiveApiKey = clientHeaderApiKey || body.apiKey || geminiApiKey;
                const effectiveModel = body.model || geminiModel || 'gemini-1.5-flash';

                if (!effectiveApiKey) {
                  return sendJson(200, {
                    isDemoMode: true,
                    message: 'GEMINI_API_KEY not configured. Running in Demo Mode.'
                  });
                }

                const { chapters, subject, classLevel, chapterAllocations, targetTotalQuestions = 30 } = body;

                if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
                  return sendJson(400, { error: 'No chapters provided for question generation.' });
                }

                const prompt = `You are a senior NCERT / CBSE / ICSE assessment author and diagnostic test architect for school students (Classes 6-12).
For the subject "${subject}" (Class "${classLevel || 'General'}"), create a balanced diagnostic pre-assessment containing EXACTLY ${targetTotalQuestions} questions.

CRITICAL SOURCE-OF-TRUTH CONSTRAINT:
Every question MUST test ONLY the concepts and topics of the chapters listed below. NEVER introduce chapters or outside concepts that are not in this syllabus map.

QUESTION ALLOCATION ACROSS CHAPTERS & DIFFICULTY:
${chapterAllocations && Array.isArray(chapterAllocations) && chapterAllocations.length > 0
  ? JSON.stringify(chapterAllocations, null, 2)
  : `Total Questions: ${targetTotalQuestions}. Evenly distribute questions across all ${chapters.length} chapters with approximately ~30% Easy, ~45% Moderate, and ~25% Difficult overall.`}

DIVERSITY & COGNITIVE QUESTION TYPES TO SPAN ACROSS QUESTIONS:
Use these genuine school examination question styles:
1. Definition & Terminology (direct concept recall)
2. Formula identification & symbolic relations
3. Formula application / Numerical computation (with realistic numerical values and units)
4. Conceptual understanding & underlying mechanism
5. "Which of the following statements is CORRECT?"
6. "Which of the following statements is INCORRECT?"
7. Real-world scenario / practical problem
8. Classification / grouping of items or properties
9. Matching or paired relationships
10. Assertion and Reason (Assertion A and Reason R)

STRICT QUALITY & ANTI-BOILERPLATE RULES:
1. NEVER USE REPETITIVE BOILERPLATE STEMS like:
   - "What fundamental principle primarily defines..."
   - "What is the primary role of..."
   - "When applying ... which step is essential?"
   - "In a multi-step scenario combining ... which conclusion is valid?"
2. NEVER USE REPETITIVE BOILERPLATE OPTIONS like:
   - "It defines the core rule and baseline properties..."
   - "It applies solely to unrelated auxiliary systems"
   - "It contradicts standard mathematical and scientific axioms"
   - "A change in boundary conditions causes a proportional shift..."
   - "Boundary conditions have zero effect..."
   - "Results are non-deterministic and cannot be reasoned logically"
3. EVERY OPTION MUST BE REALISTIC AND PLAUSIBLE:
   - For mathematical/science numericals: provide 4 distinct realistic numerical answers (e.g., ['15 cm', '30 cm', '45 cm', '10 cm']). Include common sign errors or formula mistakes as distractors.
   - For concept questions: provide 4 distinct, meaningful, educational statements.
4. Exactly 4 options per question.
5. Exactly one correct answer.
6. correctOption MUST be the 0-based integer index (0, 1, 2, or 3).
7. ROTATE correctOption evenly across 0, 1, 2, 3 throughout the test (do NOT bias towards 0 or 1).
8. No duplicate options within any question.
9. Distribute questions across different topics within each chapter for broad coverage.
10. Provide a clear, educational, step-by-step explanation for the correct answer.

Chapters to generate questions for:
${JSON.stringify(chapters, null, 2)}

Return ONLY a valid JSON object matching this schema:
{
  "questions": [
    {
      "questionId": "q_001",
      "chapterId": "ch_01",
      "chapterName": "...",
      "topic": "...",
      "difficulty": "easy",
      "question": "...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctOption": 1,
      "explanation": "...",
      "sourcePage": 1
    }
  ]
}`;

                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${effectiveApiKey}`;
                const apiRes = await fetch(geminiUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                      responseMimeType: 'application/json',
                      temperature: 0.3
                    }
                  })
                });

                if (!apiRes.ok) {
                  const errText = await apiRes.text();
                  console.warn(`Gemini API error ${apiRes.status}:`, errText);
                  return sendJson(200, { isDemoMode: true, error: `Gemini API returned ${apiRes.status}` });
                }

                const result = await apiRes.json();
                const rawJson = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!rawJson) {
                  return sendJson(200, { isDemoMode: true, error: 'Empty response from Gemini' });
                }

                const parsed = JSON.parse(rawJson);
                return sendJson(200, { isDemoMode: false, data: parsed });
              }

              // Endpoint: /api/ai/recommendation
              if (req.url === '/api/ai/recommendation' && req.method === 'POST') {
                const body = await readBody();
                const effectiveApiKey = clientHeaderApiKey || body.apiKey || geminiApiKey;
                const effectiveModel = body.model || geminiModel || 'gemini-1.5-flash';

                if (!effectiveApiKey) {
                  return sendJson(200, {
                    isDemoMode: true,
                    message: 'GEMINI_API_KEY not configured. Running in Demo Mode.'
                  });
                }

                const { summary } = body;

                const prompt = `You are GuruMitra's AI Learning Advisor for school students.
Analyze this structured diagnostic pre-assessment summary for a student:
${JSON.stringify(summary, null, 2)}

Provide an encouraging, clear, educational diagnostic evaluation.
Return ONLY a valid JSON object matching this schema:
{
  "summary": "2-3 sentences summarizing the student's baseline performance constructively",
  "strengthSummary": "1-2 sentences highlighting where the student demonstrated high confidence",
  "gapSummary": "1-2 sentences explaining the main conceptual gaps identified and why they matter",
  "nextSteps": [
    "Step 1: Specific foundation topic to review",
    "Step 2: Specific practice recommendation",
    "Step 3: Target reassessment milestone"
  ]
}Generic rules: avoid generic fluff, be specific to the student's assessed performance.`;

                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${effectiveApiKey}`;
                const apiRes = await fetch(geminiUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                      responseMimeType: 'application/json',
                      temperature: 0.4
                    }
                  })
                });

                if (!apiRes.ok) {
                  return sendJson(200, { isDemoMode: true });
                }

                const result = await apiRes.json();
                const rawJson = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                const parsed = rawJson ? JSON.parse(rawJson) : null;
                return sendJson(200, { isDemoMode: false, data: parsed });
              }

              // Endpoint: /api/ai/analyze-syllabus
              if (req.url === '/api/ai/analyze-syllabus' && req.method === 'POST') {
                const body = await readBody();
                const effectiveApiKey = clientHeaderApiKey || body.apiKey || geminiApiKey;
                const effectiveModel = body.model || geminiModel || 'gemini-1.5-flash';

                if (!effectiveApiKey) {
                  return sendJson(200, {
                    isDemoMode: true,
                    message: 'GEMINI_API_KEY not configured. Running in Demo Mode.'
                  });
                }

                const { subject, chaptersSummary } = body;

                const prompt = `You are GuruMitra's Curriculum Pedagogical Advisor.
Analyze this grounded syllabus & assessment mastery mapping for ${subject}:
${JSON.stringify(chaptersSummary, null, 2)}

Provide pedagogical synthesis:
1. Identify high priority gaps that need immediate reinforcement.
2. Highlight areas of solid command.
3. Suggest clear actionable learning priorities.

CRITICAL CONSTRAINT: Do NOT invent or alter any test scores or mastery percentages.
Return ONLY a valid JSON object matching:
{
  "aiPedagogicalSummary": {
    "strengths": ["chapter/topic where student is strong"],
    "gaps": ["chapter/topic needing attention"],
    "immediatePriorities": ["1-3 prioritized action step strings"]
  }
}`;

                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${effectiveApiKey}`;
                const apiRes = await fetch(geminiUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                      responseMimeType: 'application/json',
                      temperature: 0.3
                    }
                  })
                });

                if (!apiRes.ok) {
                  return sendJson(200, { isDemoMode: true });
                }

                const result = await apiRes.json();
                const rawJson = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                const parsed = rawJson ? JSON.parse(rawJson) : null;
                return sendJson(200, { isDemoMode: false, data: parsed });
              }

              // Endpoint: /api/ai/study-plan/generate
              if (req.url === '/api/ai/study-plan/generate' && req.method === 'POST') {
                const body = await readBody();
                const effectiveApiKey = clientHeaderApiKey || body.apiKey || geminiApiKey;

                const {
                  student,
                  examDate,
                  selectedSubjects,
                  selectedCurriculum,
                  preAssessmentResult,
                  dailyMinutesBudget = 140,
                  curriculumVersionId = 'cbse-10-2026-27',
                  startDate
                } = body;

                if (!examDate || !selectedSubjects || !selectedCurriculum) {
                  return sendJson(400, { error: 'Missing required parameters for study plan generation.' });
                }

                // Calculate calendar & metrics deterministically
                const start = startDate ? new Date(startDate) : new Date();
                start.setHours(0, 0, 0, 0);
                const exam = new Date(examDate);
                exam.setHours(0, 0, 0, 0);

                const diffMs = exam.getTime() - start.getTime();
                const remainingDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
                let hasBufferConflict = false;
                let bufferDays = 7;
                let conflictMessage = '';

                if (remainingDays <= 7) {
                  hasBufferConflict = true;
                  bufferDays = Math.max(1, Math.floor(remainingDays * 0.3));
                  conflictMessage = `Exam is in ${remainingDays} days. The 7-day revision buffer has been compressed to ${bufferDays} day(s).`;
                }

                const targetCompletion = new Date(exam);
                targetCompletion.setDate(targetCompletion.getDate() - bufferDays);

                // Build daily plan objects
                const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const dailyPlans: any[] = [];
                const cur = new Date(start);

                // Collect all topics with performance weighting
                const topicPool: any[] = [];
                selectedCurriculum.forEach((c: any) => {
                  const subName = c.subject;
                  let subAcc = 65;
                  if (preAssessmentResult?.subjectPerformance?.[subName]) {
                    subAcc = preAssessmentResult.subjectPerformance[subName].percentage;
                  }
                  (c.chapters || []).forEach((ch: any) => {
                    let chAcc = subAcc;
                    if (preAssessmentResult?.chapterPerformance?.[ch.chapterName]) {
                      chAcc = preAssessmentResult.chapterPerformance[ch.chapterName].accuracy;
                    }
                    const tops = ch.topics && ch.topics.length > 0 ? ch.topics : [ch.chapterName];
                    tops.forEach((top: string) => {
                      const isWeak = chAcc < 60;
                      topicPool.push({
                        subject: subName,
                        chapterName: ch.chapterName,
                        topicName: top,
                        accuracy: chAcc,
                        isWeak,
                        durationMinutes: isWeak ? 75 : 45
                      });
                    });
                  });
                });

                const topicsBySub: Record<string, any[]> = {};
                selectedSubjects.forEach((sub: string) => {
                  topicsBySub[sub] = topicPool.filter((t: any) => t.subject === sub);
                });
                const subPointers: Record<string, number> = {};
                selectedSubjects.forEach((sub: string) => {
                  subPointers[sub] = 0;
                });
                let studyDayCount = 0;
                let tCount = 1;

                while (cur <= exam) {
                  const dateStr = cur.toISOString().split('T')[0];
                  const dayName = daysOfWeek[cur.getDay()];
                  const isSunday = cur.getDay() === 0;
                  const isBuffer = cur > targetCompletion;

                  if (isSunday) {
                    dailyPlans.push({
                      date: dateStr,
                      day: dayName,
                      dayOfWeek: dayName,
                      isRestDay: true,
                      restDayNote: 'Rest & Recovery. Optional: flashcards, light review, or catching up on missed tasks.',
                      tasks: [],
                      totalStudyMinutes: 0
                    });
                  } else if (isBuffer) {
                    const tasks = selectedSubjects.map((sub: string, sIdx: number) => ({
                      id: `task_rev_${dateStr}_${sIdx + 1}`,
                      subject: sub,
                      chapter: 'Exam Preparation & Comprehensive Revision',
                      topic: 'Full Mock Test & Mistake Analysis',
                      activity: 'Weekly Test',
                      durationMinutes: Math.round(dailyMinutesBudget / selectedSubjects.length),
                      completed: false,
                      isRevision: true
                    }));
                    dailyPlans.push({
                      date: dateStr,
                      day: dayName,
                      dayOfWeek: dayName,
                      isRestDay: false,
                      isRevisionPeriod: true,
                      tasks,
                      totalStudyMinutes: dailyMinutesBudget
                    });
                  } else {
                    const tasks: any[] = [];
                    let dayMins = 0;
                    const targetSubCount = Math.min(3, selectedSubjects.length);
                    const todaysSubjects: string[] = [];

                    for (let s = 0; s < targetSubCount; s++) {
                      todaysSubjects.push(selectedSubjects[(studyDayCount + s) % selectedSubjects.length]);
                    }
                    studyDayCount++;

                    const baseDuration = Math.max(20, Math.floor(dailyMinutesBudget / targetSubCount));

                    todaysSubjects.forEach((sub, sIdx) => {
                      const poolForSub = topicsBySub[sub] || [];
                      const pIdx = subPointers[sub] || 0;
                      const isExhausted = pIdx >= poolForSub.length;
                      const top = !isExhausted ? poolForSub[pIdx] : (poolForSub[studyDayCount % Math.max(1, poolForSub.length)] || {
                        subject: sub,
                        chapterName: `${sub} Core Review`,
                        topicName: 'Comprehensive Topic Review & Problem Solving',
                        isWeak: false
                      });

                      if (!isExhausted) {
                        subPointers[sub] = pIdx + 1;
                      }

                      const duration = sIdx === todaysSubjects.length - 1
                        ? Math.max(20, dailyMinutesBudget - dayMins)
                        : baseDuration;

                      tasks.push({
                        id: `task_${dateStr}_${tCount++}`,
                        subject: top.subject,
                        chapter: top.chapterName,
                        topic: top.topicName,
                        activity: isExhausted ? 'Revision' : (top.isWeak ? 'Learn + Practice' : 'Practice'),
                        durationMinutes: duration,
                        completed: false,
                        isWeakTopic: top.isWeak,
                        isRevision: isExhausted
                      });
                      dayMins += duration;
                    });

                    dailyPlans.push({
                      date: dateStr,
                      day: dayName,
                      dayOfWeek: dayName,
                      isRestDay: false,
                      tasks,
                      totalStudyMinutes: dayMins
                    });
                  }
                  cur.setDate(cur.getDate() + 1);
                }

                const planId = `plan_${student?.id || 'guest'}_${Date.now()}`;
                const plan = {
                  id: planId,
                  studentId: student?.id || 'guest',
                  curriculumVersionId,
                  academicYear: student?.academicYear || '2026-27',
                  classLevel: student?.grade || '10',
                  board: student?.board || 'CBSE',
                  examDate: exam.toISOString().split('T')[0],
                  targetCompletionDate: targetCompletion.toISOString().split('T')[0],
                  syllabusCompletionTarget: targetCompletion.toISOString().split('T')[0],
                  daysAvailable: remainingDays,
                  dailyMinutesBudget,
                  selectedSubjects,
                  selectedChapters: selectedCurriculum.reduce((acc: any, c: any) => {
                    acc[c.subject] = (c.chapters || []).map((ch: any) => ch.chapterName);
                    return acc;
                  }, {}),
                  dailyPlans,
                  hasBufferConflict,
                  conflictMessage: hasBufferConflict ? conflictMessage : undefined,
                  performanceSnapshot: {},
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };

                return sendJson(200, {
                  isDemoMode: !effectiveApiKey,
                  plan
                });
              }

              // Endpoint: /api/ai/weekly-test/generate
              if (req.url === '/api/ai/weekly-test/generate' && req.method === 'POST') {
                const body = await readBody();
                const effectiveApiKey = clientHeaderApiKey || body.apiKey || geminiApiKey;
                const effectiveModel = body.model || geminiModel || 'gemini-1.5-flash';

                const {
                  studentId = 'guest',
                  weekNumber = 1,
                  subject = 'Mathematics',
                  topicsStudied = [],
                  weakTopics = [],
                  targetCount = 10
                } = body;

                let questions: any[] = [];
                let isDemo = true;

                if (effectiveApiKey) {
                  try {
                    const prompt = `You are a CBSE/ICSE exam question author.
Generate a Weekly Test for subject "${subject}" (Week ${weekNumber}).
Total questions: ${targetCount}.
Topics studied this week: ${JSON.stringify(topicsStudied)}
Weak topics needing reinforcement: ${JSON.stringify(weakTopics)}

STRICT REQUIREMENTS:
- Every question must test only topics studied this week or weak topics listed above.
- Exactly 4 distinct options per question.
- Exactly one correct answer (0-based integer index 0, 1, 2, or 3).
- Provide a clear explanation for each answer.

Return ONLY a valid JSON object matching:
{
  "questions": [
    {
      "id": "wt_q_1",
      "subject": "${subject}",
      "chapter": "Chapter name",
      "topic": "Topic name",
      "difficulty": "moderate",
      "question": "Question text...",
      "options": ["A", "B", "C", "D"],
      "correctOption": 0,
      "explanation": "Explanation..."
    }
  ]
}`;

                    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${effectiveApiKey}`;
                    const apiRes = await fetch(geminiUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        generationConfig: {
                          responseMimeType: 'application/json',
                          temperature: 0.3
                        }
                      })
                    });

                    if (apiRes.ok) {
                      const resJson = await apiRes.json();
                      const raw = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
                      const parsed = raw ? JSON.parse(raw) : null;
                      if (Array.isArray(parsed?.questions) && parsed.questions.length > 0) {
                        questions = parsed.questions;
                        isDemo = false;
                      }
                    }
                  } catch (e) {
                    console.warn('Gemini weekly test generation failed, using mock bank:', e);
                  }
                }

                if (questions.length === 0) {
                  const pool = topicsStudied.length > 0 ? topicsStudied : ['Core Concepts'];
                  for (let i = 0; i < targetCount; i++) {
                    const t = pool[i % pool.length];
                    const correctIdx = (i * 2 + 1) % 4;
                    questions.push({
                      id: `wt_q_${i + 1}`,
                      subject,
                      chapter: t,
                      topic: t,
                      difficulty: i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'moderate' : 'difficult',
                      question: `In ${subject}, which statement correctly applies the core theorems of ${t}?`,
                      options: [
                        `It defines the authoritative rule governing ${t} as established in standard curriculum.`,
                        `It applies exclusively to null values and cannot be evaluated.`,
                        `It violates fundamental conservation laws established for this topic.`,
                        `It is undefined across all real number coordinates.`
                      ],
                      correctOption: correctIdx,
                      explanation: `Based on standard curriculum principles, ${t} satisfies the conditions given in option ${correctIdx + 1}.`
                    });
                  }
                }

                return sendJson(200, {
                  isDemoMode: isDemo,
                  test: {
                    id: `test_${subject.toLowerCase()}_w${weekNumber}_${Date.now()}`,
                    studentId,
                    weekNumber,
                    subject,
                    totalQuestions: questions.length,
                    topicsStudied,
                    weakTopics
                  },
                  questions
                });
              }

              // Endpoint: /api/ai/study-plan/adapt
              if (req.url === '/api/ai/study-plan/adapt' && req.method === 'POST') {
                const body = await readBody();
                const { currentPlan, weeklyTestResult } = body;

                if (!currentPlan || !weeklyTestResult) {
                  return sendJson(400, { error: 'Missing currentPlan or weeklyTestResult for adaptation.' });
                }

                const adaptationsSummary: string[] = [];
                const updatedPlans = [...currentPlan.dailyPlans];
                const weakTopics = weeklyTestResult.weakTopics || [];
                const strongTopics = weeklyTestResult.strongTopics || [];

                if (weakTopics.length > 0) {
                  adaptationsSummary.push(
                    `Scheduled Sunday remedial reinforcement for ${weakTopics.length} weak topic(s): ${weakTopics.slice(0, 3).join(', ')}.`
                  );
                  let injected = 0;
                  updatedPlans.forEach(day => {
                    const isSun = day.day === 'Sunday' || day.isRestDay;
                    if (isSun && !day.isCompleted && injected < weakTopics.length) {
                      const topicName = weakTopics[injected % weakTopics.length];
                      day.tasks.push({
                        id: `task_remedial_sun_${Date.now()}_${injected}`,
                        subject: currentPlan.selectedSubjects?.[0] || 'Remedial Reinforcement',
                        chapter: 'Remedial Reinforcement',
                        topic: topicName,
                        durationMinutes: 35,
                        activity: 'Remedial Review',
                        completed: false,
                        priority: 'High Priority',
                        isWeakTopic: true
                      });
                      day.totalStudyMinutes += 35;
                      day.restDayNote = 'Sunday Remedial Reinforcement: Focused catch-up session scheduled on Sunday so weekday study remains balanced.';
                      injected++;
                    }
                  });
                }

                if (strongTopics.length > 0) {
                  adaptationsSummary.push(
                    `Streamlined mastered topics into rapid revision: ${strongTopics.slice(0, 2).join(', ')}.`
                  );
                  updatedPlans.forEach(day => {
                    if (!day.isRestDay && !day.isCompleted) {
                      day.tasks = day.tasks.map((t: any) => {
                        if (strongTopics.some((s: string) => t.topic.toLowerCase().includes(s.toLowerCase()))) {
                          return {
                            ...t,
                            durationMinutes: Math.max(30, t.durationMinutes - 15),
                            activity: 'Revision',
                            isWeakTopic: false
                          };
                        }
                        return t;
                      });
                    }
                  });
                }

                const adaptedPlan = {
                  ...currentPlan,
                  dailyPlans: updatedPlans,
                  updatedAt: new Date().toISOString()
                };

                return sendJson(200, {
                  isDemoMode: false,
                  adaptedPlan,
                  adaptationsSummary
                });
              }

              // Endpoint: /api/ai/adaptive-lesson/generate
              if (req.url === '/api/ai/adaptive-lesson/generate' && req.method === 'POST') {
                const body = await readBody();
                const clientHeaderApiKey = (req.headers['x-gemini-api-key'] as string) || (req.headers.authorization && (req.headers.authorization as string).replace(/^Bearer\s+/i, '')) || '';
                const effectiveApiKey = clientHeaderApiKey || body.apiKey || geminiApiKey;
                const effectiveModel = body.model || geminiModel || 'gemini-1.5-flash';

                const {
                  classLevel = '10th',
                  board = 'CBSE',
                  subject = 'Mathematics',
                  chapter = 'Quadratic Equations',
                  topic = 'Nature of Roots',
                  subtopics = [],
                  allocatedMinutes = 45,
                  studentLevel = 'Average',
                  learningStyle = 'Simple'
                } = body;

                let generatedLesson: any = null;
                let isDemo = true;

                if (effectiveApiKey) {
                  try {
                    const prompt = `You are GuruMitra's AI Adaptive Tutor and Pedagogical Curriculum Specialist for Class ${classLevel} (${board}).
Generate an in-depth, curriculum-aligned, personalized adaptive learning session.

STUDENT & TOPIC CONTEXT:
- Board & Class: ${board}, Class ${classLevel}
- Subject: ${subject}
- Chapter: ${chapter}
- Current Topic: ${topic}
${subtopics && subtopics.length > 0 ? `- Planned Subtopics: ${subtopics.join(', ')}` : ''}
- Student Understanding Level: ${studentLevel} (${
  studentLevel === 'Weak' ? 'Weak understanding. Explain with simple everyday words, step-by-step intuition, concrete foundational examples, and highlight common misconceptions.' :
  studentLevel === 'Strong' ? 'Strong understanding. Provide advanced mathematical/scientific depth, edge cases, inter-topic connections, and high-order reasoning.' :
  'Average understanding. Balance clear definitions, standard board syllabus derivations, practical examples, and common traps.'
})
- Preferred Style: ${learningStyle}
- Allocated Session Time: ${allocatedMinutes} minutes

STRICT CURRICULUM ACCURACY REQUIREMENTS:
1. Educational accuracy is non-negotiable. Content MUST strictly follow the ${board} Class ${classLevel} syllabus for ${subject} -> ${chapter} -> ${topic}.
2. Do NOT invent fake formulas or imaginary science laws. For English, grammar, or humanities, explain linguistic structures and rules—NEVER mention physics units (cm to m, grams to kg) or conservation laws!
3. Cover approximately 6 to 7 important subtopics/concepts directly explaining "${topic}".
4. Generate 4 to 6 "theory_qa" review questions: each has a conceptual theory question, complete theoretical answer for CBSE board exams, key points, and board marking tip.
5. Generate a concise Today's Learning Summary (4-6 key takeaways).
6. Generate EXACTLY 10 topic-specific quiz questions (multiple choice with 4 options each, correctOptionIndex 0-3, and clear explanations).
7. Generate 5 interactive practice questions with hints and detailed explanations.

Return ONLY a valid JSON object matching this schema (no markdown formatting, no code fences, no extra commentary):
{
  "subject": "${subject}",
  "chapter": "${chapter}",
  "topic": "${topic}",
  "difficulty_level": "${studentLevel === 'Weak' ? 'Beginner' : studentLevel === 'Strong' ? 'Advanced' : 'Intermediate'}",
  "learning_objectives": ["string", "string", "string"],
  "subtopics": [
    {
      "id": "sub_1",
      "title": "Subtopic Title",
      "explanation": "Clear pedagogical explanation adapted to student level",
      "formulaOrRule": "Governing formula or rule, if applicable",
      "intuition": "Intuitive mental model or why this works",
      "example": "Worked example with step-by-step reasoning",
      "commonMistake": "Frequent student misconception or exam pitfall",
      "importantPoints": ["Key point 1", "Key point 2"]
    }
  ],
  "theory": "Comprehensive theory overview synthesizing the topic",
  "theory_qa": [
    {
      "id": "tqa_1",
      "question": "Conceptual theory question testing deep understanding of ${topic}",
      "theoreticalAnswer": "Full, complete, structured theoretical answer suitable for CBSE board subjective marks",
      "keyPoints": ["Key point 1", "Key point 2"],
      "boardMarkingTip": "Examiner guidance on mandatory keywords or definitions"
    }
  ],
  "summary": ["Takeaway 1", "Takeaway 2", "Takeaway 3", "Takeaway 4"],
  "questions": [
    {
      "id": "q_th_1",
      "question": "Question text testing topic specifically",
      "difficulty": "easy",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctOptionIndex": 0,
      "answer": "Option A",
      "explanation": "Step-by-step explanation of why this answer is correct and why other choices fail",
      "conceptTested": "Concept tested"
    }
  ],
  "summary": ["Takeaway 1", "Takeaway 2", "Takeaway 3", "Takeaway 4"],
  "practice_questions": [
    {
      "id": "q_pr_1",
      "question": "Practice question text",
      "difficulty": "easy",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctOptionIndex": 0,
      "answer": "Option A",
      "explanation": "Detailed explanation of correct answer",
      "hint": "Guiding hint without directly revealing answer"
    }
  ]
}`;

                    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${effectiveApiKey}`;
                    const apiRes = await fetch(geminiUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        generationConfig: {
                          responseMimeType: 'application/json',
                          temperature: 0.3
                        }
                      })
                    });

                    if (apiRes.ok) {
                      const resJson = await apiRes.json();
                      const raw = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
                      if (raw) {
                        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
                        const parsed = JSON.parse(cleaned);
                        if (
                          parsed &&
                          Array.isArray(parsed.subtopics) &&
                          parsed.subtopics.length >= 4 &&
                          Array.isArray(parsed.questions) &&
                          parsed.questions.length >= 8
                        ) {
                          // Normalize question format if needed
                          if (!Array.isArray(parsed.theory_qa) || parsed.theory_qa.length === 0) {
                            const fallbackPack = buildSubjectCurriculumLesson({
                              classLevel, board, subject, chapter, topic, subtopics, studentLevel, allocatedMinutes
                            });
                            parsed.theory_qa = fallbackPack.theory_qa || [];
                          }
                          parsed.questions = parsed.questions.map((q: any, idx: number) => {
                            const options = Array.isArray(q.options) && q.options.length === 4
                              ? q.options
                              : ['Option A', 'Option B', 'Option C', 'Option D'];
                            const correctOptionIndex = typeof q.correctOptionIndex === 'number' && q.correctOptionIndex >= 0 && q.correctOptionIndex < 4
                              ? q.correctOptionIndex
                              : (typeof q.correctOption === 'number' ? q.correctOption : 0);
                            return {
                              id: q.id || `q_th_${idx + 1}`,
                              question: q.question || `Question ${idx + 1} on ${topic}`,
                              difficulty: (q.difficulty || (idx < 4 ? 'easy' : idx < 7 ? 'moderate' : 'hard')).toLowerCase(),
                              options,
                              correctOptionIndex,
                              answer: q.answer || options[correctOptionIndex],
                              explanation: q.explanation || `According to ${board} Class ${classLevel} syllabus, this matches the standard definition.`,
                              conceptTested: q.conceptTested || `${topic} Principles`
                            };
                          });

                          // Normalize practice questions
                          if (Array.isArray(parsed.practice_questions)) {
                            parsed.practice_questions = parsed.practice_questions.map((pq: any, idx: number) => {
                              const options = Array.isArray(pq.options) && pq.options.length === 4
                                ? pq.options
                                : ['Option A', 'Option B', 'Option C', 'Option D'];
                              const correctOptionIndex = typeof pq.correctOptionIndex === 'number' && pq.correctOptionIndex >= 0 && pq.correctOptionIndex < 4
                                ? pq.correctOptionIndex
                                : 0;
                              return {
                                id: pq.id || `q_pr_${idx + 1}`,
                                question: pq.question || `Practice problem ${idx + 1} on ${topic}`,
                                difficulty: (pq.difficulty || (idx < 2 ? 'easy' : idx < 4 ? 'moderate' : 'hard')).toLowerCase(),
                                options,
                                correctOptionIndex,
                                answer: pq.answer || options[correctOptionIndex],
                                explanation: pq.explanation || `Derived by applying the governing rules of ${topic}.`,
                                hint: pq.hint || `Recall the key formula and boundary conditions for ${topic}.`
                              };
                            });
                          }

                          generatedLesson = {
                            ...parsed,
                            allocatedMinutes,
                            source: 'ai_generated',
                            createdAt: new Date().toISOString()
                          };
                          isDemo = false;
                        }
                      }
                    }
                  } catch (aiErr) {
                    console.warn('Gemini adaptive lesson generation failed, using curriculum engine fallback:', aiErr);
                  }
                }

                // If AI call failed, not configured, or returned invalid JSON, generate curriculum-grounded fallback
                if (!generatedLesson) {
                  generatedLesson = createServerCurriculumLessonFallback({
                    classLevel,
                    board,
                    subject,
                    chapter,
                    topic,
                    subtopics,
                    studentLevel,
                    allocatedMinutes
                  });
                }

                return sendJson(200, {
                  isDemoMode: isDemo,
                  lesson: generatedLesson
                });
              }

              return sendJson(404, { error: 'Unknown AI endpoint' });
            } catch (error: any) {
              console.error('Server AI endpoint failure:', error);
              return sendJson(500, { error: error.message || 'Internal server error in AI endpoint', isDemoMode: true });
            }
          });
        }
      }
    ],
    server: {
      port: 3009,
      strictPort: true,
      open: false
    }
  };
});

