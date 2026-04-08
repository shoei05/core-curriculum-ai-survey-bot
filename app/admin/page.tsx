"use client";

import { useEffect, useState } from "react";
import { WordCloudSection } from "./components/WordCloudSection";

interface Stats {
  totalCount: number;
  analysisVersionDistribution: Record<string, number>;
  issueDistribution: Record<string, number>;
  competencyDistribution: Record<string, number>;
  coreItemsDistribution: Record<string, number>;
  sensitivityTopicDistribution: Record<string, number>;
}

function DistributionCard({
  title,
  data,
  queryKey,
}: {
  title: string;
  data: Record<string, number>;
  queryKey?: "issue" | "competency" | "coreItem";
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const max = Math.max(...entries.map((entry) => entry[1]), 1);

  return (
    <div className="hero-card">
      <h3 className="panel-title">{title}</h3>
      {entries.length === 0 ? (
        <p className="note">まだデータがありません。</p>
      ) : (
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {entries.map(([label, value]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                if (!queryKey) {
                  return;
                }
                const url = new URL(window.location.origin + "/admin/logs");
                url.searchParams.set(queryKey, label);
                window.location.href = url.toString();
              }}
              style={{
                padding: 0,
                background: "transparent",
                border: "none",
                textAlign: "left",
                cursor: queryKey ? "pointer" : "default",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span>{label}</span>
                <span style={{ fontWeight: 700 }}>{value}</span>
              </div>
              <div style={{ height: 10, borderRadius: 999, background: "#eee", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${(value / max) * 100}%`,
                    height: "100%",
                    background: "var(--accent)",
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((response) => {
        if (!response.ok) {
          throw new Error("統計データの取得に失敗しました");
        }
        return response.json();
      })
      .then((payload: Stats) => {
        setStats(payload);
        setLoading(false);
      })
      .catch((fetchError) => {
        console.error(fetchError);
        setError(fetchError instanceof Error ? fetchError.message : "統計データの取得に失敗しました");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="blink" style={{ textAlign: "center", padding: 40 }}>
        読み込み中...
      </div>
    );
  }

  if (error || !stats) {
    return <div className="alert">{error || "データの取得に失敗しました。"}</div>;
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div className="hero-card" style={{ display: "grid", gap: 12 }}>
        <h1 style={{ margin: 0 }}>管理ダッシュボード</h1>
        <p className="note" style={{ margin: 0 }}>
          主要分析は participant-only を既定にしています。感度分析は会話全体のトピック分布として別表示しています。
        </p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
          <div className="keyword-item" style={{ minWidth: 160 }}>
            <div className="keyword-title">分析ログ総数</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{stats.totalCount}</div>
          </div>
          <div className="keyword-item" style={{ minWidth: 220 }}>
            <div className="keyword-title">analysis version</div>
            <div style={{ color: "#555", marginTop: 4 }}>
              {Object.entries(stats.analysisVersionDistribution)
                .map(([version, count]) => `${version}: ${count}`)
                .join(" / ")}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <DistributionCard title="困り事カテゴリ" data={stats.issueDistribution} queryKey="issue" />
        <DistributionCard title="資質・能力カテゴリ" data={stats.competencyDistribution} queryKey="competency" />
        <DistributionCard title="コアカリ項目" data={stats.coreItemsDistribution} queryKey="coreItem" />
      </div>

      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <DistributionCard title="感度分析トピック" data={stats.sensitivityTopicDistribution} />
        <WordCloudSection />
      </div>
    </div>
  );
}
