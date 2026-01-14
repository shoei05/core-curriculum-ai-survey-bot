"use client";

import { useMemo, useState } from "react";
import { useChat } from "ai/react";

export default function SurveyPage({ params }: { params: { templateSlug: string } }) {
  const templateSlug = params.templateSlug;
  const [consented, setConsented] = useState(false);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    body: { templateSlug }
  });

  const intro = useMemo(() => {
    return (
      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fafafa" }}>
        <h2 style={{ marginTop: 0 }}>同意の確認</h2>
        <ul style={{ color: "#555" }}>
          <li>目的：モデル・コア改定のための周辺調査（教育上の課題・ニーズ収集）</li>
          <li>氏名・連絡先など個人を特定する情報は入力しないでください</li>
          <li>途中終了しても構いません</li>
          <li>回答内容は匿名化・集計して利用します</li>
        </ul>
        <button
          onClick={() => setConsented(true)}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", cursor: "pointer" }}
        >
          上記に同意して開始
        </button>
      </div>
    );
  }, []);

  if (!consented) {
    return (
      <main>
        <p style={{ marginTop: 0 }}>
          <a href="/">← 戻る</a>
        </p>
        {intro}
      </main>
    );
  }

  return (
    <main>
      <p style={{ marginTop: 0 }}>
        <a href="/">← 戻る</a>
      </p>

      <h2 style={{ margin: "8px 0" }}>アンケート（{templateSlug}）</h2>

      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, minHeight: 280 }}>
        {messages.length === 0 ? (
          <p style={{ color: "#666" }}>まずは「現在の教育で困っていること」から、1〜2行で教えてください。</p>
        ) : null}

        {messages.map((m) => (
          <div key={m.id} style={{ margin: "10px 0" }}>
            <div style={{ fontSize: 12, color: "#777" }}>{m.role === "user" ? "あなた" : "AI"}</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="ここに入力…"
          style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || input.trim().length === 0}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", cursor: "pointer" }}
        >
          送信
        </button>
      </form>

      <p style={{ color: "#666", marginTop: 10, fontSize: 12 }}>
        ※個人を特定する情報（氏名/メール/電話/住所/患者情報など）は入力しないでください。
      </p>
    </main>
  );
}
