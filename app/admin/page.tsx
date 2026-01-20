"use client";

import { useEffect, useState, useRef } from "react";
import { WordCloudSection } from "./components/WordCloudSection";

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
    const [reclassifyTarget, setReclassifyTarget] = useState<"core_items" | "competency_categories" | "both">("both");
    const [reclassifyStatus, setReclassifyStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
    const [reclassifyMessage, setReclassifyMessage] = useState("");
    const [reclassifyResult, setReclassifyResult] = useState<{ processed: number; updated: number; failed: number; target: string } | null>(null);
    const [reclassifyErrors, setReclassifyErrors] = useState<Array<{ id: string; error: string }> | null>(null);

    // Competency reclassification state (separate modal for dedicated button)
    const [showCompetencyReclassifyModal, setShowCompetencyReclassifyModal] = useState(false);
    const [competencyReclassifyPassword, setCompetencyReclassifyPassword] = useState("");
    const [competencyReclassifyStatus, setCompetencyReclassifyStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
    const [competencyReclassifyMessage, setCompetencyReclassifyMessage] = useState("");
    const [competencyReclassifyResult, setCompetencyReclassifyResult] = useState<{ processed: number; updated: number; failed: number; target: string } | null>(null);
    const [competencyReclassifyErrors, setCompetencyReclassifyErrors] = useState<Array<{ id: string; error: string }> | null>(null);

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
                body: JSON.stringify({ password: reclassifyPassword, target: reclassifyTarget })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "再分類に失敗しました");
            }

            setReclassifyStatus("success");
            setReclassifyMessage(data.message || "処理完了");
            setReclassifyResult({ processed: data.processed, updated: data.updated, failed: data.failed, target: data.target });
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

    const handleCompetencyReclassify = async () => {
        setCompetencyReclassifyStatus("processing");
        setCompetencyReclassifyMessage("処理中...");
        setCompetencyReclassifyErrors(null);

        try {
            const res = await fetch("/api/admin/reclassify-core-items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: competencyReclassifyPassword, target: "competency_categories" })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "資質・能力の再分類に失敗しました");
            }

            setCompetencyReclassifyStatus("success");
            setCompetencyReclassifyMessage(data.message || "処理完了");
            setCompetencyReclassifyResult({ processed: data.processed, updated: data.updated, failed: data.failed, target: data.target });
            setCompetencyReclassifyErrors(data.errors || null);

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
            setCompetencyReclassifyStatus("error");
            setCompetencyReclassifyMessage(err instanceof Error ? err.message : "エラーが発生しました");
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
            {/* Reclassify Buttons */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {/* Core Items Reclassify Button */}
                    <button
                        onClick={() => {
                            setShowReclassifyModal(true);
                            setReclassifyStatus("idle");
                            setReclassifyMessage("");
                            setReclassifyResult(null);
                            setReclassifyErrors(null);
                            setReclassifyPassword("");
                            setReclassifyTarget("core_items");
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

                    {/* Competency Reclassify Button */}
                    <button
                        onClick={() => {
                            setShowCompetencyReclassifyModal(true);
                            setCompetencyReclassifyStatus("idle");
                            setCompetencyReclassifyMessage("");
                            setCompetencyReclassifyResult(null);
                            setCompetencyReclassifyErrors(null);
                            setCompetencyReclassifyPassword("");
                        }}
                        style={{
                            padding: "12px 24px",
                            background: "#48c5a9",
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
                        資質・能力を再分類
                    </button>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                    <p className="note" style={{ margin: 0, flex: 1, minWidth: 200 }}>
                        既存のアンケートログをGeminiで再分析し、コアカリ項目を抽出・更新します
                    </p>
                    <p className="note" style={{ margin: 0, flex: 1, minWidth: 200 }}>
                        資質・能力が空欄の既存ログを再分析し、資質・能力を抽出・更新します
                    </p>
                </div>
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
                        <h3 className="panel-title" style={{ marginBottom: 16 }}>コアカリ項目・資質能力の再分類</h3>

                        {reclassifyStatus === "idle" && (
                            <div>
                                <p style={{ marginBottom: 16 }}>
                                    既存のアンケートログ（最大1000件）をGeminiで再分析し、項目を抽出・更新します。<br />
                                    処理には数分かかる場合があります。
                                </p>
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                                        再分類対象
                                    </label>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                            <input
                                                type="radio"
                                                name="reclassifyTarget"
                                                value="both"
                                                checked={reclassifyTarget === "both"}
                                                onChange={() => setReclassifyTarget("both")}
                                                style={{ cursor: "pointer" }}
                                            />
                                            <span>コアカリ項目 + 資質・能力（両方）</span>
                                        </label>
                                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                            <input
                                                type="radio"
                                                name="reclassifyTarget"
                                                value="core_items"
                                                checked={reclassifyTarget === "core_items"}
                                                onChange={() => setReclassifyTarget("core_items")}
                                                style={{ cursor: "pointer" }}
                                            />
                                            <span>コアカリ項目のみ</span>
                                        </label>
                                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                            <input
                                                type="radio"
                                                name="reclassifyTarget"
                                                value="competency_categories"
                                                checked={reclassifyTarget === "competency_categories"}
                                                onChange={() => setReclassifyTarget("competency_categories")}
                                                style={{ cursor: "pointer" }}
                                            />
                                            <span>資質・能力のみ</span>
                                        </label>
                                    </div>
                                    <p className="note" style={{ marginTop: 8, fontSize: "0.85rem" }}>
                                        ※資質・能力のみを選択した場合、空または欠損しているログのみが対象になります
                                    </p>
                                </div>
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
                                        <div style={{ marginBottom: 12, fontSize: "0.9rem", color: "#666" }}>
                                            対象: {reclassifyResult.target === "core_items" ? "コアカリ項目のみ" :
                                                   reclassifyResult.target === "competency_categories" ? "資質・能力のみ" :
                                                   "コアカリ項目 + 資質・能力（両方）"}
                                        </div>
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

            {/* Competency Reclassify Modal */}
            {showCompetencyReclassifyModal && (
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
                        <h3 className="panel-title" style={{ marginBottom: 16 }}>資質・能力の再分類</h3>

                        {competencyReclassifyStatus === "idle" && (
                            <div>
                                <p style={{ marginBottom: 16 }}>
                                    資質・能力が空欄または欠損している既存のアンケートログ（最大1000件）をGeminiで再分析し、資質・能力を抽出・更新します。<br />
                                    処理には数分かかる場合があります。
                                </p>
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                                        管理者パスワード
                                    </label>
                                    <input
                                        type="password"
                                        value={competencyReclassifyPassword}
                                        onChange={(e) => setCompetencyReclassifyPassword(e.target.value)}
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
                                        onClick={handleCompetencyReclassify}
                                        disabled={!competencyReclassifyPassword}
                                        style={{
                                            flex: 1,
                                            padding: "10px 20px",
                                            background: competencyReclassifyPassword ? "#48c5a9" : "#ccc",
                                            color: "white",
                                            border: "none",
                                            borderRadius: 6,
                                            fontSize: "1rem",
                                            fontWeight: 600,
                                            cursor: competencyReclassifyPassword ? "pointer" : "not-allowed"
                                        }}
                                    >
                                        実行
                                    </button>
                                    <button
                                        onClick={() => setShowCompetencyReclassifyModal(false)}
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

                        {competencyReclassifyStatus === "processing" && (
                            <div style={{ textAlign: "center", padding: 40 }}>
                                <div className="blink" style={{ fontSize: "1.2rem", marginBottom: 16 }}>
                                    処理中...
                                </div>
                                <p className="note">
                                    アンケートログを分析中です。しばらくお待ちください。
                                </p>
                            </div>
                        )}

                        {(competencyReclassifyStatus === "success" || competencyReclassifyStatus === "error") && (
                            <div>
                                <div style={{
                                    padding: 16,
                                    background: competencyReclassifyStatus === "success" ? "#d4edda" : "#f8d7da",
                                    borderRadius: 6,
                                    marginBottom: 16
                                }}>
                                    {competencyReclassifyMessage}
                                </div>

                                {competencyReclassifyResult && (
                                    <div style={{
                                        padding: 16,
                                        background: "#f8f9fa",
                                        borderRadius: 6,
                                        marginBottom: 16
                                    }}>
                                        <div style={{ marginBottom: 12, fontSize: "0.9rem", color: "#666" }}>
                                            対象: 資質・能力のみ
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                            <span>処理件数:</span>
                                            <span style={{ fontWeight: 700 }}>{competencyReclassifyResult.processed}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                            <span>更新成功:</span>
                                            <span style={{ fontWeight: 700, color: "#28a745" }}>{competencyReclassifyResult.updated}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span>失敗:</span>
                                            <span style={{ fontWeight: 700, color: "#dc3545" }}>{competencyReclassifyResult.failed}</span>
                                        </div>
                                    </div>
                                )}

                                {competencyReclassifyErrors && competencyReclassifyErrors.length > 0 && (
                                    <div style={{
                                        padding: 16,
                                        background: "#fff3cd",
                                        borderRadius: 6,
                                        marginBottom: 16,
                                        maxHeight: 200,
                                        overflow: "auto"
                                    }}>
                                        <div style={{ fontWeight: 600, marginBottom: 8 }}>エラー詳細:</div>
                                        {competencyReclassifyErrors.map((err, idx) => (
                                            <div key={idx} style={{
                                                fontSize: "0.85rem",
                                                marginBottom: 8,
                                                paddingBottom: 8,
                                                borderBottom: idx < competencyReclassifyErrors.length - 1 ? "1px solid #eee" : "none"
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
                                    onClick={() => setShowCompetencyReclassifyModal(false)}
                                    style={{
                                        width: "100%",
                                        padding: "10px 20px",
                                        background: "#48c5a9",
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

            {/* Word Cloud Section */}
            <WordCloudSection />

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
