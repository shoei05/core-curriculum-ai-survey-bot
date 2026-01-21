"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessage } from "@/types/survey";
import { generateInitialGreeting } from "@/lib/prompts";

const TIME_LIMIT_SECONDS = 7 * 60;
const MAX_MESSAGES = 14; // 7往復

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [respondentType, setRespondentType] = useState<string>("");
  const [remainingTime, setRemainingTime] = useState(TIME_LIMIT_SECONDS);
  const [isExpired, setIsExpired] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // localStorageからデータ取得
  useEffect(() => {
    const sessionId = localStorage.getItem("sessionId");
    const formResponseId = localStorage.getItem("formResponseId");
    const storedRespondentType = localStorage.getItem("respondentType");

    if (!sessionId || !formResponseId) {
      router.push("/survey");
      return;
    }

    setRespondentType(storedRespondentType || "");

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
    const timer = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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

  // メッセージ送信
  const handleSend = async () => {
    if (!input.trim() || isLoading || isExpired) return;

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
          setIsComplete(true);
          // サマリーを保存して完了画面へ
          setTimeout(() => {
            router.push("/complete");
          }, 2500);
        }
      } else {
        const errorData = await response.json();
        alert(errorData.error || "エラーが発生しました");
        // エラー時はユーザーメッセージを削除
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

  return (
    <main style={{ padding: "20px", maxWidth: 800, margin: "0 auto" }}>
      <a className="top-link" href="/survey">← 戻る</a>

      <header style={{ marginBottom: 24 }}>
        <h2>AIインタビュー</h2>
        <p style={{ color: "#666", fontSize: 14 }}>
          次期コアカリ改定への要望をお聞かせください
        </p>
      </header>

      {/* タイマー */}
      <div style={{
        padding: "12px 16px",
        borderRadius: 8,
        backgroundColor: remainingTime < 60 ? "#fff3cd" : "#f0f0f0",
        marginBottom: 20,
        textAlign: "center",
      }}>
        <span style={{ fontWeight: 600, color: remainingTime < 60 ? "#856404" : "#333" }}>
          残り {formatTime(remainingTime)}
        </span>
        {isExpired && (
          <span style={{ marginLeft: 12, color: "#856404", fontSize: 14 }}>
            （時間終了）
          </span>
        )}
      </div>

      {/* チャットエリア */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        marginBottom: 20,
        minHeight: 300,
      }}>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: "flex",
              justifyContent: message.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                padding: "12px 16px",
                borderRadius: 12,
                backgroundColor: message.role === "user" ? "var(--accent)" : "#f0f0f0",
                color: message.role === "user" ? "#fff" : "#333",
              }}
            >
              {message.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                backgroundColor: "#f0f0f0",
              }}
            >
              入力中...
            </div>
          </div>
        )}
        {isComplete && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 8,
              backgroundColor: "#d4edda",
              color: "#155724",
              textAlign: "center",
            }}
          >
            インタビュー完了！要点をまとめました...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      {!isComplete && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          style={{ display: "flex", gap: 12 }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="回答を入力してください..."
            disabled={isLoading || isExpired}
            rows={1}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              border: "1px solid #ccc",
              resize: "none",
              fontFamily: "inherit",
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || isExpired}
            style={{
              padding: "12px 24px",
              borderRadius: 8,
              border: "none",
              backgroundColor: !input.trim() || isLoading || isExpired ? "#ccc" : "var(--accent)",
              color: "#fff",
              fontWeight: 600,
              cursor: !input.trim() || isLoading || isExpired ? "not-allowed" : "pointer",
            }}
          >
            送信
          </button>
        </form>
      )}

      <p style={{ marginTop: 12, fontSize: 12, color: "#999" }}>
        Enter キーで送信、Shift + Enter で改行
      </p>
    </main>
  );
}
