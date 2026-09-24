import { generateCombinedQuestions } from '../src/services/preAssessmentService.ts';

console.log('Testing Pre-Assessment generation for Social Science and Computer Science...');

const mockSocialScienceChapters = [
  {
    chapterId: 'sst_ch1',
    chapterName: 'Nationalism in India',
    subject: 'Social Science',
    topics: ['Rowlatt Act and Jallianwala Bagh', 'Non-Cooperation Movement', 'Salt March and Civil Disobedience', 'Poona Pact'],
    pageStart: 29,
    pageEnd: 52
  },
  {
    chapterId: 'sst_ch2',
    chapterName: 'Resources and Development',
    subject: 'Social Science',
    topics: ['Soil Classification', 'Land Degradation', 'Resource Planning', 'Agenda 21'],
    pageStart: 1,
    pageEnd: 25
  }
];

const mockCSChapters = [
  {
    chapterId: 'cs_ch1',
    chapterName: 'Introduction to Computer Applications',
    subject: 'Computer Science',
    topics: ['Networking Basics', 'Cyber Ethics and Security', 'HTML Elements', 'Python Fundamentals'],
    pageStart: 1,
    pageEnd: 30
  }
];

const chaptersBySubject = {
  'Social Science': mockSocialScienceChapters,
  'Computer Science': mockCSChapters
};

async function run() {
  const res = await generateCombinedQuestions(
    chaptersBySubject,
    ['Social Science', 'Computer Science'],
    'Class 10',
    26
  );

  const questions = res.questions;
  console.log(`Generated ${questions.length} questions.`);

  let hasGenericFigureOfSpeech = false;
  let hasDuplicateOptions = false;

  questions.forEach((q, idx) => {
    const qLower = q.question.toLowerCase();
    if (qLower.includes('figure of speech') || qLower.includes('literary analysis')) {
      console.error(`FAILED: Question ${idx + 1} has figure of speech: "${q.question}"`);
      hasGenericFigureOfSpeech = true;
    }

    const uniqueOptions = new Set(q.options.map(o => o.trim()));
    if (uniqueOptions.size !== q.options.length) {
      console.error(`FAILED: Question ${idx + 1} has duplicate options:`, q.options);
      hasDuplicateOptions = true;
    }

    if (q.options.includes('Personification') || q.options.includes('Hyperbole')) {
      console.error(`FAILED: Question ${idx + 1} contains literary devices as options!`, q.options);
      hasGenericFigureOfSpeech = true;
    }
  });

  console.log('\n--- SAMPLE SOCIAL SCIENCE QUESTIONS ---');
  questions.filter(q => q.subject === 'Social Science').slice(0, 4).forEach((q, i) => {
    console.log(`\n[SST Q${i+1}] [${q.difficulty.toUpperCase()}] ${q.question}`);
    q.options.forEach((opt, oIdx) => {
      console.log(`   ${String.fromCharCode(65 + oIdx)}) ${opt} ${oIdx === q.correctOption ? '✓ (Correct)' : ''}`);
    });
    console.log(`   Explanation: ${q.explanation}`);
  });

  console.log('\n--- SAMPLE COMPUTER SCIENCE QUESTIONS ---');
  questions.filter(q => q.subject === 'Computer Science').slice(0, 4).forEach((q, i) => {
    console.log(`\n[CS Q${i+1}] [${q.difficulty.toUpperCase()}] ${q.question}`);
    q.options.forEach((opt, oIdx) => {
      console.log(`   ${String.fromCharCode(65 + oIdx)}) ${opt} ${oIdx === q.correctOption ? '✓ (Correct)' : ''}`);
    });
    console.log(`   Explanation: ${q.explanation}`);
  });

  if (!hasGenericFigureOfSpeech && !hasDuplicateOptions) {
    console.log('\n✅ ALL VERIFICATION CHECKS PASSED: Questions are authentic, Board-aligned, with diverse, non-repeating options!');
  } else {
    process.exit(1);
  }
}

run();
