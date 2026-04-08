/**
 * Admin panel type definitions
 */

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
    source: "participant_messages" | "conversation_topic_groups";
  };
}

export interface WordCloudApiResponse {
  words: WordCloudWord[];
  metadata: WordCloudData["metadata"];
}

export interface WordCloudQueryParams {
  timeRange?: "7d" | "30d" | "90d" | "all";
  minFrequency?: number;
  maxWords?: number;
  source?: "participant_messages" | "conversation_topic_groups";
}
