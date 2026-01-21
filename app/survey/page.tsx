"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  FormResponse,
  RespondentType,
  UniversityType,
  Specialty,
  ExperienceYears,
  StudentYear,
  ChallengeCode,
  ExpectationCode,
} from "@/types/survey";
import {
  RESPONDENT_TYPE_LABELS,
  UNIVERSITY_TYPE_LABELS,
  SPECIALTY_LABELS,
  EXPERIENCE_YEARS_LABELS,
  STUDENT_YEAR_LABELS,
  CHALLENGE_LABELS,
  EXPECTATION_LABELS,
} from "@/types/survey";

interface OtherTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
}

function OtherTextarea({ value, onChange, placeholder, rows = 3 }: OtherTextareaProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalValue(e.target.value);
  };

  const handleBlur = () => {
    onChange(localValue);
  };

  return (
    <textarea
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%",
        padding: 12,
        border: "1px solid #ddd",
        borderRadius: 6,
        fontSize: "0.95rem",
        resize: "vertical",
        boxSizing: "border-box",
      }}
    />
  );
}

export default function SurveyPage() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [formData, setFormData] = useState<Partial<FormResponse>>({
    challenges: [],
    expectations: [],
  });
  // 個別のstateでIME入力中の再レンダリングを防止
  const [challengeOther, setChallengeOther] = useState("");
  const [expectationOther, setExpectationOther] = useState("");

  // ステップ0: 同意画面
  const Step0Consent = () => (
    <div className="consent-card">
      <h2>同意の確認</h2>

      <details className="consent-details" open>
        <summary>研究背景・目的</summary>
        <div className="consent-details-content">
          <p><strong>目的：</strong>2022年に改定された医学教育モデル・コア・カリキュラムの次期改定に向けて、現行カリキュラムの課題と現場のニーズを把握する事前調査です。</p>
          <p><strong>なぜこの調査：</strong>2022年改定後の教育現場での実践状況、困りごと、および今後の改定に期待する点について、先生方・職員の方々・学生の皆さまの視点をお聞かせいただきたく存じます。</p>
        </div>
      </details>

      <details className="consent-details" open>
        <summary>調査方法</summary>
        <div className="consent-details-content">
          <ul>
            <li><strong>形式：</strong>フォーム入力 + AIアシスタントによる対話形式のインタビュー調査</li>
            <li><strong>所要時間：</strong>約7分間（フォーム2分 + インタビュー5分）</li>
            <li><strong>時間終了後：</strong>延長を選択いただけます（+3分ずつ）</li>
            <li><strong>技術：</strong>AIを用いて回答内容を解析し、テーマ・キーワードを抽出します</li>
          </ul>
        </div>
      </details>

      <details className="consent-details" open>
        <summary>対象者と選出理由</summary>
        <div className="consent-details-content">
          <p><strong>対象：</strong>医学教育に携わる教員・職員・医学生の方</p>
          <p><strong>選出理由：</strong>医学教育の専門知識と実践経験、または学習者としての経験をお持ちであり、カリキュラム改定に向けた貴重なご意見をお伺いできるため</p>
        </div>
      </details>

      <details className="consent-details" open>
        <summary>リスクとベネフィット</summary>
        <div className="consent-details-content">
          <p><strong>リスク：</strong>時間の負担、教育上の課題について話すことによる心理的な不快感の可能性（いずれも軽微）</p>
          <p><strong>ベネフィット：</strong>次期医学教育カリキュラムの改善に貢献</p>
          <p><strong>謝礼：</strong>なし</p>
        </div>
      </details>

      <details className="consent-details" open>
        <summary>プライバシーとデータ取り扱い</summary>
        <div className="consent-details-content">
          <ul>
            <li><strong>匿名性：</strong>個人を特定できる情報（氏名・所属・連絡先等）は収集しません</li>
            <li><strong>集計：</strong>回答は他の回答者の方のデータと合わせて集約・分析します</li>
            <li><strong>保存：</strong>データは暗号化され、アクセス制限された環境で保存されます</li>
            <li><strong>保持期間：</strong>研究目的のため5年間保存します</li>
          </ul>
        </div>
      </details>

      <details className="consent-details" open>
        <summary>参加者の権利</summary>
        <div className="consent-details-content">
          <ul>
            <li><strong>任意性：</strong>研究への参加は任意です</li>
            <li><strong>拒否権：</strong>同意しない場合でも不利益は一切ありません</li>
            <li><strong>途中撤回：</strong>いつでも参加を取りやめることができます</li>
            <li><strong>質問省略：</strong>回答したくない質問はスキップ可能です</li>
            <li><strong>データ削除請求：</strong>回答後の削除を希望される場合は、下記連絡先までお問い合わせください</li>
          </ul>
        </div>
      </details>

      <details className="consent-details" open>
        <summary>研究承認・問い合わせ</summary>
        <div className="consent-details-content">
          <p><strong>IRB承認番号：</strong>[機関に合わせて設定 - 例: IRB-2026-001]</p>
          <p><strong>研究責任者：</strong>[責任者氏名・所属]</p>
          <p><strong>所属機関：</strong>[機関名]</p>
          <p><strong>研究に関するお問い合わせ：</strong>[email/phone]</p>
          <p><strong>研究倫理に関するお問い合わせ：</strong>[IRB連絡先]</p>
        </div>
      </details>

      <div className="consent-statement">
        <p>「上記に同意して開始」をクリックすることで、以下のことを確認したものとみなします：</p>
        <ul>
          <li>上記の内容を読み、理解した</li>
          <li>自らの意志で研究に参加することに同意する</li>
          <li>いつでも参加を取りやめることができることを理解した</li>
        </ul>
      </div>

      <div className="consent-timer-notice">
        <p style={{ fontWeight: 600 }}>⏰ 制限時間：インタビューは約7分間</p>
        <p style={{ fontSize: 14, color: "#666" }}>※時間終了後、+3分ずつ延長を選択いただけます</p>
      </div>

      <button
        onClick={() => setStep(1)}
        className="btn btn-primary"
        style={{ width: "100%", padding: 14, fontSize: "1rem" }}
      >
        上記に同意して開始
      </button>
    </div>
  );

  // ステップ1: 属性選択
  const Step1Attributes = () => (
    <div className="consent-card">
      <h2>属性情報</h2>

      {/* 回答者タイプ */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 12 }}>
          回答者タイプ <span style={{ color: "#b00020" }}>*</span>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {(Object.entries(RESPONDENT_TYPE_LABELS) as [RespondentType, string][]).map(([value, label]) => (
            <label
              key={value}
              className={`card-option ${formData.respondent_type === value ? "selected" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                borderRadius: 8,
                border: "2px solid",
                borderColor: formData.respondent_type === value ? "var(--accent)" : "#ddd",
                cursor: "pointer",
                backgroundColor: formData.respondent_type === value ? "var(--accent-soft)" : "#fff",
                transition: "all 0.2s",
              }}
            >
              <input
                type="radio"
                name="respondent_type"
                value={value}
                checked={formData.respondent_type === value}
                onChange={() => setFormData({ ...formData, respondent_type: value })}
                style={{ position: "absolute", opacity: 0 }}
              />
              <span style={{ fontWeight: 500 }}>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 大学設置形態（任意・教員・学生のみ） */}
      {(formData.respondent_type === "faculty" || formData.respondent_type === "student") && (
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 12 }}>
            大学の設置形態 <span style={{ color: "#999", fontSize: 14 }}>（任意）</span>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {(Object.entries(UNIVERSITY_TYPE_LABELS) as [UniversityType, string][]).map(([value, label]) => (
              <label
                key={value}
                className={`card-option ${formData.university_type === value ? "selected" : ""}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 12,
                  borderRadius: 8,
                  border: "2px solid",
                  borderColor: formData.university_type === value ? "var(--accent)" : "#ddd",
                  cursor: "pointer",
                  backgroundColor: formData.university_type === value ? "var(--accent-soft)" : "#fff",
                  transition: "all 0.2s",
                }}
              >
                <input
                  type="radio"
                  name="university_type"
                  value={value}
                  checked={formData.university_type === value}
                  onChange={() => setFormData({ ...formData, university_type: value })}
                  style={{ position: "absolute", opacity: 0 }}
                />
                <span style={{ fontWeight: 500 }}>{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 教員向け追加項目 */}
      {formData.respondent_type === "faculty" && (
        <>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 12 }}>
              専門分野 <span style={{ color: "#b00020" }}>*</span>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
              {(Object.entries(SPECIALTY_LABELS) as [Specialty, string][]).map(([value, label]) => (
                <label
                  key={value}
                  className={`card-option ${formData.specialty === value ? "selected" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 12,
                    borderRadius: 8,
                    border: "2px solid",
                    borderColor: formData.specialty === value ? "var(--accent)" : "#ddd",
                    cursor: "pointer",
                    backgroundColor: formData.specialty === value ? "var(--accent-soft)" : "#fff",
                    transition: "all 0.2s",
                  }}
                >
                  <input
                    type="radio"
                    name="specialty"
                    value={value}
                    checked={formData.specialty === value}
                    onChange={() => setFormData({ ...formData, specialty: value })}
                    style={{ position: "absolute", opacity: 0 }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 12 }}>
              教育経験 <span style={{ color: "#b00020" }}>*</span>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
              {(Object.entries(EXPERIENCE_YEARS_LABELS) as [ExperienceYears, string][]).map(([value, label]) => (
                <label
                  key={value}
                  className={`card-option ${formData.experience_years === value ? "selected" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 12,
                    borderRadius: 8,
                    border: "2px solid",
                    borderColor: formData.experience_years === value ? "var(--accent)" : "#ddd",
                    cursor: "pointer",
                    backgroundColor: formData.experience_years === value ? "var(--accent-soft)" : "#fff",
                    transition: "all 0.2s",
                  }}
                >
                  <input
                    type="radio"
                    name="experience_years"
                    value={value}
                    checked={formData.experience_years === value}
                    onChange={() => setFormData({ ...formData, experience_years: value })}
                    style={{ position: "absolute", opacity: 0 }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 学生向け追加項目 */}
      {formData.respondent_type === "student" && (
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 12 }}>
            学年 <span style={{ color: "#b00020" }}>*</span>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1FR))", gap: 8 }}>
            {(Object.entries(STUDENT_YEAR_LABELS) as [StudentYear, string][]).map(([value, label]) => (
              <label
                key={value}
                className={`card-option ${formData.student_year === value ? "selected" : ""}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 12,
                  borderRadius: 8,
                  border: "2px solid",
                  borderColor: formData.student_year === value ? "var(--accent)" : "#ddd",
                  cursor: "pointer",
                  backgroundColor: formData.student_year === value ? "var(--accent-soft)" : "#fff",
                  transition: "all 0.2s",
                }}
              >
                <input
                  type="radio"
                  name="student_year"
                  value={value}
                  checked={formData.student_year === value}
                  onChange={() => setFormData({ ...formData, student_year: value })}
                  style={{ position: "absolute", opacity: 0 }}
                />
                <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ステップ2: 課題認識
  const Step2Challenges = () => (
    <div className="consent-card">
      <h2>現行コアカリの課題</h2>
      <p style={{ color: "#666", marginBottom: 24 }}>
        当てはまるものを最大3つまで選択してください
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(Object.entries(CHALLENGE_LABELS) as [ChallengeCode, string][]).map(([code, label]) => (
          <label
            key={code}
            style={{
              display: "flex",
              alignItems: "start",
              padding: 16,
              borderRadius: 8,
              border: "2px solid",
              borderColor: formData.challenges?.includes(code) ? "var(--accent)" : "#ddd",
              cursor: "pointer",
              backgroundColor: formData.challenges?.includes(code) ? "var(--accent-soft)" : "#fff",
              transition: "all 0.2s",
              opacity:
                !formData.challenges?.includes(code) &&
                formData.challenges &&
                formData.challenges.length >= 3
                  ? 0.5
                  : 1,
            }}
          >
            <input
              type="checkbox"
              checked={formData.challenges?.includes(code) || false}
              onChange={(e) => {
                const current = formData.challenges || [];
                if (e.target.checked) {
                  if (current.length < 3) {
                    setFormData({ ...formData, challenges: [...current, code] });
                  }
                } else {
                  setFormData({ ...formData, challenges: current.filter((c) => c !== code) });
                }
              }}
              disabled={
                !formData.challenges?.includes(code) &&
                formData.challenges &&
                formData.challenges.length >= 3
              }
              style={{ marginTop: 4, marginRight: 12, width: 18, height: 18 }}
            />
            <span style={{ fontWeight: 500 }}>{label}</span>
          </label>
        ))}
      </div>

      {formData.challenges?.includes("other") && (
        <div style={{ marginTop: 16, padding: 16, background: "#f8f9fa", borderRadius: 8 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
            その他の課題（自由記述）
          </label>
          <OtherTextarea
            value={challengeOther}
            onChange={setChallengeOther}
            placeholder="具体的にお書きください"
            rows={3}
          />
        </div>
      )}

      <p style={{ marginTop: 16, fontSize: 14, color: "#666" }}>
        選択数: {formData.challenges?.length || 0} / 3
      </p>
    </div>
  );

  // ステップ3: 次期改定への期待
  const Step3Expectations = () => (
    <div className="consent-card">
      <h2>次期改定への期待</h2>
      <p style={{ color: "#666", marginBottom: 24 }}>
        次期改定に期待するものを最大3つまで選択してください
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(Object.entries(EXPECTATION_LABELS) as [ExpectationCode, string][]).map(([code, label]) => (
          <label
            key={code}
            style={{
              display: "flex",
              alignItems: "start",
              padding: 16,
              borderRadius: 8,
              border: "2px solid",
              borderColor: formData.expectations?.includes(code) ? "var(--accent)" : "#ddd",
              cursor: "pointer",
              backgroundColor: formData.expectations?.includes(code) ? "var(--accent-soft)" : "#fff",
              transition: "all 0.2s",
              opacity:
                !formData.expectations?.includes(code) &&
                formData.expectations &&
                formData.expectations.length >= 3
                  ? 0.5
                  : 1,
            }}
          >
            <input
              type="checkbox"
              checked={formData.expectations?.includes(code) || false}
              onChange={(e) => {
                const current = formData.expectations || [];
                if (e.target.checked) {
                  if (current.length < 3) {
                    setFormData({ ...formData, expectations: [...current, code] });
                  }
                } else {
                  setFormData({
                    ...formData,
                    expectations: current.filter((c) => c !== code),
                  });
                }
              }}
              disabled={
                !formData.expectations?.includes(code) &&
                formData.expectations &&
                formData.expectations.length >= 3
              }
              style={{ marginTop: 4, marginRight: 12, width: 18, height: 18 }}
            />
            <span style={{ fontWeight: 500 }}>{label}</span>
          </label>
        ))}
      </div>

      {formData.expectations?.includes("other") && (
        <div style={{ marginTop: 16, padding: 16, background: "#f8f9fa", borderRadius: 8 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
            その他の期待（自由記述）
          </label>
          <OtherTextarea
            value={expectationOther}
            onChange={setExpectationOther}
            placeholder="具体的にお書きください"
            rows={3}
          />
        </div>
      )}

      <p style={{ marginTop: 16, fontSize: 14, color: "#666" }}>
        選択数: {formData.expectations?.length || 0} / 3
      </p>
    </div>
  );

  // バリデーション
  const validateStep = (): boolean => {
    if (step === 0) {
      return true; // 同意画面は常に進める
    }
    if (step === 1) {
      if (!formData.respondent_type) return false;
      if (formData.respondent_type === "faculty") {
        return !!(formData.specialty && formData.experience_years);
      }
      if (formData.respondent_type === "student") {
        return !!formData.student_year;
      }
      return true;
    }
    if (step === 2) {
      return (formData.challenges?.length || 0) > 0;
    }
    if (step === 3) {
      return (formData.expectations?.length || 0) > 0;
    }
    return true;
  };

  // 次へ
  const handleNext = async () => {
    if (!validateStep()) return;

    if (step < 3) {
      setStep((step + 1) as 1 | 2 | 3);
    } else {
      // フォーム送信（個別stateをマージ）
      try {
        const submitData = {
          ...formData,
          challenge_other: challengeOther || undefined,
          expectation_other: expectationOther || undefined,
        };
        const response = await fetch("/api/form", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submitData),
        });

        const data = await response.json();
        if (response.ok) {
          localStorage.setItem("sessionId", data.sessionId);
          localStorage.setItem("formResponseId", data.formResponseId);
          localStorage.setItem("respondentType", formData.respondent_type!);
          router.push("/survey/chat");
        } else {
          alert(data.error || "エラーが発生しました");
        }
      } catch (error) {
        console.error("Error:", error);
        alert("エラーが発生しました");
      }
    }
  };

  // 戻る
  const handleBack = () => {
    if (step > 0) {
      setStep((step - 1) as 0 | 1 | 2);
    } else {
      router.push("/");
    }
  };

  const stepTitles = ["同意確認", "属性情報", "課題認識", "次期改定への期待"];

  return (
    <main style={{ padding: "20px", maxWidth: 600, margin: "0 auto" }}>
      <a className="top-link" href="/">← 戻る</a>

      {/* プログレスバー */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#666" }}>
            ステップ {step + 1} / 4
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)" }}>
            {stepTitles[step]}
          </span>
        </div>
        <div style={{ width: "100%", backgroundColor: "#e0e0e0", borderRadius: 4, overflow: "hidden" }}>
          <div
            style={{
              height: 8,
              backgroundColor: "var(--accent)",
              transition: "width 0.3s",
              width: `${((step + 1) / 4) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* フォーム内容 */}
      {step === 0 && <Step0Consent />}
      {step === 1 && <Step1Attributes />}
      {step === 2 && <Step2Challenges />}
      {step === 3 && <Step3Expectations />}

      {/* ナビゲーションボタン（同意画面以外で表示） */}
      {step > 0 && (
        <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
          <button
            onClick={handleBack}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              border: "2px solid #ccc",
              backgroundColor: "#fff",
              color: "#333",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            戻る
          </button>
          <button
            onClick={handleNext}
            disabled={!validateStep()}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              border: "none",
              backgroundColor: validateStep() ? "var(--accent)" : "#ccc",
              color: "#fff",
              fontWeight: 600,
              cursor: validateStep() ? "pointer" : "not-allowed",
            }}
          >
            {step === 3 ? "インタビューへ" : "次へ"}
          </button>
        </div>
      )}
    </main>
  );
}
