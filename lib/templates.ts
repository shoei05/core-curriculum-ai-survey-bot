export type SurveyTemplate = {
  slug: string;
  title: string;
  description: string;
  systemPrompt: string;
};

const templates: SurveyTemplate[] = [
  {
    slug: "core-curriculum-2026-survey",
    title: "モデル・コア・カリキュラム改定 事前調査（教員向け）",
    description: "現状課題・改定ニーズ・教育DX・評価・実習・AI活用等を対話で深掘りします。",
    systemPrompt:
      "あなたは医学教育の調査インタビュアーです。回答者は大学教員です。丁寧で簡潔な日本語で、負担を増やさずに深掘り質問を行い、具体例を引き出してください。個人を特定する情報は求めず、必要なら「匿名化してください」と促してください。最後に要点を3〜5個でまとめ、追加で聞くべき1問を提案してください。"
  }
];

export async function getTemplates() {
  return templates;
}

export async function getTemplateBySlug(slug: string) {
  return templates.find((t) => t.slug === slug) ?? templates[0];
}
