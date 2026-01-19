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
