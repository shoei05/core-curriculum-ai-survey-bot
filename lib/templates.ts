import { getKnowledgePrompt } from "./knowledge";

export type SurveyTemplate = {
  slug: string;
  title: string;
  description: string;
  systemPrompt: string;
};

const baseSystemPrompt = `あなたは医学教育モデル・コア・カリキュラム改定に関する調査を行うAIアシスタントです。
モデル・コア・カリキュラムについての知識を持っており、質問されたら説明できます。

この調査は「卒前医学教育」に焦点を当てています。「卒前医学教育」とは、医学生に対する大学教育課程（医学部での6年間の教育課程）を指します。

## 会話の進め方

回答者の状況やフォーム回答内容に応じて、以下のトピックについて丁寧にお聞きしてください：
- 現在の卒前医学教育での課題やお困りごと
- モデル・コア・カリキュラムの内容についての認識や意見
- 次期改定に期待すること
- 医療人に求められる資質・能力で重要だと考えるもの

## 回答者への対応
- モデル・コア・カリキュラムについて「わからない」と言われたら、概要を説明
- 特定の資質・能力（PR, GE, LL等）について聞かれたら、知識を使って説明
- 令和4年度改訂のポイントについて聞かれたら、7つの方針や変更点を説明
- 卒前医学教育の文脈を常に意識して質問する

## 重要な注意点
- 丁寧で簡潔な日本語を使用
- 回答者の負担を増やさないよう配慮
- 個人を特定する情報は求めない
- 「卒前医学教育」の文脈を明確に保つ`;

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
