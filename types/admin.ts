/**
 * Admin panel type definitions
 */

// Word Cloud Types
export interface WordCloudWord {
  text: string;
  value: number;
}

export interface WordCloudData {
  words: WordCloudWord[];
  metadata: {
    totalResponses: number;
    dateRange: {
      start: string;
      end: string;
    };
  };
}

export interface WordCloudApiResponse {
  words: WordCloudWord[];
  metadata: WordCloudData['metadata'];
}

// Word Cloud Query Parameters
export interface WordCloudQueryParams {
  timeRange?: '7d' | '30d' | '90d' | 'all';
  minFrequency?: number;
  maxWords?: number;
}
