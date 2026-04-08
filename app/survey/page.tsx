"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type {
  ChallengeCode,
  ExpectationCode,
  ExperienceYears,
  FormResponse,
  RespondentType,
  Specialty,
  StudentYear,
  UniversityType,
} from "@/types/survey";
import {
  CHALLENGE_LABELS,
  CONSENT_VERSION,
  EXPERIENCE_YEARS_LABELS,
  EXPECTATION_LABELS,
  RESPONDENT_TYPE_LABELS,
  SPECIALTY_LABELS,
  STUDENT_YEAR_LABELS,
  UNIVERSITY_TYPE_LABELS,
} from "@/types/survey";
import { toAdditionalRoles } from "@/lib/survey-helpers";

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

  return (
    <textarea
      value={localValue}
      onChange={(event) => setLocalValue(event.target.value)}
      onBlur={() => onChange(localValue)}
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
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<RespondentType[]>([]);
  const [primaryRole, setPrimaryRole] = useState<RespondentType | "">("");
  const [formData, setFormData] = useState<Partial<FormResponse>>({
    challenges: [],
    expectations: [],
    additional_roles: [],
  });
  const [challengeOther, setChallengeOther] = useState("");
  const [expectationOther, setExpectationOther] = useState("");

  const resolvedPrimaryRole = useMemo<RespondentType | undefined>(() => {
    if (selectedRoles.length === 1) {
      return selectedRoles[0];
    }
    if (primaryRole && selectedRoles.includes(primaryRole)) {
      return primaryRole;
    }
    return undefined;
  }, [primaryRole, selectedRoles]);

  useEffect(() => {
    if (selectedRoles.length === 1) {
      setPrimaryRole(selectedRoles[0]);
      return;
    }
    if (selectedRoles.length === 0) {
      setPrimaryRole("");
      return;
    }
    if (primaryRole && !selectedRoles.includes(primaryRole)) {
      setPrimaryRole("");
    }
  }, [primaryRole, selectedRoles]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(() => {
        headingRef.current?.focus();
      }, 120);
    }
  }, [step]);

  const includesRole = (role: RespondentType) => selectedRoles.includes(role);

  const updateFormData = <K extends keyof FormResponse>(key: K, value: FormResponse[K]) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const toggleRole = (role: RespondentType) => {
    setSelectedRoles((current) => {
      if (current.includes(role)) {
        return current.filter((item) => item !== role);
      }
      return [...current, role];
    });
  };

  const toggleSelection = <T extends string>(key: "challenges" | "expectations", value: T) => {
    const currentValues = (formData[key] as T[] | undefined) ?? [];
    const isSelected = currentValues.includes(value);

    if (isSelected) {
      updateFormData(
        key,
        currentValues.filter((item) => item !== value) as FormResponse[typeof key],
      );
      return;
    }

    if (currentValues.length >= 3) {
      return;
    }

    updateFormData(key, [...currentValues, value] as FormResponse[typeof key]);
  };

  const validateStep = () => {
    if (step === 0) {
      return consentChecked;
    }
    if (step === 1) {
      if (selectedRoles.length === 0) {
        return false;
      }
      if (selectedRoles.length > 1 && !resolvedPrimaryRole) {
        return false;
      }
      if (includesRole("faculty") && !(formData.specialty && formData.experience_years)) {
        return false;
      }
      if (includesRole("student") && !formData.student_year) {
        return false;
      }
      return true;
    }
    if (step === 2) {
      return ((formData.challenges as ChallengeCode[] | undefined) ?? []).length > 0;
    }
    if (step === 3) {
      return ((formData.expectations as ExpectationCode[] | undefined) ?? []).length > 0;
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) {
      return;
    }

    if (step < 3) {
      setStep((current) => (current + 1) as 1 | 2 | 3);
      return;
    }

    const respondentType = resolvedPrimaryRole;
    if (!respondentType) {
      return;
    }

    const submitData: FormResponse = {
      respondent_type: respondentType,
      additional_roles: toAdditionalRoles(selectedRoles, respondentType),
      university_type: formData.university_type,
      specialty: includesRole("faculty") ? formData.specialty : undefined,
      experience_years: includesRole("faculty") ? formData.experience_years : undefined,
      student_year: includesRole("student") ? formData.student_year : undefined,
      practitioner_profession: includesRole("practitioner")
        ? formData.practitioner_profession?.trim() || undefined
        : undefined,
      staff_role: includesRole("staff") ? formData.staff_role?.trim() || undefined : undefined,
      challenges: ((formData.challenges as ChallengeCode[] | undefined) ?? []),
      expectations: ((formData.expectations as ExpectationCode[] | undefined) ?? []),
      challenge_other: challengeOther.trim() || undefined,
      expectation_other: expectationOther.trim() || undefined,
      consent_given: true,
      consent_version: CONSENT_VERSION,
      consented_at: new Date().toISOString(),
    };

    setSubmitting(true);
    try {
      const response = await fetch("/api/form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "フォームの送信に失敗しました");
        return;
      }

      localStorage.setItem("sessionId", data.sessionId);
      localStorage.setItem("formResponseId", data.formResponseId);
      localStorage.setItem("respondentType", respondentType);
      router.push("/survey/chat");
    } catch (error) {
      console.error("Survey submit error:", error);
      alert("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 0) {
      router.push("/");
      return;
    }
    setStep((current) => (current - 1) as 0 | 1 | 2);
  };

  const renderChoiceCard = (
    checked: boolean,
    label: string,
    input: ReactNode,
    disabled?: boolean,
  ) => (
    <label
      className={`card-option ${checked ? "selected" : ""}`}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: 16,
        borderRadius: 8,
        border: "2px solid",
        borderColor: checked ? "var(--accent)" : "#ddd",
        cursor: disabled ? "not-allowed" : "pointer",
        backgroundColor: checked ? "var(--accent-soft)" : "#fff",
        transition: "all 0.2s",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {input}
      <span style={{ fontWeight: 500 }}>{label}</span>
    </label>
  );

  const Step0Consent = () => (
    <div className="consent-card">
      <h2 ref={headingRef} tabIndex={-1} style={{ outline: "none" }}>
        同意の確認
      </h2>

      <details className="consent-details" open>
        <summary>研究背景・目的</summary>
        <div className="consent-details-content">
          <p>
            <strong>目的：</strong>
            2022年に改定された医学教育モデル・コア・カリキュラムの次期改定に向けて、現行カリキュラムの課題と現場のニーズを把握する事前調査です。
          </p>
          <p>
            <strong>なぜこの調査：</strong>
            教員、職員、学生、医療者の視点から、教育現場で感じている課題と次期改定への期待をうかがいます。
          </p>
        </div>
      </details>

      <details className="consent-details" open>
        <summary>調査方法</summary>
        <div className="consent-details-content">
          <ul>
            <li>
              <strong>形式：</strong>フォーム入力 + AIアシスタントとの対話インタビュー
            </li>
            <li>
              <strong>所要時間：</strong>約7分間（フォーム2分 + インタビュー5分）
            </li>
            <li>
              <strong>技術：</strong>回答内容は要約と研究用コーディングに利用されます
            </li>
          </ul>
        </div>
      </details>

      <details className="consent-details" open>
        <summary>プライバシーとデータ取り扱い</summary>
        <div className="consent-details-content">
          <ul>
            <li>
              <strong>匿名性：</strong>氏名、所属、連絡先などの個人を特定できる情報は収集しません
            </li>
            <li>
              <strong>保存：</strong>同意時刻と同意バージョンを記録します
            </li>
            <li>
              <strong>IPアドレス：</strong>raw IP は新規保存しません
            </li>
            <li>
              <strong>保持期間：</strong>研究目的のため5年間保存します
            </li>
          </ul>
        </div>
      </details>

      <details className="consent-details" open>
        <summary>参加者の権利</summary>
        <div className="consent-details-content">
          <ul>
            <li>
              <strong>任意性：</strong>参加は任意であり、同意しない場合でも不利益はありません
            </li>
            <li>
              <strong>途中撤回：</strong>いつでも中止できます
            </li>
            <li>
              <strong>省略：</strong>答えづらい質問は無理に答える必要はありません
            </li>
          </ul>
        </div>
      </details>

      <div
        style={{
          marginTop: 20,
          padding: 16,
          borderRadius: 10,
          border: `2px solid ${consentChecked ? "var(--accent)" : "#ddd"}`,
          background: consentChecked ? "var(--accent-soft)" : "#fff",
        }}
      >
        <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(event) => setConsentChecked(event.target.checked)}
            style={{ marginTop: 4, width: 18, height: 18 }}
          />
          <span style={{ lineHeight: 1.7 }}>
            上記の説明を読み、内容を理解したうえで、自らの意思で調査への参加に同意します。
          </span>
        </label>
      </div>

      <div className="consent-timer-notice">
        <p style={{ fontWeight: 600 }}>制限時間は約7分です</p>
        <p style={{ fontSize: 14, color: "#666" }}>終了時に延長するか、そのまま要約へ進むかを選べます。</p>
      </div>

      <button
        onClick={handleNext}
        disabled={!consentChecked}
        className="btn btn-primary"
        style={{
          width: "100%",
          padding: 14,
          fontSize: "1rem",
          background: consentChecked ? "var(--accent)" : "#ccc",
          cursor: consentChecked ? "pointer" : "not-allowed",
        }}
      >
        同意して開始
      </button>
    </div>
  );

  const Step1Attributes = () => (
    <div className="consent-card">
      <h2 ref={headingRef} tabIndex={-1} style={{ outline: "none" }}>
        属性情報
      </h2>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 12 }}>
          当てはまる立場をすべて選択してください <span style={{ color: "#b00020" }}>*</span>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {(Object.entries(RESPONDENT_TYPE_LABELS) as [RespondentType, string][]).map(([value, label]) =>
            renderChoiceCard(
              includesRole(value),
              label,
              <input
                type="checkbox"
                checked={includesRole(value)}
                onChange={() => toggleRole(value)}
                style={{ marginTop: 4, width: 18, height: 18 }}
              />,
            ),
          )}
        </div>
      </div>

      {selectedRoles.length > 1 && (
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 12 }}>
            主たる立場を1つ選択してください <span style={{ color: "#b00020" }}>*</span>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {selectedRoles.map((role) =>
              renderChoiceCard(
                primaryRole === role,
                RESPONDENT_TYPE_LABELS[role],
                <input
                  type="radio"
                  name="primary_role"
                  checked={primaryRole === role}
                  onChange={() => setPrimaryRole(role)}
                  style={{ marginTop: 4, width: 18, height: 18 }}
                />,
              ),
            )}
          </div>
        </div>
      )}

      {(includesRole("faculty") || includesRole("student")) && (
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 12 }}>
            大学の設置形態 <span style={{ color: "#999", fontSize: 14 }}>（任意）</span>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {(Object.entries(UNIVERSITY_TYPE_LABELS) as [UniversityType, string][]).map(([value, label]) =>
              renderChoiceCard(
                formData.university_type === value,
                label,
                <input
                  type="radio"
                  name="university_type"
                  checked={formData.university_type === value}
                  onChange={() => updateFormData("university_type", value)}
                  style={{ marginTop: 4, width: 18, height: 18 }}
                />,
              ),
            )}
          </div>
        </div>
      )}

      {includesRole("faculty") && (
        <>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 12 }}>
              専門分野 <span style={{ color: "#b00020" }}>*</span>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              {(Object.entries(SPECIALTY_LABELS) as [Specialty, string][]).map(([value, label]) =>
                renderChoiceCard(
                  formData.specialty === value,
                  label,
                  <input
                    type="radio"
                    name="specialty"
                    checked={formData.specialty === value}
                    onChange={() => updateFormData("specialty", value)}
                    style={{ marginTop: 4, width: 18, height: 18 }}
                  />,
                ),
              )}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 12 }}>
              教育経験 <span style={{ color: "#b00020" }}>*</span>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              {(Object.entries(EXPERIENCE_YEARS_LABELS) as [ExperienceYears, string][]).map(([value, label]) =>
                renderChoiceCard(
                  formData.experience_years === value,
                  label,
                  <input
                    type="radio"
                    name="experience_years"
                    checked={formData.experience_years === value}
                    onChange={() => updateFormData("experience_years", value)}
                    style={{ marginTop: 4, width: 18, height: 18 }}
                  />,
                ),
              )}
            </div>
          </div>
        </>
      )}

      {includesRole("student") && (
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 12 }}>
            学年 <span style={{ color: "#b00020" }}>*</span>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {(Object.entries(STUDENT_YEAR_LABELS) as [StudentYear, string][]).map(([value, label]) =>
              renderChoiceCard(
                formData.student_year === value,
                label,
                <input
                  type="radio"
                  name="student_year"
                  checked={formData.student_year === value}
                  onChange={() => updateFormData("student_year", value)}
                  style={{ marginTop: 4, width: 18, height: 18 }}
                />,
              ),
            )}
          </div>
        </div>
      )}

      {includesRole("practitioner") && (
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
            医療者としての職種 <span style={{ color: "#999", fontSize: 14 }}>（任意）</span>
          </label>
          <input
            className="text-input"
            value={formData.practitioner_profession ?? ""}
            onChange={(event) => updateFormData("practitioner_profession", event.target.value)}
            placeholder="例: 医師、看護師、薬剤師"
            style={{ width: "100%" }}
          />
        </div>
      )}

      {includesRole("staff") && (
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
            職員としての担当 <span style={{ color: "#999", fontSize: 14 }}>（任意）</span>
          </label>
          <input
            className="text-input"
            value={formData.staff_role ?? ""}
            onChange={(event) => updateFormData("staff_role", event.target.value)}
            placeholder="例: 教務、実習支援、学務"
            style={{ width: "100%" }}
          />
        </div>
      )}
    </div>
  );

  const Step2Challenges = () => (
    <div className="consent-card">
      <h2 ref={headingRef} tabIndex={-1} style={{ outline: "none" }}>
        現行コアカリの課題
      </h2>
      <p style={{ color: "#666", marginBottom: 24 }}>当てはまるものを最大3つまで選択してください。</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(Object.entries(CHALLENGE_LABELS) as [ChallengeCode, string][]).map(([code, label]) => {
          const current = ((formData.challenges as ChallengeCode[] | undefined) ?? []);
          const disabled = !current.includes(code) && current.length >= 3;
          return renderChoiceCard(
            current.includes(code),
            label,
            <input
              type="checkbox"
              checked={current.includes(code)}
              onChange={() => toggleSelection("challenges", code)}
              disabled={disabled}
              style={{ marginTop: 4, width: 18, height: 18 }}
            />,
            disabled,
          );
        })}
      </div>

      {((formData.challenges as ChallengeCode[] | undefined) ?? []).includes("other") && (
        <div style={{ marginTop: 16, padding: 16, background: "#f8f9fa", borderRadius: 8 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>その他の課題</label>
          <OtherTextarea value={challengeOther} onChange={setChallengeOther} placeholder="具体的にお書きください" />
        </div>
      )}
    </div>
  );

  const Step3Expectations = () => (
    <div className="consent-card">
      <h2 ref={headingRef} tabIndex={-1} style={{ outline: "none" }}>
        次期改定への期待
      </h2>
      <p style={{ color: "#666", marginBottom: 24 }}>期待するものを最大3つまで選択してください。</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(Object.entries(EXPECTATION_LABELS) as [ExpectationCode, string][]).map(([code, label]) => {
          const current = ((formData.expectations as ExpectationCode[] | undefined) ?? []);
          const disabled = !current.includes(code) && current.length >= 3;
          return renderChoiceCard(
            current.includes(code),
            label,
            <input
              type="checkbox"
              checked={current.includes(code)}
              onChange={() => toggleSelection("expectations", code)}
              disabled={disabled}
              style={{ marginTop: 4, width: 18, height: 18 }}
            />,
            disabled,
          );
        })}
      </div>

      {((formData.expectations as ExpectationCode[] | undefined) ?? []).includes("other") && (
        <div style={{ marginTop: 16, padding: 16, background: "#f8f9fa", borderRadius: 8 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>その他の期待</label>
          <OtherTextarea value={expectationOther} onChange={setExpectationOther} placeholder="具体的にお書きください" />
        </div>
      )}
    </div>
  );

  const stepTitles = ["同意確認", "属性情報", "課題認識", "次期改定への期待"];

  return (
    <main style={{ padding: "20px", maxWidth: 760, margin: "0 auto" }}>
      <a className="top-link" href="/">
        ← 戻る
      </a>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#666" }}>
            ステップ {step + 1} / 4
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)" }}>{stepTitles[step]}</span>
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

      {step === 0 && <Step0Consent />}
      {step === 1 && <Step1Attributes />}
      {step === 2 && <Step2Challenges />}
      {step === 3 && <Step3Expectations />}

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
            disabled={!validateStep() || submitting}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              border: "none",
              backgroundColor: validateStep() && !submitting ? "var(--accent)" : "#ccc",
              color: "#fff",
              fontWeight: 600,
              cursor: validateStep() && !submitting ? "pointer" : "not-allowed",
            }}
          >
            {submitting ? "送信中..." : step === 3 ? "インタビューへ" : "次へ"}
          </button>
        </div>
      )}
    </main>
  );
}
