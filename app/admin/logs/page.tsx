"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
    core_items: string[];
}

const MarkdownContent = ({ content }: { content: string }) => (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
        {content}
    </ReactMarkdown>
);

function AdminLogsContent() {
    const [logs, setLogs] = useState<SurveyLog[]>([]);
    const [loading, setLoading] = useState(true);
    const searchParams = useSearchParams();
    const router = useRouter();

    const issueFilter = searchParams.get("issue");
    const competencyFilter = searchParams.get("competency");
    const coreItemFilter = searchParams.get("coreItem");

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

    const filteredLogs = useMemo(() => {
        if (!issueFilter && !competencyFilter && !coreItemFilter) return logs;
        return logs.filter(log => {
            if (issueFilter) {
                return log.issue_categories?.some(cat => cat.category === issueFilter);
            }
            if (competencyFilter) {
                return log.competency_categories?.some(cat => cat.category === competencyFilter);
            }
            if (coreItemFilter) {
                return log.core_items?.includes(coreItemFilter);
            }
            return true;
        });
    }, [logs, issueFilter, competencyFilter, coreItemFilter]);

    if (loading) return <div className="blink" style={{ textAlign: "center", padding: 40 }}>読み込み中...</div>;

    const clearFilter = () => {
        router.push("/admin/logs");
    };

    const handleDownloadCsv = async () => {
        const password = window.prompt("管理パスワードを入力してください（CSV出力）");
        if (!password) return;

        try {
            const res = await fetch("/api/admin/logs/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `survey_logs_${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else {
                const data = await res.json();
                alert(data.error || "出力に失敗しました。");
            }
        } catch (err) {
            alert("通信エラーが発生しました。");
        }
    };

    const handleDelete = async (id: string) => {
        const password = window.prompt("管理パスワードを入力してください。この操作は取り消せません。");
        if (!password) return;

        try {
            const res = await fetch("/api/admin/logs/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, password }),
            });

            if (res.ok) {
                setLogs(prev => prev.filter(log => log.id !== id));
                alert("削除しました。");
            } else {
                const data = await res.json();
                alert(data.error || "削除に失敗しました。");
            }
        } catch (err) {
            alert("通信エラーが発生しました。");
        }
    };

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
                <h2 style={{ margin: 0 }}>回答一覧 ({filteredLogs.length}件表示)</h2>

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <button onClick={handleDownloadCsv} className="btn btn-primary" style={{ padding: "8px 16px" }}>
                        CSV出力 (UTF-8 BOM)
                    </button>

                    {(issueFilter || competencyFilter || coreItemFilter) && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span className="pill" style={{ background: "var(--accent-light)", color: "var(--accent-deep)" }}>
                                フィルタ: {issueFilter || competencyFilter || coreItemFilter}
                            </span>
                            <button onClick={clearFilter} className="btn btn-ghost" style={{ fontSize: "0.8rem", padding: "4px 8px" }}>
                                フィルタ解除
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="log-list">
                {filteredLogs.length === 0 && <p className="note">条件に一致する回答データがありません。</p>}
                {filteredLogs.map((log) => (
                    <details key={log.id} className="log-item" style={{ marginBottom: 16 }}>
                        <summary style={{ fontSize: "1.1rem", padding: "8px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                {new Date(log.created_at).toLocaleString("ja-JP")} - {log.template_slug} ({log.messages.length}件のやり取り)
                            </div>
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleDelete(log.id);
                                }}
                                className="btn btn-ghost"
                                style={{ color: "#b00020", fontSize: "0.8rem", border: "1px solid #ffcdd2", background: "#fdf8f8" }}
                            >
                                削除
                            </button>
                        </summary>

                        <div style={{ padding: "16px 0", display: "grid", gap: 16 }}>
                            <div className="summary-card">
                                <div className="log-section-title">サマリー</div>
                                <ul className="consent-list" style={{ margin: "8px 0" }}>
                                    {log.summary_bullets.map((b, i) => <li key={i}>{b}</li>)}
                                </ul>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
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
                                <div className="keyword-item">
                                    <div className="log-section-title">コアカリ項目</div>
                                    {log.core_items && log.core_items.length > 0 ? (
                                        <div className="note">{log.core_items.join(", ")}</div>
                                    ) : (
                                        <div className="note">該当なし</div>
                                    )}
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

export default function AdminLogsPage() {
    return (
        <Suspense fallback={<div className="blink" style={{ textAlign: "center", padding: 40 }}>読み込み中...</div>}>
            <AdminLogsContent />
        </Suspense>
    );
}
