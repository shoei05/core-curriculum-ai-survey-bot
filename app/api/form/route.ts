import { NextResponse } from "next/server";
import { z } from "zod";
import type { FormResponse } from "@/types/survey";

// Zodスキーマでバリデーション
const FormResponseSchema = z.object({
  respondent_type: z.enum(["faculty", "staff", "student"]),
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

    // TODO: Supabaseに保存
    // 現在はモックでsession_idとform_response_idを返す
    const sessionId = crypto.randomUUID();
    const formResponseId = crypto.randomUUID();

    return NextResponse.json({
      success: true,
      sessionId,
      formResponseId,
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
