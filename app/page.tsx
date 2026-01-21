import Link from "next/link";
import { getTemplates } from "@/lib/templates";

export default async function Home() {
  const templates = await getTemplates();
  const primaryTemplate = templates[0];

  return (
    <main>
      <section className="home-hero">
        <div>
          <span className="pill">事前調査</span>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h1 className="hero-title">
              {process.env.NEXT_PUBLIC_APP_TITLE ?? "AI Survey Bot"}
            </h1>
            <Link href="/admin" className="note" style={{ fontSize: "0.8rem", textDecoration: "underline" }}>
              管理者
            </Link>
          </div>
          <p className="hero-subtitle">
            教員向けの事前調査をチャット形式で回答できます。
            回答は要約とカテゴリ別キーワードに自動整理されます。
          </p>
          <div className="hero-actions">
            <Link href="/survey" className="btn btn-primary" style={{ marginRight: 12 }}>
              2段階調査を開始（新）
            </Link>
            {primaryTemplate && (
              <Link href={`/surveys/${primaryTemplate.slug}`} className="btn btn-secondary">
                チャットのみ
              </Link>
            )}
            <div style={{ marginTop: 8 }}>
              <span className="hero-hint">所要時間：約10分（フォーム2-3分 + AIインタビュー5-7分）</span>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <div className="template-title">調査の流れ（2段階調査）</div>
          <ul className="consent-list" style={{ marginTop: 12 }}>
            <li><strong>ステップ1：</strong>フォームで属性・課題・期待を選択（2-3分）</li>
            <li><strong>ステップ2：</strong>AIが回答に基づいて深掘り質問（5-7分）</li>
            <li><strong>完了：</strong>要約と次期改定要望を生成</li>
          </ul>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 className="panel-title">利用可能なアンケート</h2>
        <div className="template-grid">
          {/* 2段階調査システム */}
          <Link href="/survey" className="template-card" style={{ border: "2px solid var(--accent)" }}>
            <div className="template-title" style={{ color: "var(--accent)" }}>2段階調査（新）</div>
            <div className="template-description">
              フォーム入力後、AIが個別に深掘り質問を行います。
              教員・事務職員・学生それぞれの視点から収集します。
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
              約10分（フォーム2-3分 + AI 5-7分）
            </div>
          </Link>
          {templates.map((t) => (
            <Link
              key={t.slug}
              href={`/surveys/${t.slug}`}
              className="template-card"
            >
              <div className="template-title">{t.title}</div>
              <div className="template-description">{t.description}</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
