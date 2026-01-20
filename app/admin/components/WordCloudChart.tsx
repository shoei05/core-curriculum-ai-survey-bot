"use client";

import React, { useMemo, useCallback } from "react";
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
const createColorScale = () => {
  return scaleLinear<string>()
    .domain([0, 1])
    .range(["var(--accent)", "var(--accent-deep)"])
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
  const colorScale = useMemo(() => createColorScale(), []);

  // Create callbacks with memoized values
  const getWordColor = useCallback(
    (word: WordCloudWord) => {
      const max = Math.max(...words.map((w) => w.value));
      const min = Math.min(...words.map((w) => w.value));
      const normalized = max === min ? 0.5 : (word.value - min) / (max - min);
      return colorScale(normalized);
    },
    [words, colorScale]
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

  // Size configuration
  const size: [number, number] = [500, 300];

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
      <div style={{ width: "100%", height: "100%" }}>
        <Wordcloud words={words} size={size} options={options} callbacks={callbacks} />
      </div>
    </div>
  );
}
