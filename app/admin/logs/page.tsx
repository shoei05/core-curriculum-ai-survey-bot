"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

interface SurveyLog {
    id: string;
    template_slug: string;
    created_at: string;
    messages: any[];
    summary_bullets: string[];
    keyword_groups: any[];
    issue_categories: any[];
    competency_categories: any[];
}

const MarkdownContent = ({ content }: { content: string }) => (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
        {content}
    </ReactMarkdown>
);

export default function AdminLogsPage() {
    const [logs, setLogs] = useState<SurveyLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/admin/logs")
            .then(res => res.json())
            .then(data => {
                setLogs(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="blink" style={{ textAlign: "center", padding: 40 }}>読み込み中...</div>;

    return (
        <div>
            <h2 style={{ marginBottom: 24 }}>回答一覧 (最近の100件)</h2>

            <div className="log-list">
                {logs.length === 0 && <p className="note">回答データがありません。</p>}
                {logs.map((log) => (
                    <details key={log.id} className="log-item" style={{ marginBottom: 16 }}>
                        <summary style={{ fontSize: "1.1rem", padding: "8px 0" }}>
                            {new Date(log.created_at).toLocaleString("ja-JP")} - {log.template_slug} ({log.messages.length}件のやり取り)
                        </summary>

                        <div style={{ padding: "16px 0", display: "grid", gap: 16 }}>
                            <div className="summary-card">
                                <div className="log-section-title">サマリー</div>
                                <ul className="consent-list" style={{ margin: "8px 0" }}>
                                    {log.summary_bullets.map((b, i) => <li key={i}>{b}</li>)}
                                </ul>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                <div className="keyword-item">
                                    <div className="log-section-title">困り事</div>
                                    {log.issue_categories?.map((g: any, i: number) => (
                                        <div key={i} style={{ marginBottom: 8 }}>
                                            <div className="keyword-title">{g.category}</div>
                                            <div className="note">{g.items?.join(" / ")}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="keyword-item">
                                    <div className="log-section-title">資質・能力</div>
                                    {log.competency_categories?.map((g: any, i: number) => (
                                        <div key={i} style={{ marginBottom: 8 }}>
                                            <div className="keyword-title">{g.category}</div>
                                            <div className="note">{g.items?.join(" / ")}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <details>
                                <summary className="note" style={{ cursor: "pointer" }}>会話ログを表示</summary>
                                <div className="message-stack compact" style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                                    {log.messages.map((m: any, i: number) => (
                                        <div key={i} className={`message ${m.role === "user" ? "message-user" : "message-ai"}`}>
                                            <div className="message-role">{m.role === "user" ? "あなた" : "AI"}</div>
                                            <div className="message-content markdown-content">
                                                <MarkdownContent content={m.content} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </div>
                    </details>
                ))}
            </div>
        </div>
    );
}
