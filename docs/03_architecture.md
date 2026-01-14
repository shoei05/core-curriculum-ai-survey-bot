# 03. アーキテクチャ（Vercel最短版）

- Next.js App Router（フロント/UI）
- API Routes（/api/*）でAI呼び出し＆保存
- DBはSupabase(Postgres)想定（後で置換可）

```
[Browser] -> [Next.js on Vercel] -> /api/chat -> [OpenAI]
                        |
                        -> (Phase1) [Supabase]
```
