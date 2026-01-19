"use client";

import { useEffect, useState, useRef } from "react";

interface Stats {
    totalCount: number;
    slugDistribution: Record<string, number>;
    issueDistribution: Record<string, number>;
    competencyDistribution: Record<string, number>;
    coreItemsDistribution: Record<string, number>;
}

// Statsスキーマ検証
function validateStats(data: unknown): data is Stats {
    if (typeof data !== "object" || data === null) return false;

    const d = data as Record<string, unknown>;
    if (typeof d.totalCount !== "number" || d.totalCount < 0) return false;

    const isRecord = (v: unknown): v is Record<string, number> => {
        if (typeof v !== "object" || v === null) return false;
        return Object.values(v as Record<string, unknown>).every(
            val => typeof val === "number" && val >= 0
        );
    };

    return isRecord(d.slugDistribution) &&
           isRecord(d.issueDistribution) &&
           isRecord(d.competencyDistribution) &&
           isRecord(d.coreItemsDistribution);
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Reclassification state
    const [showReclassifyModal, setShowReclassifyModal] = useState(false);
    const [reclassifyPassword, setReclassifyPassword] = useState("");
    const [reclassifyStatus, setReclassifyStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
    const [reclassifyMessage, setReclassifyMessage] = useState("");
    const [reclassifyResult, setReclassifyResult] = useState<{ processed: number; updated: number; failed: number } | null>(null);
    const [reclassifyErrors, setReclassifyErrors] = useState<Array<{ id: string; error: string }> | null>(null);

    useEffect(() => {
        // 前回のリクエストをキャンセル
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();

        fetch("/api/admin/stats", { signal: abortControllerRef.current.signal })
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                if (!validateStats(data)) {
                    throw new Error("Invalid stats data format");
                }
                setStats(data);
                setLoading(false);
                setError(null);
            })
            .catch(err => {
                if (err.name === "AbortError") {
                    return; // アボート時は何もしない
                }
                console.error("Stats fetch error:", err);
                setError("データの取得に失敗しました");
                setLoading(false);
            });

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const handleReclassify = async () => {
        setReclassifyStatus("processing");
        setReclassifyMessage("処理中...");
        setReclassifyErrors(null);

        try {
            const res = await fetch("/api/admin/reclassify-core-items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: reclassifyPassword })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "再分類に失敗しました");
            }

            setReclassifyStatus("success");
            setReclassifyMessage(data.message || "処理完了");
            setReclassifyResult({ processed: data.processed, updated: data.updated, failed: data.failed });
            setReclassifyErrors(data.errors || null);

            // Refresh stats after successful reclassification
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            abortControllerRef.current = new AbortController();

            fetch("/api/admin/stats", { signal: abortControllerRef.current.signal })
                .then(res => res.json())
                .then(data => {
                    if (validateStats(data)) {
                        setStats(data);
                    }
                })
                .catch(console.error);

        } catch (err) {
            setReclassifyStatus("error");
            setReclassifyMessage(err instanceof Error ? err.message : "エラーが発生しました");
        }
    };

    if (loading) return <div className="blink" style={{ textAlign: "center", padding: 40 }}>読み込み中...</div>;
    if (error || !stats) return <div className="alert">{error || "データの取得に失敗しました。"}</div>;

    const renderBarChart = (title: string, data: Record<string, number>, color: string, type: "issue" | "competency" | "coreItem") => {
        const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
        const max = Math.max(...entries.map(e => e[1]), 1);

        return (
            <div className="hero-card" style={{ marginBottom: 24 }}>
                <h3 className="panel-title">{title}</h3>
                <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                    {entries.length === 0 && <p className="note">データがありません</p>}
                    {entries.map(([label, value]) => (
                        <div
                            key={label}
                            style={{ cursor: "pointer" }}
                            onClick={() => {
                                const url = new URL(window.location.origin + "/admin/logs");
                                url.searchParams.set(type, label);
                                window.location.href = url.toString();
                            }}
                            title={`${label} でフィルタリング`}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.9rem" }}>
                                <span>{label}</span>
                                <span style={{ fontWeight: 700 }}>{value}</span>
                            </div>
                            <div style={{ height: 12, background: "#f0f0f0", borderRadius: 6, overflow: "hidden" }}>
                                <div style={{
                                    height: "100%",
                                    width: `${(value / max) * 100}%`,
                                    background: color,
                                    borderRadius: 6,
                                    transition: "width 0.5s ease-out"
                                }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div>
            {/* Reclassify Button */}
            <div style={{ marginBottom: 24 }}>
                <button
                    onClick={() => {
                        setShowReclassifyModal(true);
                        setReclassifyStatus("idle");
                        setReclassifyMessage("");
                        setReclassifyResult(null);
                        setReclassifyErrors(null);
                        setReclassifyPassword("");
                    }}
                    style={{
                        padding: "12px 24px",
                        background: "var(--accent-deep)",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        fontSize: "1rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "opacity 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                >
                    コアカリ項目を再分類
                </button>
                <p className="note" style={{ marginTop: 8 }}>
                    既存のアンケートログをGeminiで再分析し、コアカリ項目を抽出・更新します
                </p>
            </div>

            {/* Reclassify Modal */}
            {showReclassifyModal && (
                <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(0, 0, 0, 0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1000
                }}>
                    <div className="hero-card" style={{
                        maxWidth: 500,
                        width: "90%",
                        maxHeight: "80vh",
                        overflow: "auto"
                    }}>
                        <h3 className="panel-title" style={{ marginBottom: 16 }}>コアカリ項目の再分類</h3>

                        {reclassifyStatus === "idle" && (
                            <div>
                                <p style={{ marginBottom: 16 }}>
                                    既存のアンケートログ（最大1000件）をGeminiで再分析し、コアカリ項目を抽出・更新します。<br />
                                    処理には数分かかる場合があります。
                                </p>
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
                                        onClick={handleReclassify}
                                        disabled={!reclassifyPassword}
                                        style={{
                                            flex: 1,
                                            padding: "10px 20px",
                                            background: reclassifyPassword ? "var(--accent-deep)" : "#ccc",
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
                                    アンケートログを分析中です。しばらくお待ちください。
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
                                            <div key={idx} style={{ fontSize: "0.85rem", marginBottom: 4, fontFamily: "monospace" }}>
                                                ID: {err.id.slice(0, 8)}... - {err.error}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <button
                                    onClick={() => setShowReclassifyModal(false)}
                                    style={{
                                        width: "100%",
                                        padding: "10px 20px",
                                        background: "var(--accent-deep)",
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginBottom: 32 }}>
                <div className="hero-card" style={{ textAlign: "center" }}>
                    <div className="message-role">総回答数</div>
                    <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--accent-deep)" }}>{stats.totalCount}</div>
                </div>
                {/* Placeholder for other high-level stats if needed */}
                {Object.entries(stats.slugDistribution).map(([slug, count]) => (
                    <div key={slug} className="hero-card" style={{ textAlign: "center" }}>
                        <div className="message-role">{slug}</div>
                        <div style={{ fontSize: "2.5rem", fontWeight: 700 }}>{count}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 24 }}>
                {renderBarChart("困り事カテゴリ分布", stats.issueDistribution, "var(--accent)", "issue")}
                {renderBarChart("重要資質・能力カテゴリ分布", stats.competencyDistribution, "#48c5a9", "competency")}
            </div>

            <div style={{ marginTop: 24 }}>
                {renderBarChart("モデル・コア・カリキュラム項目分布", stats.coreItemsDistribution, "#6c5ce7", "coreItem")}
            </div>
        </div>
    );
}
