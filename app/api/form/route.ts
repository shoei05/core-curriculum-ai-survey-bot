import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Zodスキーマでバリデーション
const FormResponseSchema = z.object({
  respondent_type: z.enum(["faculty", "staff", "student", "practitioner"]),
  university_type: z.enum(["national", "public", "private"]).optional(),
  specialty: z.enum(["basic", "clinical", "social", "education", "other"]).optional(),
  experience_years: z.enum(["under_5", "5_10", "over_10"]).optional(),
  student_year: z.enum(["1_2", "3_4", "5_6"]).optional(),
  challenges: z.array(z.string()).min(1).max(3),
  expectations: z.array(z.string()).min(1).max(3),
  challenge_other: z.string().optional(),
  expectation_other: z.string().optional(),
}).refine(
  (data) => {
    // 教員の場合はspecialtyとexperience_yearsが必須
    if (data.respondent_type === "faculty") {
      return data.specialty && data.experience_years;
    }
    // 学生の場合はstudent_yearが必須
    if (data.respondent_type === "student") {
      return data.student_year;
    }
    // 事務職員・医療者は追加の必須項目なし
    return true;
  },
  {
    message: "回答者タイプに応じた必須項目が入力されていません",
  }
);

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = FormResponseSchema.parse(json);

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error("Supabase admin client unavailable: missing env vars.");
      return NextResponse.json(
        { error: "データベースに接続できません" },
        { status: 500 }
      );
    }

    const sessionId = crypto.randomUUID();

    // Supabaseに保存
    const insertPayload = {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("form_responses")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "データの保存に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId,
      formResponseId: data?.id ?? sessionId,
    });
  } catch (error) {
    console.error("Form API Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "入力内容に誤りがあります", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
