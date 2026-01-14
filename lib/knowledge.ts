import { readFileSync } from "fs";
import { join } from "path";

// Load knowledge base text files
let knowledgeCache: string | null = null;

export function getKnowledge(): string {
    if (knowledgeCache) return knowledgeCache;

    try {
        // In production, use bundled knowledge or fetch from API
        const summaryPath = join(process.cwd(), "lib", "knowledge-summary.txt");
        knowledgeCache = readFileSync(summaryPath, "utf-8");
    } catch (error) {
        console.warn("Knowledge file not found, using embedded summary");
        knowledgeCache = getEmbeddedKnowledgeSummary();
    }

    return knowledgeCache;
}

// Embedded summary for production (when file system access may be limited)
function getEmbeddedKnowledgeSummary(): string {
    return `
# 医学教育モデル・コア・カリキュラム（令和4年度改訂版）概要

## 改訂の7つの基本方針
1. 20年後以降の社会も想定した医師として求められる資質・能力の改訂
2. アウトカム基盤型教育のさらなる展開（学修目標の再編成と方略・評価の整理）
3. 医師養成をめぐる制度改正等との整合性の担保に向けた方策の検討
4. スリム化の徹底と読み手や利用方法を想定した電子化
5. 研究者育成の視点の充実
6. 根拠に基づいたモデル・コア・カリキュラムの内容
7. 歯学・薬学教育モデル・コア・カリキュラムとの一部共通化

## 医師として求められる基本的な資質・能力
- PR: プロフェッショナリズム
- GE: 総合的に患者・生活者をみる姿勢
- LL: 生涯にわたって共に学ぶ姿勢
- RE: 科学的探究
- PS: 専門知識に基づいた問題解決能力
- IT: 情報・科学技術を活かす能力
- CM: コミュニケーション能力
- IP: 多職種連携能力
- SO: 社会における医療の役割の理解
- CS: 診療の実践

## 主な学修目標領域
- PR-01: 医師としての責務と裁量権
- PR-02: 心構え
- PR-03: 教養
- PR-04: 生命倫理
- GE-01: 全人的な視点とアプローチ
- GE-02: 地域の視点とアプローチ
- GE-03: 人生の視点とアプローチ
- GE-04: 社会の視点とアプローチ
- LL-01: 生涯学習
- LL-02: 医療者教育
- RE-01: リサーチマインド
- RE-02: 既知の知
- RE-03: 研究の実施
- RE-04: 研究の発信
- RE-05: 研究倫理

## 令和4年度改訂の主な変更点
- 「総合的に患者・生活者をみる姿勢」を新規追加
- 診療参加型臨床実習の法的位置づけ明確化
- 地域医療、プライマリ・ケアの教育強化
- 研究者育成の視点を充実
`;
}

export function getKnowledgePrompt(): string {
    return `
あなたは以下の「医学教育モデル・コア・カリキュラム（令和4年度改訂版）」の知識を持っています。
回答者からモデル・コア・カリキュラムについて質問された場合は、この知識を参照して回答してください。

${getEmbeddedKnowledgeSummary()}

重要: 具体的な学修目標コード（例: PR-01-01, GE-02-03など）について質問された場合は、
「詳細は公式のモデル・コア・カリキュラム文書をご確認ください」と案内してください。
`;
}
