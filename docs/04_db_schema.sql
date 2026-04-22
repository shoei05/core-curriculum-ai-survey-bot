-- 04. DBスキーマ（Supabase/Postgres想定）

create table if not exists interview_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  system_prompt text not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);
alter table interview_templates enable row level security;

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references interview_templates(id) on delete cascade,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
alter table sessions enable row level security;

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
alter table messages enable row level security;

-- 追加: サマリー + キーワード + 会話ログの保存（Supabase推奨）
create table if not exists survey_logs (
  id uuid primary key default gen_random_uuid(),
  template_slug text,
  started_at timestamptz,
  ended_at timestamptz,
  messages jsonb not null default '[]'::jsonb,
  summary_bullets jsonb not null default '[]'::jsonb,
  keyword_groups jsonb not null default '[]'::jsonb,
  issue_categories jsonb not null default '[]'::jsonb,
  competency_categories jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table survey_logs enable row level security;

-- This app writes through server-side API routes using the service_role key.
-- Do not add anon/authenticated table policies unless direct browser access is
-- intentionally introduced and scoped with strict row ownership checks.
