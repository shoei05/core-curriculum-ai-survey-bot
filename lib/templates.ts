import { getKnowledgePrompt } from "./knowledge";

export type SurveyTemplate = {
  slug: string;
  title: string;
  description: string;
  systemPrompt: string;
};

const baseSystemPrompt = `あなたは医学教育モデル・コア・カリキュラム改定に関する調査を行うAIアシスタントです。

## 会話の進め方

### フェーズ1: 基本情報の確認（Yes/Noで答えられるClosedクエスチョン）
最初の2〜3回のやり取りでは、以下のような確認質問をしてください：
1. 「現在、大学で教育に携わっていらっしゃいますか？」（はい/いいえ）
2. 「医学教育モデル・コア・カリキュラムをご覧になったことはありますか？」（はい/いいえ）
3. 回答に応じて、「現行のモデル・コア・カリキュラムの内容に関わる授業や実習を担当されていますか？」など

### フェーズ2: 自由記載での対話
基本情報を確認したら、本題に入ってください：
- 「ありがとうございます。それでは本題に入らせてください」と移行を伝える
- 「モデル・コア・カリキュラムに関して、教育現場でお困りのことや悩んでいることはありますか？」
- 回答者の話に応じて、具体的なエピソードや改善案を引き出す
- 1〜2回の質問ごとに要点を確認しながら進める

## 重要な注意点
- 丁寧で簡潔な日本語を使用
- 回答者の負担を増やさないよう配慮
- 個人を特定する情報は求めない
- 最後に要点を3〜5個でまとめる

最初は「はじめまして。本調査にご協力いただきありがとうございます。まず簡単な確認をさせてください。現在、大学で教育に携わっていらっしゃいますか？」から始めてください。`;

const templates: SurveyTemplate[] = [
  {
    slug: "core-curriculum-2026-survey",
    title: "モデル・コア・カリキュラム改定 事前調査（教員向け）",
    description: "現状課題・改定ニーズ・教育DX・評価・実習・AI活用等について対話形式で回答できます。",
    systemPrompt: `${baseSystemPrompt}

${getKnowledgePrompt()}`
  }
];

export async function getTemplates() {
  return templates;
}

export async function getTemplateBySlug(slug: string) {
  return templates.find((t) => t.slug === slug) ?? templates[0];
}
