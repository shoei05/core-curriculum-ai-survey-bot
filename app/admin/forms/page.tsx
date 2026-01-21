"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import { PCAScatterPlot } from "@/components/PCAScatterPlot";
import { CrossTabulationTable } from "@/components/CrossTabulationTable";

interface FormResponse {
  id: string;
  session_id: string;
  created_at: string;
  respondent_type: string;
  respondent_type_code: string;
  university_type: string | null;
  specialty: string | null;
  experience_years: string | null;
  student_year: string | null;
  attribute: string | null;
  challenges: string[];
  challenges_code: string[];
  challenge_other: string | null;
  expectations: string[];
  expectations_code: string[];
  expectation_other: string | null;
  has_chat_log: boolean;
  chat_summary: string[] | null;
}

interface PCAPoint {
  id: string;
  respondent_type: string;
  x: number;
  y: number;
}

interface PCAResponse {
  points: PCAPoint[];
  explainedVariance: number[];
}

const TABS = ["overview", "cross-tab", "pca", "list"] as const;
type Tab = (typeof TABS)[number];

function AdminFormsContent() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [pcaData, setPcaData] = useState<PCAResponse | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  // フィルタ状態
  const [filterRespondentType, setFilterRespondentType] = useState<string>("all");
  const [filterChallenge, setFilterChallenge] = useState<string>("all");
  const [filterExpectation, setFilterExpectation] = useState<string>("all");

  // 認証
  useEffect(() => {
    const savedAuth = sessionStorage.getItem("adminAuth");
    if (savedAuth === "true") {
      setIsAuthenticated(true);
      fetchData();
    }
  }, []);

  // データ取得
  const fetchData = async () => {
    setLoading(true);
    try {
      // フォーム回答データを取得
      const formsRes = await fetch(
        `/api/admin/forms?password=${sessionStorage.getItem("adminPassword") || ""}`
      );
      if (formsRes.ok) {
        const data = await formsRes.json();
        setResponses(data);
      }

      // PCAデータを取得
      const pcaRes = await fetch(
        `/api/admin/forms/pca?password=${sessionStorage.getItem("adminPassword") || ""}`
      );
      if (pcaRes.ok) {
        const pcaData = await pcaRes.json();
        setPcaData(pcaData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setIsAuthenticated(true);
        sessionStorage.setItem("adminAuth", "true");
        sessionStorage.setItem("adminPassword", password);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "認証に失敗しました");
      }
    } catch (error) {
      alert("通信エラーが発生しました");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setIsAuthenticated(false);
    sessionStorage.removeItem("adminAuth");
    sessionStorage.removeItem("adminPassword");
  };

  const handleDownloadCsv = async () => {
    try {
      const res = await fetch("/api/admin/forms/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: sessionStorage.getItem("adminPassword") || "" }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `form_responses_${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        alert(data.error || "出力に失敗しました。");
      }
    } catch (err) {
      alert("通信エラーが発生しました。");
    }
  };

  // フィルタ適用
  const filteredResponses = useMemo(() => {
    return responses.filter((r) => {
      if (filterRespondentType !== "all" && r.respondent_type_code !== filterRespondentType) {
        return false;
      }
      if (filterChallenge !== "all" && !r.challenges.includes(filterChallenge)) {
        return false;
      }
      if (filterExpectation !== "all" && !r.expectations.includes(filterExpectation)) {
        return false;
      }
      return true;
    });
  }, [responses, filterRespondentType, filterChallenge, filterExpectation]);

  // 統計データ
  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    const challengeCounts: Record<string, number> = {};
    const expectationCounts: Record<string, number> = {};

    responses.forEach((r) => {
      byType[r.respondent_type_code] = (byType[r.respondent_type_code] || 0) + 1;
      r.challenges.forEach((c) => {
        challengeCounts[c] = (challengeCounts[c] || 0) + 1;
      });
      r.expectations.forEach((e) => {
        expectationCounts[e] = (expectationCounts[e] || 0) + 1;
      });
    });

    return { byType, challengeCounts, expectationCounts };
  }, [responses]);

  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: 400, margin: "100px auto", padding: 24 }}>
        <div className="consent-card">
          <h2 style={{ textAlign: "center", marginBottom: 24 }}>管理者ログイン</h2>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleLogin()}
              style={{
                width: "100%",
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: 1,
              }}
              autoFocus
            />
          </div>
          <button onClick={handleLogin} className="btn btn-primary" style={{ width: "100%" }}>
            ログイン
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="blink" style={{ textAlign: "center", padding: 40 }}>読み込み中...</div>;
  }

  // 選択肢リスト（フィルタ用）
  const challengeOptions = Array.from(new Set(responses.flatMap((r) => r.challenges)));
  const expectationOptions = Array.from(new Set(responses.flatMap((r) => r.expectations)));

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>フォーム回答管理</h1>
          <p className="note">総回答数: {responses.length}件（表示: {filteredResponses.length}件）</p>
        </div>
        <button onClick={handleDownloadCsv} className="btn btn-primary">
          CSV出力
        </button>
      </div>

      {/* タブ */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
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
            {tab === "overview" && "概要"}
            {tab === "cross-tab" && "クロス集計"}
            {tab === "pca" && "PCA分析"}
            {tab === "list" && "回答一覧"}
          </button>
        ))}
      </div>

      {/* 概要タブ */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* 回答者タイプ分布 */}
          <div className="consent-card">
            <h3>回答者タイプ分布</h3>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {Object.entries(stats.byType).map(([type, count]) => {
                const labels: Record<string, string> = { faculty: "教員", staff: "職員", student: "学生" };
                const colors: Record<string, string> = { faculty: "#3498db", staff: "#2ecc71", student: "#e74c3c" };
                const percent = ((count / responses.length) * 100).toFixed(1);
                return (
                  <div key={type} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: colors[type] }} />
                    <span>{labels[type]}: </span>
                    <strong>{count}</strong>
                    <span className="note">({percent}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 課題認識ランキング */}
          <div className="consent-card">
            <h3>課題認識 選択回数ランキング</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Object.entries(stats.challengeCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([label, count]) => {
                  const percent = ((count / responses.length) * 100).toFixed(1);
                  return (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 200 }}>{label}</div>
                      <div style={{ flex: 1, height: 24, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${percent}%`, height: "100%", background: "var(--accent)", transition: "width 0.3s" }} />
                      </div>
                      <div style={{ width: 80, textAlign: "right" }}>
                        {count} <span className="note">({percent}%)</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* 期待ランキング */}
          <div className="consent-card">
            <h3>次期改定への期待 選択回数ランキング</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Object.entries(stats.expectationCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([label, count]) => {
                  const percent = ((count / responses.length) * 100).toFixed(1);
                  return (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 200 }}>{label}</div>
                      <div style={{ flex: 1, height: 24, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${percent}%`, height: "100%", background: "var(--accent)", transition: "width 0.3s" }} />
                      </div>
                      <div style={{ width: 80, textAlign: "right" }}>
                        {count} <span className="note">({percent}%)</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* クロス集計タブ */}
      {activeTab === "cross-tab" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div className="consent-card">
            <h3>回答者タイプ × 課題認識</h3>
            <CrossTabulationTable responses={responses} type="challenges" />
          </div>
          <div className="consent-card">
            <h3>回答者タイプ × 次期改定への期待</h3>
            <CrossTabulationTable responses={responses} type="expectations" />
          </div>
        </div>
      )}

      {/* PCAタブ */}
      {activeTab === "pca" && (
        <div className="consent-card">
          <h3>PCA 2次元マップ</h3>
          <p className="note" style={{ marginBottom: 16 }}>
            回答者の選択パターンを2次元にマッピング。似た選択パターンの回答者は近くにプロットされます。
          </p>
          {pcaData && pcaData.points.length > 0 ? (
            <PCAScatterPlot
              points={pcaData.points}
              explainedVariance={pcaData.explainedVariance}
              onPointClick={(point) => {
                setSelectedPointId(point.id);
                const response = responses.find((r) => r.id === point.id);
                if (response) {
                  alert(`${response.respondent_type}\n課題: ${response.challenges.join("、")}\n期待: ${response.expectations.join("、")}`);
                }
              }}
            />
          ) : (
            <p className="note">PCAには少なくとも3件のデータが必要です。</p>
          )}
        </div>
      )}

      {/* 回答一覧タブ */}
      {activeTab === "list" && (
        <div>
          {/* フィルタ */}
          <div className="consent-card" style={{ marginBottom: 16 }}>
            <h4>フィルタ</h4>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div>
                <label style={{ marginRight: 8 }}>回答者タイプ:</label>
                <select
                  value={filterRespondentType}
                  onChange={(e) => setFilterRespondentType(e.target.value)}
                  style={{ padding: 8, borderRadius: 4 }}
                >
                  <option value="all">すべて</option>
                  <option value="faculty">教員</option>
                  <option value="staff">職員</option>
                  <option value="student">学生</option>
                </select>
              </div>
              <div>
                <label style={{ marginRight: 8 }}>課題:</label>
                <select
                  value={filterChallenge}
                  onChange={(e) => setFilterChallenge(e.target.value)}
                  style={{ padding: 8, borderRadius: 4 }}
                >
                  <option value="all">すべて</option>
                  {challengeOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ marginRight: 8 }}>期待:</label>
                <select
                  value={filterExpectation}
                  onChange={(e) => setFilterExpectation(e.target.value)}
                  style={{ padding: 8, borderRadius: 4 }}
                >
                  <option value="all">すべて</option>
                  {expectationOptions.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 回答一覧テーブル */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--surface)" }}>
                  <th style={{ padding: 12, textAlign: "left", border: "1px solid var(--border)" }}>回答日時</th>
                  <th style={{ padding: 12, textAlign: "left", border: "1px solid var(--border)" }}>回答者タイプ</th>
                  <th style={{ padding: 12, textAlign: "left", border: "1px solid var(--border)" }}>属性</th>
                  <th style={{ padding: 12, textAlign: "left", border: "1px solid var(--border)" }}>課題認識</th>
                  <th style={{ padding: 12, textAlign: "left", border: "1px solid var(--border)" }}>期待</th>
                  <th style={{ padding: 12, textAlign: "center", border: "1px solid var(--border)" }}>チャット</th>
                </tr>
              </thead>
              <tbody>
                {filteredResponses.map((r) => (
                  <tr key={r.id} style={{ background: selectedPointId === r.id ? "#fff3cd" : undefined }}>
                    <td style={{ padding: 10, border: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                      {new Date(r.created_at).toLocaleString("ja-JP")}
                    </td>
                    <td style={{ padding: 10, border: "1px solid var(--border)" }}>{r.respondent_type}</td>
                    <td style={{ padding: 10, border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 12 }}>
                        {r.university_type && <div>{r.university_type}</div>}
                        {r.attribute && <div>{r.attribute}</div>}
                      </div>
                    </td>
                    <td style={{ padding: 10, border: "1px solid var(--border)", fontSize: 13 }}>
                      <div>{r.challenges.join("、")}</div>
                      {r.challenge_other && (
                        <div style={{ color: "#666", fontSize: 12 }}>
                          （その他: {r.challenge_other}）
                        </div>
                      )}
                    </td>
                    <td style={{ padding: 10, border: "1px solid var(--border)", fontSize: 13 }}>
                      <div>{r.expectations.join("、")}</div>
                      {r.expectation_other && (
                        <div style={{ color: "#666", fontSize: 12 }}>
                          （その他: {r.expectation_other}）
                        </div>
                      )}
                    </td>
                    <td style={{ padding: 10, border: "1px solid var(--border)", textAlign: "center" }}>
                      {r.has_chat_log ? (
                        <span style={{ color: "#28a745", fontWeight: 600 }}>あり</span>
                      ) : (
                        <span style={{ color: "#999" }}>なし</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredResponses.length === 0 && (
              <p className="note" style={{ textAlign: "center", padding: 24 }}>
                条件に一致する回答がありません
              </p>
            )}
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
