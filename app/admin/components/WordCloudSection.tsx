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
  const [minFrequency, setMinFrequency] = useState(2);
  const [maxWords, setMaxWords] = useState(50);

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
  }, [timeRange, minFrequency, maxWords]);

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

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
  };

  return (
    <div className="hero-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 className="panel-title">キーワードワードクラウド</h3>
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
    </div>
  );
}
