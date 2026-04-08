// コアカリ改定調査システム 型定義

// 回答者タイプ
export type RespondentType = "faculty" | "staff" | "student" | "practitioner";

// 大学設置形態
export type UniversityType = "national" | "public" | "private";

// 教員専門分野
export type Specialty = "basic" | "clinical" | "social" | "education" | "other";

// 教育経験年数
export type ExperienceYears = "under_5" | "5_10" | "over_10";

// 学生学年
export type StudentYear = "1_2" | "3_4" | "5_6";

export type SummaryScope = "conversation_all" | "participant_only";
export type CodingScope = "participant_only" | "conversation_all";
export type CodingMethod = "in_vivo" | "topic";

export const CONSENT_VERSION = "2026-04-08";

// 課題認識選択肢（2026年次期改定調査向け）
export type ChallengeCode =
  | "content_overload"
  | "lack_practice_time"
  | "lack_educators"
  | "evaluation_issues"
  | "lack_genai_education"
  | "clinical_quality_variance"
  | "priority_unclear"
  | "integration_insufficient"
  | "local_adaptation_difficult"
  | "exam_alignment_weak"
  | "other";

// 次期改定への期待選択肢（2026年次期改定調査向け）
export type ExpectationCode =
  | "goal_reduction"
  | "clinical_enhancement"
  | "genai_education"
  | "evaluation_improvement"
  | "interprofessional"
  | "clinical_quality_enhancement"
  | "priority_clarification"
  | "integration_enhancement"
  | "local_adaptation_enhancement"
  | "exam_alignment_enhancement"
  | "other";

// マスターオプション
export interface MasterOption {
  id: string;
  category: string;
  code: string;
  label_ja: string;
  target_respondent: "all" | RespondentType;
  sort_order: number;
  is_active: boolean;
}

// フォーム回答
export interface FormResponse {
  id?: string;
  session_id?: string;

  // 共通属性
  respondent_type: RespondentType;
  additional_roles?: RespondentType[];
  university_type?: UniversityType;

  // 同意
  consent_given: boolean;
  consent_version: string;
  consented_at: string;

  // 教員向け
  specialty?: Specialty;
  experience_years?: ExperienceYears;

  // 学生向け
  student_year?: StudentYear;

  // 医療者・職員向け
  practitioner_profession?: string;
  staff_role?: string;

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
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

export interface TopicGroup {
  category: string;
  keywords: string[];
}

export interface CategoryGroup {
  category: string;
  items: string[];
}

export interface InVivoCode {
  code: string;
  quote?: string;
  messageIndex?: number;
}

export interface SummaryView {
  scope: SummaryScope;
  summaryBullets: string[];
  topicGroups: TopicGroup[];
}

export interface CodingPrimary {
  scope: CodingScope;
  method: CodingMethod;
  inVivoCodes: InVivoCode[];
  issueCategories: CategoryGroup[];
  competencyCategories: CategoryGroup[];
  coreItems: string[];
}

export interface CodingSensitivity {
  scope: SummaryScope;
  method: "topic";
  topicGroups: TopicGroup[];
}

export interface SummaryApiResponse {
  summaryView: SummaryView;
  codingPrimary: CodingPrimary;
  codingSensitivity: CodingSensitivity;
  analysisMeta: {
    analysisVersion: string;
    messageCount: number;
    participantMessageCount: number;
    assistantMessageCount: number;
  };
}

// 次期改定要望
export interface RevisionRequest {
  category: string;
  detail: string;
  priority: "high" | "medium" | "low";
}

// インタビューログ（拡張版）
export interface SurveyLog {
  id?: string;
  session_id?: string;
  form_response_id?: string;
  respondent_type?: RespondentType;

  messages: ChatMessage[];

  // legacy fields
  summary_bullets?: string[];
  keyword_groups?: TopicGroup[];
  issue_categories?: CategoryGroup[];
  competency_categories?: CategoryGroup[];
  core_items?: string[];

  // participant-first fields
  conversation_summary_bullets?: string[];
  conversation_topic_groups?: TopicGroup[];
  participant_messages?: Array<ChatMessage & { messageIndex?: number }>;
  participant_in_vivo_codes?: InVivoCode[];
  participant_issue_categories?: CategoryGroup[];
  participant_competency_categories?: CategoryGroup[];
  participant_core_items?: string[];
  coding_sensitivity_topic_groups?: TopicGroup[];
  summary_scope?: SummaryScope;
  coding_scope?: CodingScope;
  coding_method?: CodingMethod;
  analysis_version?: string;

  revision_requests?: RevisionRequest[];
  created_at?: string;
  completed_at?: string;
}

// フォームステップ
export type FormStep = "attributes" | "challenges" | "expectations" | "confirm";

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
  respondentType?: RespondentType;
}

// チャットAPIレスポンス
export interface ChatResponse {
  message: string;
  summary?: string;
  isComplete?: boolean;
}

// 選択肢マスターラベル（2026年次期改定調査向け）
export const CHALLENGE_LABELS: Record<ChallengeCode, string> = {
  content_overload: "コアカリの学修内容が多すぎる",
  lack_practice_time: "臨床実習の時間が足りない",
  lack_educators: "教員・指導者が不足している",
  evaluation_issues: "評価方法に課題がある",
  lack_genai_education: "生成AI活用教育が不十分",
  clinical_quality_variance: "実習先・臨床経験の質がばらつく",
  priority_unclear: "学修目標の優先順位が分かりにくい",
  integration_insufficient: "基礎・臨床・社会医学の統合が不十分",
  local_adaptation_difficult: "地域・大学の実情に合わせにくい",
  exam_alignment_weak: "国家試験・卒前評価との整合が弱い",
  other: "その他",
};

export const EXPECTATION_LABELS: Record<ExpectationCode, string> = {
  goal_reduction: "コアカリ学修目標の精選",
  clinical_enhancement: "臨床実習の充実",
  genai_education: "生成AI活用教育の充実",
  evaluation_improvement: "評価方法の改善",
  interprofessional: "多職種連携教育の充実",
  clinical_quality_enhancement: "実習・臨床経験の質の均質化",
  priority_clarification: "学修目標の優先順位の明確化",
  integration_enhancement: "基礎・臨床・社会医学の統合の強化",
  local_adaptation_enhancement: "地域・大学の実情に合わせた柔軟な運用",
  exam_alignment_enhancement: "国家試験・卒前評価との整合性強化",
  other: "その他",
};

export const RESPONDENT_TYPE_LABELS: Record<RespondentType, string> = {
  faculty: "教員",
  staff: "事務職員",
  student: "学生",
  practitioner: "医療者（医師・看護師等）",
};

export const UNIVERSITY_TYPE_LABELS: Record<UniversityType, string> = {
  national: "国立",
  public: "公立",
  private: "私立",
};

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  basic: "基礎系",
  clinical: "臨床系",
  social: "社会医学系",
  education: "教育専任",
  other: "その他",
};

export const EXPERIENCE_YEARS_LABELS: Record<ExperienceYears, string> = {
  under_5: "5年未満",
  "5_10": "5-10年",
  over_10: "10年以上",
};

export const STUDENT_YEAR_LABELS: Record<StudentYear, string> = {
  "1_2": "1-2年",
  "3_4": "3-4年",
  "5_6": "5-6年（臨床実習中）",
};
