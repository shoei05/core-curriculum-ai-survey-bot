"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import Wordcloud from "react-wordcloud";
import type { WordCloudWord } from "@/types/admin";
import { scaleLinear } from "d3-scale";

// Word cloud options
const options = {
  deterministic: true,
  fontSizes: [12, 60] as [number, number],
  fontFamily: "var(--font-ud), 'BIZ UDGothic', sans-serif",
  fontStyle: "normal",
  fontWeight: "normal",
  padding: 5,
  rotations: 0,
  rotationAngles: [0, 90] as [number, number],
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
      if (!words || words.length === 0) {
        return accentColor;
      }
      const max = Math.max(...words.map((w) => w.value));
      const min = Math.min(...words.map((w) => w.value));
      const normalized = max === min ? 0.5 : (word.value - min) / (max - min);
      return colorScale(normalized);
    },
    [words, colorScale, accentColor]
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

  if (words.length === 0) {
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

  return (
    <div style={{ width: "100%", height: "300px" }}>
      <Wordcloud words={words} options={options} callbacks={callbacks} />
    </div>
  );
}
