"use client";

import { Suspense, useEffect, useMemo, useState } from "react";

interface FormResponse {
  id: string;
  session_id: string;
  created_at: string;
  respondent_type: string;
  respondent_type_code: string;
  additional_roles: string[];
  university_type: string | null;
  specialty: string | null;
  experience_years: string | null;
  student_year: string | null;
  practitioner_profession: string | null;
  staff_role: string | null;
  challenges: string[];
  challenges_code: string[];
  challenge_other: string | null;
  expectations: string[];
  expectations_code: string[];
  expectation_other: string | null;
  consent_given: boolean;
  consent_version: string | null;
  consented_at: string | null;
  has_chat_log: boolean;
  chat_summary: string[];
}

const TABS = ["overview", "list"] as const;
type Tab = (typeof TABS)[number];

function AdminFormsContent() {
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [filterRespondentType, setFilterRespondentType] = useState<string>("all");
  const [filterChallenge, setFilterChallenge] = useState<string>("all");
  const [filterExpectation, setFilterExpectation] = useState<string>("all");

  useEffect(() => {
    fetch("/api/admin/forms")
      .then((response) => {
        if (!response.ok) {
          throw new Error("フォーム回答の取得に失敗しました");
        }
        return response.json();
      })
      .then((payload: FormResponse[]) => {
        setResponses(payload);
        setLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setLoading(false);
      });
  }, []);

  const handleDownloadCsv = async () => {
    try {
      const response = await fetch("/api/admin/forms/export", { method: "POST" });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "CSV出力に失敗しました");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `form_responses_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error instanceof Error ? error.message : "CSV出力に失敗しました");
    }
  };

  const filteredResponses = useMemo(() => {
    return responses.filter((response) => {
      if (filterRespondentType !== "all" && response.respondent_type_code !== filterRespondentType) {
        return false;
      }
      if (filterChallenge !== "all" && !response.challenges.includes(filterChallenge)) {
        return false;
      }
      if (filterExpectation !== "all" && !response.expectations.includes(filterExpectation)) {
        return false;
      }
      return true;
    });
  }, [filterChallenge, filterExpectation, filterRespondentType, responses]);

  const stats = useMemo(() => {
    const respondentTypeCounts: Record<string, number> = {};
    const challengeCounts: Record<string, number> = {};
    const expectationCounts: Record<string, number> = {};

    responses.forEach((response) => {
      respondentTypeCounts[response.respondent_type] = (respondentTypeCounts[response.respondent_type] || 0) + 1;
      response.challenges.forEach((challenge) => {
        challengeCounts[challenge] = (challengeCounts[challenge] || 0) + 1;
      });
      response.expectations.forEach((expectation) => {
        expectationCounts[expectation] = (expectationCounts[expectation] || 0) + 1;
      });
    });

    return {
      typeDistribution: Object.entries(respondentTypeCounts).sort((a, b) => b[1] - a[1]),
      challengeRanking: Object.entries(challengeCounts).sort((a, b) => b[1] - a[1]).slice(0, 6),
      expectationRanking: Object.entries(expectationCounts).sort((a, b) => b[1] - a[1]).slice(0, 6),
      challengeOptions: Array.from(new Set(responses.flatMap((response) => response.challenges))),
      expectationOptions: Array.from(new Set(responses.flatMap((response) => response.expectations))),
    };
  }, [responses]);

  if (loading) {
    return (
      <div className="blink" style={{ textAlign: "center", padding: 40 }}>
        読み込み中...
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>フォーム回答</h1>
          <p className="note" style={{ margin: "8px 0 0 0" }}>
            総回答数: {responses.length}件 / 表示中: {filteredResponses.length}件
          </p>
        </div>
        <button onClick={() => void handleDownloadCsv()} className="btn btn-primary">
          CSV出力
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)" }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 20px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab ? "3px solid var(--accent)" : "3px solid transparent",
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? "var(--accent)" : "var(--text-main)",
              cursor: "pointer",
            }}
          >
            {tab === "overview" ? "概要" : "回答一覧"}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <div className="hero-card">
            <h3 className="panel-title">主たる立場</h3>
            <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
              {stats.typeDistribution.map(([label, count]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{label}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-card">
            <h3 className="panel-title">課題認識 上位</h3>
            <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
              {stats.challengeRanking.map(([label, count]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{label}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-card">
            <h3 className="panel-title">期待 上位</h3>
            <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
              {stats.expectationRanking.map(([label, count]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{label}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "list" && (
        <div className="hero-card">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <select value={filterRespondentType} onChange={(event) => setFilterRespondentType(event.target.value)} className="text-input" style={{ width: 220 }}>
              <option value="all">主たる立場: すべて</option>
              {Array.from(new Set(responses.map((response) => response.respondent_type_code))).map((code) => {
                const sample = responses.find((response) => response.respondent_type_code === code);
                return (
                  <option key={code} value={code}>
                    {sample?.respondent_type ?? code}
                  </option>
                );
              })}
            </select>

            <select value={filterChallenge} onChange={(event) => setFilterChallenge(event.target.value)} className="text-input" style={{ width: 260 }}>
              <option value="all">課題: すべて</option>
              {stats.challengeOptions.map((challenge) => (
                <option key={challenge} value={challenge}>
                  {challenge}
                </option>
              ))}
            </select>

            <select value={filterExpectation} onChange={(event) => setFilterExpectation(event.target.value)} className="text-input" style={{ width: 260 }}>
              <option value="all">期待: すべて</option>
              {stats.expectationOptions.map((expectation) => (
                <option key={expectation} value={expectation}>
                  {expectation}
                </option>
              ))}
            </select>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  {["回答日時", "主たる立場", "追加ロール", "課題", "期待", "同意", "チャット"].map((label) => (
                    <th key={label} style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: 10 }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredResponses.map((response) => (
                  <tr key={response.id}>
                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                      {new Date(response.created_at).toLocaleString("ja-JP")}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{response.respondent_type}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                      {response.additional_roles.length > 0 ? response.additional_roles.join(" / ") : <span className="note">なし</span>}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{response.challenges.join(" / ")}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{response.expectations.join(" / ")}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                      {response.consent_given ? `取得済み (${response.consent_version ?? "version unknown"})` : "未取得"}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                      {response.has_chat_log ? "あり" : "なし"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminFormsPage() {
  return (
    <Suspense fallback={<div className="blink" style={{ textAlign: "center", padding: 40 }}>読み込み中...</div>}>
      <AdminFormsContent />
    </Suspense>
  );
}
