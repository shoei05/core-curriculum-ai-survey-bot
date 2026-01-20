/**
 * Text extraction utilities for word cloud from user messages
 */

import kuromoji from "kuromoji";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface SurveyLogWithMessages {
  messages?: Message[];
  created_at?: string;
}

/**
 * Extract user messages from survey logs
 * @param logs - Array of survey logs containing messages
 * @returns Concatenated user message text
 */
export function extractUserMessages(logs: SurveyLogWithMessages[]): string {
  const userTexts: string[] = [];

  for (const log of logs) {
    const messages = log.messages || [];
    for (const message of messages) {
      if (message.role === "user" && message.content) {
        userTexts.push(message.content);
      }
    }
  }

  return userTexts.join("\n");
}

// Kuromoji tokenizer instance (cached)
let tokenizerInstance: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;
let tokenizerPromise: Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> | null = null;

/**
 * Get or initialize kuromoji tokenizer
 */
function getTokenizer(): Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> {
  if (tokenizerInstance) {
    return Promise.resolve(tokenizerInstance);
  }

  if (tokenizerPromise) {
    return tokenizerPromise;
  }

  tokenizerPromise = new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: "node_modules/kuromoji/dict" }).build((err, tokenizer) => {
      if (err) {
        reject(err);
      } else {
        tokenizerInstance = tokenizer;
        resolve(tokenizer);
      }
    });
  });

  return tokenizerPromise;
}

/**
 * Tokenize Japanese text using kuromoji morphological analysis
 * @param text - Input text
 * @returns Array of meaningful words (nouns, verbs, adjectives)
 */
export async function tokenizeJapanese(text: string): Promise<string[]> {
  try {
    const tokenizer = await getTokenizer();
    const tokens = tokenizer.tokenize(text);

    const words: string[] = [];
    const debugInfo: any[] = [];

    for (const token of tokens) {
      const pos = token.pos;
      const pos_detail_1 = token.pos_detail_1;
      const surface = token.surface_form;
      const basic = token.basic_form;

      // Debug: log first 10 tokens
      if (debugInfo.length < 10) {
        debugInfo.push({ surface, basic, pos, pos_detail_1 });
      }

      // More permissive noun filtering
      if (pos === "名詞") {
        // Include: 一般名詞, 固有名詞, サ変名詞, 形容動詞語幹
        // Exclude: 非自立名詞, 代名詞, 数詞
        if (
          pos_detail_1 !== "非自立" &&
          pos_detail_1 !== "代名詞" &&
          pos_detail_1 !== "数" &&
          surface.length >= 2 &&
          !isStopWord(surface)
        ) {
          words.push(surface);
        }
      }
      // Verbs: use base form
      else if (pos === "動詞" && basic && basic.length >= 2 && !isStopWord(basic)) {
        words.push(basic);
      }
      // Adjectives: use base form
      else if (pos === "形容詞" && basic && basic.length >= 2 && !isStopWord(basic)) {
        words.push(basic);
      }
      // Adjectival nouns (形容動詞)
      else if (pos === "形容動詞" && surface.length >= 2 && !isStopWord(surface)) {
        words.push(surface);
      }
    }

    // Log sample tokens for debugging
    if (debugInfo.length > 0) {
      console.log("[Kuromoji] Sample tokens:", debugInfo);
    }
    console.log(`[Kuromoji] Extracted ${words.length} words from ${tokens.length} tokens`);

    return words;
  } catch (error) {
    console.error("Kuromoji tokenization error:", error);
    // Fallback to simple tokenization if kuromoji fails
    return simpleTokenize(text);
  }
}

/**
 * Simple Japanese text tokenizer (fallback without morphological analysis)
 * @param text - Input text
 * @returns Array of tokens
 */
export function simpleTokenize(text: string): string[] {
  // Remove special characters and numbers, keep Japanese and alphabets
  const cleaned = text
    .replace(/[0-9０-９]/g, "") // Remove numbers
    .replace(/[、。！？「」『』（）().,!?]/g, " ") // Replace punctuation with space
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  // Split by whitespace and filter out empty strings
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0);

  const tokens: string[] = [];
  for (const word of words) {
    // Check if contains Japanese characters
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(word);

    if (hasJapanese && word.length >= 2 && !isStopWord(word)) {
      tokens.push(word);
    } else if (!hasJapanese && word.length >= 3 && !isStopWord(word.toLowerCase())) {
      tokens.push(word.toLowerCase());
    }
  }

  return tokens;
}

/**
 * Japanese stop words (minimal set - only particles, pronouns, and meaningless words)
 */
const STOP_WORDS = new Set([
  // Minimal particles and suffixes
  "です", "ます", "ました", "ません", "ですね", "ますね",
  // Pronouns and demonstratives
  "これ", "それ", "あれ", "この", "その", "あの", "ここ", "そこ", "あそこ", "どこ",
  "こう", "そう", "ああ", "どう",
  // Generic nouns (meaningless)
  "こと", "もの", "ところ", "よう", "ため", "はず", "わけ",
  // Common responses
  "はい", "いいえ", "うん", "ええ",
  // English stop words
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from",
  "is", "was", "are", "be", "have", "has", "had", "do", "does", "did",
  "it", "this", "that", "these", "those", "i", "you", "he", "she", "we", "they",
]);

/**
 * Check if a token is a stop word
 * @param token - Token to check
 * @returns true if stop word
 */
function isStopWord(token: string): boolean {
  return STOP_WORDS.has(token) || token.length < 2;
}
