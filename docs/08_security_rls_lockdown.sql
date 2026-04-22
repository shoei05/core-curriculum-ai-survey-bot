-- 08. Security lockdown for Supabase public API exposure
-- Apply this to the Supabase project after the schema migrations.
--
-- The Next.js app reads/writes these tables only from server-side API routes
-- using SUPABASE_SERVICE_ROLE_KEY. Therefore, browser clients should not have
-- direct table or view access through the anon/authenticated Supabase API roles.

begin;

alter table if exists public.interview_templates enable row level security;
alter table if exists public.sessions enable row level security;
alter table if exists public.messages enable row level security;
alter table if exists public.survey_logs enable row level security;
alter table if exists public.form_responses enable row level security;
alter table if exists public.master_options enable row level security;

-- Close any previously documented permissive policy.
do $$
begin
  if to_regclass('public.survey_logs') is not null then
    execute 'drop policy if exists "allow insert survey logs" on public.survey_logs';
  end if;
end $$;

-- RLS blocks table access, and revoking table privileges adds a second guard.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'interview_templates',
    'sessions',
    'messages',
    'survey_logs',
    'form_responses',
    'master_options'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', table_name);
    end if;
  end loop;
end $$;

-- Views can otherwise expose sensitive base-table data through the API.
do $$
begin
  if to_regclass('public.survey_analysis_v2') is not null then
    execute 'alter view public.survey_analysis_v2 set (security_invoker = true)';
    execute 'revoke all on table public.survey_analysis_v2 from anon, authenticated';
  end if;
end $$;

commit;
