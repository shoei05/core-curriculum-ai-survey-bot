"use client";

import { useMemo, useState, FormEvent, use, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

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

interface SurveyLog {
  id: string;
  templateSlug: string;
  startedAt: string;
  endedAt: string;
  messages: Message[];
  summaryBullets: string[];
  keywordGroups: KeywordGroup[];
  issueCategories?: CategoryGroup[];
  competencyCategories?: CategoryGroup[];
  coreItems?: string[];
}

const TIME_LIMIT_SECONDS = 5 * 60;
const CLOSED_QUESTION_COUNT = 3; // First 3 questions are closed questions with buttons
const LOG_STORAGE_KEY = "surveyLogs:v1";
const EXTENSION_SECONDS = 3 * 60; // 3 minutes per extension

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const MarkdownContent = ({ content }: { content: string }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
    {content}
  </ReactMarkdown>
);

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
  const [showTimeUpOptions, setShowTimeUpOptions] = useState(false);
  const [totalExtendedTime, setTotalExtendedTime] = useState(0);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryBullets, setSummaryBullets] = useState<string[]>([]);
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroup[]>([]);
  const [issueCategories, setIssueCategories] = useState<CategoryGroup[]>([]);
  const [competencyCategories, setCompetencyCategories] = useState<CategoryGroup[]>([]);
  const [coreItems, setCoreItems] = useState<string[]>([]);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryRequested, setSummaryRequested] = useState(false);
  const [summaryAttempted, setSummaryAttempted] = useState(false);
  const [logs, setLogs] = useState<SurveyLog[]>([]);
  const [sidePanelFocus, setSidePanelFocus] = useState(false);
  const [showExtendConfirmModal, setShowExtendConfirmModal] = useState(false);
  const [extendConfirmCountdown, setExtendConfirmCountdown] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const sidePanelRef = useRef<HTMLDivElement | null>(null);
  const extendConfirmTimerRef = useRef<NodeJS.Timeout | null>(null);

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
            setShowTimeUpOptions(true);
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

  const focusSidePanel = useCallback(() => {
    setSidePanelFocus(true);
    if (typeof window !== "undefined") {
      sidePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => setSidePanelFocus(false), 2200);
    }
  }, []);

  const handleDownloadTxt = useCallback(() => {
    if (summaryBullets.length === 0) return;

    const separator = "--------------------------------------------------";
    const reportGeneratedAt = new Date().toLocaleString("ja-JP");

    let text = "\uFEFF"; // UTF-8 BOM
    text += `医学教育モデル・コア・カリキュラム 改定 事前調査レポート\r\n`;
    text += `作成日: ${reportGeneratedAt}\r\n`;
    text += `テンプレート: ${templateSlug}\r\n`;
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
  }, [summaryBullets, issueCategories, competencyCategories, coreItems, keywordGroups, messages, templateSlug]);

  // Auto-summarize when time expires (only if user didn't choose to extend)
  useEffect(() => {
    if (isExpired && !showTimeUpOptions && !isEnded && !summaryRequested && messagesRef.current.length > 0) {
      setIsEnded(true);
    }
  }, [isExpired, showTimeUpOptions, isEnded, summaryRequested]);

  const summarizeConversation = useCallback(async () => {
    if (isSummarizing || summaryRequested) return;
    if (messagesRef.current.length === 0) return;

    setIsSummarizing(true);
    setSummaryRequested(true);
    setSummaryAttempted(true);
    setSummaryError(null);

    try {
      const finishedAt = new Date().toISOString();
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesRef.current.map((m) => ({ role: m.role, content: m.content })),
          templateSlug,
          startedAt: startedAt ?? undefined,
          endedAt: finishedAt
        })
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

      const sessionStartedAt = startedAt ?? finishedAt;

      const logEntry: SurveyLog = {
        id: createId(),
        templateSlug,
        startedAt: sessionStartedAt,
        endedAt: finishedAt,
        messages: messagesRef.current,
        summaryBullets: summary,
        keywordGroups: groups,
        issueCategories: issues,
        competencyCategories: competencies,
        coreItems: coreItemsList
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

  useEffect(() => {
    if (!isSummarizing && summaryRequested && summaryBullets.length > 0) {
      focusSidePanel();
    }
  }, [isSummarizing, summaryRequested, summaryBullets.length, focusSidePanel]);

  // Trigger summarize when isEnded becomes true (for auto-summarize on expire)
  useEffect(() => {
    if (isEnded && !summaryRequested && !summaryAttempted && messagesRef.current.length > 0) {
      focusSidePanel();
      summarizeConversation();
    }
  }, [isEnded, summaryRequested, summaryAttempted, summarizeConversation, focusSidePanel]);

  // Countdown timer for extend confirm modal (1 minute)
  useEffect(() => {
    if (showExtendConfirmModal) {
      extendConfirmTimerRef.current = setInterval(() => {
        setExtendConfirmCountdown((prev) => {
          if (prev <= 1) {
            // Time's up, auto proceed to summarize
            if (extendConfirmTimerRef.current) {
              clearInterval(extendConfirmTimerRef.current);
            }
            // Automatically skip extension and summarize
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

  const handleEnd = () => {
    if (isEnded || isSummarizing) return;
    // Show extend confirm modal instead of directly ending
    setShowExtendConfirmModal(true);
    setExtendConfirmCountdown(60);
  };

  const handleExtendFromModal = () => {
    // Add 3 minutes and continue
    setRemainingTime((prev) => prev + EXTENSION_SECONDS);
    setTotalExtendedTime((prev) => prev + EXTENSION_SECONDS);
    setIsExpired(false);
    setShowExtendConfirmModal(false);
    if (extendConfirmTimerRef.current) {
      clearInterval(extendConfirmTimerRef.current);
    }
  };

  const handleSkipExtend = async () => {
    // Skip extension and proceed to summarize
    setShowExtendConfirmModal(false);
    setIsEnded(true);
    focusSidePanel();
    if (extendConfirmTimerRef.current) {
      clearInterval(extendConfirmTimerRef.current);
    }
    await summarizeConversation();
  };

  const handleExtend = () => {
    setRemainingTime((prev) => prev + EXTENSION_SECONDS);
    setTotalExtendedTime((prev) => prev + EXTENSION_SECONDS);
    setIsExpired(false);
    setShowTimeUpOptions(false);
  };

  const handleTimeUpEnd = async () => {
    setShowTimeUpOptions(false);
    setIsEnded(true);
    focusSidePanel();
    await summarizeConversation();
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading || showTimeUpOptions || isEnded) return;

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

      <details className="consent-details" open>
        <summary>研究背景・目的</summary>
        <div className="consent-details-content">
          <p><strong>目的：</strong>医学教育モデル・コア・カリキュラム改定のため、現状の教育課題やニーズを把握する研究です。</p>
          <p><strong>なぜこの調査：</strong>教育現場での困りごとや、優先すべき資質・能力について、先生方の視点をお聞かせいただきたく存じます。</p>
        </div>
      </details>

      <details className="consent-details" open>
        <summary>調査方法</summary>
        <div className="consent-details-content">
          <ul>
            <li><strong>形式：</strong>AIアシスタントによる対話形式のインタビュー調査</li>
            <li><strong>所要時間：</strong>約5分間（時間終了後は延長可能）</li>
            <li><strong>技術：</strong>AIを用いて回答内容を解析し、テーマ・キーワードを抽出します</li>
          </ul>
        </div>
      </details>

      <details className="consent-details" open>
        <summary>対象者と選出理由</summary>
        <div className="consent-details-content">
          <p><strong>対象：</strong>卒前医学教育に携わる教員の方</p>
          <p><strong>選出理由：</strong>医学教育の専門知識と実践経験をお持ちであり、カリキュラム改定に向けた貴重なご意見をお伺いできるため</p>
        </div>
      </details>

      <details className="consent-details" open>
        <summary>リスクとベネフィット</summary>
        <div className="consent-details-content">
          <p><strong>リスク：</strong>時間の負担、教育上の課題について話すことによる心理的な不快感の可能性（いずれも軽微）</p>
          <p><strong>ベネフィット：</strong>医学教育カリキュラムの改善に貢献</p>
          <p><strong>謝礼：</strong>なし</p>
        </div>
      </details>

      <details className="consent-details" open>
        <summary>プライバシーとデータ取り扱い</summary>
        <div className="consent-details-content">
          <ul>
            <li><strong>匿名性：</strong>個人を特定できる情報（氏名・所属・連絡先等）は収集しません</li>
            <li><strong>集計：</strong>回答は他の回答者の方のデータと合わせて集約・分析します</li>
            <li><strong>保存：</strong>データは暗号化され、アクセス制限された環境で保存されます</li>
            <li><strong>保持期間：</strong>研究目的のため5年間保存します</li>
          </ul>
        </div>
      </details>

      <details className="consent-details" open>
        <summary>参加者の権利</summary>
        <div className="consent-details-content">
          <ul>
            <li><strong>任意性：</strong>研究への参加は任意です</li>
            <li><strong>拒否権：</strong>同意しない場合でも不利益は一切ありません</li>
            <li><strong>途中撤回：</strong>いつでも参加を取りやめることができます</li>
            <li><strong>質問省略：</strong>回答したくない質問はスキップ可能です</li>
            <li><strong>データ削除請求：</strong>回答後の削除を希望される場合は、下記連絡先までお問い合わせください</li>
          </ul>
        </div>
      </details>

      <details className="consent-details" open>
        <summary>研究承認・問い合わせ</summary>
        <div className="consent-details-content">
          <p><strong>IRB承認番号：</strong>[機関に合わせて設定 - 例: IRB-2026-001]</p>
          <p><strong>研究責任者：</strong>[責任者氏名・所属]</p>
          <p><strong>所属機関：</strong>[機関名]</p>
          <p><strong>研究に関するお問い合わせ：</strong>[email/phone]</p>
          <p><strong>研究倫理に関するお問い合わせ：</strong>[IRB連絡先]</p>
        </div>
      </details>

      <div className="consent-statement">
        <p>「同意して開始」をクリックすることで、以下のことを確認したものとみなします：</p>
        <ul>
          <li>上記の内容を読み、理解した</li>
          <li>自らの意志で研究に参加することに同意する</li>
          <li>いつでも参加を取りやめることができることを理解した</li>
        </ul>
      </div>

      <div className="consent-timer-notice">
        <p style={{ fontWeight: 600 }}>⏰ 制限時間：5分間（できるだけ5分間お話しください）</p>
        <p style={{ fontSize: 14, color: "#666" }}>※時間終了後、延長を選択いただけます</p>
      </div>

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
  const isInputDisabled = isLoading || showTimeUpOptions || isEnded;
  const shouldShowChatTransfer = summaryRequested || isEnded;
  const reportGeneratedAt = new Date().toLocaleString("ja-JP");

  return (
    <main>
      <a className="top-link" href="/">← 戻る</a>

      <header className="survey-header">
        <h2>アンケート</h2>
      </header>

      {showTimeUpOptions && (
        <div className="alert time-up-options">
          <p style={{ margin: "0 0 12px 0", fontWeight: 600 }}>⏰ 制限時間が終了しました。もう少し続けますか？</p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={handleExtend}
              className="btn btn-primary"
              style={{ padding: "10px 16px" }}
            >
              もう少し続ける (+3分)
            </button>
            <button
              onClick={handleTimeUpEnd}
              className="btn btn-ghost"
              style={{ padding: "10px 16px", borderColor: "var(--accent)" }}
            >
              終了してサマライズ
            </button>
          </div>
        </div>
      )}

      {isExpired && !showTimeUpOptions && (
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
                <div className="message-content markdown-content">
                  <MarkdownContent content={m.content} />
                </div>
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

          <div className="summary-controls">
            {!isEnded && messages.length > 0 && !isClosedQuestionPhase && (
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
            <p className="note" style={{ marginTop: 6 }}>
              ※できるだけ5分間ご入力ください（時間終了後は延長可能です。「終了してサマライズ」はなるべく押さないでください）
            </p>
          </div>

          <p className="note">
            {isEnded
              ? "※終了しました。サマリーをご確認ください。"
              : isClosedQuestionPhase
                ? "※上のボタンを選んで回答してください"
                : "※個人を特定する情報は入力しないでください。"}
          </p>
        </section>

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

          <div className="log-list">
            <h3 className="panel-title">履歴</h3>
            {logs.length === 0 ? (
              <p className="note">履歴はまだありません。</p>
            ) : (
              logs.map((log) => {
                const issueCats = log.issueCategories ?? [];
                const competencyCats = log.competencyCategories ?? [];
                const logCoreItems = log.coreItems ?? [];

                return (
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

                    {issueCats.length > 0 && (
                      <div className="log-section">
                        <div className="log-section-title">困り事カテゴリ</div>
                        {issueCats.map((group, index) => (
                          <div key={index} style={{ marginBottom: 6 }}>
                            <div className="keyword-title">{group.category}</div>
                            <div style={{ color: "#555" }}>{group.items.join(" / ")}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {competencyCats.length > 0 && (
                      <div className="log-section">
                        <div className="log-section-title">資質・能力カテゴリ</div>
                        {competencyCats.map((group, index) => (
                          <div key={index} style={{ marginBottom: 6 }}>
                            <div className="keyword-title">{group.category}</div>
                            <div style={{ color: "#555" }}>{group.items.join(" / ")}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {logCoreItems.length > 0 && (
                      <div className="log-section">
                        <div className="log-section-title">該当するコアカリ項目</div>
                        <div style={{ color: "#555", fontSize: 14 }}>
                          {logCoreItems.join(", ")}
                        </div>
                      </div>
                    )}

                    <div className="log-section">
                      <div className="log-section-title">会話ログ</div>
                      {log.messages.map((m, index) => (
                        <div key={index} style={{ margin: "6px 0" }}>
                          <div className="message-role">{m.role === "user" ? "あなた" : "AI"}</div>
                          <div className="message-content markdown-content">
                            <MarkdownContent content={m.content} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })
            )}
          </div>
        </aside>
      </div>

      <div style={{ paddingBottom: 40 }} />

      {/* Extend Confirm Modal */}
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
            <p style={{ margin: "0 0 16px 0", textAlign: "center", color: "#666" }}>
              あと{Math.ceil(extendConfirmCountdown / 60)}分で自動的に終了します
            </p>
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
          </div>
        </div>
      )}
    </main >
  );
}
