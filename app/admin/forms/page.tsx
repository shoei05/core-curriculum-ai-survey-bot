"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";

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
  is_chat_only?: boolean;
}

const TABS = ["overview", "list"] as const;
type Tab = (typeof TABS)[number];

function AdminFormsContent() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

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
      // チャットのみは課題・期待フィルタを無視
      if (!r.is_chat_only) {
        if (filterChallenge !== "all" && !r.challenges.includes(filterChallenge)) {
          return false;
        }
        if (filterExpectation !== "all" && !r.expectations.includes(filterExpectation)) {
          return false;
        }
      }
      return true;
    });
  }, [responses, filterRespondentType, filterChallenge, filterExpectation]);

  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: 400, margin: "100px auto", padding: 24 }}>
        <div className="consent-card">
          <h2 style={{ textAlign: "center", marginBottom: 24 }}>管理者ログイン</h2>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: "1rem" }}>
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleLogin()}
              style={{
                width: "100%",
                padding: 16,
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: "1.1rem",
              }}
              placeholder="管理パスワードを入力"
              autoFocus
            />
            <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 8 }}>
              環境変数 ADMIN_PASSWORD で設定されたパスワードを入力してください
            </p>
          </div>
          <button onClick={handleLogin} className="btn btn-primary" style={{ width: "100%", padding: 14, fontSize: "1rem" }}>
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
  const challengeOptions = Array.from(
    new Set(responses.flatMap((r) => r.challenges || []))
  );
  const expectationOptions = Array.from(
    new Set(responses.flatMap((r) => r.expectations || []))
  );

  // BI集計データ
  const statsData = useMemo(() => {
    // 回答者タイプ分布
    const typeCounts: Record<string, number> = {};
    const typeLabels: Record<string, string> = {};
    responses.forEach((r) => {
      const type = r.respondent_type_code || "unknown";
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      typeLabels[type] = r.respondent_type;
    });
    const typeDistribution = Object.entries(typeCounts)
      .map(([type, count]) => ({
        type,
        label: typeLabels[type],
        count,
        percent: responses.length > 0 ? (count / responses.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // 課題認識ランキング（チャットのみ除く）
    const challengeCounts: Record<string, number> = {};
    responses.forEach((r) => {
      if (!r.is_chat_only) {
        (r.challenges || []).forEach((c) => {
          challengeCounts[c] = (challengeCounts[c] || 0) + 1;
        });
      }
    });
    const challengeRanking = Object.entries(challengeCounts)
      .map(([challenge, count]) => ({ challenge, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 期待ランキング（チャットのみ除く）
    const expectationCounts: Record<string, number> = {};
    responses.forEach((r) => {
      if (!r.is_chat_only) {
        (r.expectations || []).forEach((e) => {
          expectationCounts[e] = (expectationCounts[e] || 0) + 1;
        });
      }
    });
    const expectationRanking = Object.entries(expectationCounts)
      .map(([expectation, count]) => ({ expectation, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // チャートあり/なし
    const withChat = responses.filter((r) => r.has_chat_log).length;
    const withoutChat = responses.length - withChat;

    // 日別回答数（最近7日）
    const dailyCounts: Record<string, number> = {};
    responses.forEach((r) => {
      const date = new Date(r.created_at).toLocaleDateString("ja-JP");
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });
    const dailyData = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .slice(-7);

    return {
      typeDistribution,
      challengeRanking,
      expectationRanking,
      chatRate: {
        with: withChat,
        without: withoutChat,
        withPercent: responses.length > 0 ? (withChat / responses.length) * 100 : 0,
      },
      dailyData,
    };
  }, [responses]);

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
            {tab === "list" && "回答一覧"}
          </button>
        ))}
      </div>

      {/* 概要タブ */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* 総回答数 */}
          <div className="consent-card" style={{ textAlign: "center", padding: 32 }}>
            <h3 style={{ marginBottom: 16 }}>総回答数</h3>
            <div style={{ fontSize: "3rem", fontWeight: 700, color: "var(--accent)" }}>
              {responses.length.toLocaleString()}<span style={{ fontSize: "1.5rem", marginLeft: 8 }}>件</span>
            </div>
          </div>

          {/* BIダッシュボード */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            {/* 回答者タイプ分布 */}
            <div className="consent-card" style={{ padding: 20 }}>
              <h4 style={{ marginBottom: 16 }}>回答者タイプ分布</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {statsData.typeDistribution.map((item) => (
                  <div key={item.type}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 14 }}>{item.label}</span>
                      <span style={{ fontSize: 13, color: "#666" }}>{item.count}件 ({item.percent.toFixed(1)}%)</span>
                    </div>
                    <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${item.percent}%`,
                          background: `hsl(210, 70%, 50%)`,
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* チャットあり/なし */}
            <div className="consent-card" style={{ padding: 20 }}>
              <h4 style={{ marginBottom: 16 }}>チャットログ</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 14 }}>あり</span>
                    <span style={{ fontSize: 13, color: "#666" }}>{statsData.chatRate.with}件 ({statsData.chatRate.withPercent.toFixed(1)}%)</span>
                  </div>
                  <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${statsData.chatRate.withPercent}%`,
                        background: "#28a745",
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 14 }}>なし</span>
                    <span style={{ fontSize: 13, color: "#666" }}>{statsData.chatRate.without}件 ({(100 - statsData.chatRate.withPercent).toFixed(1)}%)</span>
                  </div>
                  <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${100 - statsData.chatRate.withPercent}%`,
                        background: "#dc3545",
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 課題認識・期待ランキング */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            {/* 課題認識トップ5 */}
            <div className="consent-card" style={{ padding: 20 }}>
              <h4 style={{ marginBottom: 16 }}>課題認識 Top 5</h4>
              {statsData.challengeRanking.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {statsData.challengeRanking.map((item, idx) => (
                    <div key={item.challenge} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        width: 24,
                        height: 24,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: idx < 3 ? "#ffd700" : "#f0f0f0",
                        borderRadius: "50%",
                        fontSize: 12,
                        fontWeight: 600,
                      }}>{idx + 1}</span>
                      <div style={{ flex: 1, height: 6, background: "#f0f0f0", borderRadius: 3 }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${statsData.challengeRanking[0] ? (item.count / statsData.challengeRanking[0].count) * 100 : 0}%`,
                            background: `hsl(0, 70%, ${60 - idx * 10}%)`,
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 13, minWidth: 40, textAlign: "right" }}>{item.count}</span>
                      <span style={{ fontSize: 12, color: "#666", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.challenge}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "#999", fontSize: 14 }}>データがありません</p>
              )}
            </div>

            {/* 期待トップ5 */}
            <div className="consent-card" style={{ padding: 20 }}>
              <h4 style={{ marginBottom: 16 }}>期待 Top 5</h4>
              {statsData.expectationRanking.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {statsData.expectationRanking.map((item, idx) => (
                    <div key={item.expectation} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        width: 24,
                        height: 24,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: idx < 3 ? "#ffd700" : "#f0f0f0",
                        borderRadius: "50%",
                        fontSize: 12,
                        fontWeight: 600,
                      }}>{idx + 1}</span>
                      <div style={{ flex: 1, height: 6, background: "#f0f0f0", borderRadius: 3 }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${statsData.expectationRanking[0] ? (item.count / statsData.expectationRanking[0].count) * 100 : 0}%`,
                            background: `hsl(140, 70%, ${60 - idx * 10}%)`,
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 13, minWidth: 40, textAlign: "right" }}>{item.count}</span>
                      <span style={{ fontSize: 12, color: "#666", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.expectation}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "#999", fontSize: 14 }}>データがありません</p>
              )}
            </div>
          </div>
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
                  <option value="practitioner">医療者</option>
                  <option value="chat_only">チャットのみ</option>
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
                  <tr key={r.id}>
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
                      {r.is_chat_only ? (
                        <span style={{ color: "#999" }}>-</span>
                      ) : (
                        <>
                          <div>{r.challenges.join("、") || "-"}</div>
                          {r.challenge_other && (
                            <div style={{ color: "#666", fontSize: 12 }}>
                              （その他: {r.challenge_other}）
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td style={{ padding: 10, border: "1px solid var(--border)", fontSize: 13 }}>
                      {r.is_chat_only ? (
                        <span style={{ color: "#999" }}>-</span>
                      ) : (
                        <>
                          <div>{r.expectations.join("、") || "-"}</div>
                          {r.expectation_other && (
                            <div style={{ color: "#666", fontSize: 12 }}>
                              （その他: {r.expectation_other}）
                            </div>
                          )}
                        </>
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
