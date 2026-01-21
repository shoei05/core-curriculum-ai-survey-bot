"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import Wordcloud from "react-wordcloud";
import type { WordCloudWord } from "@/types/admin";
import { scaleLinear } from "d3-scale";
import { ErrorBoundary } from "./ErrorBoundary";

// Word cloud options
const options = {
  deterministic: true,
  fontSizes: [12, 60] as [number, number],
  fontFamily: "var(--font-ud), 'BIZ UDGothic', sans-serif",
  fontStyle: "normal",
  fontWeight: "normal",
  padding: 5,
  rotations: 2,
  rotationAngles: [-90, 90] as [number, number],
  scale: "sqrt" as const,
  spiral: "archimedean" as const,
  transitionDuration: 0,
};

// Color scale for words
const createColorScale = (startColor: string, endColor: string) => {
  return scaleLinear<string>()
    .domain([0, 1])
    .range([startColor, endColor])
    .clamp(true);
};

interface WordCloudChartProps {
  words: WordCloudWord[];
  onWordClick?: (word: string, value: number) => void;
}

/**
 * WordCloudChart component
 * Displays a word cloud visualization using react-wordcloud
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

  // Validate each word has required properties (memoized to prevent infinite re-renders)
  const validWords = useMemo(() => {
    return words.filter((word) => {
    if (!word || typeof word !== 'object') {
      console.warn("[WordCloudChart] Invalid word object:", word);
      return false;
    }
    if (typeof word.text !== 'string' || !word.text.trim()) {
      console.warn("[WordCloudChart] Invalid word.text:", word);
      return false;
    }
    if (typeof word.value !== 'number' || isNaN(word.value) || word.value <= 0) {
      console.warn("[WordCloudChart] Invalid word.value:", word);
      return false;
    }
    return true;
    });
  }, [words]);

  console.log("[WordCloudChart] Validation results:", {
    inputCount: words.length,
    validCount: validWords.length,
    invalidCount: words.length - validWords.length,
    sampleValid: validWords.slice(0, 3)
  });

  if (validWords.length === 0) {
    console.warn("[WordCloudChart] No valid words after filtering. Original words:", words.slice(0, 5));
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

  // State for resolved CSS variable colors (with fallback values)
  const [accentColor, setAccentColor] = useState<string>("#c5487b");
  const [accentDeepColor, setAccentDeepColor] = useState<string>("#a23a63");

  // Resolve CSS variables to actual color values on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const rootStyles = getComputedStyle(document.documentElement);
      const accent = rootStyles.getPropertyValue('--accent').trim();
      const accentDeep = rootStyles.getPropertyValue('--accent-deep').trim();

      if (accent) setAccentColor(accent);
      if (accentDeep) setAccentDeepColor(accentDeep);
    }
  }, []);

  const colorScale = useMemo(
    () => createColorScale(accentColor, accentDeepColor),
    [accentColor, accentDeepColor]
  );

  // Store validWords length and valueRange as separate memoized values
  // to avoid including the entire validWords array in dependencies
  const wordCount = validWords.length;
  const valueRange = useMemo(() => {
    if (wordCount === 0) return { min: 0, max: 0 };
    const values = validWords.map((w) => w.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }, [validWords]); // validWords is a stable reference due to useMemo above

  // Create callbacks with memoized values
  // Note: We use wordCount and valueRange instead of validWords to break the dependency cycle
  const getWordColor = useCallback(
    (word: WordCloudWord) => {
      if (wordCount === 0) {
        return accentColor;
      }
      try {
        const { min, max } = valueRange;
        const wordValue = word?.value ?? 0;
        const normalized = max === min ? 0.5 : (wordValue - min) / (max - min);
        return colorScale(normalized);
      } catch (err) {
        console.error("[WordCloudChart] Error in getWordColor:", err);
        return accentColor;
      }
    },
    [wordCount, valueRange, colorScale, accentColor]
  );

  const getWordTooltip = useCallback((word: WordCloudWord) => {
    return `${word.text}: ${word.value}回`;
  }, []);

  const callbacks = useMemo(
    () => ({
      getWordColor,
      getWordTooltip,
      onWordClick: onWordClick
        ? (word: WordCloudWord) => {
            onWordClick(word.text, word.value);
          }
        : undefined,
    }),
    [getWordColor, getWordTooltip, onWordClick]
  );

  // Temporary fallback: simple tag cloud instead of react-wordcloud
  // This avoids the internal array access error in react-wordcloud
  const renderSimpleTagCloud = () => {
    const sorted = [...validWords].sort((a, b) => b.value - a.value);
    const max = Math.max(...validWords.map(w => w.value));
    const min = Math.min(...validWords.map(w => w.value));

    return (
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        minHeight: "300px"
      }}>
        {sorted.map((word, idx) => {
          const normalized = max === min ? 0.5 : (word.value - min) / (max - min);
          const fontSize = 12 + normalized * 36; // 12px to 48px
          const color = colorScale(normalized);

          return (
            <span
              key={`${word.text}-${idx}`}
              style={{
                fontSize: `${fontSize}px`,
                color: color,
                cursor: onWordClick ? "pointer" : "default",
                fontWeight: 600,
                transition: "transform 0.2s, opacity 0.2s",
                userSelect: "none"
              }}
              onClick={() => onWordClick && onWordClick(word.text, word.value)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.opacity = "0.8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.opacity = "1";
              }}
              title={`${word.text}: ${word.value}回`}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    );
  };

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
          ワードクラウドの表示中にエラーが発生しました
        </div>
      }
    >
      {renderSimpleTagCloud()}
    </ErrorBoundary>
  );
}
