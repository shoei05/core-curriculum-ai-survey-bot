/**
 * Model Core Curriculum Item Codes and Names Mapping
 * モデル・コア・カリキュラム項目コードと名称のマッピング
 */

export interface CoreCurriculumItem {
  code: string;
  name: string;
  category: string;
}

export const CORE_CURRICULUM_ITEMS: Record<string, CoreCurriculumItem> = {
  // A. プロフェッショナリズム (Professionalism)
  "PR-01": { code: "PR-01", name: "医師の責務", category: "プロフェッショナリズム" },
  "PR-02": { code: "PR-02", name: "患者中心の視点", category: "プロフェッショナリズム" },
  "PR-03": { code: "PR-03", name: "医師としての倫理・責任", category: "プロフェッショナリズム" },
  "PR-04": { code: "PR-04", name: "自己研鑽", category: "プロフェッショナリズム" },

  // B. 総合的視点 (General Perspectives)
  "GE-01": { code: "GE-01", name: "全人的視点", category: "総合的視点" },
  "GE-02": { code: "GE-02", name: "地域の視点", category: "総合的視点" },
  "GE-03": { code: "GE-03", name: "多職種連携", category: "総合的視点" },

  // C. 生涯学習 (Lifelong Learning)
  "LL-01": { code: "LL-01", name: "生涯学習の態度", category: "生涯学習" },
  "LL-02": { code: "LL-02", name: "自己評価・改善", category: "生涯学習" },

  // D. 科学的探究 (Research)
  "RE-01": { code: "RE-01", name: "研究マインド", category: "科学的探究" },
  "RE-02": { code: "RE-02", name: "研究の理解", category: "科学的探究" },
  "RE-03": { code: "RE-03", name: "研究の実施", category: "科学的探究" },

  // E. 社会と医療 (Society and Healthcare)
  "SO-01": { code: "SO-01", name: "社会と健康", category: "社会と医療" },
  "SO-02": { code: "SO-02", name: "医療と社会", category: "社会と医療" },
  "SO-03": { code: "SO-03", name: "医療制度", category: "社会と医療" },

  // F. 臨床推論 (Clinical Reasoning)
  "CR-01": { code: "CR-01", name: "臨床推論の基本", category: "臨床推論" },
  "CR-02": { code: "CR-02", name: "診断プロセス", category: "臨床推論" },
  "CR-03": { code: "CR-03", name: "治療計画", category: "臨床推論" },

  // G. 臨床技能 (Clinical Skills)
  "CS-01": { code: "CS-01", name: "医療面接", category: "臨床技能" },
  "CS-02": { code: "CS-02", name: "身体診察", category: "臨床技能" },
  "CS-03": { code: "CS-03", name: "検査・手技", category: "臨床技能" },
  "CS-04": { code: "CS-04", name: "治療・ケア", category: "臨床技能" },

  // H. 連携とチーム医療 (Interprofessional Collaboration)
  "IP-01": { code: "IP-01", name: "チーム医療の理解", category: "連携とチーム医療" },
  "IP-02": { code: "IP-02", name: "多職種協働", category: "連携とチーム医療" },
  "IP-03": { code: "IP-03", name: "地域連携", category: "連携とチーム医療" },

  // I. 情報・科学技術 (Information Technology)
  "IT-01": { code: "IT-01", name: "情報リテラシー", category: "情報・科学技術" },
  "IT-02": { code: "IT-02", name: "医療情報", category: "情報・科学技術" },
  "IT-03": { code: "IT-03", name: "医療技術", category: "情報・科学技術" },
};

/**
 * Get core curriculum item by code
 * @param code - Item code (e.g., "PR-01")
 * @returns CoreCurriculumItem or undefined if not found
 */
export function getCoreItem(code: string): CoreCurriculumItem | undefined {
  return CORE_CURRICULUM_ITEMS[code];
}

/**
 * Get formatted display text for core item
 * @param code - Item code (e.g., "PR-01")
 * @returns Formatted text (e.g., "PR-01: 医師の責務") or just code if not found
 */
export function formatCoreItem(code: string): string {
  const item = getCoreItem(code);
  return item ? `${item.code}: ${item.name}` : code;
}
