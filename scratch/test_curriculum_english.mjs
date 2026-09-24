import { buildSubjectCurriculumLesson } from '../src/services/curriculumKnowledgePacks.ts';

const englishLesson = buildSubjectCurriculumLesson({
  classLevel: '10th',
  board: 'CBSE',
  subject: 'English',
  chapter: 'Tenses',
  topic: 'Continuous',
  studentLevel: 'Average',
  allocatedMinutes: 45
});

console.log('--- ENGLISH LESSON CHECK ---');
console.log('Subject:', englishLesson.subject);
console.log('Chapter:', englishLesson.chapter);
console.log('Topic:', englishLesson.topic);
console.log('Subtopics count:', englishLesson.subtopics.length);
console.log('Subtopic 1:', englishLesson.subtopics[0].title);
console.log('Subtopic 2 Rule:', englishLesson.subtopics[1].formulaOrRule);
console.log('Theory QA count:', englishLesson.theory_qa?.length);
console.log('Theory QA 1 Question:', englishLesson.theory_qa?.[0]?.question);
console.log('Theory QA 1 Answer:', englishLesson.theory_qa?.[0]?.theoreticalAnswer?.slice(0, 100) + '...');
console.log('Summary count:', englishLesson.summary?.length);
console.log('Quiz questions count:', englishLesson.questions?.length);
console.log('Quiz Q1:', englishLesson.questions?.[0]?.question);
console.log('Quiz Q1 options:', englishLesson.questions?.[0]?.options);

// Verify no physics / math keywords leaked into English
const text = JSON.stringify(englishLesson);
const forbidden = ['converting cm to m', 'conservation laws', 'quadratic', 'discriminant', 'ax²'];
const foundForbidden = forbidden.filter(f => text.includes(f));
if (foundForbidden.length > 0) {
  console.error('FAILED: Found forbidden placeholders in English lesson:', foundForbidden);
  process.exit(1);
} else {
  console.log('PASSED: Zero science/math placeholders found in English lesson!');
}
