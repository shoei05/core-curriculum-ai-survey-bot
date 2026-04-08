import {
  CHALLENGE_LABELS,
  EXPECTATION_LABELS,
  EXPERIENCE_YEARS_LABELS,
  RESPONDENT_TYPE_LABELS,
  SPECIALTY_LABELS,
  STUDENT_YEAR_LABELS,
  UNIVERSITY_TYPE_LABELS,
  type ChatMessage,
  type FormResponse,
  type RespondentType,
} from "@/types/survey";

const VALID_ROLES: RespondentType[] = ["faculty", "staff", "student", "practitioner"];

export function isRespondentType(value: unknown): value is RespondentType {
  return typeof value === "string" && VALID_ROLES.includes(value as RespondentType);
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function normalizeRoleArray(value: unknown): RespondentType[] {
  return normalizeStringArray(value).filter(isRespondentType);
}

export function getAllRoles(formResponse: Partial<FormResponse>): RespondentType[] {
  const roles = new Set<RespondentType>();

  if (isRespondentType(formResponse.respondent_type)) {
    roles.add(formResponse.respondent_type);
  }

  for (const role of normalizeRoleArray(formResponse.additional_roles)) {
    roles.add(role);
  }

  return VALID_ROLES.filter((role) => roles.has(role));
}

export function toAdditionalRoles(
  selectedRoles: RespondentType[],
  primaryRole?: RespondentType,
): RespondentType[] {
  if (!primaryRole) {
    return [];
  }
  return selectedRoles.filter((role) => role !== primaryRole);
}

export function getRoleLabel(role?: string | null): string {
  if (!role) {
    return "未設定";
  }
  return RESPONDENT_TYPE_LABELS[role as RespondentType] ?? role;
}

export function getChallengeLabels(codes: unknown, other?: string | null): string[] {
  const labels = normalizeStringArray(codes).map((code) => CHALLENGE_LABELS[code as keyof typeof CHALLENGE_LABELS] ?? code);
  if (normalizeStringArray(codes).includes("other") && other?.trim()) {
    labels.push(`その他: ${other.trim()}`);
  }
  return labels;
}

export function getExpectationLabels(codes: unknown, other?: string | null): string[] {
  const labels = normalizeStringArray(codes).map((code) => EXPECTATION_LABELS[code as keyof typeof EXPECTATION_LABELS] ?? code);
  if (normalizeStringArray(codes).includes("other") && other?.trim()) {
    labels.push(`その他: ${other.trim()}`);
  }
  return labels;
}

export function getUniversityLabel(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  return UNIVERSITY_TYPE_LABELS[value as keyof typeof UNIVERSITY_TYPE_LABELS] ?? value;
}

export function getSpecialtyLabel(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  return SPECIALTY_LABELS[value as keyof typeof SPECIALTY_LABELS] ?? value;
}

export function getExperienceLabel(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  return EXPERIENCE_YEARS_LABELS[value as keyof typeof EXPERIENCE_YEARS_LABELS] ?? value;
}

export function getStudentYearLabel(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  return STUDENT_YEAR_LABELS[value as keyof typeof STUDENT_YEAR_LABELS] ?? value;
}

export function buildFormContext(formResponse: Partial<FormResponse>): string[] {
  const roles = getAllRoles(formResponse);
  const context: string[] = [];

  context.push(`主たる立場: ${getRoleLabel(formResponse.respondent_type)}`);
  if (roles.length > 1) {
    context.push(`複数ロール: ${roles.map(getRoleLabel).join(" / ")}`);
  }

  const universityType = getUniversityLabel(formResponse.university_type);
  if (universityType) {
    context.push(`大学の設置形態: ${universityType}`);
  }

  const specialty = getSpecialtyLabel(formResponse.specialty);
  if (specialty) {
    context.push(`専門分野: ${specialty}`);
  }

  const experienceYears = getExperienceLabel(formResponse.experience_years);
  if (experienceYears) {
    context.push(`教育経験: ${experienceYears}`);
  }

  const studentYear = getStudentYearLabel(formResponse.student_year);
  if (studentYear) {
    context.push(`学年: ${studentYear}`);
  }

  if (formResponse.practitioner_profession?.trim()) {
    context.push(`医療者としての職種: ${formResponse.practitioner_profession.trim()}`);
  }

  if (formResponse.staff_role?.trim()) {
    context.push(`職員としての担当: ${formResponse.staff_role.trim()}`);
  }

  const challengeLabels = getChallengeLabels(formResponse.challenges, formResponse.challenge_other);
  if (challengeLabels.length > 0) {
    context.push(`選択した課題: ${challengeLabels.join(" / ")}`);
  }

  const expectationLabels = getExpectationLabels(formResponse.expectations, formResponse.expectation_other);
  if (expectationLabels.length > 0) {
    context.push(`次期改定への期待: ${expectationLabels.join(" / ")}`);
  }

  return context;
}

export function formatTranscript(
  messages: Array<Pick<ChatMessage, "role" | "content">>,
  options?: { participantOnly?: boolean; includeIndexes?: boolean },
): string {
  const includeIndexes = options?.includeIndexes ?? false;
  return messages
    .filter((message) => (options?.participantOnly ? message.role === "user" : true))
    .map((message, index) => {
      const speaker = message.role === "user" ? "参加者" : "AI";
      const prefix = includeIndexes ? `[${index}] ` : "";
      return `${prefix}${speaker}: ${message.content}`;
    })
    .join("\n");
}

export function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // no-op
  }

  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // no-op
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {
      // no-op
    }
  }

  return null;
}
