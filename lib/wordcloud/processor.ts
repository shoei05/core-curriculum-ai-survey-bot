/**
 * Keyword extraction processor for word cloud generation
 * Extracts keywords from survey_logs keyword_groups field
 */

export interface KeywordGroup {
  category: string;
  keywords: string[];
}

export interface SurveyLog {
  keyword_groups?: KeywordGroup[];
  created_at?: string;
}

/**
 * Extract all keywords from survey logs
 * @param logs - Array of survey logs containing keyword_groups
 * @returns Array of extracted keywords
 */
export function extractKeywords(logs: SurveyLog[]): string[] {
  const keywords: string[] = [];

  for (const log of logs) {
    const groups = log.keyword_groups || [];
    for (const group of groups) {
      const groupKeywords = group.keywords || [];
      for (const keyword of groupKeywords) {
        // Normalize keyword: trim whitespace
        const normalized = keyword.trim();
        if (normalized.length > 0) {
          keywords.push(normalized);
        }
      }
    }
  }

  return keywords;
}

/**
 * Filter keywords by minimum frequency
 * @param keywords - Array of keywords
 * @param minFrequency - Minimum frequency threshold
 * @returns Filtered keywords
 */
export function filterByFrequency(keywords: string[], minFrequency: number): string[] {
  const frequency = new Map<string, number>();

  // Count frequency
  for (const keyword of keywords) {
    frequency.set(keyword, (frequency.get(keyword) || 0) + 1);
  }

  // Filter by minimum frequency
  const filtered: string[] = [];
  for (const keyword of keywords) {
    const count = frequency.get(keyword) || 0;
    if (count >= minFrequency) {
      filtered.push(keyword);
    }
  }

  return filtered;
}

/**
 * Get date range from logs
 * @param logs - Array of survey logs
 * @returns Object with start and end dates
 */
export function getDateRange(logs: SurveyLog[]): { start: string; end: string } {
  if (logs.length === 0) {
    const now = new Date().toISOString();
    return { start: now, end: now };
  }

  const dates = logs
    .map(log => log.created_at)
    .filter((date): date is string => date !== undefined)
    .sort();

  if (dates.length === 0) {
    const now = new Date().toISOString();
    return { start: now, end: now };
  }

  return {
    start: dates[0],
    end: dates[dates.length - 1],
  };
}
