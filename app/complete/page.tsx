"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface SummaryData {
  summary_bullets: string[];
  revision_requests: Array<{ category: string; detail: string; priority: string }>;
}

export default function CompletePage() {
  const router = useRouter();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const sessionId = localStorage.getItem("sessionId");
      const formResponseId = localStorage.getItem("formResponseId");

      if (!sessionId || !formResponseId) {
        router.push("/survey");
        return;
      }

      // TODO: survey_logsからサマリーを取得
      // 現在はモックで表示
      setSummary({
        summary_bullets: [
          "学修目標の精選が求められている",
          "臨床実習の充実が必要",
          "AI/デジタル教育の導入が期待されている",
        ],
        revision_requests: [
          { category: "学修目標", detail: "精選・削減", priority: "high" },
        ],
      });

      setIsLoading(false);
      // localStorageをクリア
      localStorage.removeItem("sessionId");
      localStorage.removeItem("formResponseId");
      localStorage.removeItem("respondentType");
    };

    fetchData();
  }, [router]);

  if (isLoading) {
    return (
      <main style={{ padding: 40, textAlign: "center" }}>
        <p>読み込み中...</p>
      </main>
    );
  }

  return (
    <main style={{ padding: "40px 20px", maxWidth: 600, margin: "0 auto" }}>
      <div className="consent-card" style={{ textAlign: "center" }}>
        {/* 完了アイコン */}
        <div style={{
          width: 80,
          height: 80,
          backgroundColor: "#10b981",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px",
        }}>
          <svg style={{ width: 40, height: 40 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 style={{ marginBottom: 16 }}>ご協力ありがとうございました！</h1>
        <p style={{ color: "#666", marginBottom: 32 }}>
          お答えいただいた内容は、次期コアカリ改定の重要な参考資料として活用させていただきます。
        </p>

        {/* サマリー表示 */}
        {summary && summary.summary_bullets.length > 0 && (
          <div style={{
            backgroundColor: "var(--accent-soft)",
            borderRadius: 8,
            padding: 20,
            marginBottom: 24,
            textAlign: "left",
          }}>
            <h2 style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <svg style={{ width: 20, height: 20, color: "var(--accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              あなたからいただいた主な意見
            </h2>
            <ul style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {summary.summary_bullets.map((bullet, index) => (
                <li key={index} style={{ display: "flex", alignItems: "start", gap: 12 }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    backgroundColor: "var(--accent)",
                    borderRadius: "50%",
                    marginTop: 6,
                    flexShrink: 0,
                  }} />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 重要ポイントの説明 */}
        <div style={{
          backgroundColor: "#f0f0f0",
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
          textAlign: "left",
        }}>
          <h2 style={{ marginBottom: 16 }}>いただいたご意見の活用について</h2>
          <ul style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <li style={{ display: "flex", alignItems: "start", gap: 12 }}>
              <div style={{
                width: 24,
                height: 24,
                backgroundColor: "var(--accent)",
                color: "#fff",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: 12,
              }}>1</div>
              <span>全ての回答は<strong>統計的に集計・分析</strong>され、傾向と要望を抽出いたします</span>
            </li>
            <li style={{ display: "flex", alignItems: "start", gap: 12 }}>
              <div style={{
                width: 24,
                height: 24,
                backgroundColor: "var(--accent)",
                color: "#fff",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: 12,
              }}>2</div>
              <span>抽出された意見は、次期コアカリ改定検討ワーキンググループにて<strong>検討資料</strong>として活用されます</span>
            </li>
            <li style={{ display: "flex", alignItems: "start", gap: 12 }}>
              <div style={{
                width: 24,
                height: 24,
                backgroundColor: "var(--accent)",
                color: "#fff",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: 12,
              }}>3</div>
              <span><strong>個人を特定できる情報は一切含まれません</strong>ので、安心してください</span>
            </li>
          </ul>
        </div>

        {/* ホームに戻るボタン */}
        <button
          onClick={() => router.push("/")}
          style={{
            width: "100%",
            padding: 16,
            borderRadius: 8,
            border: "none",
            backgroundColor: "var(--accent)",
            color: "#fff",
            fontWeight: 600,
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          トップページに戻る
        </button>
      </div>
    </main>
  );
}
