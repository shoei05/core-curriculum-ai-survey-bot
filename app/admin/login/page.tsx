"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
    const [user, setUser] = useState("");
    const [pass, setPass] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const err = params.get("error");
        if (err === "session_expired") {
            setError("セッションが切れたか、無効です。再度ログインしてください。");
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user, pass }),
            });

            if (res.ok) {
                router.push("/admin");
            } else {
                const data = await res.json();
                setError(data.error || "ログインに失敗しました");
            }
        } catch (err) {
            setError("接続エラーが発生しました");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 400, margin: "100px auto", padding: 20 }} className="hero-card">
            <h1 className="panel-title" style={{ fontSize: "1.5rem", textAlign: "center", marginBottom: 24 }}>
                管理者ログイン
            </h1>

            {error && (
                <div className="alert" style={{ background: "#ffebee", border: "1px solid #ffcdd2", color: "#c62828" }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleLogin} style={{ display: "grid", gap: 16 }}>
                <div>
                    <label className="message-role" style={{ display: "block", marginBottom: 4 }}>ユーザー名</label>
                    <input
                        type="text"
                        className="text-input"
                        style={{ width: "100%" }}
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                        required
                        autoComplete="username"
                    />
                </div>
                <div>
                    <label className="message-role" style={{ display: "block", marginBottom: 4 }}>パスワード</label>
                    <input
                        type="password"
                        className="text-input"
                        style={{ width: "100%" }}
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        required
                        autoComplete="current-password"
                    />
                </div>
                <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: "100%", marginTop: 8 }}
                    disabled={isLoading}
                >
                    {isLoading ? "ログイン中..." : "ログイン"}
                </button>
            </form>

            <div style={{ marginTop: 24, textAlign: "center" }}>
                <a href="/" className="note">← トップページに戻る</a>
            </div>
        </div>
    );
}
