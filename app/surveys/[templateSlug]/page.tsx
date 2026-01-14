"use client";

import { useMemo, useState, FormEvent, use, useEffect, useCallback, useRef } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface KeywordGroup {
  category: string;
  keywords: string[];
}

interface SurveyLog {
  id: string;
  templateSlug: string;
  startedAt: string;
  endedAt: string;
  messages: Message[];
  summaryBullets: string[];
  keywordGroups: KeywordGroup[];
}

const TIME_LIMIT_SECONDS = 5 * 60;
const CLOSED_QUESTION_COUNT = 3; // First 3 questions are closed questions with buttons
const LOG_STORAGE_KEY = "surveyLogs:v1";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export default function SurveyPage({
  params
}: {
  params: Promise<{ templateSlug: string }>
}) {
  const { templateSlug } = use(params);

  const [consented, setConsented] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [remainingTime, setRemainingTime] = useState(TIME_LIMIT_SECONDS);
  const [isExpired, setIsExpired] = useState(false);
  const [questionCount, setQuestionCount] = useState(0); // Track number of AI questions
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [isEnded, setIsEnded] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryBullets, setSummaryBullets] = useState<string[]>([]);
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroup[]>([]);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryRequested, setSummaryRequested] = useState(false);
  const [logs, setLogs] = useState<SurveyLog[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesRef = useRef<Message[]>([]);

  // Determine if we're in closed question phase
  const isClosedQuestionPhase = questionCount < CLOSED_QUESTION_COUNT;

  // Suggestion buttons for closed questions (simple yes/no)
  const getSuggestions = (): string[] => {
    if (isClosedQuestionPhase) {
      return ["はい", "いいえ"];
    }
    return [];
  };

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(LOG_STORAGE_KEY);
      if (stored) {
        setLogs(JSON.parse(stored) as SurveyLog[]);
      }
    } catch (error) {
      console.warn("Failed to load logs:", error);
    }
  }, []);

  useEffect(() => {
    if (consented && !startedAt) {
      setStartedAt(new Date().toISOString());
    }
  }, [consented, startedAt]);

  useEffect(() => {
    if (consented && !isExpired && !isEnded) {
      timerRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            setIsExpired(true);
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [consented, isExpired, isEnded]);

  const persistLogs = useCallback((updater: (prev: SurveyLog[]) => SurveyLog[]) => {
    setLogs((prev) => {
      const next = updater(prev);
      if (typeof window !== "undefined") {
        localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatLogDate = (iso: string) => {
    return new Date(iso).toLocaleString("ja-JP");
  };

  const fetchInitialGreeting = useCallback(async () => {
    if (initialized || messages.length > 0) return;

    setIsLoading(true);
    setInitialized(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [], templateSlug })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "サーバーエラー");

      setMessages([{
        id: Date.now().toString(),
        role: "assistant",
        content: data.text || "本調査にご協力いただきありがとうございます。現在、大学で教育に携わっていらっしゃいますか？"
      }]);
      setQuestionCount(1);
    } catch (error) {
      console.error("Error:", error);
      setMessages([{
        id: Date.now().toString(),
        role: "assistant",
        content: "接続エラーが発生しました。ページを再読み込みしてください。"
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [initialized, messages.length, templateSlug]);

  useEffect(() => {
    if (consented && !initialized) {
      fetchInitialGreeting();
    }
  }, [consented, initialized, fetchInitialGreeting]);

  // Auto-summarize when time expires
  useEffect(() => {
    if (isExpired && !isEnded && !summaryRequested && messagesRef.current.length > 0) {
      setIsEnded(true);
    }
  }, [isExpired, isEnded, summaryRequested]);

  const summarizeConversation = useCallback(async () => {
    if (isSummarizing || summaryRequested) return;
    if (messagesRef.current.length === 0) return;

    setIsSummarizing(true);
    setSummaryRequested(true);
    setSummaryError(null);

    try {
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesRef.current.map((m) => ({ role: m.role, content: m.content })),
          templateSlug
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "サーバーエラー");

      const summary = Array.isArray(data.summaryBullets) ? data.summaryBullets : [];
      const groups = Array.isArray(data.keywordGroups) ? data.keywordGroups : [];

      setSummaryBullets(summary);
      setKeywordGroups(groups);

      const endedAt = new Date().toISOString();
      const sessionStartedAt = startedAt ?? endedAt;

      const logEntry: SurveyLog = {
        id: createId(),
        templateSlug,
        startedAt: sessionStartedAt,
        endedAt,
        messages: messagesRef.current,
        summaryBullets: summary,
        keywordGroups: groups
      };

      persistLogs((prev) => [logEntry, ...prev].slice(0, 50));
    } catch (error) {
      console.error("Summary Error:", error);
      setSummaryError("サマライズに失敗しました。もう一度お試しください。");
      setSummaryRequested(false);
    } finally {
      setIsSummarizing(false);
    }
  }, [isSummarizing, summaryRequested, templateSlug, persistLogs, startedAt]);

  // Trigger summarize when isEnded becomes true (for auto-summarize on expire)
  useEffect(() => {
    if (isEnded && !summaryRequested && messagesRef.current.length > 0) {
      summarizeConversation();
    }
  }, [isEnded, summaryRequested, summarizeConversation]);

  const handleEnd = async () => {
    if (isEnded || isSummarizing) return;
    setIsEnded(true);
    await summarizeConversation();
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading || isExpired || isEnded) return;

    const currentMessages = messagesRef.current;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...currentMessages, userMessage].map((m) => ({ role: m.role, content: m.content })),
          templateSlug
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "サーバーエラー");

      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.text || "（応答を取得できませんでした）"
      }]);
      setQuestionCount((prev) => prev + 1);
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "エラーが発生しました。もう一度お試しください。"
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  const handleSuggestionClick = async (suggestion: string) => {
    await sendMessage(suggestion);
  };

  const intro = useMemo(() => (
    <div className="consent-card">
      <h2>同意の確認</h2>
      <ul className="consent-list">
        <li>目的：モデル・コア改定のための周辺調査（教育上の課題・ニーズ収集）</li>
        <li>氏名・連絡先など個人を特定する情報は入力しないでください</li>
        <li>途中終了しても構いません</li>
        <li>回答内容は匿名化・集計して利用します</li>
        <li style={{ fontWeight: 600 }}>制限時間：5分間</li>
      </ul>
      <button
        onClick={() => setConsented(true)}
        className="btn btn-primary"
      >
        上記に同意して開始
      </button>
    </div>
  ), []);

  if (!consented) {
    return (
      <main>
        <a className="top-link" href="/">← 戻る</a>
        {intro}
      </main>
    );
  }

  const suggestions = getSuggestions();
  const isInputDisabled = isLoading || isExpired || isEnded;

  return (
    <main>
      <a className="top-link" href="/">← 戻る</a>

      <header className="survey-header">
        <h2>アンケート</h2>
        <div className={`timer ${remainingTime < 60 ? "is-urgent" : ""}`}>
          残り {formatTime(remainingTime)}
        </div>
      </header>

      {isExpired && (
        <div className="alert">
          ⏰ 制限時間が終了しました。ご協力ありがとうございました。
        </div>
      )}

      <div className="survey-grid">
        <section className="chat-panel">
          <div className="message-stack">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`message ${m.role === "user" ? "message-user" : "message-ai"}`}
              >
                <div className="message-role">{m.role === "user" ? "あなた" : "AI"}</div>
                <div className="message-content">{m.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="message message-ai thinking">
                <div className="message-role">AI</div>
                <div>考え中...</div>
              </div>
            )}
          </div>

          {isClosedQuestionPhase && suggestions.length > 0 && !isInputDisabled && (
            <div className="chip-row">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(s)}
                  className="chip"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {!isClosedQuestionPhase && (
            <form onSubmit={handleSubmit} className="input-row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isExpired ? "制限時間終了" : isEnded ? "終了しました" : "ここに入力…"}
                className="text-input"
                disabled={isInputDisabled}
              />
              <button
                type="submit"
                disabled={isInputDisabled || input.trim().length === 0}
                className="btn btn-primary"
              >
                送信
              </button>
            </form>
          )}

          {/* 終了してサマライズボタン - チャット下に大きく配置 */}
          {!isEnded && messages.length > 0 && !isClosedQuestionPhase && (
            <button
              onClick={handleEnd}
              disabled={isSummarizing || isLoading}
              className="btn-end-summarize"
            >
              {isSummarizing ? "サマライズ中..." : "✓ 終了してサマライズ"}
            </button>
          )}

          <p className="note">
            {isEnded
              ? "※終了しました。サマリーをご確認ください。"
              : isClosedQuestionPhase
                ? "※上のボタンを選んで回答してください"
                : "※個人を特定する情報は入力しないでください。"}
          </p>
        </section>

        <aside className="side-panel">
          <div className="summary-card">
            <h3 className="panel-title">サマリー</h3>
            {isSummarizing && <p className="note">サマライズ中...</p>}
            {summaryError && (
              <div style={{ color: "#b00020", marginBottom: 8 }}>
                {summaryError}
                <button
                  onClick={summarizeConversation}
                  className="btn btn-ghost"
                  style={{ marginLeft: 8 }}
                >
                  再試行
                </button>
              </div>
            )}
            {!isSummarizing && !summaryError && summaryBullets.length === 0 && (
              <p className="note">{isEnded ? "サマリーはまだありません。" : "終了するとサマリーが生成されます。"}</p>
            )}
            {summaryBullets.length > 0 && (
              <ul>
                {summaryBullets.map((bullet, index) => (
                  <li key={index}>{bullet}</li>
                ))}
              </ul>
            )}

            {keywordGroups.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="log-section-title">カテゴリ別キーワード</div>
                <div className="keyword-grid">
                  {keywordGroups.map((group, index) => (
                    <div key={index} className="keyword-item">
                      <div className="keyword-title">{group.category}</div>
                      <div style={{ color: "#555", marginTop: 4 }}>
                        {group.keywords.join(" / ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="log-list">
            <h3 className="panel-title">履歴</h3>
            {logs.length === 0 ? (
              <p className="note">履歴はまだありません。</p>
            ) : (
              logs.map((log) => (
                <details key={log.id} className="log-item">
                  <summary>
                    {formatLogDate(log.endedAt)} / {log.messages.length}件
                  </summary>
                  <div className="log-section">
                    <div className="log-section-title">サマリー</div>
                    {log.summaryBullets.length > 0 ? (
                      <ul>
                        {log.summaryBullets.map((bullet, index) => (
                          <li key={index}>{bullet}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="note">サマリーなし</p>
                    )}
                  </div>

                  {log.keywordGroups.length > 0 && (
                    <div className="log-section">
                      <div className="log-section-title">キーワード</div>
                      {log.keywordGroups.map((group, index) => (
                        <div key={index} style={{ marginBottom: 6 }}>
                          <div className="keyword-title">{group.category}</div>
                          <div style={{ color: "#555" }}>{group.keywords.join(" / ")}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="log-section">
                    <div className="log-section-title">会話ログ</div>
                    {log.messages.map((m, index) => (
                      <div key={index} style={{ margin: "6px 0" }}>
                        <div className="message-role">{m.role === "user" ? "あなた" : "AI"}</div>
                        <div className="message-content">{m.content}</div>
                      </div>
                    ))}
                  </div>
                </details>
              ))
            )}
          </div>
        </aside>
      </div>
    </main >
  );
}
