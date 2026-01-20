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

  // Validate each word has required properties
  const validWords = words.filter((word) => {
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

  if (validWords.length === 0) {
    console.warn("[WordCloudChart] No valid words after filtering");
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
        表示するデータがありません
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

  // Create callbacks with memoized values
  const getWordColor = useCallback(
    (word: WordCloudWord) => {
      if (!validWords || validWords.length === 0) {
        return accentColor;
      }
      try {
        const values = validWords.map((w) => w.value);
        const max = Math.max(...values);
        const min = Math.min(...values);
        const wordValue = word?.value ?? 0;
        const normalized = max === min ? 0.5 : (wordValue - min) / (max - min);
        return colorScale(normalized);
      } catch (err) {
        console.error("[WordCloudChart] Error in getWordColor:", err);
        return accentColor;
      }
    },
    [validWords, colorScale, accentColor]
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
      <div style={{ width: "100%", height: "300px" }}>
        <Wordcloud words={validWords} options={options} callbacks={callbacks} />
      </div>
    </ErrorBoundary>
  );
}
