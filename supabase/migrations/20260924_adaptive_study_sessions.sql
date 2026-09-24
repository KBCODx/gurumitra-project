-- ==============================================================================
-- GURUMITRA ADAPTIVE AI LEARNING COMPANION — ADAPTIVE STUDY SESSIONS & LESSONS
-- ==============================================================================

-- 1. Generated Lessons (Cache AI-generated lesson content to prevent redundant calls)
create table if not exists public.generated_lessons (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references auth.users(id) on delete cascade,
  subject text not null,
  chapter text not null,
  topic text not null,
  student_level text not null check (student_level in ('Weak', 'Average', 'Strong')),
  difficulty_level text not null,
  content_json jsonb not null,
  source text not null default 'ai_generated',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for quick lesson lookup
create index if not exists idx_generated_lessons_lookup 
  on public.generated_lessons(subject, chapter, topic, student_level);

-- 2. Study Sessions (Records actual time, completion, and student performance metrics)
create table if not exists public.study_sessions (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references auth.users(id) on delete cascade not null,
  task_id text,
  date date not null,
  subject text not null,
  chapter text not null,
  topic text not null,
  allocated_minutes integer not null,
  actual_minutes integer not null default 0,
  started_at timestamp with time zone not null default timezone('utc'::text, now()),
  completed_at timestamp with time zone,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  theory_completed boolean not null default false,
  questions_attempted integer not null default 0,
  questions_correct integer not null default 0,
  practice_attempted integer not null default 0,
  practice_correct integer not null default 0,
  difficulty_level text not null default 'Intermediate',
  topic_understanding text check (topic_understanding in ('Strong', 'Developing', 'Needs Revision')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for session queries
create index if not exists idx_study_sessions_student 
  on public.study_sessions(student_id, date, subject);

-- 3. Question Attempts (Granular tracking of student answers to theory & practice items)
create table if not exists public.question_attempts (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.study_sessions(id) on delete cascade,
  student_id uuid references auth.users(id) on delete cascade not null,
  question_id text not null,
  type text not null check (type in ('theory', 'practice')),
  subject text not null,
  chapter text not null,
  topic text not null,
  difficulty text not null check (difficulty in ('easy', 'moderate', 'hard')),
  selected_option integer not null,
  is_correct boolean not null,
  time_spent_seconds integer default 0,
  attempted_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.generated_lessons enable row level security;
alter table public.study_sessions enable row level security;
alter table public.question_attempts enable row level security;

-- Policies for generated_lessons
create policy "Students view own or shared generated lessons" on public.generated_lessons
  for select using (student_id is null or auth.uid() = student_id);

create policy "Students insert generated lessons" on public.generated_lessons
  for insert with check (student_id is null or auth.uid() = student_id);

create policy "Students update own generated lessons" on public.generated_lessons
  for update using (student_id is null or auth.uid() = student_id);

-- Policies for study_sessions
create policy "Students view own study sessions" on public.study_sessions
  for select using (auth.uid() = student_id);

create policy "Students insert own study sessions" on public.study_sessions
  for insert with check (auth.uid() = student_id);

create policy "Students update own study sessions" on public.study_sessions
  for update using (auth.uid() = student_id);

-- Policies for question_attempts
create policy "Students view own question attempts" on public.question_attempts
  for select using (auth.uid() = student_id);

create policy "Students insert own question attempts" on public.question_attempts
  for insert with check (auth.uid() = student_id);
