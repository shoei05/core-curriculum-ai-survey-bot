"use client";

import { useMemo, useState, FormEvent, use, useEffect, useCallback, useRef } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const TIME_LIMIT_SECONDS = 10 * 60;
const CLOSED_QUESTION_COUNT = 3; // First 3 questions are closed questions with buttons

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
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if we're in closed question phase
  const isClosedQuestionPhase = questionCount < CLOSED_QUESTION_COUNT;

  // Suggestion buttons for closed questions
  const getSuggestions = (): string[] => {
    if (questionCount === 0) return ["はい、教育に携わっています", "いいえ"];
    if (questionCount === 1) return ["はい、見たことがあります", "いいえ、見たことがありません"];
    if (questionCount === 2) return ["はい、担当しています", "いいえ、担当していません"];
    return [];
  };

  useEffect(() => {
    if (consented && !isExpired) {
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
  }, [consented, isExpired]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
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

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading || isExpired) return;

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
          messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
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
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fafafa" }}>
      <h2 style={{ marginTop: 0 }}>同意の確認</h2>
      <ul style={{ color: "#555" }}>
        <li>目的：モデル・コア改定のための周辺調査（教育上の課題・ニーズ収集）</li>
        <li>氏名・連絡先など個人を特定する情報は入力しないでください</li>
        <li>途中終了しても構いません</li>
        <li>回答内容は匿名化・集計して利用します</li>
        <li style={{ fontWeight: 600 }}>制限時間：10分間</li>
      </ul>
      <button
        onClick={() => setConsented(true)}
        style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", cursor: "pointer" }}
      >
        上記に同意して開始
      </button>
    </div>
  ), []);

  if (!consented) {
    return (
      <main>
        <p style={{ marginTop: 0 }}><a href="/">← 戻る</a></p>
        {intro}
      </main>
    );
  }

  const suggestions = getSuggestions();

  return (
    <main>
      <p style={{ marginTop: 0 }}><a href="/">← 戻る</a></p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: "8px 0" }}>アンケート</h2>
        <div style={{
          padding: "6px 12px",
          borderRadius: 8,
          background: remainingTime < 60 ? "#fee" : "#f5f5f5",
          color: remainingTime < 60 ? "#c00" : "#333",
          fontWeight: 600
        }}>
          残り {formatTime(remainingTime)}
        </div>
      </div>

      {isExpired && (
        <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          ⏰ 制限時間が終了しました。ご協力ありがとうございました。
        </div>
      )}

      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, minHeight: 280 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ margin: "10px 0" }}>
            <div style={{ fontSize: 12, color: "#777" }}>{m.role === "user" ? "あなた" : "AI"}</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
          </div>
        ))}
        {isLoading && (
          <div style={{ margin: "10px 0", color: "#999" }}>
            <div style={{ fontSize: 12, color: "#777" }}>AI</div>
            <div>考え中...</div>
          </div>
        )}
      </div>

      {/* Suggestion buttons for closed questions */}
      {isClosedQuestionPhase && suggestions.length > 0 && !isLoading && !isExpired && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSuggestionClick(s)}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid #4a90d9",
                background: "#e8f4fd",
                color: "#1a5da6",
                cursor: "pointer",
                fontWeight: 500
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Free text input for open questions */}
      {!isClosedQuestionPhase && (
        <form onSubmit={handleSubmit} style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isExpired ? "制限時間終了" : "ここに入力…"}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
            disabled={isLoading || isExpired}
          />
          <button
            type="submit"
            disabled={isLoading || input.trim().length === 0 || isExpired}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", cursor: "pointer" }}
          >
            送信
          </button>
        </form>
      )}

      <p style={{ color: "#666", marginTop: 10, fontSize: 12 }}>
        {isClosedQuestionPhase
          ? "※上のボタンを選んで回答してください"
          : "※個人を特定する情報は入力しないでください。"}
      </p>
    </main>
  );
}
