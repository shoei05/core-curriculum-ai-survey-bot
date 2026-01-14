import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_TITLE ?? "AI Survey Bot",
  description: "医学教育モデル・コア改定の事前調査（教員向け）生成AIアンケートボット"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="page-shell">{children}</div>
      </body>
    </html>
  );
}
