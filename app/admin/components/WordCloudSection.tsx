"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { WordCloudChart } from "./WordCloudChart";
import type { WordCloudWord, WordCloudQueryParams } from "@/types/admin";

interface WordCloudData {
  words: WordCloudWord[];
  metadata: {
    totalResponses: number;
    dateRange: {
      start: string;
      end: string;
    };
  };
}

/**
 * WordCloudSection component
 * Manages word cloud data fetching and filter controls
 */
export function WordCloudSection() {
  const [data, setData] = useState<WordCloudData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Filter states
  const [timeRange, setTimeRange] = useState<WordCloudQueryParams["timeRange"]>("all");
  const [minFrequency, setMinFrequency] = useState(1); // Changed from 2 to 1
  const [maxWords, setMaxWords] = useState(100); // Changed from 50 to 100
  const [source, setSource] = useState<"user_messages" | "keyword_groups">("keyword_groups"); // Default to AI-extracted keywords

  // Reclassify state
  const [showReclassifyModal, setShowReclassifyModal] = useState(false);
  const [reclassifyPassword, setReclassifyPassword] = useState("");
  const [reclassifyStatus, setReclassifyStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [reclassifyMessage, setReclassifyMessage] = useState("");
  const [reclassifyResult, setReclassifyResult] = useState<{ processed: number; updated: number; failed: number } | null>(null);
  const [reclassifyErrors, setReclassifyErrors] = useState<Array<{ id: string; error: string }> | null>(null);

  // Fetch word cloud data
  const fetchData = useCallback(() => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      timeRange: timeRange || "all",
      minFrequency: minFrequency.toString(),
      maxWords: maxWords.toString(),
      source: source,
    });

    fetch(`/api/admin/wordcloud?${params.toString()}`, {
      signal: abortControllerRef.current.signal,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data: WordCloudData) => {
        console.log("[WordCloudSection] Fetched data:", {
          wordsCount: data?.words?.length ?? 0,
          totalResponses: data?.metadata?.totalResponses ?? 0,
          sampleWords: data?.words?.slice(0, 3) ?? []
        });
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") {
          return;
        }
        console.error("Word cloud fetch error:", err);
        setError("データの取得に失敗しました");
        setLoading(false);
      });
  }, [timeRange, minFrequency, maxWords, source]);

  // Initial fetch and refetch on filter changes
  useEffect(() => {
    fetchData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  // Handle word click
  const handleWordClick = useCallback((word: string, value: number) => {
    setSelectedWord(word);
    // Navigate to logs page filtered by keyword
    const url = new URL(window.location.origin + "/admin/logs");
    url.searchParams.set("keyword", word);
    window.location.href = url.toString();
  }, []);

  // Handle reclassify
  const handleReclassify = async () => {
    setReclassifyStatus("processing");
    setReclassifyMessage("処理中...");
    setReclassifyErrors(null);

    try {
      const res = await fetch("/api/admin/reclassify-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: reclassifyPassword })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "再分類に失敗しました");
      }

      setReclassifyStatus("success");
      setReclassifyMessage(data.message || "処理完了");
      setReclassifyResult({ processed: data.processed, updated: data.updated, failed: data.failed });
      setReclassifyErrors(data.errors || null);

      // Refresh word cloud after successful reclassification
      fetchData();

    } catch (err) {
      setReclassifyStatus("error");
      setReclassifyMessage(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
  };

  return (
    <div className="hero-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: "12px" }}>
        <h3 className="panel-title">キーワードワードクラウド</h3>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          {data && (
            <span className="note">
              {data.metadata.totalResponses}件の回答
              {data.metadata.dateRange.start !== data.metadata.dateRange.end && (
                <>
                  （{formatDate(data.metadata.dateRange.start)} - {formatDate(data.metadata.dateRange.end)}）
                </>
              )}
            </span>
          )}
          <button
            onClick={() => {
              setShowReclassifyModal(true);
              setReclassifyStatus("idle");
              setReclassifyMessage("");
              setReclassifyResult(null);
              setReclassifyErrors(null);
              setReclassifyPassword("");
            }}
            style={{
              padding: "6px 16px",
              background: "#48c5a9",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "opacity 0.2s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
          >
            キーワード再分類
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        {/* Time Range Filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>期間</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as WordCloudQueryParams["timeRange"])}
            style={{
              padding: "8px 12px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: "0.9rem",
              background: "var(--card)",
            }}
          >
            <option value="all">すべて</option>
            <option value="7d">過去7日間</option>
            <option value="30d">過去30日間</option>
            <option value="90d">過去90日間</option>
          </select>
        </div>

        {/* Min Frequency Filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>最小出現回数</label>
          <input
            type="number"
            min="1"
            max="100"
            value={minFrequency}
            onChange={(e) => setMinFrequency(parseInt(e.target.value) || 1)}
            style={{
              padding: "8px 12px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: "0.9rem",
              width: "80px",
            }}
          />
        </div>

        {/* Max Words Filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>最大表示語数</label>
          <input
            type="number"
            min="10"
            max="200"
            value={maxWords}
            onChange={(e) => setMaxWords(parseInt(e.target.value) || 50)}
            style={{
              padding: "8px 12px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: "0.9rem",
              width: "80px",
            }}
          />
        </div>

        {/* Source Filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>データソース</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as "user_messages" | "keyword_groups")}
            style={{
              padding: "8px 12px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: "0.9rem",
              background: "var(--card)",
            }}
          >
            <option value="keyword_groups">AI抽出キーワード</option>
            <option value="user_messages">ユーザー回答</option>
          </select>
        </div>

        {/* Apply Button */}
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              padding: "8px 20px",
              background: loading ? "#ccc" : "var(--accent-deep)",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "読み込み中..." : "更新"}
          </button>
        </div>
      </div>

      {/* Selected Word Display */}
      {selectedWord && (
        <div
          style={{
            padding: "12px",
            background: "var(--surface)",
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <span style={{ fontWeight: 600 }}>選択中: </span>
          <span style={{ color: "var(--accent-deep)" }}>{selectedWord}</span>
          <button
            onClick={() => setSelectedWord(null)}
            style={{
              marginLeft: 12,
              padding: "4px 12px",
              background: "white",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            クリア
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Word Cloud Chart */}
      {loading && !data ? (
        <div className="blink" style={{ textAlign: "center", padding: 40 }}>
          読み込み中...
        </div>
      ) : data && Array.isArray(data.words) ? (
        <WordCloudChart words={data.words} onWordClick={handleWordClick} />
      ) : null}

      {/* Hint */}
      <p className="note" style={{ marginTop: 12 }}>
        ワードをクリックすると、そのキーワードを含むアンケート回答をフィルタリングできます
      </p>

      {/* Reclassify Modal */}
      {showReclassifyModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div className="hero-card" style={{
            maxWidth: 500,
            width: "90%",
            maxHeight: "80vh",
            overflow: "auto"
          }}>
            <h3 className="panel-title" style={{ marginBottom: 16 }}>キーワードの再分類</h3>

            {reclassifyStatus === "idle" && (
              <div>
                <p style={{ marginBottom: 16 }}>
                  既存のアンケートログ（最大1000件）のユーザー回答をGeminiで再分析し、keyword_groupsを再生成します。<br />
                  処理には数分かかる場合があります。
                </p>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                    管理者パスワード
                  </label>
                  <input
                    type="password"
                    value={reclassifyPassword}
                    onChange={(e) => setReclassifyPassword(e.target.value)}
                    placeholder="パスワードを入力"
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ddd",
                      borderRadius: 6,
                      fontSize: "1rem",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={handleReclassify}
                    disabled={!reclassifyPassword}
                    style={{
                      flex: 1,
                      padding: "10px 20px",
                      background: reclassifyPassword ? "#48c5a9" : "#ccc",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      fontSize: "1rem",
                      fontWeight: 600,
                      cursor: reclassifyPassword ? "pointer" : "not-allowed"
                    }}
                  >
                    実行
                  </button>
                  <button
                    onClick={() => setShowReclassifyModal(false)}
                    style={{
                      flex: 1,
                      padding: "10px 20px",
                      background: "white",
                      color: "var(--text-main)",
                      border: "1px solid #ddd",
                      borderRadius: 6,
                      fontSize: "1rem",
                      cursor: "pointer"
                    }}
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}

            {reclassifyStatus === "processing" && (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div className="blink" style={{ fontSize: "1.2rem", marginBottom: 16 }}>
                  処理中...
                </div>
                <p className="note">
                  アンケートログを分析中です。しばらくお待ちください。
                </p>
              </div>
            )}

            {(reclassifyStatus === "success" || reclassifyStatus === "error") && (
              <div>
                <div style={{
                  padding: 16,
                  background: reclassifyStatus === "success" ? "#d4edda" : "#f8d7da",
                  borderRadius: 6,
                  marginBottom: 16
                }}>
                  {reclassifyMessage}
                </div>

                {reclassifyResult && (
                  <div style={{
                    padding: 16,
                    background: "#f8f9fa",
                    borderRadius: 6,
                    marginBottom: 16
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span>処理件数:</span>
                      <span style={{ fontWeight: 700 }}>{reclassifyResult.processed}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span>更新成功:</span>
                      <span style={{ fontWeight: 700, color: "#28a745" }}>{reclassifyResult.updated}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>失敗:</span>
                      <span style={{ fontWeight: 700, color: "#dc3545" }}>{reclassifyResult.failed}</span>
                    </div>
                  </div>
                )}

                {reclassifyErrors && reclassifyErrors.length > 0 && (
                  <div style={{
                    padding: 16,
                    background: "#fff3cd",
                    borderRadius: 6,
                    marginBottom: 16,
                    maxHeight: 200,
                    overflow: "auto"
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>エラー詳細:</div>
                    {reclassifyErrors.map((err, idx) => (
                      <div key={idx} style={{
                        fontSize: "0.85rem",
                        marginBottom: 8,
                        paddingBottom: 8,
                        borderBottom: idx < reclassifyErrors.length - 1 ? "1px solid #eee" : "none"
                      }}>
                        <div style={{ fontFamily: "monospace", color: "#666" }}>
                          ID: {err.id.slice(0, 8)}...
                        </div>
                        <div style={{ marginTop: 4, wordBreak: "break-word" }}>
                          {err.error}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setShowReclassifyModal(false)}
                  style={{
                    width: "100%",
                    padding: "10px 20px",
                    background: "#48c5a9",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  閉じる
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
