import type { Metadata } from "next";
import { BIZ_UDGothic } from "next/font/google";
import "./globals.css";

const bizUDGothic = BIZ_UDGothic({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ud",
});

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_TITLE ?? "AI Survey Bot",
  description: "医学教育モデル・コア改定の事前調査（教員向け）生成AIアンケートボット"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={bizUDGothic.variable}>
      <body>
        <div className="page-shell">{children}</div>
      </body>
    </html>
  );
}
