import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// 管理者パスワード検証
function verifyPassword(password: string): boolean {
  return password === (process.env.ADMIN_PASSWORD || "admin123");
}

// 課題コードのリスト（2026年次期改定調査向け）
const CHALLENGE_CODES = [
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
] as const;

// 期待コードのリスト（2026年次期改定調査向け）
const EXPECTATION_CODES = [
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
] as const;

// 全選択肢コード（22次元：11課題 + 11期待）
const ALL_CODES = [...CHALLENGE_CODES, ...EXPECTATION_CODES] as const;

/**
 * シンプルなPCA実装（SVDを使用）
 * @param data データ行列（各行はサンプル、各列は特徴量）
 * @returns { scores: 主成分スコア, explainedVariance: 説明分散比 }
 */
function simplePCA(data: number[][]): {
  scores: number[][];
  explainedVariance: number[];
} {
  const n = data.length;
  const p = data[0].length;

  if (n === 0 || p === 0) {
    return { scores: [], explainedVariance: [] };
  }

  // 1. 中心化（各特徴量の平均を0に）
  const means = new Array(p).fill(0);
  for (let j = 0; j < p; j++) {
    for (let i = 0; i < n; i++) {
      means[j] += data[i][j];
    }
    means[j] /= n;
  }

  const centered = data.map((row) => row.map((val, j) => val - means[j]));

  // 2. 分散共分散行列を計算
  const cov: number[][] = [];
  for (let i = 0; i < p; i++) {
    cov[i] = [];
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += centered[k][i] * centered[k][j];
      }
      cov[i][j] = sum / (n - 1);
    }
  }

  // 3. 固有値・固有ベクトルを計算（べき乗法の簡易版）
  // 最初の2つの主成分のみ計算
  const eigenVectors = computeEigenvectors(cov, 2);

  // 4. 主成分スコアを計算
  const scores: number[][] = [];
  for (let i = 0; i < n; i++) {
    const point: number[] = [];
    for (let v = 0; v < eigenVectors.length; v++) {
      let sum = 0;
      for (let j = 0; j < p; j++) {
        sum += centered[i][j] * eigenVectors[v][j];
      }
      point.push(sum);
    }
    scores.push(point);
  }

  // 説明分散比（簡易計算）
  const totalVariance = cov.reduce((sum, row, i) => sum + row[i], 0);
  const explainedVariance = eigenVectors.map((ev) => {
    let evVariance = 0;
    for (let i = 0; i < p; i++) {
      let sum = 0;
      for (let j = 0; j < p; j++) {
        sum += cov[i][j] * ev[j];
      }
      evVariance += ev[i] * sum;
    }
    return evVariance / totalVariance;
  });

  return { scores, explainedVariance };
}

/**
 * べき乗法を使用して固有ベクトルを計算
 * @param matrix 対称行列
 * @param numComponents 計算する主成分の数
 * @returns 固有ベクトルの配列
 */
function computeEigenvectors(matrix: number[][], numComponents: number): number[][] {
  const p = matrix.length;
  const vectors: number[][] = [];

  for (let comp = 0; comp < numComponents; comp++) {
    // 初期ベクトル
    let v = new Array(p).fill(0).map(() => Math.random());
    let vNorm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
    v = v.map((val) => val / vNorm);

    // べき乗法の反復
    for (let iter = 0; iter < 100; iter++) {
      // 行列乗算
      const newV = new Array(p).fill(0);
      for (let i = 0; i < p; i++) {
        for (let j = 0; j < p; j++) {
          newV[i] += matrix[i][j] * v[j];
        }
      }

      // 正規化
      vNorm = Math.sqrt(newV.reduce((sum, val) => sum + val * val, 0));
      if (vNorm < 1e-10) break;
      v = newV.map((val) => val / vNorm);
    }

    // 以前のベクトルと直交するように変換
    for (let prev = 0; prev < vectors.length; prev++) {
      const prevVec = vectors[prev];
      let dot = 0;
      for (let i = 0; i < p; i++) {
        dot += v[i] * prevVec[i];
      }
      v = v.map((val, i) => val - dot * prevVec[i]);
    }

    // 再正規化
    vNorm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
    if (vNorm > 1e-10) {
      v = v.map((val) => val / vNorm);
      vectors.push(v);
    }

    // 行列を減算して次の固有ベクトルを求める
    if (comp < numComponents - 1) {
      const lambda = v.reduce((sum, vi, i) => {
        let rowSum = 0;
        for (let j = 0; j < p; j++) {
          rowSum += matrix[i][j] * v[j];
        }
        return sum + vi * rowSum;
      }, 0);

      for (let i = 0; i < p; i++) {
        for (let j = 0; j < p; j++) {
          matrix[i][j] -= lambda * v[i] * v[j];
        }
      }
    }
  }

  return vectors;
}

// 選択肢パターンをone-hotベクトルに変換
function selectionsToVector(challenges: string[], expectations: string[]): number[] {
  const vector = new Array(ALL_CODES.length).fill(0);

  // 課題（11次元）
  CHALLENGE_CODES.forEach((code, idx) => {
    if (challenges.includes(code)) {
      vector[idx] = 1;
    }
  });

  // 期待（11次元）
  EXPECTATION_CODES.forEach((code, idx) => {
    if (expectations.includes(code)) {
      vector[CHALLENGE_CODES.length + idx] = 1;
    }
  });

  return vector;
}

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // URLパラメータからパスワードを取得
  const url = new URL(req.url);
  const password = url.searchParams.get("password");

  if (!password || !verifyPassword(password)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    // form_responsesを取得
    const { data: formResponses, error } = await (supabase as any)
      .from("form_responses")
      .select("id, respondent_type, challenges, expectations")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("PCA calculation error:", error);
      return NextResponse.json(
        { error: "データの取得に失敗しました" },
        { status: 500 }
      );
    }

    if (!formResponses || formResponses.length < 3) {
      return NextResponse.json({
        points: [],
        explainedVariance: [],
        message: "PCAには少なくとも3件のデータが必要です",
      });
    }

    // 各回答をベクトル化
    const vectors = formResponses.map((item: any) =>
      selectionsToVector(item.challenges || [], item.expectations || [])
    );

    // PCAを実行
    const { scores, explainedVariance } = simplePCA(vectors);

    // 結果を整形
    const points = formResponses.map((item: any, idx: number) => ({
      id: item.id,
      respondent_type: item.respondent_type,
      x: scores[idx]?.[0] ?? 0,
      y: scores[idx]?.[1] ?? 0,
    }));

    return NextResponse.json({
      points,
      explainedVariance: explainedVariance.map((v) => v * 100), // パーセンテージに変換
    });
  } catch (error) {
    console.error("PCA API error:", error);
    return NextResponse.json(
      { error: "PCAの計算に失敗しました" },
      { status: 500 }
    );
  }
}
