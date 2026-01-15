"use client";

import { useEffect, useState } from "react";

interface Stats {
    totalCount: number;
    slugDistribution: Record<string, number>;
    issueDistribution: Record<string, number>;
    competencyDistribution: Record<string, number>;
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/admin/stats")
            .then(res => res.json())
            .then(data => {
                setStats(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="blink" style={{ textAlign: "center", padding: 40 }}>読み込み中...</div>;
    if (!stats) return <div className="alert">データの取得に失敗しました。</div>;

    const renderBarChart = (title: string, data: Record<string, number>, color: string) => {
        const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
        const max = Math.max(...entries.map(e => e[1]), 1);

        return (
            <div className="hero-card" style={{ marginBottom: 24 }}>
                <h3 className="panel-title">{title}</h3>
                <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                    {entries.length === 0 && <p className="note">データがありません</p>}
                    {entries.map(([label, value]) => (
                        <div key={label}>
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
                {renderBarChart("困り事カテゴリ分布", stats.issueDistribution, "var(--accent)")}
                {renderBarChart("重要資質・能力カテゴリ分布", stats.competencyDistribution, "#48c5a9")}
            </div>
        </div>
    );
}
