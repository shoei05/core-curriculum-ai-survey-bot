-- 06. DBスキーマ拡張: survey_logsの拡張

-- survey_logsにカラム追加
alter table survey_logs add column if not exists form_response_id uuid references form_responses(id);
alter table survey_logs add column if not exists respondent_type text check (respondent_type in ('faculty', 'staff', 'student'));
alter table survey_logs add column if not exists revision_requests jsonb default '[]'::jsonb;

-- 分析用ビュー（回答者タイプ別）
create or replace view survey_analysis as
select
  fr.id as response_id,
  fr.respondent_type,
  fr.university_type,
  fr.specialty,
  fr.experience_years,
  fr.student_year,
  fr.challenges,
  fr.expectations,
  sl.summary_bullets,
  sl.revision_requests,
  sl.keyword_groups,
  fr.created_at as form_created_at,
  sl.created_at as interview_created_at
from form_responses fr
left join survey_logs sl on sl.form_response_id = fr.id;

-- インデックス作成
create index if not exists idx_survey_logs_form_response_id on survey_logs(form_response_id);
create index if not exists idx_survey_logs_respondent_type on survey_logs(respondent_type);
