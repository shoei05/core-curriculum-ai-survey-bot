"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

interface TopicGroup {
  category: string;
  keywords: string[];
}

interface CategoryGroup {
  category: string;
  items: string[];
}

interface InVivoCode {
  code: string;
  quote?: string;
  messageIndex?: number;
}

interface SurveyLog {
  id: string;
  template_slug: string;
  created_at: string;
  analysis_version: string | null;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  summary_view: {
    summary_bullets: string[];
    topic_groups: TopicGroup[];
  };
  coding_primary: {
    in_vivo_codes: InVivoCode[];
    issue_categories: CategoryGroup[];
    competency_categories: CategoryGroup[];
    core_items: string[];
  };
  coding_sensitivity: {
    topic_groups: TopicGroup[];
  };
}

const MarkdownContent = ({ content }: { content: string }) => {
  const normalizeMarkdown = (text: string) =>
    text.replace(/\*\*([^\s*\u200B])/g, "**\u200B$1").replace(/([^\s*\u200B])\*\*/g, "$1\u200B**");

  return <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{normalizeMarkdown(content)}</ReactMarkdown>;
};

function AdminLogsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [logs, setLogs] = useState<SurveyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [reclassifyStatus, setReclassifyStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [reclassifyMessage, setReclassifyMessage] = useState("");

  const issueFilter = searchParams.get("issue");
  const competencyFilter = searchParams.get("competency");
  const coreItemFilter = searchParams.get("coreItem");
  const keywordFilter = searchParams.get("keyword");

  useEffect(() => {
    fetch("/api/admin/logs")
      .then((response) => {
        if (!response.ok) {
          throw new Error("ログの取得に失敗しました");
        }
        return response.json();
      })
      .then((payload: SurveyLog[]) => {
        setLogs(payload);
        setLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setLoading(false);
      });
  }, []);

  const filteredLogs = useMemo(() => {
    if (!issueFilter && !competencyFilter && !coreItemFilter && !keywordFilter) {
      return logs;
    }

    return logs.filter((log) => {
      if (issueFilter) {
        return log.coding_primary.issue_categories.some((group) => group.category === issueFilter);
      }
      if (competencyFilter) {
        return log.coding_primary.competency_categories.some((group) => group.category === competencyFilter);
      }
      if (coreItemFilter) {
        return log.coding_primary.core_items.includes(coreItemFilter);
      }
      if (keywordFilter) {
        const text = [
          ...log.summary_view.summary_bullets,
          ...log.summary_view.topic_groups.flatMap((group) => [group.category, ...group.keywords]),
          ...log.coding_primary.in_vivo_codes.map((code) => `${code.code} ${code.quote ?? ""}`),
          ...log.messages.map((message) => message.content),
        ]
          .join(" ")
          .toLowerCase();
        return text.includes(keywordFilter.toLowerCase());
      }
      return true;
    });
  }, [competencyFilter, coreItemFilter, issueFilter, keywordFilter, logs]);

  const selectedLog = selectedLogId ? logs.find((log) => log.id === selectedLogId) : null;

  const handleReclassifyIssues = async () => {
    setReclassifyStatus("processing");
    setReclassifyMessage("participant-only の困り事を再分類しています...");

    try {
      const response = await fetch("/api/admin/reclassify-issues", { method: "POST" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "困り事の再分類に失敗しました");
      }

      setReclassifyStatus("success");
      setReclassifyMessage(payload.message || "処理完了");

      const refreshed = await fetch("/api/admin/logs").then((result) => result.json());
      setLogs(refreshed);
    } catch (error) {
      setReclassifyStatus("error");
      setReclassifyMessage(error instanceof Error ? error.message : "困り事の再分類に失敗しました");
    }
  };

  if (loading) {
    return (
      <div className="blink" style={{ textAlign: "center", padding: 40 }}>
        読み込み中...
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>チャット回答一覧</h1>
          <p className="note" style={{ margin: "8px 0 0 0" }}>
            表示件数: {filteredLogs.length}件
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => void handleReclassifyIssues()} className="btn btn-primary">
            participant-only 困り事を再分類
          </button>
          {(issueFilter || competencyFilter || coreItemFilter || keywordFilter) && (
            <button onClick={() => router.push("/admin/logs")} className="btn btn-ghost">
              フィルタ解除
            </button>
          )}
        </div>
      </div>

      {reclassifyStatus !== "idle" && (
        <div className="alert" style={{ background: reclassifyStatus === "error" ? "#fff0f0" : undefined }}>
          {reclassifyMessage}
        </div>
      )}

      <div className="log-list">
        {filteredLogs.length === 0 && <p className="note">条件に一致するログがありません。</p>}

        {filteredLogs.map((log) => (
          <details key={log.id} className="log-item" style={{ marginBottom: 16 }} open>
            <summary style={{ fontSize: "1.05rem", padding: "8px 0", display: "flex", justifyContent: "space-between", gap: 16 }}>
              <span>
                {new Date(log.created_at).toLocaleString("ja-JP")} / {log.template_slug}
              </span>
              <span className="note">{log.analysis_version ?? "legacy"}</span>
            </summary>

            <div style={{ padding: "16px 0", display: "grid", gap: 16 }}>
              <div className="summary-card">
                <div className="log-section-title">会話全体サマリー</div>
                <ul className="consent-list" style={{ margin: "8px 0" }}>
                  {log.summary_view.summary_bullets.map((bullet, index) => (
                    <li key={index}>{bullet}</li>
                  ))}
                </ul>
              </div>

              {log.summary_view.topic_groups.length > 0 && (
                <div className="keyword-item">
                  <div className="log-section-title">会話全体トピック</div>
                  {log.summary_view.topic_groups.map((group, index) => (
                    <div key={index} style={{ marginBottom: 8 }}>
                      <div className="keyword-title">{group.category}</div>
                      <div className="note">{group.keywords.join(" / ")}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div className="keyword-item">
                  <div className="log-section-title">主要分析: in vivo codes</div>
                  {log.coding_primary.in_vivo_codes.length > 0 ? (
                    log.coding_primary.in_vivo_codes.map((code, index) => (
                      <div key={index} style={{ marginBottom: 8 }}>
                        <div className="keyword-title">{code.code}</div>
                        {code.quote && <div className="note">{code.quote}</div>}
                      </div>
                    ))
                  ) : (
                    <div className="note">該当なし</div>
                  )}
                </div>

                <div className="keyword-item">
                  <div className="log-section-title">主要分析: 困り事カテゴリ</div>
                  {log.coding_primary.issue_categories.length > 0 ? (
                    log.coding_primary.issue_categories.map((group, index) => (
                      <div key={index} style={{ marginBottom: 8 }}>
                        <div className="keyword-title">{group.category}</div>
                        <div className="note">{group.items.join(" / ")}</div>
                      </div>
                    ))
                  ) : (
                    <div className="note">該当なし</div>
                  )}
                </div>

                <div className="keyword-item">
                  <div className="log-section-title">主要分析: 資質・能力</div>
                  {log.coding_primary.competency_categories.length > 0 ? (
                    log.coding_primary.competency_categories.map((group, index) => (
                      <div key={index} style={{ marginBottom: 8 }}>
                        <div className="keyword-title">{group.category}</div>
                        <div className="note">{group.items.join(" / ")}</div>
                      </div>
                    ))
                  ) : (
                    <div className="note">該当なし</div>
                  )}
                </div>

                <div className="keyword-item">
                  <div className="log-section-title">主要分析: コアカリ項目</div>
                  {log.coding_primary.core_items.length > 0 ? (
                    <div className="note">{log.coding_primary.core_items.join(", ")}</div>
                  ) : (
                    <div className="note">該当なし</div>
                  )}
                </div>
              </div>

              {log.coding_sensitivity.topic_groups.length > 0 && (
                <div className="keyword-item">
                  <div className="log-section-title">感度分析（会話全体）</div>
                  {log.coding_sensitivity.topic_groups.map((group, index) => (
                    <div key={index} style={{ marginBottom: 8 }}>
                      <div className="keyword-title">{group.category}</div>
                      <div className="note">{group.keywords.join(" / ")}</div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setSelectedLogId(log.id)}
                className="btn btn-primary"
                style={{ width: "100%" }}
              >
                会話ログを表示
              </button>
            </div>
          </details>
        ))}
      </div>

      {selectedLog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setSelectedLogId(null)}
        >
          <div
            style={{
              background: "var(--card)",
              borderRadius: 12,
              width: "95vw",
              height: "90vh",
              maxWidth: 1400,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--surface)",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "1.3rem" }}>会話ログ</h3>
                <p className="note" style={{ margin: "4px 0 0 0", fontSize: "0.9rem" }}>
                  {new Date(selectedLog.created_at).toLocaleString("ja-JP")} / {selectedLog.template_slug}
                </p>
              </div>
              <button onClick={() => setSelectedLogId(null)} className="btn btn-ghost">
                閉じる
              </button>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
              <div className="message-stack" style={{ maxWidth: 900, margin: "0 auto" }}>
                {selectedLog.messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`message ${message.role === "user" ? "message-user" : "message-ai"}`}>
                    <div className="message-role">{message.role === "user" ? "参加者" : "AI"}</div>
                    <div className="message-content markdown-content">
                      <MarkdownContent content={message.content} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
