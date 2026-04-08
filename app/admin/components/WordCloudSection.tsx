"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WordCloudChart } from "./WordCloudChart";
import type { WordCloudData, WordCloudQueryParams } from "@/types/admin";

export function WordCloudSection() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const [data, setData] = useState<WordCloudData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<WordCloudQueryParams["timeRange"]>("all");
  const [minFrequency, setMinFrequency] = useState(1);
  const [maxWords, setMaxWords] = useState(100);
  const [source, setSource] = useState<WordCloudQueryParams["source"]>("participant_messages");

  const fetchData = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      timeRange: timeRange ?? "all",
      minFrequency: String(minFrequency),
      maxWords: String(maxWords),
      source: source ?? "participant_messages",
    });

    fetch(`/api/admin/wordcloud?${params.toString()}`, {
      signal: abortControllerRef.current.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((payload: WordCloudData) => {
        setData(payload);
        setLoading(false);
      })
      .catch((fetchError) => {
        if (fetchError.name === "AbortError") {
          return;
        }
        console.error("Word cloud fetch error:", fetchError);
        setError("データの取得に失敗しました");
        setLoading(false);
      });
  }, [maxWords, minFrequency, source, timeRange]);

  useEffect(() => {
    fetchData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  const handleWordClick = useCallback((word: string) => {
    const url = new URL(window.location.origin + "/admin/logs");
    url.searchParams.set("keyword", word);
    window.location.href = url.toString();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
  };

  return (
    <div className="hero-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h3 className="panel-title">ワードクラウド</h3>
        {data && (
          <span className="note">
            {data.metadata.totalResponses}件の回答
            {data.metadata.dateRange.start !== data.metadata.dateRange.end && (
              <>（{formatDate(data.metadata.dateRange.start)} - {formatDate(data.metadata.dateRange.end)}）</>
            )}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>期間</label>
          <select
            value={timeRange}
            onChange={(event) => setTimeRange(event.target.value as WordCloudQueryParams["timeRange"])}
            style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.9rem" }}
          >
            <option value="all">すべて</option>
            <option value="7d">過去7日間</option>
            <option value="30d">過去30日間</option>
            <option value="90d">過去90日間</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>最小出現回数</label>
          <input
            type="number"
            min="1"
            max="100"
            value={minFrequency}
            onChange={(event) => setMinFrequency(parseInt(event.target.value, 10) || 1)}
            style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8, width: 90 }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>最大表示語数</label>
          <input
            type="number"
            min="10"
            max="200"
            value={maxWords}
            onChange={(event) => setMaxWords(parseInt(event.target.value, 10) || 100)}
            style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8, width: 100 }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>データ源</label>
          <select
            value={source}
            onChange={(event) => setSource(event.target.value as WordCloudQueryParams["source"])}
            style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.9rem" }}
          >
            <option value="participant_messages">参加者発話</option>
            <option value="conversation_topic_groups">会話全体トピック</option>
          </select>
        </div>
      </div>

      {loading && <div className="blink" style={{ textAlign: "center", padding: 40 }}>読み込み中...</div>}
      {error && <div className="alert">{error}</div>}

      {!loading && !error && data && (
        <>
          <p className="note" style={{ marginBottom: 16 }}>
            単語をクリックすると、該当語を含むログに絞り込めます。
          </p>
          <WordCloudChart words={data.words} onWordClick={handleWordClick} />
        </>
      )}
    </div>
  );
}
