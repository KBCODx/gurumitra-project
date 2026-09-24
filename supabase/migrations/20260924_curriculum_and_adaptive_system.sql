-- ==============================================================================
-- GURUMITRA ADAPTIVE AI LEARNING COMPANION — CURRICULUM & ADAPTIVE SCHEMA
-- ==============================================================================

-- 1. Curriculum Versions (Authoritative source tracking across academic years)
create table if not exists public.curriculum_versions (
  id uuid default gen_random_uuid() primary key,
  board text not null check (board in ('CBSE', 'ICSE', 'NCERT', 'UP Board', 'Other')),
  class_level text not null,
  academic_year text not null, -- e.g. '2026-27', '2025-26'
  source_name text not null,  -- e.g. 'CBSE Academic Official Curriculum'
  source_url text not null,   -- official portal URL
  version text not null default '1.0',
  is_active boolean not null default true,
  last_verified_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_board_class_year_ver unique(board, class_level, academic_year, version)
);

-- 2. Curriculum Subjects
create table if not exists public.curriculum_subjects (
  id uuid default gen_random_uuid() primary key,
  curriculum_version_id uuid references public.curriculum_versions(id) on delete cascade not null,
  name text not null,
  code text,
  icon text,
  color text,
  display_order integer default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Curriculum Chapters
create table if not exists public.curriculum_chapters (
  id uuid default gen_random_uuid() primary key,
  subject_id uuid references public.curriculum_subjects(id) on delete cascade not null,
  name text not null,
  chapter_number integer not null,
  description text,
  display_order integer default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Curriculum Topics
create table if not exists public.curriculum_topics (
  id uuid default gen_random_uuid() primary key,
  chapter_id uuid references public.curriculum_chapters(id) on delete cascade not null,
  name text not null,
  display_order integer default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Curriculum Subtopics
create table if not exists public.curriculum_subtopics (
  id uuid default gen_random_uuid() primary key,
  topic_id uuid references public.curriculum_topics(id) on delete cascade not null,
  name text not null,
  display_order integer default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Student Personalized Learning Plans (Stores exact curriculum_version_id used)
create table if not exists public.student_learning_plans (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references auth.users(id) on delete cascade not null,
  curriculum_version_id uuid references public.curriculum_versions(id),
  academic_year text not null default '2026-27',
  class_level text not null,
  board text not null,
  exam_date date not null,
  target_completion_date date not null,
  days_available integer not null,
  has_buffer_conflict boolean not null default false,
  selected_subjects text[] not null,
  selected_chapters jsonb not null default '{}'::jsonb,
  daily_plans jsonb not null default '[]'::jsonb,
  performance_snapshot jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Student Topic Performance History
create table if not exists public.student_topic_performance (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references auth.users(id) on delete cascade not null,
  subject text not null,
  chapter text not null,
  topic text not null,
  score_percentage integer not null check (score_percentage between 0 and 100),
  mastery_status text not null check (mastery_status in ('Needs Significant Improvement', 'Needs Improvement', 'Developing', 'Strong', 'Mastered')),
  total_questions integer default 0,
  correct_questions integer default 0,
  last_assessed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_student_subject_topic unique(student_id, subject, topic)
);

-- 8. Weekly Tests & Continuous Assessment Records
create table if not exists public.weekly_tests (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references auth.users(id) on delete cascade not null,
  week_number integer not null,
  subject text not null,
  score integer not null,
  total_questions integer not null,
  percentage integer not null,
  weak_topics text[] default array[]::text[],
  strong_topics text[] default array[]::text[],
  questions_data jsonb default '[]'::jsonb,
  student_answers jsonb default '{}'::jsonb,
  adapted_plan_generated boolean default false,
  completed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS across all new tables
alter table public.curriculum_versions enable row level security;
alter table public.curriculum_subjects enable row level security;
alter table public.curriculum_chapters enable row level security;
alter table public.curriculum_topics enable row level security;
alter table public.curriculum_subtopics enable row level security;
alter table public.student_learning_plans enable row level security;
alter table public.student_topic_performance enable row level security;
alter table public.weekly_tests enable row level security;

-- Public read access for curriculum tables
create policy "Allow public read on curriculum_versions" on public.curriculum_versions for select using (true);
create policy "Allow public read on curriculum_subjects" on public.curriculum_subjects for select using (true);
create policy "Allow public read on curriculum_chapters" on public.curriculum_chapters for select using (true);
create policy "Allow public read on curriculum_topics" on public.curriculum_topics for select using (true);
create policy "Allow public read on curriculum_subtopics" on public.curriculum_subtopics for select using (true);

-- Student-specific policies for personal learning data
create policy "Students view own learning plans" on public.student_learning_plans for select using (auth.uid() = student_id);
create policy "Students insert own learning plans" on public.student_learning_plans for insert with check (auth.uid() = student_id);
create policy "Students update own learning plans" on public.student_learning_plans for update using (auth.uid() = student_id);

create policy "Students view own topic performance" on public.student_topic_performance for select using (auth.uid() = student_id);
create policy "Students manage own topic performance" on public.student_topic_performance for all using (auth.uid() = student_id);

create policy "Students view own weekly tests" on public.weekly_tests for select using (auth.uid() = student_id);
create policy "Students insert own weekly tests" on public.weekly_tests for insert with check (auth.uid() = student_id);
