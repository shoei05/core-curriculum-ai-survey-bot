/**
 * Text extraction utilities for word cloud from user messages
 */

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

/**
 * Simple Japanese text tokenizer (without morphological analysis)
 * Extracts potential keywords from text
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

  // Extract meaningful tokens (2+ characters for Japanese, 3+ for English)
  const tokens: string[] = [];
  for (const word of words) {
    // Check if contains Japanese characters
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(word);

    if (hasJapanese && word.length >= 2) {
      // Japanese: extract 2-4 character substrings as potential words
      for (let i = 0; i <= word.length - 2; i++) {
        for (let len = 2; len <= Math.min(4, word.length - i); len++) {
          const token = word.substr(i, len);
          if (!isStopWord(token)) {
            tokens.push(token);
          }
        }
      }
    } else if (!hasJapanese && word.length >= 3) {
      // English: take whole word if 3+ characters
      if (!isStopWord(word.toLowerCase())) {
        tokens.push(word.toLowerCase());
      }
    }
  }

  return tokens;
}

/**
 * Japanese stop words (particles, auxiliary verbs, common words to exclude)
 */
const STOP_WORDS = new Set([
  // Particles
  "の", "に", "は", "を", "た", "が", "で", "て", "と", "し", "れ", "さ", "ある", "いる", "する", "です", "ます", "でき", "これ", "それ", "あれ", "この", "その", "あの", "ここ", "そこ", "あそこ", "こう", "そう", "ああ", "どう", "して", "くれ", "やる", "もの", "ので", "から", "ため", "ない", "なら", "なく", "ても", "ては", "では", "より", "まで", "だけ", "ほど", "など", "とか", "ばかり", "まま", "ながら", "ところ", "こと", "もの", "ところが", "ものの", "ものを", "ことに", "ことは", "ことが", "ことを", "こんな", "そんな", "あんな", "どんな", "いう", "いった", "いって", "いない", "いく", "いけ", "いける",
  // Common verbs/adjectives
  "思う", "思い", "思っ", "思わ", "考え", "考える", "感じ", "感じる", "見る", "見て", "見た", "聞く", "聞い", "聞こ", "話す", "話し", "言う", "言っ", "言わ",
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
