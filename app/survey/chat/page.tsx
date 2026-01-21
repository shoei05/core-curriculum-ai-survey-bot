"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessage } from "@/types/survey";
import { generateInitialGreeting } from "@/lib/prompts";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

const TIME_LIMIT_SECONDS = 7 * 60; // 7分
const EXTENSION_SECONDS = 3 * 60; // 3分延長
const MAX_MESSAGES = 14; // 7往復

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface KeywordGroup {
  category: string;
  keywords: string[];
}

interface CategoryGroup {
  category: string;
  items: string[];
}

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const MarkdownContent = ({ content }: { content: string }) => {
  const normalizeMarkdown = (text: string) => {
    return text
      .replace(/\*\*([^\s*])/g, '** $1')
      .replace(/([^\s*])\*\*/g, '$1 **');
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
      {normalizeMarkdown(content)}
    </ReactMarkdown>
  );
};

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [respondentType, setRespondentType] = useState<string>("");
  const [remainingTime, setRemainingTime] = useState(TIME_LIMIT_SECONDS);
  const [isExpired, setIsExpired] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);

  // 延長・終了関連
  const [showExtendConfirmModal, setShowExtendConfirmModal] = useState(false);
  const [extendConfirmCountdown, setExtendConfirmCountdown] = useState(60);
  const [totalExtendedTime, setTotalExtendedTime] = useState(0);
  const [isEnded, setIsEnded] = useState(false);

  // サマリー関連
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryRequested, setSummaryRequested] = useState(false);
  const [summaryBullets, setSummaryBullets] = useState<string[]>([]);
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroup[]>([]);
  const [issueCategories, setIssueCategories] = useState<CategoryGroup[]>([]);
  const [competencyCategories, setCompetencyCategories] = useState<CategoryGroup[]>([]);
  const [coreItems, setCoreItems] = useState<string[]>([]);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [sidePanelFocus, setSidePanelFocus] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const extendConfirmTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const sidePanelRef = useRef<HTMLDivElement | null>(null);

  // messagesの参照を更新
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // localStorageからデータ取得 & 初期メッセージ
  useEffect(() => {
    const sessionId = localStorage.getItem("sessionId");
    const formResponseId = localStorage.getItem("formResponseId");
    const storedRespondentType = localStorage.getItem("respondentType");

    if (!sessionId || !formResponseId) {
      router.push("/survey");
      return;
    }

    setRespondentType(storedRespondentType || "");
    setStartedAt(new Date().toISOString());

    // 初期メッセージを取得
    const fetchInitialMessage = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            formResponseId,
            respondentType: storedRespondentType,
            messages: [],
            action: "start",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setMessages([
            {
              id: createId(),
              role: "assistant",
              content: data.message || generateInitialGreeting((storedRespondentType || "faculty") as any),
            },
          ]);
        } else {
          const errorData = await response.json();
          alert(errorData.error || "エラーが発生しました");
          router.push("/survey");
        }
      } catch (error) {
        console.error("Error:", error);
        alert("通信エラーが発生しました");
        router.push("/survey");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialMessage();
  }, [router]);

  // タイマー
  useEffect(() => {
    if (!isExpired && !isEnded) {
      timerRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            setIsExpired(true);
            setShowExtendConfirmModal(true);
            setExtendConfirmCountdown(60);
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
  }, [isExpired, isEnded]);

  // 延長確認モーダルのカウントダウン
  useEffect(() => {
    if (showExtendConfirmModal) {
      extendConfirmTimerRef.current = setInterval(() => {
        setExtendConfirmCountdown((prev) => {
          if (prev <= 1) {
            if (extendConfirmTimerRef.current) {
              clearInterval(extendConfirmTimerRef.current);
            }
            // 自動的に終了してサマライズ
            handleSkipExtend();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (extendConfirmTimerRef.current) {
        clearInterval(extendConfirmTimerRef.current);
      }
    };
  }, [showExtendConfirmModal]);

  // 自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // textareaの高さを自動調整
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const focusSidePanel = useCallback(() => {
    setSidePanelFocus(true);
    if (typeof window !== "undefined") {
      sidePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => setSidePanelFocus(false), 2200);
    }
  }, []);

  // サマリー生成
  const summarizeConversation = useCallback(async () => {
    if (isSummarizing || summaryRequested) return;
    if (messagesRef.current.length === 0) return;

    setIsSummarizing(true);
    setSummaryRequested(true);
    setSummaryError(null);

    try {
      const finishedAt = new Date().toISOString();
      const sessionId = localStorage.getItem("sessionId");
      const formResponseId = localStorage.getItem("formResponseId");

      const response = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesRef.current.map((m) => ({ role: m.role, content: m.content })),
          sessionId,
          formResponseId,
          startedAt: startedAt ?? undefined,
          endedAt: finishedAt,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "サーバーエラー");

      const summary = Array.isArray(data.summaryBullets) ? data.summaryBullets : [];
      const groups = Array.isArray(data.keywordGroups) ? data.keywordGroups : [];
      const issues = Array.isArray(data.issueCategories) ? data.issueCategories : [];
      const competencies = Array.isArray(data.competencyCategories) ? data.competencyCategories : [];
      const coreItemsList = Array.isArray(data.coreItems) ? data.coreItems : [];

      setSummaryBullets(summary);
      setKeywordGroups(groups);
      setIssueCategories(issues);
      setCompetencyCategories(competencies);
      setCoreItems(coreItemsList);
    } catch (error) {
      console.error("Summary Error:", error);
      setSummaryError("サマライズに失敗しました。もう一度お試しください。");
      setSummaryRequested(false);
    } finally {
      setIsSummarizing(false);
    }
  }, [isSummarizing, summaryRequested, startedAt]);

  // サマリー生成完了時にサイドパネルにフォーカス
  useEffect(() => {
    if (!isSummarizing && summaryRequested && summaryBullets.length > 0) {
      focusSidePanel();
    }
  }, [isSummarizing, summaryRequested, summaryBullets.length, focusSidePanel]);

  // 終了ボタンクリック時
  const handleEnd = () => {
    if (isEnded || isSummarizing) return;
    setShowExtendConfirmModal(true);
    setExtendConfirmCountdown(60);
  };

  // 延長する
  const handleExtendFromModal = () => {
    setRemainingTime((prev) => prev + EXTENSION_SECONDS);
    setTotalExtendedTime((prev) => prev + EXTENSION_SECONDS);
    setIsExpired(false);
    setShowExtendConfirmModal(false);
    if (extendConfirmTimerRef.current) {
      clearInterval(extendConfirmTimerRef.current);
    }
  };

  // 延長せずに終了
  const handleSkipExtend = async () => {
    setShowExtendConfirmModal(false);
    setIsEnded(true);
    focusSidePanel();
    if (extendConfirmTimerRef.current) {
      clearInterval(extendConfirmTimerRef.current);
    }
    await summarizeConversation();
  };

  // レポートダウンロード
  const handleDownloadTxt = useCallback(() => {
    if (summaryBullets.length === 0) return;

    const separator = "--------------------------------------------------";
    const reportGeneratedAt = new Date().toLocaleString("ja-JP");

    let text = "\uFEFF"; // UTF-8 BOM
    text += `医学教育モデル・コア・カリキュラム 次期改定 事前調査レポート\r\n`;
    text += `作成日: ${reportGeneratedAt}\r\n`;
    text += `${separator}\r\n\r\n`;

    text += `■サマリー\r\n`;
    summaryBullets.forEach(b => {
      text += `・${b}\r\n`;
    });
    text += `\r\n`;

    if (issueCategories.length > 0) {
      text += `■困り事カテゴリ\r\n`;
      issueCategories.forEach(g => {
        text += `[${g.category}]: ${g.items.join(" / ")}\r\n`;
      });
      text += `\r\n`;
    }

    if (competencyCategories.length > 0) {
      text += `■資質・能力カテゴリ\r\n`;
      competencyCategories.forEach(g => {
        text += `[${g.category}]: ${g.items.join(" / ")}\r\n`;
      });
      text += `\r\n`;
    }

    if (coreItems.length > 0) {
      text += `■該当するコアカリ項目\r\n`;
      text += `${coreItems.join(", ")}\r\n\r\n`;
    }

    if (keywordGroups.length > 0) {
      text += `■カテゴリ別キーワード\r\n`;
      keywordGroups.forEach(g => {
        text += `[${g.category}]: ${g.keywords.join(" / ")}\r\n`;
      });
      text += `\r\n`;
    }

    text += `${separator}\r\n`;
    text += `■会話ログ\r\n\r\n`;
    messages.forEach(m => {
      const role = m.role === "user" ? "あなた" : "AI";
      text += `${role}:\r\n${m.content}\r\n\r\n`;
    });

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filenameDate = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `survey-report-${filenameDate}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [summaryBullets, issueCategories, competencyCategories, coreItems, keywordGroups, messages]);

  // メッセージ送信
  const handleSend = async () => {
    if (!input.trim() || isLoading || isEnded || showExtendConfirmModal) return;

    const userMessage: Message = {
      id: createId(),
      role: "user",
      content: input.trim(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const sessionId = localStorage.getItem("sessionId");
      const formResponseId = localStorage.getItem("formResponseId");

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          formResponseId,
          respondentType,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          action: "chat",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: Message = {
          id: createId(),
          role: "assistant",
          content: data.message || "",
        };
        setMessages([...newMessages, assistantMessage]);

        // インタビュー完了チェック
        if (data.isComplete) {
          setIsEnded(true);
          await summarizeConversation();
        }
      } else {
        const errorData = await response.json();
        alert(errorData.error || "エラーが発生しました");
        setMessages(messages);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("通信エラーが発生しました");
      setMessages(messages);
    } finally {
      setIsLoading(false);
    }
  };

  // Enterキーで送信
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isInputDisabled = isLoading || isEnded || showExtendConfirmModal;
  const shouldShowChatTransfer = summaryRequested || isEnded;

  return (
    <main style={{ padding: "20px", maxWidth: 1200, margin: "0 auto" }}>
      <a className="top-link" href="/survey">← 戻る</a>

      <header className="survey-header">
        <h2>AIインタビュー</h2>
        <p style={{ color: "#666", fontSize: 14 }}>
          次期コアカリ改定への要望をお聞かせください
        </p>
      </header>

      {isExpired && !showExtendConfirmModal && isEnded && (
        <div className="alert">
          ⏰ 制限時間が終了しました。ご協力ありがとうございました。
        </div>
      )}

      <div className="survey-grid">
        {/* チャットパネル */}
        <section className="chat-panel">
          <div className="message-stack">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.role === "user" ? "message-user" : "message-ai"}`}
              >
                <div className="message-role">{message.role === "user" ? "あなた" : "AI"}</div>
                <div className="message-content markdown-content">
                  <MarkdownContent content={message.content} />
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message message-ai thinking">
                <div className="message-role">AI</div>
                <div>考え中...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 入力エリア */}
          {!isEnded && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="input-row"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isInputDisabled ? "制限時間終了" : "回答を入力してください..."}
                disabled={isInputDisabled}
                rows={1}
                className="text-input"
                style={{
                  resize: "none",
                  fontFamily: "inherit",
                  fontSize: 14,
                  minHeight: 44,
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isInputDisabled}
                className="btn btn-primary"
              >
                送信
              </button>
            </form>
          )}

          {/* タイマーと終了ボタン */}
          <div className="summary-controls">
            {!isEnded && messages.length > 0 && (
              <button
                onClick={handleEnd}
                disabled={isSummarizing || isLoading}
                className="btn-end-summarize"
              >
                {isSummarizing ? <span className="blink">サマライズ中...</span> : "✓ 終了してサマライズ"}
              </button>
            )}
            <div className={`timer ${remainingTime < 60 ? "is-urgent" : ""}`}>
              残り {formatTime(remainingTime)}
              {totalExtendedTime > 0 && (
                <span style={{ fontSize: "0.85em", marginLeft: "4px" }}>
                  (+{Math.floor(totalExtendedTime / 60)}分延長中)
                </span>
              )}
            </div>
          </div>

          <p className="note">
            {isEnded
              ? "※終了しました。サマリーをご確認ください。"
              : "※Enter キーで送信、Shift + Enter で改行。個人を特定する情報は入力しないでください。"}
          </p>
        </section>

        {/* サイドパネル */}
        <aside ref={sidePanelRef} className={`side-panel ${sidePanelFocus ? "is-front" : ""}`}>
          <div className="summary-card">
            <h3 className="panel-title">サマリー</h3>
            {isSummarizing && <p className="note blink">サマライズ中...</p>}
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

            {issueCategories.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="log-section-title">困り事カテゴリ</div>
                <div className="keyword-grid">
                  {issueCategories.map((group, index) => (
                    <div key={index} className="keyword-item">
                      <div className="keyword-title">{group.category}</div>
                      <div style={{ color: "#555", marginTop: 4 }}>
                        {group.items.join(" / ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {competencyCategories.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="log-section-title">資質・能力カテゴリ</div>
                <div className="keyword-grid">
                  {competencyCategories.map((group, index) => (
                    <div key={index} className="keyword-item">
                      <div className="keyword-title">{group.category}</div>
                      <div style={{ color: "#555", marginTop: 4 }}>
                        {group.items.join(" / ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {coreItems.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="log-section-title">該当するコアカリ項目</div>
                <div style={{ color: "#555", fontSize: 14 }}>
                  {coreItems.join(", ")}
                </div>
              </div>
            )}
          </div>

          {summaryBullets.length > 0 && (
            <div className="report-card">
              <div className="report-title">ご協力ありがとうございました</div>
              <p className="report-text">
                対話内容と要約をテキストファイル（UTF-8 BOM付き）でダウンロードできます。
              </p>
              <button
                onClick={handleDownloadTxt}
                className="btn btn-primary"
              >
                レポートをダウンロード（.txt）
              </button>
            </div>
          )}

          {shouldShowChatTransfer && (
            <div className="summary-card" style={{ marginTop: 12 }}>
              <h3 className="panel-title">チャット履歴</h3>
              {messages.length === 0 ? (
                <p className="note">まだ会話がありません。</p>
              ) : (
                <div className="message-stack compact">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`message ${m.role === "user" ? "message-user" : "message-ai"}`}
                    >
                      <div className="message-role">{m.role === "user" ? "あなた" : "AI"}</div>
                      <div className="message-content markdown-content">
                        <MarkdownContent content={m.content} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* 延長確認モーダル */}
      {showExtendConfirmModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "#fff",
            borderRadius: "16px",
            padding: "24px",
            maxWidth: "400px",
            width: "90%",
            boxShadow: "0 24px 60px rgba(35, 27, 32, 0.2)"
          }}>
            <h3 style={{ margin: "0 0 16px 0", textAlign: "center", fontSize: "1.2rem" }}>
              もう少し続けますか？
            </h3>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={handleSkipExtend}
                className="btn btn-ghost"
                style={{ padding: "12px 20px", borderColor: "var(--accent)" }}
              >
                終了してサマライズ
              </button>
              <button
                onClick={handleExtendFromModal}
                className="btn btn-primary"
                style={{ padding: "12px 20px" }}
              >
                もう少し続ける (+3分)
              </button>
            </div>
            <p style={{ margin: "16px 0 0 0", textAlign: "center", color: "#666", fontSize: "0.85rem", lineHeight: "1.8" }}>
              あと1分で自動的に終了します（残り{extendConfirmCountdown}秒）
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
