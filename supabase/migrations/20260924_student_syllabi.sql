-- ==============================================================================
-- GURUMITRA ADAPTIVE AI LEARNING COMPANION — STUDENT SYLLABI METADATA
-- ==============================================================================

create table if not exists public.student_syllabi (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references auth.users(id) on delete cascade not null,
  class_level text not null,
  subject text not null,
  file_name text not null,
  file_path text,
  file_url text,
  processing_status text not null default 'uploaded' check (processing_status in ('uploaded', 'processing', 'processed', 'failed')),
  extracted_data jsonb default '{}'::jsonb,
  uploaded_at timestamp with time zone default timezone('utc'::text, now()) not null,
  extracted_at timestamp with time zone,
  constraint unique_student_class_subject unique(student_id, class_level, subject)
);

alter table public.student_syllabi enable row level security;

create policy "Students can view their own syllabi"
  on public.student_syllabi for select
  using (auth.uid() = student_id);

create policy "Students can insert their own syllabi"
  on public.student_syllabi for insert
  with check (auth.uid() = student_id);

create policy "Students can update their own syllabi"
  on public.student_syllabi for update
  using (auth.uid() = student_id);

create policy "Students can delete their own syllabi"
  on public.student_syllabi for delete
  using (auth.uid() = student_id);
