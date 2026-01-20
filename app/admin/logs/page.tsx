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
    const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const router = useRouter();

    // Reclassification state
    const [showReclassifyModal, setShowReclassifyModal] = useState(false);
    const [reclassifyPassword, setReclassifyPassword] = useState("");
    const [reclassifyStatus, setReclassifyStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
    const [reclassifyMessage, setReclassifyMessage] = useState("");
    const [reclassifyResult, setReclassifyResult] = useState<{ processed: number; updated: number; failed: number } | null>(null);
    const [reclassifyErrors, setReclassifyErrors] = useState<Array<{ id: string; error: string }> | null>(null);

    const issueFilter = searchParams.get("issue");
    const competencyFilter = searchParams.get("competency");
    const coreItemFilter = searchParams.get("coreItem");

    const selectedLog = selectedLogId ? logs.find(log => log.id === selectedLogId) : null;

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

    const handleReclassifyIssues = async () => {
        setReclassifyStatus("processing");
        setReclassifyMessage("処理中...");
        setReclassifyErrors(null);

        try {
            const res = await fetch("/api/admin/reclassify-issues", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: reclassifyPassword })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "困り事の再分類に失敗しました");
            }

            setReclassifyStatus("success");
            setReclassifyMessage(data.message || "処理完了");
            setReclassifyResult({ processed: data.processed, updated: data.updated, failed: data.failed });
            setReclassifyErrors(data.errors || null);

            // Refresh logs after successful reclassification
            fetch("/api/admin/logs")
                .then(res => res.json())
                .then(data => setLogs(data))
                .catch(console.error);

        } catch (err) {
            setReclassifyStatus("error");
            setReclassifyMessage(err instanceof Error ? err.message : "エラーが発生しました");
        }
    };

    // Count logs with unclassified issues
    const unclassifiedIssuesCount = logs.filter((log: SurveyLog) => {
        const issues = log.issue_categories;
        return !issues ||
               !Array.isArray(issues) ||
               issues.length === 0 ||
               issues.some((cat: any) => !cat.category || !cat.items || cat.items.length === 0);
    }).length;

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
                <h2 style={{ margin: 0 }}>回答一覧 ({filteredLogs.length}件表示)</h2>

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <button
                        onClick={() => {
                            setShowReclassifyModal(true);
                            setReclassifyStatus("idle");
                            setReclassifyMessage("");
                            setReclassifyResult(null);
                            setReclassifyErrors(null);
                            setReclassifyPassword("");
                        }}
                        className="btn"
                        style={{
                            padding: "8px 16px",
                            background: unclassifiedIssuesCount > 0 ? "#e67e22" : "#95a5a6",
                            color: "white",
                            border: "none",
                            borderRadius: 6,
                            fontWeight: 600,
                            cursor: "pointer"
                        }}
                    >
                        困り事を再分類 {unclassifiedIssuesCount > 0 && `(${unclassifiedIssuesCount}件)`}
                    </button>

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
                    <details key={log.id} className="log-item" style={{ marginBottom: 16 }} open>
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

                            <button
                                onClick={() => setSelectedLogId(log.id)}
                                style={{
                                    padding: "10px 20px",
                                    background: "var(--accent)",
                                    color: "white",
                                    border: "none",
                                    borderRadius: 8,
                                    fontSize: "0.95rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "opacity 0.2s",
                                    width: "100%"
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                            >
                                会話ログを表示
                            </button>
                        </div>
                    </details>
                ))}
            </div>

            {/* Full Screen Chat Log Modal */}
            {selectedLog && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0, 0, 0, 0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                        padding: "20px"
                    }}
                    onClick={() => setSelectedLogId(null)}
                >
                    <div
                        style={{
                            background: "var(--card)",
                            borderRadius: 12,
                            width: "95vw",
                            height: "90vh",
                            maxWidth: "1400px",
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                            boxShadow: "0 10px 40px rgba(0,0,0,0.2)"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div
                            style={{
                                padding: "20px 24px",
                                borderBottom: "1px solid var(--border)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                background: "var(--surface)"
                            }}
                        >
                            <div>
                                <h3 style={{ margin: 0, fontSize: "1.3rem" }}>会話ログ</h3>
                                <p className="note" style={{ margin: "4px 0 0 0", fontSize: "0.9rem" }}>
                                    {new Date(selectedLog.created_at).toLocaleString("ja-JP")} - {selectedLog.template_slug}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedLogId(null)}
                                style={{
                                    padding: "8px 16px",
                                    background: "white",
                                    color: "var(--text-main)",
                                    border: "1px solid var(--border)",
                                    borderRadius: 6,
                                    fontSize: "1rem",
                                    cursor: "pointer",
                                    fontWeight: 600
                                }}
                            >
                                閉じる
                            </button>
                        </div>

                        {/* Modal Content - Scrollable */}
                        <div
                            style={{
                                flex: 1,
                                overflow: "auto",
                                padding: "24px"
                            }}
                        >
                            <div className="message-stack" style={{ maxWidth: "900px", margin: "0 auto" }}>
                                {selectedLog.messages.map((m: any, i: number) => (
                                    <div key={i} className={`message ${m.role === "user" ? "message-user" : "message-ai"}`}>
                                        <div className="message-role">{m.role === "user" ? "あなた" : "AI"}</div>
                                        <div className="message-content markdown-content">
                                            <MarkdownContent content={m.content} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reclassify Issues Modal */}
            {showReclassifyModal && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0, 0, 0, 0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                        padding: "20px"
                    }}
                    onClick={() => setShowReclassifyModal(false)}
                >
                    <div
                        className="hero-card"
                        style={{
                            maxWidth: 500,
                            width: "90%",
                            maxHeight: "80vh",
                            overflow: "auto"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="panel-title" style={{ marginBottom: 16 }}>困り事の再分類</h3>

                        {reclassifyStatus === "idle" && (
                            <div>
                                <p style={{ marginBottom: 16 }}>
                                    未分類の「困り事」がある回答ログ（最大1000件）をGemini 3で再分析し、困り事を抽出・分類します。<br />
                                    処理には数分かかる場合があります。
                                </p>
                                {unclassifiedIssuesCount > 0 && (
                                    <div style={{
                                        padding: 12,
                                        background: "#fff3cd",
                                        borderRadius: 6,
                                        marginBottom: 16
                                    }}>
                                        未分類のログ: <strong>{unclassifiedIssuesCount}件</strong>
                                    </div>
                                )}
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                                        管理者パスワード
                                    </label>
                                    <input
                                        type="password"
                                        value={reclassifyPassword}
                                        onChange={(e) => setReclassifyPassword(e.target.value)}
                                        placeholder="パスワードを入力"
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            border: "1px solid #ddd",
                                            borderRadius: 6,
                                            fontSize: "1rem",
                                            boxSizing: "border-box"
                                        }}
                                    />
                                </div>
                                <div style={{ display: "flex", gap: 12 }}>
                                    <button
                                        onClick={handleReclassifyIssues}
                                        disabled={!reclassifyPassword}
                                        style={{
                                            flex: 1,
                                            padding: "10px 20px",
                                            background: reclassifyPassword ? "#e67e22" : "#ccc",
                                            color: "white",
                                            border: "none",
                                            borderRadius: 6,
                                            fontSize: "1rem",
                                            fontWeight: 600,
                                            cursor: reclassifyPassword ? "pointer" : "not-allowed"
                                        }}
                                    >
                                        実行
                                    </button>
                                    <button
                                        onClick={() => setShowReclassifyModal(false)}
                                        style={{
                                            flex: 1,
                                            padding: "10px 20px",
                                            background: "white",
                                            color: "var(--text-main)",
                                            border: "1px solid #ddd",
                                            borderRadius: 6,
                                            fontSize: "1rem",
                                            cursor: "pointer"
                                        }}
                                    >
                                        キャンセル
                                    </button>
                                </div>
                            </div>
                        )}

                        {reclassifyStatus === "processing" && (
                            <div style={{ textAlign: "center", padding: 40 }}>
                                <div className="blink" style={{ fontSize: "1.2rem", marginBottom: 16 }}>
                                    処理中...
                                </div>
                                <p className="note">
                                    回答ログを分析中です。しばらくお待ちください。
                                </p>
                            </div>
                        )}

                        {(reclassifyStatus === "success" || reclassifyStatus === "error") && (
                            <div>
                                <div style={{
                                    padding: 16,
                                    background: reclassifyStatus === "success" ? "#d4edda" : "#f8d7da",
                                    borderRadius: 6,
                                    marginBottom: 16
                                }}>
                                    {reclassifyMessage}
                                </div>

                                {reclassifyResult && (
                                    <div style={{
                                        padding: 16,
                                        background: "#f8f9fa",
                                        borderRadius: 6,
                                        marginBottom: 16
                                    }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                            <span>処理件数:</span>
                                            <span style={{ fontWeight: 700 }}>{reclassifyResult.processed}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                            <span>更新成功:</span>
                                            <span style={{ fontWeight: 700, color: "#28a745" }}>{reclassifyResult.updated}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span>失敗:</span>
                                            <span style={{ fontWeight: 700, color: "#dc3545" }}>{reclassifyResult.failed}</span>
                                        </div>
                                    </div>
                                )}

                                {reclassifyErrors && reclassifyErrors.length > 0 && (
                                    <div style={{
                                        padding: 16,
                                        background: "#fff3cd",
                                        borderRadius: 6,
                                        marginBottom: 16,
                                        maxHeight: 200,
                                        overflow: "auto"
                                    }}>
                                        <div style={{ fontWeight: 600, marginBottom: 8 }}>エラー詳細:</div>
                                        {reclassifyErrors.map((err, idx) => (
                                            <div key={idx} style={{
                                                fontSize: "0.85rem",
                                                marginBottom: 8,
                                                paddingBottom: 8,
                                                borderBottom: idx < reclassifyErrors.length - 1 ? "1px solid #eee" : "none"
                                            }}>
                                                <div style={{ fontFamily: "monospace", color: "#666" }}>
                                                    ID: {err.id.slice(0, 8)}...
                                                </div>
                                                <div style={{ marginTop: 4, wordBreak: "break-word" }}>
                                                    {err.error}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <button
                                    onClick={() => setShowReclassifyModal(false)}
                                    style={{
                                        width: "100%",
                                        padding: "10px 20px",
                                        background: "#e67e22",
                                        color: "white",
                                        border: "none",
                                        borderRadius: 6,
                                        fontSize: "1rem",
                                        fontWeight: 600,
                                        cursor: "pointer"
                                    }}
                                >
                                    閉じる
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
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
