import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const RespondentTypeSchema = z.enum(["faculty", "staff", "student", "practitioner"]);
const ChallengeCodeSchema = z.enum([
  "content_overload",
  "lack_practice_time",
  "lack_educators",
  "evaluation_issues",
  "lack_genai_education",
  "clinical_quality_variance",
  "priority_unclear",
  "integration_insufficient",
  "local_adaptation_difficult",
  "exam_alignment_weak",
  "other",
]);
const ExpectationCodeSchema = z.enum([
  "goal_reduction",
  "clinical_enhancement",
  "genai_education",
  "evaluation_improvement",
  "interprofessional",
  "clinical_quality_enhancement",
  "priority_clarification",
  "integration_enhancement",
  "local_adaptation_enhancement",
  "exam_alignment_enhancement",
  "other",
]);

const FormResponseSchema = z
  .object({
    respondent_type: RespondentTypeSchema,
    additional_roles: z.array(RespondentTypeSchema).max(3).optional().default([]),
    university_type: z
      .enum([
        "national",
        "public",
        "private",
        "university",
        "university_hospital",
        "public_hospital",
        "private_hospital",
        "clinic",
        "government",
        "other",
      ])
      .optional(),
    specialty: z.enum(["basic", "clinical", "social", "education", "other"]).optional(),
    experience_years: z.enum(["under_5", "5_10", "over_10"]).optional(),
    student_year: z.enum(["1_2", "3_4", "5_6"]).optional(),
    practitioner_profession: z.string().trim().max(120).optional(),
    staff_role: z.string().trim().max(120).optional(),
    challenges: z.array(ChallengeCodeSchema).min(1).max(3),
    expectations: z.array(ExpectationCodeSchema).min(1).max(3),
    challenge_other: z.string().trim().max(1000).optional(),
    expectation_other: z.string().trim().max(1000).optional(),
    consent_given: z.literal(true),
    consent_version: z.string().trim().min(1),
    consented_at: z.string().datetime(),
  })
  .superRefine((data, ctx) => {
    const roles = new Set([data.respondent_type, ...data.additional_roles]);

    const requiresExperienceYears = roles.has("faculty") || roles.has("staff") || roles.has("practitioner");

    if (roles.has("faculty")) {
      if (!data.specialty) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["specialty"],
          message: "教員を含む場合、専門分野は必須です",
        });
      }
    }

    if (requiresExperienceYears && !data.experience_years) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["experience_years"],
        message: "教員・職員・医療者を含む場合、経験年数は必須です",
      });
    }

    if (roles.has("student") && !data.student_year) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["student_year"],
        message: "学生を含む場合、学年は必須です",
      });
    }
  });

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = FormResponseSchema.parse(json);

    const supabase = getSupabaseAdmin();
    const sessionId = crypto.randomUUID();
    const additionalRoles = [...new Set(body.additional_roles.filter((role) => role !== body.respondent_type))];

    const insertPayload = {
      session_id: sessionId,
      respondent_type: body.respondent_type,
      additional_roles: additionalRoles,
      university_type: body.university_type ?? null,
      specialty: body.specialty ?? null,
      experience_years: body.experience_years ?? null,
      student_year: body.student_year ?? null,
      practitioner_profession: body.practitioner_profession ?? null,
      staff_role: body.staff_role ?? null,
      challenges: body.challenges,
      expectations: body.expectations,
      challenge_other: body.challenge_other ?? null,
      expectation_other: body.expectation_other ?? null,
      consent_given: body.consent_given,
      consent_version: body.consent_version,
      consented_at: body.consented_at,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result = await (supabase as any).from("form_responses").insert(insertPayload).select("id").single();

    if (result.error) {
      const errorMessage = String(result.error.message ?? "");
      const isMissingNewColumn =
        errorMessage.includes("column") &&
        (errorMessage.includes("consent_") ||
          errorMessage.includes("additional_roles") ||
          errorMessage.includes("practitioner_profession") ||
          errorMessage.includes("staff_role"));

      if (isMissingNewColumn) {
        const legacyPayload = {
          session_id: sessionId,
          respondent_type: body.respondent_type,
          university_type: body.university_type ?? null,
          specialty: body.specialty ?? null,
          experience_years: body.experience_years ?? null,
          student_year: body.student_year ?? null,
          challenges: body.challenges,
          expectations: body.expectations,
          challenge_other: body.challenge_other ?? null,
          expectation_other: body.expectation_other ?? null,
        };

        result = await (supabase as any).from("form_responses").insert(legacyPayload).select("id").single();
      }
    }

    if (result.error) {
      const errorMessage = String(result.error.message ?? "");
      if (errorMessage.includes("university_type")) {
        return NextResponse.json(
          { error: "所属機関の種別を保存できませんでした。DB schema の制約更新が必要です。" },
          { status: 500 },
        );
      }
      console.error("Supabase insert error:", result.error);
      return NextResponse.json({ error: "データの保存に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sessionId,
      formResponseId: result.data?.id ?? sessionId,
    });
  } catch (error) {
    console.error("Form API Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "入力内容に誤りがあります", details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
