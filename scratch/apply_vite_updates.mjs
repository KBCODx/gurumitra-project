import fs from 'fs';

const filePath = 'vite.config.ts';
let code = fs.readFileSync(filePath, 'utf8');

// Ensure import
if (!code.includes('buildSubjectCurriculumLesson')) {
  code = code.replace(
    "import react from '@vitejs/plugin-react';",
    "import react from '@vitejs/plugin-react';\nimport { buildSubjectCurriculumLesson } from './src/services/curriculumKnowledgePacks';"
  );
}

const lines = code.split(/\r?\n/);

// Find createServerCurriculumLessonFallback start and end
let funcStart = -1;
let funcEnd = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const createServerCurriculumLessonFallback = (params: any) => {')) {
    funcStart = i;
  }
  if (funcStart !== -1 && i > funcStart && lines[i].trim() === '};' && lines[i + 2]?.includes('try {')) {
    funcEnd = i;
    break;
  }
}

if (funcStart !== -1 && funcEnd !== -1) {
  const newFunc = [
    '            const createServerCurriculumLessonFallback = (params: any) => {',
    '              return buildSubjectCurriculumLesson(params);',
    '            };'
  ];
  lines.splice(funcStart, funcEnd - funcStart + 1, ...newFunc);
  console.log(`Replaced createServerCurriculumLessonFallback (lines ${funcStart + 1} to ${funcEnd + 1})`);
} else {
  console.error('Could not locate createServerCurriculumLessonFallback bounds', { funcStart, funcEnd });
}

code = lines.join('\n');

// Fix clientHeaderApiKey
const oldEndpointHead = `              if (req.url === '/api/ai/adaptive-lesson/generate' && req.method === 'POST') {
                const body = await readBody();
                const effectiveApiKey = clientHeaderApiKey || body.apiKey || geminiApiKey;`;

const newEndpointHead = `              if (req.url === '/api/ai/adaptive-lesson/generate' && req.method === 'POST') {
                const body = await readBody();
                const clientHeaderApiKey = (req.headers['x-gemini-api-key'] as string) || (req.headers.authorization && (req.headers.authorization as string).replace(/^Bearer\\s+/i, '')) || '';
                const effectiveApiKey = clientHeaderApiKey || body.apiKey || geminiApiKey;`;

if (code.includes(oldEndpointHead)) {
  code = code.replace(oldEndpointHead, newEndpointHead);
  console.log('Fixed clientHeaderApiKey');
} else {
  console.warn('Could not find oldEndpointHead directly, searching with regex');
  code = code.replace(
    /if\s*\(\s*req\.url\s*===\s*'\/api\/ai\/adaptive-lesson\/generate'[\s\S]*?const effectiveApiKey = clientHeaderApiKey \|\| body\.apiKey \|\| geminiApiKey;/,
    `if (req.url === '/api/ai/adaptive-lesson/generate' && req.method === 'POST') {
                const body = await readBody();
                const clientHeaderApiKey = (req.headers['x-gemini-api-key'] as string) || (req.headers.authorization && (req.headers.authorization as string).replace(/^Bearer\\s+/i, '')) || '';
                const effectiveApiKey = clientHeaderApiKey || body.apiKey || geminiApiKey;`
  );
}

// Update prompt requirements and schema
code = code.replace(
  /STRICT CURRICULUM ACCURACY REQUIREMENTS:[\s\S]*?Return ONLY a valid JSON object matching this schema/m,
  `STRICT CURRICULUM ACCURACY REQUIREMENTS:
1. Educational accuracy is non-negotiable. Content MUST strictly follow the \${board} Class \${classLevel} syllabus for \${subject} -> \${chapter} -> \${topic}.
2. Do NOT invent fake formulas or imaginary science laws. For English, grammar, or humanities, explain linguistic structures and rules—NEVER mention physics units (cm to m, grams to kg) or conservation laws!
3. Cover approximately 6 to 7 important subtopics/concepts directly explaining "\${topic}".
4. Generate 4 to 6 "theory_qa" review questions: each has a conceptual theory question, complete theoretical answer for CBSE board exams, key points, and board marking tip.
5. Generate a concise Today's Learning Summary (4-6 key takeaways).
6. Generate EXACTLY 10 topic-specific quiz questions (multiple choice with 4 options each, correctOptionIndex 0-3, and clear explanations).
7. Generate 5 interactive practice questions with hints and detailed explanations.

Return ONLY a valid JSON object matching this schema`
);

code = code.replace(
  /"theory": "Comprehensive theory overview synthesizing the topic",\s*"questions": \[/m,
  `"theory": "Comprehensive theory overview synthesizing the topic",
  "theory_qa": [
    {
      "id": "tqa_1",
      "question": "Conceptual theory question testing deep understanding of \${topic}",
      "theoreticalAnswer": "Full, complete, structured theoretical answer suitable for CBSE board subjective marks",
      "keyPoints": ["Key point 1", "Key point 2"],
      "boardMarkingTip": "Examiner guidance on mandatory keywords or definitions"
    }
  ],
  "summary": ["Takeaway 1", "Takeaway 2", "Takeaway 3", "Takeaway 4"],
  "questions": [`
);

// Normalize theory_qa in response
const oldNormalizationCheck = `parsed.questions = parsed.questions.map((q: any, idx: number) => {`;
const newNormalizationCheck = `if (!Array.isArray(parsed.theory_qa) || parsed.theory_qa.length === 0) {
                            const fallbackPack = buildSubjectCurriculumLesson({
                              classLevel, board, subject, chapter, topic, subtopics, studentLevel, allocatedMinutes
                            });
                            parsed.theory_qa = fallbackPack.theory_qa || [];
                          }
                          parsed.questions = parsed.questions.map((q: any, idx: number) => {`;

if (code.includes(oldNormalizationCheck)) {
  code = code.replace(oldNormalizationCheck, newNormalizationCheck);
  console.log('Added theory_qa normalization');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated vite.config.ts!');
