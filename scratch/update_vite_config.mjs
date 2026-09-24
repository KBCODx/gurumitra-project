import fs from 'fs';
import path from 'path';

const viteConfigPath = path.resolve('vite.config.ts');
let content = fs.readFileSync(viteConfigPath, 'utf8');

// 1. Check if buildSubjectCurriculumLesson is imported
if (!content.includes("buildSubjectCurriculumLesson")) {
  content = content.replace(
    "import react from '@vitejs/plugin-react';",
    "import react from '@vitejs/plugin-react';\nimport { buildSubjectCurriculumLesson } from './src/services/curriculumKnowledgePacks';"
  );
}

// 2. Replace the massive createServerCurriculumLessonFallback body
const startMarker = "const createServerCurriculumLessonFallback = (params: any) => {";
const endMarker = "};\n\n            try {\n              // 0. Server-side PDF Text Extraction Endpoint";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `const createServerCurriculumLessonFallback = (params: any) => {
              return buildSubjectCurriculumLesson(params);
            };`;
  content = content.slice(0, startIdx) + replacement + content.slice(endIdx + 2); // keep try { ...
  console.log('Successfully replaced createServerCurriculumLessonFallback');
} else {
  console.warn('Could not find markers for createServerCurriculumLessonFallback:', { startIdx, endIdx });
}

// 3. Fix clientHeaderApiKey and prompt in /api/ai/adaptive-lesson/generate
const targetSearch = `// Endpoint: /api/ai/adaptive-lesson/generate
              if (req.url === '/api/ai/adaptive-lesson/generate' && req.method === 'POST') {
                const body = await readBody();
                const effectiveApiKey = clientHeaderApiKey || body.apiKey || geminiApiKey;`;

const newEndpointSetup = `// Endpoint: /api/ai/adaptive-lesson/generate
              if (req.url === '/api/ai/adaptive-lesson/generate' && req.method === 'POST') {
                const body = await readBody();
                const clientHeaderApiKey = (req.headers['x-gemini-api-key'] as string) || (req.headers.authorization && (req.headers.authorization as string).replace(/^Bearer\\s+/i, '')) || '';
                const effectiveApiKey = clientHeaderApiKey || body.apiKey || geminiApiKey;`;

if (content.includes(targetSearch)) {
  content = content.replace(targetSearch, newEndpointSetup);
  console.log('Successfully fixed clientHeaderApiKey declaration');
} else {
  console.warn('Could not find targetSearch for endpoint setup');
}

// 4. Update the prompt to require theory_qa
const oldPromptRequirements = `STRICT CURRICULUM ACCURACY REQUIREMENTS:
1. Educational accuracy is non-negotiable. Content MUST strictly follow the \${board} Class \${classLevel} syllabus for \${subject} -> \${chapter} -> \${topic}.
2. Do NOT invent fake formulas, imaginary science laws, or college topics.
3. Cover approximately 6 to 7 important subtopics/concepts directly explaining "\${topic}".
4. Generate AT LEAST 10 topic-specific theory questions (3-4 easy, 3-4 moderate, 2-3 hard) with 4 options, correct answer, and deep explanations.
5. Generate a concise Today's Learning Summary (4-6 key takeaways).
6. Generate 5-8 interactive practice questions with hints and detailed explanations.`;

const newPromptRequirements = `STRICT CURRICULUM ACCURACY REQUIREMENTS:
1. Educational accuracy is non-negotiable. Content MUST strictly follow the \${board} Class \${classLevel} syllabus for \${subject} -> \${chapter} -> \${topic}.
2. Do NOT invent fake formulas or imaginary science laws. For English, grammar, or humanities, explain grammar structures and rules—NEVER mention physics units (cm to m, grams to kg) or conservation laws!
3. Cover approximately 6 to 7 important subtopics/concepts directly explaining "\${topic}".
4. Generate 4 to 6 "theory_qa" review questions: each has a conceptual theory question, complete theoretical answer for CBSE board exams, key points, and board marking tip.
5. Generate a concise Today's Learning Summary (4-6 key takeaways).
6. Generate EXACTLY 10 topic-specific quiz questions (multiple choice with 4 options each, correctOptionIndex 0-3, and clear explanations).
7. Generate 5 interactive practice questions with hints and detailed explanations.`;

if (content.includes(oldPromptRequirements)) {
  content = content.replace(oldPromptRequirements, newPromptRequirements);
  console.log('Successfully updated prompt requirements');
}

// 5. Update prompt JSON schema to include theory_qa
const oldSchemaPart = `"theory": "Comprehensive theory overview synthesizing the topic",
  "questions": [`;

const newSchemaPart = `"theory": "Comprehensive theory overview synthesizing the topic",
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
  "questions": [`;

if (content.includes(oldSchemaPart)) {
  content = content.replace(oldSchemaPart, newSchemaPart);
  console.log('Successfully updated schema to include theory_qa');
}

fs.writeFileSync(viteConfigPath, content, 'utf8');
console.log('vite.config.ts update finished successfully!');
