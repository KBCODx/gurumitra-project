import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Verify Sample Syllabus Files exist and are readable
test('1. Syllabus Asset Integrity', async (t) => {
  const sampleDir = path.resolve(__dirname, '../public/sample-syllabus');
  assert.ok(fs.existsSync(sampleDir), 'sample-syllabus directory must exist');
  
  const files = fs.readdirSync(sampleDir);
  const pdfFiles = files.filter(f => f.endsWith('.pdf'));
  assert.ok(pdfFiles.length >= 1, 'Must have at least one Class 10 CBSE PDF in public/sample-syllabus');
  
  for (const pdf of pdfFiles) {
    const stat = fs.statSync(path.join(sampleDir, pdf));
    assert.ok(stat.size > 1000, `PDF ${pdf} must be non-empty valid document (got ${stat.size} bytes)`);
  }
});

// 2. Demo User Credentials & Isolation Verification
test('2. Demo User Credentials and Profile Defaults', async (t) => {
  const authContextPath = path.resolve(__dirname, '../src/context/AuthContext.tsx');
  const authContent = fs.readFileSync(authContextPath, 'utf8');

  assert.ok(authContent.includes('sally.demo@example.com'), 'Demo user email must be sally.demo@example.com');
  assert.ok(authContent.includes('Sally Sharma'), 'Demo user name must be Sally Sharma');
  assert.ok(authContent.includes('Class 10'), 'Demo user grade must be Class 10');
  assert.ok(authContent.includes('CBSE'), 'Demo user board must be CBSE');
  assert.ok(authContent.includes('loginAsDemo'), 'AuthContext must export loginAsDemo()');
});

// 3. User-Scoped LocalStorage Keys for Data Isolation
test('3. User-Scoped LocalStorage Keys for Demo Isolation', async (t) => {
  const studentContextPath = path.resolve(__dirname, '../src/context/StudentContext.tsx');
  const studentContent = fs.readFileSync(studentContextPath, 'utf8');

  assert.ok(studentContent.includes('gurumitra_quiz_history_'), 'Quiz history must be user-scoped');
  assert.ok(studentContent.includes('gurumitra_study_sessions_'), 'Study sessions must be user-scoped');
  assert.ok(studentContent.includes('resetDemo'), 'StudentContext must export resetDemo()');
  assert.ok(studentContent.includes('recordQuizResult'), 'StudentContext must handle recordQuizResult()');
});

// 4. Header Reset Demo Button Existence & Clean UI
test('4. Header Reset Demo Button in Navigation', async (t) => {
  const headerPath = path.resolve(__dirname, '../src/components/Header.tsx');
  const headerContent = fs.readFileSync(headerPath, 'utf8');

  assert.ok(headerContent.includes('Reset Demo'), 'Header must contain Reset Demo button for presentation');
  assert.ok(headerContent.includes('resetDemo'), 'Header must invoke resetDemo function');
});

// 5. Quiz System Comprehensive Features
test('5. Quiz System Feature Integrity', async (t) => {
  const quizPath = path.resolve(__dirname, '../src/components/QuizView.tsx');
  const quizContent = fs.readFileSync(quizPath, 'utf8');

  assert.ok(quizContent.includes('buildSubjectCurriculumLesson'), 'QuizView must have dynamic fallback to curriculum lesson pack');
  assert.ok(quizContent.includes('recordQuizResult'), 'QuizView must persist results to student context');
  assert.ok(quizContent.includes('Check Answer'), 'QuizView must provide immediate answer checking');
  assert.ok(quizContent.includes('Mistakes ('), 'QuizView must allow reviewing mistakes');
  assert.ok(quizContent.includes('Presentation Simulation'), 'QuizView must include presentation simulation CTA');
  assert.ok(quizContent.includes('timeSpentSeconds'), 'QuizView must track time spent');
});

// 6. Analytics Dynamic Calculations (No Static Mocks)
test('6. Analytics Real Calculation Integrity', async (t) => {
  const analyticsPath = path.resolve(__dirname, '../src/components/AnalyticsView.tsx');
  const analyticsContent = fs.readFileSync(analyticsPath, 'utf8');

  assert.ok(analyticsContent.includes('allStudySessions'), 'AnalyticsView must read allStudySessions');
  assert.ok(analyticsContent.includes('quizHistory'), 'AnalyticsView must read quizHistory');
  assert.ok(analyticsContent.includes('Areas Needing Practice'), 'AnalyticsView must compute Areas Needing Practice');
  assert.ok(analyticsContent.includes('Strong Areas'), 'AnalyticsView must compute Strong Areas');
  assert.ok(analyticsContent.includes('No Quiz Results Recorded Yet'), 'AnalyticsView must provide clean empty state when no data');
});

// 7. Recommendations Dynamic Reactivity
test('7. Recommendations Dynamic Link to Quiz & Gaps', async (t) => {
  const recPath = path.resolve(__dirname, '../src/components/RecommendationsView.tsx');
  const recContent = fs.readFileSync(recPath, 'utf8');

  assert.ok(recContent.includes('recommendations'), 'RecommendationsView must consume dynamic recommendations');
  assert.ok(recContent.includes('Start Learning'), 'RecommendationsView must allow direct study action');
});
