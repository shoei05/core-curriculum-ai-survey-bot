import Link from "next/link";

export default function Home() {
  return (
    <main>
      <section className="home-hero">
        <div>
          <span className="pill">医学教育モデル・コア・カリキュラム 改定事前調査</span>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h1 className="hero-title">
              {process.env.NEXT_PUBLIC_APP_TITLE ?? "AI Survey Bot"}
            </h1>
            <a href="/admin" className="note" style={{ fontSize: "0.8rem", textDecoration: "underline" }}>
              管理者
            </a>
          </div>
          <p className="hero-subtitle">
            教員・事務職員・学生・医療者の方々の視点から、
            現行コアカリの課題と次期改定への期待をお聞かせください。
            フォームで回答後、AIが深掘り質問を行います。
          </p>
          <div className="hero-actions">
            <Link href="/survey" className="btn btn-primary" style={{ fontSize: "1.1rem", padding: "16px 32px" }}>
              アンケートに回答する
            </Link>
            <div style={{ marginTop: 8 }}>
              <span className="hero-hint">所要時間：約10分（フォーム2-3分 + AIインタビュー5-7分）</span>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <div className="template-title">調査の流れ</div>
          <ul className="consent-list" style={{ marginTop: 12 }}>
            <li><strong>ステップ1：</strong>属性・課題・期待をフォームで選択（2-3分）</li>
            <li><strong>ステップ2：</strong>AIが回答に基づいて深掘り質問（5-7分）</li>
            <li><strong>完了：</strong>要約と次期改定要望を生成</li>
          </ul>
        </div>
      </section>

      <section style={{ marginTop: 48 }}>
        <h2 className="panel-title">本調査について</h2>
        <div className="consent-card" style={{ marginTop: 16 }}>
          <h3>目的</h3>
          <p>
            2022年に改定された医学教育モデル・コア・カリキュラムの次期改定に向けて、
            現行カリキュラムの課題と現場のニーズを把握する事前調査です。
          </p>

          <h3>対象者</h3>
          <p>
            医学教育に携わる以下の方々：
          </p>
          <ul className="consent-list">
            <li>教員（医学部・医科大学等）</li>
            <li>事務職員</li>
            <li>学生（医学生）</li>
            <li>医療者（医師・看護師等の実地医療従事者）</li>
          </ul>

          <h3>調査方法</h3>
          <ul className="consent-list">
            <li><strong>形式：</strong>フォーム入力 + AIアシスタントによる対話形式のインタビュー調査</li>
            <li><strong>所要時間：</strong>約10分間（フォーム2-3分 + インタビュー5-7分）</li>
            <li><strong>時間終了後：</strong>延長を選択いただけます（+3分ずつ）</li>
            <li><strong>技術：</strong>AIを用いて回答内容を解析し、テーマ・キーワードを抽出します</li>
          </ul>

          <h3>プライバシー</h3>
          <ul className="consent-list">
            <li><strong>匿名性：</strong>個人を特定できる情報（氏名・所属・連絡先等）は収集しません</li>
            <li><strong>集計：</strong>回答は他の回答者の方のデータと合わせて集約・分析します</li>
            <li><strong>保存：</strong>データは暗号化され、アクセス制限された環境で保存されます</li>
            <li><strong>保持期間：</strong>研究目的のため5年間保存します</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
