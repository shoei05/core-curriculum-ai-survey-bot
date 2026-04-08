-- 05. DB schema: form_responses (participant-first)

create table if not exists form_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,

  respondent_type text not null check (respondent_type in ('faculty', 'staff', 'student', 'practitioner')),
  additional_roles text[] not null default '{}'::text[],
  university_type text check (
    university_type in (
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
  ),

  specialty text check (specialty in ('basic', 'clinical', 'social', 'education', 'other')),
  experience_years text check (experience_years in ('under_5', '5_10', 'over_10')),
  student_year text check (student_year in ('1_2', '3_4', '5_6')),
  practitioner_profession text,
  staff_role text,

  challenges jsonb not null default '[]'::jsonb check (jsonb_array_length(challenges) between 1 and 3),
  expectations jsonb not null default '[]'::jsonb check (jsonb_array_length(expectations) between 1 and 3),
  challenge_other text,
  expectation_other text,

  consent_given boolean not null,
  consent_version text not null,
  consented_at timestamptz not null,

  created_at timestamptz not null default now()
);

create index if not exists idx_form_responses_created_at on form_responses(created_at desc);
create index if not exists idx_form_responses_respondent_type on form_responses(respondent_type);
create index if not exists idx_form_responses_additional_roles_gin on form_responses using gin (additional_roles);
create index if not exists idx_form_responses_consented_at on form_responses(consented_at);
