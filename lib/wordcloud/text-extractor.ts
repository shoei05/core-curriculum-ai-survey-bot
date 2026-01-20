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
    for (const token of tokens) {
      // Extract only meaningful words
      // pos: 名詞, 動詞, 形容詞, etc.
      const pos = token.pos;

      // Include nouns, verbs (base form), adjectives
      if (pos === "名詞" && token.surface_form.length >= 2 && !isStopWord(token.surface_form)) {
        words.push(token.surface_form);
      } else if (pos === "動詞" && token.basic_form && token.basic_form.length >= 2 && !isStopWord(token.basic_form)) {
        words.push(token.basic_form);
      } else if (pos === "形容詞" && token.basic_form && token.basic_form.length >= 2 && !isStopWord(token.basic_form)) {
        words.push(token.basic_form);
      }
    }

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
 * Japanese stop words (particles, auxiliary verbs, common words to exclude)
 */
const STOP_WORDS = new Set([
  // Particles and common suffixes
  "の", "に", "は", "を", "た", "が", "で", "て", "と", "し", "れ", "さ", "ある", "いる", "する", "です", "ます", "ました", "ません", "ですね", "ますね", "でしょう", "だろう", "でき", "できる", "できた", "これ", "それ", "あれ", "この", "その", "あの", "ここ", "そこ", "あそこ", "こう", "そう", "ああ", "どう", "して", "くれ", "やる", "もの", "ので", "から", "ため", "ない", "なら", "なく", "ても", "ては", "では", "より", "まで", "だけ", "ほど", "など", "とか", "ばかり", "まま", "ながら", "ところ", "こと", "ところが", "ものの", "ものを", "ことに", "ことは", "ことが", "ことを", "こんな", "そんな", "あんな", "どんな", "いう", "いった", "いって", "いない", "いく", "いけ", "いける", "なる", "なり", "なっ", "され", "れる", "られ", "よう", "みたい", "そう", "らしい", "ちゃう", "じゃう",
  // Common verbs/adjectives (generic)
  "思う", "思い", "思っ", "思わ", "考える", "感じる", "見る", "見て", "見た", "聞く", "聞い", "聞こ", "話す", "話し", "言う", "言っ", "言わ", "ある", "ない", "いい", "よい", "悪い", "多い", "少ない", "大きい", "小さい",
  // English
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from", "as", "is", "was", "are", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "should", "could", "may", "might", "must", "can", "it", "this", "that", "these", "those", "i", "you", "he", "she", "we", "they", "me", "him", "her", "us", "them", "my", "your", "his", "her", "our", "their",
]);

/**
 * Check if a token is a stop word
 * @param token - Token to check
 * @returns true if stop word
 */
function isStopWord(token: string): boolean {
  return STOP_WORDS.has(token) || token.length < 2;
}
