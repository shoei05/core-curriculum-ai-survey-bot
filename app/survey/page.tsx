"use client";

import { useState } from "react";
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

export default function SurveyPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState<Partial<FormResponse>>({
    challenges: [],
    expectations: [],
  });

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

      {/* 大学設置形態（任意） */}
      {formData.respondent_type && (
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

      <p style={{ marginTop: 16, fontSize: 14, color: "#666" }}>
        選択数: {formData.expectations?.length || 0} / 3
      </p>
    </div>
  );

  // バリデーション
  const validateStep = (): boolean => {
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
      setStep((step + 1) as 2 | 3);
    } else {
      // フォーム送信
      try {
        const response = await fetch("/api/form", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
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
    if (step > 1) {
      setStep((step - 1) as 1 | 2);
    } else {
      router.push("/");
    }
  };

  const stepTitles = ["属性情報", "課題認識", "次期改定への期待"];

  return (
    <main style={{ padding: "20px", maxWidth: 600, margin: "0 auto" }}>
      <a className="top-link" href="/">← 戻る</a>

      {/* プログレスバー */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#666" }}>
            ステップ {step} / 3
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)" }}>
            {stepTitles[step - 1]}
          </span>
        </div>
        <div style={{ width: "100%", backgroundColor: "#e0e0e0", borderRadius: 4, overflow: "hidden" }}>
          <div
            style={{
              height: 8,
              backgroundColor: "var(--accent)",
              transition: "width 0.3s",
              width: `${(step / 3) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* フォーム内容 */}
      {step === 1 && <Step1Attributes />}
      {step === 2 && <Step2Challenges />}
      {step === 3 && <Step3Expectations />}

      {/* ナビゲーションボタン */}
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
    </main>
  );
}
