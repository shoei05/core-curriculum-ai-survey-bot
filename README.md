# 医学教育モデル・コア・カリキュラム改定 事前調査用 生成AIアンケートボット（Vercel版）

大学教員向けに「周辺調査（背景・課題・ニーズ）」を効率的に収集するための
**生成AIアンケートボット（チャット形式）**の設計書＋最小実装テンプレートです。

- デプロイ先: **Vercel**
- フロント: Next.js（App Router）
- AI: OpenAI（APIキーで差し替え可）
- データ保存: Supabase（Postgres）※Vercel Postgresへ置換も可

---

## まず動かす（最短）

1. 依存関係インストール
```bash
npm i
```

2. 環境変数を設定
```bash
cp .env.example .env.local
```

3. 開発サーバ起動
```bash
npm run dev
```

---

## 設計ドキュメント
- docs/01_requirements.md
- docs/02_user_stories.md
- docs/03_architecture.md
- docs/04_db_schema.sql
- docs/05_prompts.md
- docs/06_privacy_ethics.md
- docs/07_rollout_plan.md
