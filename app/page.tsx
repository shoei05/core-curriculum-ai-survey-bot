import Link from "next/link";
import { getTemplates } from "@/lib/templates";

export default async function Home() {
  const templates = await getTemplates();

  return (
    <main>
      <h1 style={{ margin: "12px 0 4px" }}>{process.env.NEXT_PUBLIC_APP_TITLE ?? "AI Survey Bot"}</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        教員向け周辺調査を、チャット形式で回答できるボットです（MVPテンプレート）。
      </p>

      <section style={{ marginTop: 24 }}>
        <h2>利用可能なアンケート</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {templates.map((t) => (
            <Link
              key={t.slug}
              href={`/surveys/${t.slug}`}
              style={{
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 12,
                textDecoration: "none",
                color: "inherit"
              }}
            >
              <div style={{ fontWeight: 700 }}>{t.title}</div>
              <div style={{ color: "#555", marginTop: 4 }}>{t.description}</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
