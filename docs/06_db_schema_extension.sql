-- core-curriculum-ai-survey-bot
-- participant-first analysis migration
-- 2026-04-08

begin;

alter table if exists form_responses
  add column if not exists consent_given boolean,
  add column if not exists consent_version text,
  add column if not exists consented_at timestamptz,
  add column if not exists additional_roles text[] default '{}'::text[],
  add column if not exists practitioner_profession text,
  add column if not exists staff_role text;

create index if not exists idx_form_responses_additional_roles_gin
  on form_responses using gin (additional_roles);

create index if not exists idx_form_responses_consented_at
  on form_responses (consented_at);

update form_responses
set
  consent_given = coalesce(consent_given, true),
  consent_version = coalesce(consent_version, 'legacy-no-version'),
  consented_at = coalesce(consented_at, created_at)
where consent_given is null
   or consent_version is null
   or consented_at is null;

alter table if exists form_responses
  drop constraint if exists form_responses_university_type_check;

alter table if exists form_responses
  add constraint form_responses_university_type_check
  check (
    university_type is null or university_type in (
      'national',
      'public',
      'private',
      'university',
      'university_hospital',
      'public_hospital',
      'private_hospital',
      'clinic',
      'government',
      'other'
    )
  );

alter table if exists survey_logs
  add column if not exists conversation_summary_bullets jsonb not null default '[]'::jsonb,
  add column if not exists conversation_topic_groups jsonb not null default '[]'::jsonb,
  add column if not exists participant_messages jsonb not null default '[]'::jsonb,
  add column if not exists participant_in_vivo_codes jsonb not null default '[]'::jsonb,
  add column if not exists participant_issue_categories jsonb not null default '[]'::jsonb,
  add column if not exists participant_competency_categories jsonb not null default '[]'::jsonb,
  add column if not exists participant_core_items jsonb not null default '[]'::jsonb,
  add column if not exists coding_sensitivity_topic_groups jsonb not null default '[]'::jsonb,
  add column if not exists assistant_probe_tags jsonb not null default '[]'::jsonb,
  add column if not exists summary_scope text default 'conversation_all',
  add column if not exists coding_scope text default 'participant_only',
  add column if not exists coding_method text default 'in_vivo',
  add column if not exists analysis_version text default '2026-04-08';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'survey_logs_summary_scope_check_v2'
  ) then
    alter table survey_logs
      add constraint survey_logs_summary_scope_check_v2
      check (summary_scope in ('conversation_all', 'participant_only'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'survey_logs_coding_scope_check_v2'
  ) then
    alter table survey_logs
      add constraint survey_logs_coding_scope_check_v2
      check (coding_scope in ('participant_only', 'conversation_all'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'survey_logs_coding_method_check_v2'
  ) then
    alter table survey_logs
      add constraint survey_logs_coding_method_check_v2
      check (coding_method in ('in_vivo', 'topic'));
  end if;
end $$;

create index if not exists idx_survey_logs_summary_scope on survey_logs (summary_scope);
create index if not exists idx_survey_logs_coding_scope on survey_logs (coding_scope);
create index if not exists idx_survey_logs_analysis_version on survey_logs (analysis_version);

update survey_logs
set
  conversation_summary_bullets = case
    when jsonb_array_length(conversation_summary_bullets) = 0 and summary_bullets is not null then summary_bullets
    else conversation_summary_bullets
  end,
  conversation_topic_groups = case
    when jsonb_array_length(conversation_topic_groups) = 0 and keyword_groups is not null then keyword_groups
    else conversation_topic_groups
  end,
  participant_issue_categories = case
    when jsonb_array_length(participant_issue_categories) = 0 and issue_categories is not null then issue_categories
    else participant_issue_categories
  end,
  participant_competency_categories = case
    when jsonb_array_length(participant_competency_categories) = 0 and competency_categories is not null then competency_categories
    else participant_competency_categories
  end,
  participant_core_items = case
    when jsonb_array_length(participant_core_items) = 0 and core_items is not null then core_items
    else participant_core_items
  end;

update survey_logs
set participant_messages = coalesce(
  (
    select jsonb_agg(elem)
    from jsonb_array_elements(coalesce(messages, '[]'::jsonb)) elem
    where elem->>'role' = 'user'
  ),
  '[]'::jsonb
)
where participant_messages = '[]'::jsonb
  and messages is not null;

create or replace view survey_analysis_v2 as
select
  fr.id as response_id,
  fr.session_id,
  fr.respondent_type,
  fr.additional_roles,
  fr.university_type,
  fr.specialty,
  fr.experience_years,
  fr.student_year,
  fr.practitioner_profession,
  fr.staff_role,
  fr.challenges,
  fr.expectations,
  fr.challenge_other,
  fr.expectation_other,
  fr.consent_given,
  fr.consent_version,
  fr.consented_at,
  sl.id as survey_log_id,
  sl.created_at as interview_created_at,
  sl.conversation_summary_bullets,
  sl.conversation_topic_groups,
  sl.participant_in_vivo_codes,
  sl.participant_issue_categories,
  sl.participant_competency_categories,
  sl.participant_core_items,
  sl.coding_sensitivity_topic_groups,
  sl.summary_scope,
  sl.coding_scope,
  sl.coding_method,
  sl.analysis_version
from form_responses fr
left join survey_logs sl on sl.form_response_id = fr.id;

commit;
