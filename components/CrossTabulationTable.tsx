"use client";

import { useMemo } from "react";

interface FormResponse {
  id: string;
  respondent_type_code: string;
  respondent_type: string;
  challenges: string[];
  expectations: string[];
}

interface CrossTabulationTableProps {
  responses: FormResponse[];
  type: "challenges" | "expectations";
}

const RESPONDENT_TYPES = ["faculty", "staff", "student"] as const;
const RESPONDENT_TYPE_LABELS: Record<string, string> = {
  faculty: "教員",
  staff: "職員",
  student: "学生",
};

const CHALLENGE_LABELS: Record<string, string> = {
  "コアカリの学修内容が多すぎる": "コアカリの学修内容が多すぎる",
  "臨床実習の時間が足りない": "臨床実習の時間が足りない",
  "教員・指導者が不足している": "教員・指導者が不足している",
  "評価方法に課題がある": "評価方法に課題がある",
  "生成AI活用教育が不十分": "生成AI活用教育が不十分",
  "実習先・臨床経験の質がばらつく": "実習先・臨床経験の質がばらつく",
  "学修目標の優先順位が分かりにくい": "学修目標の優先順位が分かりにくい",
  "基礎・臨床・社会医学の統合が不十分": "基礎・臨床・社会医学の統合が不十分",
  "地域・大学の実情に合わせにくい": "地域・大学の実情に合わせにくい",
  "国家試験・卒前評価との整合が弱い": "国家試験・卒前評価との整合が弱い",
  "その他": "その他",
};

const EXPECTATION_LABELS: Record<string, string> = {
  "コアカリ学修目標の精選": "コアカリ学修目標の精選",
  "臨床実習の充実": "臨床実習の充実",
  "生成AI活用教育の充実": "生成AI活用教育の充実",
  "評価方法の改善": "評価方法の改善",
  "多職種連携教育の充実": "多職種連携教育の充実",
  "実習・臨床経験の質の均質化": "実習・臨床経験の質の均質化",
  "学修目標の優先順位の明確化": "学修目標の優先順位の明確化",
  "基礎・臨床・社会医学の統合の強化": "基礎・臨床・社会医学の統合の強化",
  "地域・大学の実情に合わせた柔軟な運用": "地域・大学の実情に合わせた柔軟な運用",
  "国家試験・卒前評価との整合性強化": "国家試験・卒前評価との整合性強化",
  "その他": "その他",
};

export function CrossTabulationTable({
  responses,
  type,
}: CrossTabulationTableProps) {
  const crossTabData = useMemo(() => {
    // 選択肢ラベルを取得
    const labels =
      type === "challenges" ? CHALLENGE_LABELS : EXPECTATION_LABELS;
    const items = Object.values(labels);

    // 各回答者タイプの集計
    const typeCounts: Record<string, number> = {};
    RESPONDENT_TYPES.forEach((t) => {
      typeCounts[t] = responses.filter((r) => r.respondent_type_code === t).length;
    });

    // クロス集計テーブルを作成
    const table: Record<string, Record<string, { count: number; percent: number }>> = {};

    items.forEach((item) => {
      table[item] = {};
      RESPONDENT_TYPES.forEach((respondentType) => {
        const typeResponses = responses.filter(
          (r) => r.respondent_type_code === respondentType
        );
        const count = typeResponses.filter((r) => {
          const values = type === "challenges" ? r.challenges : r.expectations;
          return values.includes(item);
        }).length;
        const percent =
          typeCounts[respondentType] > 0 ? (count / typeCounts[respondentType]) * 100 : 0;
        table[item][respondentType] = { count, percent };
      });
    });

    return { table, typeCounts, items };
  }, [responses, type]);

  const { table, typeCounts, items } = crossTabData;
  const labels = type === "challenges" ? CHALLENGE_LABELS : EXPECTATION_LABELS;

  // 選択回数順にソート
  const sortedItems = [...items].sort((a, b) => {
    const sumA = RESPONDENT_TYPES.reduce(
      (sum, t) => sum + table[a][t].count,
      0
    );
    const sumB = RESPONDENT_TYPES.reduce(
      (sum, t) => sum + table[b][t].count,
      0
    );
    return sumB - sumA;
  });

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "14px",
        }}
      >
        <thead>
          <tr style={{ background: "var(--surface)" }}>
            <th
              style={{
                padding: "12px",
                textAlign: "left",
                border: "1px solid var(--border)",
                fontWeight: 600,
                minWidth: 200,
              }}
            >
              {type === "challenges" ? "課題認識" : "次期改定への期待"}
            </th>
            {RESPONDENT_TYPES.map((type) => (
              <th
                key={type}
                style={{
                  padding: "12px",
                  textAlign: "center",
                  border: "1px solid var(--border)",
                  fontWeight: 600,
                  minWidth: 100,
                }}
              >
                <div>
                  {RESPONDENT_TYPE_LABELS[type]}
                  <span style={{ fontSize: "12px", color: "#666" }}>
                    (N={typeCounts[type]})
                  </span>
                </div>
              </th>
            ))}
            <th
              style={{
                padding: "12px",
                textAlign: "center",
                border: "1px solid var(--border)",
                fontWeight: 600,
                minWidth: 80,
              }}
            >
              合計
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item) => {
            const totalCount = RESPONDENT_TYPES.reduce(
              (sum, t) => sum + table[item][t].count,
              0
            );
            return (
              <tr key={item}>
                <td
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    fontWeight: 500,
                  }}
                >
                  {item}
                </td>
                {RESPONDENT_TYPES.map((type) => {
                  const { count, percent } = table[item][type];
                  return (
                    <td
                      key={type}
                      style={{
                        padding: "10px 12px",
                        border: "1px solid var(--border)",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: `${percent}%`,
                            height: 8,
                            background: `hsl(${210 + percent * 1.2}, 70%, 50%)`,
                            borderRadius: 4,
                            minWidth: percent > 0 ? 8 : 0,
                          }}
                        />
                        <span style={{ fontSize: "12px", whiteSpace: "nowrap" }}>
                          {count} ({percent.toFixed(1)}%)
                        </span>
                      </div>
                    </td>
                  );
                })}
                <td
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    textAlign: "center",
                    fontWeight: 600,
                  }}
                >
                  {totalCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
