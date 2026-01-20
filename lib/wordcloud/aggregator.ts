/**
 * Frequency aggregator for word cloud generation
 * Aggregates keyword frequencies and sorts for word cloud display
 */

import type { WordCloudWord } from '@/types/admin';

/**
 * Aggregate keyword frequencies
 * @param keywords - Array of keywords
 * @returns Map of keyword to frequency count
 */
export function aggregateFrequencies(keywords: string[]): Map<string, number> {
  const frequency = new Map<string, number>();

  for (const keyword of keywords) {
    frequency.set(keyword, (frequency.get(keyword) || 0) + 1);
  }

  return frequency;
}

/**
 * Convert frequency map to word cloud word array
 * @param frequencyMap - Map of keyword to frequency
 * @param maxWords - Maximum number of words to return
 * @returns Array of WordCloudWord sorted by frequency (descending)
 */
export function toWordCloudWords(
  frequencyMap: Map<string, number>,
  maxWords: number = 50
): WordCloudWord[] {
  // Convert to array and sort by frequency (descending)
  const sorted = Array.from(frequencyMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxWords);

  // Convert to WordCloudWord format
  return sorted.map(([text, value]) => ({ text, value }));
}

/**
 * Process keywords into word cloud format
 * @param keywords - Array of keywords
 * @param maxWords - Maximum number of words to return
 * @returns Array of WordCloudWord sorted by frequency
 */
export function processToWordCloud(keywords: string[], maxWords: number = 50): WordCloudWord[] {
  const frequencyMap = aggregateFrequencies(keywords);
  return toWordCloudWords(frequencyMap, maxWords);
}
