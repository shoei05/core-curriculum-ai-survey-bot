import type { Metadata } from "next";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_TITLE ?? "AI Survey Bot",
  description: "医学教育モデル・コア改定の事前調査（教員向け）生成AIアンケートボット"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ fontFamily: "system-ui, -apple-system, sans-serif", margin: 0 }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>{children}</div>
      </body>
    </html>
  );
}
