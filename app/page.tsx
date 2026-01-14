import Link from "next/link";
import { getTemplates } from "@/lib/templates";

export default async function Home() {
  const templates = await getTemplates();

  return (
    <main>
      <section className="home-hero">
        <div>
          <span className="pill">事前調査</span>
          <h1 className="hero-title">
            {process.env.NEXT_PUBLIC_APP_TITLE ?? "AI Survey Bot"}
          </h1>
          <p className="hero-subtitle">
            教員向けの事前調査をチャット形式で回答できます。
            回答は要約とカテゴリ別キーワードに自動整理されます。
          </p>
        </div>
        <div className="hero-card">
          <div className="template-title">調査の流れ</div>
          <ul className="consent-list" style={{ marginTop: 12 }}>
            <li>同意確認後にAIが最初の質問を提示</li>
            <li>回答に応じてAIが質問を進行</li>
            <li>終了時に要約とキーワードを生成</li>
          </ul>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 className="panel-title">利用可能なアンケート</h2>
        <div className="template-grid">
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
