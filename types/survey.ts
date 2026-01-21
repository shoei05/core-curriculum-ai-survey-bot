// コアカリ改定調査システム 型定義

// 回答者タイプ
export type RespondentType = 'faculty' | 'staff' | 'student';

// 大学設置形態
export type UniversityType = 'national' | 'public' | 'private';

// 教員専門分野
export type Specialty = 'basic' | 'clinical' | 'social' | 'education' | 'other';

// 教育経験年数
export type ExperienceYears = 'under_5' | '5_10' | 'over_10';

// 学生学年
export type StudentYear = '1_2' | '3_4' | '5_6';

// 課題認識選択肢
export type ChallengeCode =
  | 'content_overload'
  | 'lack_practice_time'
  | 'lack_educators'
  | 'outdated_materials'
  | 'evaluation_issues'
  | 'lack_ai_education'
  | 'other';

// 次期改定への期待選択肢
export type ExpectationCode =
  | 'goal_reduction'
  | 'clinical_enhancement'
  | 'ai_digital'
  | 'research_mind'
  | 'evaluation_improvement'
  | 'interprofessional'
  | 'other';

// マスターオプション
export interface MasterOption {
  id: string;
  category: string;
  code: string;
  label_ja: string;
  target_respondent: 'all' | RespondentType;
  sort_order: number;
  is_active: boolean;
}

// フォーム回答
export interface FormResponse {
  id?: string;
  session_id?: string;

  // 共通属性
  respondent_type: RespondentType;
  university_type?: UniversityType;

  // 教員向け
  specialty?: Specialty;
  experience_years?: ExperienceYears;

  // 学生向け
  student_year?: StudentYear;

  // 課題認識（最大3つ）
  challenges: ChallengeCode[];

  // 次期改定への期待（最大3つ）
  expectations: ExpectationCode[];

  // その他の自由記述
  challenge_other?: string;
  expectation_other?: string;
}

// チャットメッセージ
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

// 次期改定要望
export interface RevisionRequest {
  category: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
}

// インタビューログ（拡張版）
export interface SurveyLog {
  id?: string;
  session_id?: string;
  form_response_id?: string;
  respondent_type?: RespondentType;

  messages: ChatMessage[];
  summary_bullets: string[];
  revision_requests: RevisionRequest[];
  keyword_groups: Record<string, unknown>;
  issue_categories?: Array<{ category: string; items: string[] }>;
  competency_categories?: Array<{ category: string; items: string[] }>;
  core_items?: string[];

  created_at?: string;
  completed_at?: string;
}

// フォームステップ
export type FormStep = 'attributes' | 'challenges' | 'expectations' | 'confirm';

// マルチステップフォームの状態
export interface FormState {
  step: FormStep;
  data: Partial<FormResponse>;
}

// APIレスポンス
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// チャットAPIリクエスト
export interface ChatRequest {
  sessionId: string;
  formResponseId: string;
  messages: ChatMessage[];
  respondentType: RespondentType;
}

// チャットAPIレスポンス
export interface ChatResponse {
  message: string;
  summary?: string;
  isComplete?: boolean;
}

// 選択肢マスターラベル
export const CHALLENGE_LABELS: Record<ChallengeCode, string> = {
  content_overload: '学修内容が多すぎる',
  lack_practice_time: '実習時間が足りない',
  lack_educators: '教員・指導者が足りない',
  outdated_materials: '教材・設備が古い',
  evaluation_issues: '評価方法に課題がある',
  lack_ai_education: 'AI/デジタル教育が不十分',
  other: 'その他',
};

export const EXPECTATION_LABELS: Record<ExpectationCode, string> = {
  goal_reduction: '学修目標の精選・削減',
  clinical_enhancement: '臨床実習の充実',
  ai_digital: 'AI/デジタル教育の充実',
  research_mind: '研究マインドの涵養',
  evaluation_improvement: '評価方法の改善',
  interprofessional: '多職種連携教育の充実',
  other: 'その他',
};

export const RESPONDENT_TYPE_LABELS: Record<RespondentType, string> = {
  faculty: '教員',
  staff: '事務職員',
  student: '学生',
};

export const UNIVERSITY_TYPE_LABELS: Record<UniversityType, string> = {
  national: '国立',
  public: '公立',
  private: '私立',
};

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  basic: '基礎系',
  clinical: '臨床系',
  social: '社会医学系',
  education: '教育専任',
  other: 'その他',
};

export const EXPERIENCE_YEARS_LABELS: Record<ExperienceYears, string> = {
  under_5: '5年未満',
  '5_10': '5-10年',
  over_10: '10年以上',
};

export const STUDENT_YEAR_LABELS: Record<StudentYear, string> = {
  '1_2': '1-2年',
  '3_4': '3-4年',
  '5_6': '5-6年（臨床実習中）',
};
