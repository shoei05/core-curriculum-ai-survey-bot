-- 05. DBスキーマ拡張: 2段階調査システム（フォーム回答）

-- フォーム回答保存テーブル
create table if not exists form_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,

  -- 共通属性
  respondent_type text not null check (respondent_type in ('faculty', 'staff', 'student')),
  university_type text check (university_type in ('national', 'public', 'private')),

  -- 教員向け
  specialty text check (specialty in ('basic', 'clinical', 'social', 'education', 'other')),
  experience_years text check (experience_years in ('under_5', '5_10', 'over_10')),

  -- 学生向け
  student_year text check (student_year in ('1_2', '3_4', '5_6')),

  -- 課題認識（最大3つ）
  challenges jsonb default '[]'::jsonb check (jsonb_array_length(challenges) <= 3),

  -- 次期改定への期待（最大3つ）
  expectations jsonb default '[]'::jsonb check (jsonb_array_length(expectations) <= 3),

  -- その他自由記述
  challenge_other text,
  expectation_other text,

  created_at timestamptz not null default now()
);

-- 選択肢マスターテーブル
create table if not exists master_options (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  code text not null,
  label_ja text not null,
  target_respondent text default 'all' check (target_respondent in ('all', 'faculty', 'staff', 'student')),
  sort_order int default 0,
  is_active boolean default true,
  unique(category, code)
);

-- 課題認識選択肢の初期データ
insert into master_options (category, code, label_ja, sort_order) values
  -- 課題認識
  ('challenges', 'content_overload', '学修内容が多すぎる', 1),
  ('challenges', 'lack_practice_time', '実習時間が足りない', 2),
  ('challenges', 'lack_educators', '教員・指導者が足りない', 3),
  ('challenges', 'outdated_materials', '教材・設備が古い', 4),
  ('challenges', 'evaluation_issues', '評価方法に課題がある', 5),
  ('challenges', 'lack_ai_education', 'AI/デジタル教育が不十分', 6),
  ('challenges', 'other', 'その他', 99)
on conflict (category, code) do nothing;

-- 次期改定への期待選択肢の初期データ
insert into master_options (category, code, label_ja, sort_order) values
  ('expectations', 'goal_reduction', '学修目標の精選・削減', 1),
  ('expectations', 'clinical_enhancement', '臨床実習の充実', 2),
  ('expectations', 'ai_digital', 'AI/デジタル教育の充実', 3),
  ('expectations', 'research_mind', '研究マインドの涵養', 4),
  ('expectations', 'evaluation_improvement', '評価方法の改善', 5),
  ('expectations', 'interprofessional', '多職種連携教育の充実', 6),
  ('expectations', 'other', 'その他', 99)
on conflict (category, code) do nothing;

-- 教員専門分野選択肢の初期データ
insert into master_options (category, code, label_ja, sort_order) values
  ('specialty', 'basic', '基礎系', 1),
  ('specialty', 'clinical', '臨床系', 2),
  ('specialty', 'social', '社会医学系', 3),
  ('specialty', 'education', '教育専任', 4),
  ('specialty', 'other', 'その他', 99)
on conflict (category, code) do nothing;

-- インデックス作成
create index if not exists idx_form_responses_session_id on form_responses(session_id);
create index if not exists idx_form_responses_respondent_type on form_responses(respondent_type);
create index if not exists idx_master_options_category on master_options(category) where is_active = true;
