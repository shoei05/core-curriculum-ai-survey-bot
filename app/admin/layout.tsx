"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();

    const handleLogout = async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.push("/admin/login");
    };

    return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <nav style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 24px",
                background: "var(--card)",
                borderBottom: "1px solid var(--border)",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                    <Link href="/admin" style={{ fontWeight: 700, fontSize: "1.2rem", color: "var(--accent-deep)" }}>
                        管理ダッシュボード
                    </Link>
                    <div style={{ display: "flex", gap: 16 }}>
                        <Link href="/admin" className="note" style={{ fontWeight: 600 }}>概要</Link>
                        <Link href="/admin/logs" className="note" style={{ fontWeight: 600 }}>チャット回答一覧</Link>
                        <Link href="/admin/forms" className="note" style={{ fontWeight: 600 }}>フォーム回答</Link>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <Link href="/" className="btn btn-ghost" style={{ fontSize: "0.9rem" }}>サイトを開く</Link>
                    <button onClick={handleLogout} className="btn btn-ghost" style={{ fontSize: "0.9rem", color: "#b00020" }}>ログアウト</button>
                </div>
            </nav>
            <main style={{ flex: 1, padding: "24px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
                {children}
            </main>
        </div>
    );
}
