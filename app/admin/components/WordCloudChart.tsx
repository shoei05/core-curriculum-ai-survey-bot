"use client";

import React, { useMemo } from "react";
import type { WordCloudWord } from "@/types/admin";
import { ErrorBoundary } from "./ErrorBoundary";

interface WordCloudChartProps {
  words: WordCloudWord[];
  onWordClick?: (word: string, value: number) => void;
}

/**
 * WordCloudChart component
 * Displays a simple word list instead of word cloud visualization
 */
export function WordCloudChart({ words, onWordClick }: WordCloudChartProps) {
  // Validate words prop
  if (!words || !Array.isArray(words)) {
    console.error("[WordCloudChart] Invalid words prop:", words);
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "300px",
          color: "var(--muted)",
        }}
      >
        データ形式が不正です
      </div>
    );
  }

  // Validate and sort words
  const validWords = useMemo(() => {
    return words
      .filter((word) => {
        if (!word || typeof word !== "object") {
          return false;
        }
        if (typeof word.text !== "string" || !word.text.trim()) {
          return false;
        }
        if (typeof word.value !== "number" || isNaN(word.value) || word.value <= 0) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.value - a.value);
  }, [words]);

  if (validWords.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "300px",
          color: "var(--muted)",
        }}
      >
        表示するデータがありません（フィルタ条件を緩めてください）
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "300px",
            color: "var(--muted)",
          }}
        >
          ワードリストの表示中にエラーが発生しました
        </div>
      }
    >
      <div
        style={{
          padding: "20px",
          maxHeight: "500px",
          overflowY: "auto",
        }}
      >
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {validWords.map((word, idx) => (
            <li
              key={`${word.text}-${idx}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                backgroundColor: "var(--card-bg, #f5f5f5)",
                borderRadius: "6px",
                cursor: onWordClick ? "pointer" : "default",
                transition: "background-color 0.2s",
                border: "1px solid var(--border, #e0e0e0)",
              }}
              onClick={() => onWordClick && onWordClick(word.text, word.value)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--accent, #c5487b)";
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--card-bg, #f5f5f5)";
                e.currentTarget.style.color = "inherit";
              }}
              title={`${word.text}: ${word.value}回`}
            >
              <span
                style={{
                  fontSize: "16px",
                  fontWeight: 500,
                }}
              >
                {word.text}
              </span>
              <span
                style={{
                  fontSize: "14px",
                  color: "var(--muted, #666)",
                  fontWeight: 600,
                }}
              >
                {word.value}回
              </span>
            </li>
          ))}
        </ul>
        <div
          style={{
            marginTop: "16px",
            fontSize: "12px",
            color: "var(--muted, #666)",
            textAlign: "center",
          }}
        >
          全 {validWords.length} 件
        </div>
      </div>
    </ErrorBoundary>
  );
}
