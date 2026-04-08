"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type {
  CategoryGroup,
  CodingSensitivity,
  InVivoCode,
  SummaryApiResponse,
  SummaryView,
} from "@/types/survey";

const TIME_LIMIT_SECONDS = 7 * 60;
const EXTENSION_SECONDS = 3 * 60;
const CHAT_TIMEOUT_MS = 25000;
const SUMMARY_TIMEOUT_MS = 45000;
const VOICE_TIMEOUT_MS = 45000;
const MAX_RECORDING_MS = 90 * 1000;
const RECORDING_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface PendingChatRequest {
  action: "start" | "chat";
  messages: Message[];
}

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const MarkdownContent = ({ content }: { content: string }) => {
  const normalizeMarkdown = (text: string) =>
    text.replace(/\*\*([^\s*\u200B])/g, "**\u200B$1").replace(/([^\s*\u200B])\*\*/g, "$1\u200B**");

  return <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{normalizeMarkdown(content)}</ReactMarkdown>;
};

function getFallbackGreeting(respondentType?: string | null) {
  const greetings: Record<string, string> = {
    faculty: "ご回答ありがとうございます。まず、現場で課題を強く感じた具体的な場面を1つ教えてください。",
    staff: "ご回答ありがとうございます。まず、運営や調整の場面で困った具体例を1つ教えてください。",
    student: "ご回答ありがとうございます。まず、授業や実習で困った具体的な場面を1つ教えてください。",
    practitioner: "ご回答ありがとうございます。まず、教育との接点で課題を感じた具体的な場面を1つ教えてください。",
  };
  return greetings[respondentType ?? ""] ?? greetings.faculty;
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "サーバーエラーが発生しました");
    }
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("timeout");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchFormDataJsonWithTimeout(url: string, formData: FormData, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { method: "POST", body: formData, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "サーバーエラーが発生しました");
    }
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("timeout");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function getPreferredRecordingMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }

  return RECORDING_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

function getRecordingFileExtension(mimeType: string) {
  if (mimeType.includes("mp4")) {
    return "m4a";
  }

  return "webm";
}

function mergeInputText(previous: string, next: string) {
  const current = previous.trim();
  const incoming = next.trim();

  if (!incoming) {
    return current;
  }

  if (!current) {
    return incoming;
  }

  return `${current}\n${incoming}`;
}

export default function ChatPage() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastAiMessageRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const extendConfirmTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingStopTimerRef = useRef<number | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const sidePanelRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [respondentType, setRespondentType] = useState<string>("");
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [remainingTime, setRemainingTime] = useState(TIME_LIMIT_SECONDS);
  const [isExpired, setIsExpired] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [showExtendConfirmModal, setShowExtendConfirmModal] = useState(false);
  const [extendConfirmCountdown, setExtendConfirmCountdown] = useState(60);
  const [totalExtendedTime, setTotalExtendedTime] = useState(0);
  const [sidePanelFocus, setSidePanelFocus] = useState(false);

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryRequested, setSummaryRequested] = useState(false);
  const [summaryView, setSummaryView] = useState<SummaryView | null>(null);
  const [codingPrimaryIssueCategories, setCodingPrimaryIssueCategories] = useState<CategoryGroup[]>([]);
  const [codingPrimaryCompetencyCategories, setCodingPrimaryCompetencyCategories] = useState<CategoryGroup[]>([]);
  const [codingPrimaryCoreItems, setCodingPrimaryCoreItems] = useState<string[]>([]);
  const [codingPrimaryInVivoCodes, setCodingPrimaryInVivoCodes] = useState<InVivoCode[]>([]);
  const [codingSensitivity, setCodingSensitivity] = useState<CodingSensitivity | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [pendingChatRequest, setPendingChatRequest] = useState<PendingChatRequest | null>(null);
  const [voiceInputSupported, setVoiceInputSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const sessionId = localStorage.getItem("sessionId");
    const formResponseId = localStorage.getItem("formResponseId");
    const storedRespondentType = localStorage.getItem("respondentType");

    if (!sessionId || !formResponseId) {
      router.push("/survey");
      return;
    }

    setRespondentType(storedRespondentType || "");
    setStartedAt(new Date().toISOString());
  }, [router]);

  useEffect(() => {
    setVoiceInputSupported(typeof window !== "undefined" && "MediaRecorder" in window && Boolean(navigator.mediaDevices?.getUserMedia));
  }, []);

  const clearRecordingStopTimer = useCallback(() => {
    if (recordingStopTimerRef.current !== null) {
      window.clearTimeout(recordingStopTimerRef.current);
      recordingStopTimerRef.current = null;
    }
  }, []);

  const stopMediaStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearRecordingStopTimer();

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }

      stopMediaStream();
    };
  }, [clearRecordingStopTimer, stopMediaStream]);

  const focusSidePanel = useCallback(() => {
    setSidePanelFocus(true);
    sidePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => setSidePanelFocus(false), 2200);
  }, []);

  const runChatRequest = useCallback(
    async (request: PendingChatRequest) => {
      const sessionId = localStorage.getItem("sessionId");
      const formResponseId = localStorage.getItem("formResponseId");

      if (!sessionId || !formResponseId) {
        router.push("/survey");
        return;
      }

      setIsLoading(true);
      setChatError(null);
      setPendingChatRequest(request);

      try {
        const data = await fetchJsonWithTimeout(
          "/api/chat",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              formResponseId,
              respondentType,
              messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
              action: request.action,
            }),
          },
          CHAT_TIMEOUT_MS,
        );

        const assistantMessage: Message = {
          id: createId(),
          role: "assistant",
          content:
            typeof data.message === "string" && data.message.trim().length > 0
              ? data.message
              : getFallbackGreeting(respondentType),
        };

        setMessages(request.action === "start" ? [assistantMessage] : [...request.messages, assistantMessage]);
        setPendingChatRequest(null);

        if (data.isComplete) {
          setIsEnded(true);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "通信エラーが発生しました";
        const isTimeout = message === "timeout";
        setChatError(isTimeout ? "AI応答がタイムアウトしました。再試行できます。" : message);

        if (request.action === "start") {
          setMessages([
            {
              id: createId(),
              role: "assistant",
              content: getFallbackGreeting(respondentType),
            },
          ]);
        } else {
          setMessages(request.messages);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [respondentType, router],
  );

  useEffect(() => {
    if (!startedAt) {
      return;
    }
    if (messages.length > 0 || isLoading) {
      return;
    }

    void runChatRequest({ action: "start", messages: [] });
  }, [isLoading, messages.length, runChatRequest, startedAt]);

  useEffect(() => {
    if (!isExpired && !isEnded) {
      timerRef.current = setInterval(() => {
        setRemainingTime((previous) => {
          if (previous <= 1) {
            setIsExpired(true);
            setShowExtendConfirmModal(true);
            setExtendConfirmCountdown(60);
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            return 0;
          }
          return previous - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isEnded, isExpired]);

  useEffect(() => {
    if (!showExtendConfirmModal) {
      return;
    }

    extendConfirmTimerRef.current = setInterval(() => {
      setExtendConfirmCountdown((previous) => {
        if (previous <= 1) {
          if (extendConfirmTimerRef.current) {
            clearInterval(extendConfirmTimerRef.current);
          }
          void handleSkipExtend();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => {
      if (extendConfirmTimerRef.current) {
        clearInterval(extendConfirmTimerRef.current);
      }
    };
  });

  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1]?.role === "assistant") {
      lastAiMessageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [messages]);

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
  }, [input]);

  const transcribeAudioBlob = useCallback(async (audioBlob: Blob, mimeType: string) => {
    const file = new File([audioBlob], `survey-voice-input.${getRecordingFileExtension(mimeType)}`, {
      type: mimeType || "audio/webm",
    });
    const formData = new FormData();
    formData.set("file", file);
    formData.set("language", "ja");

    const data = await fetchFormDataJsonWithTimeout("/api/transcribe", formData, VOICE_TIMEOUT_MS);
    const text = typeof data.text === "string" ? data.text.trim() : "";

    if (!text) {
      throw new Error("文字起こし結果が空でした");
    }

    setInput((previous) => mergeInputText(previous, text));
    setAudioError(null);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, []);

  const stopRecording = useCallback(() => {
    clearRecordingStopTimer();
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.stop();
  }, [clearRecordingStopTimer]);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    if (!voiceInputSupported) {
      setAudioError("このブラウザでは音声入力を利用できません");
      return;
    }

    if (isEnded || showExtendConfirmModal || isLoading || isTranscribingAudio) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = getPreferredRecordingMimeType();
      const recorder = preferredMimeType ? new MediaRecorder(stream, { mimeType: preferredMimeType }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      let shouldTranscribe = true;

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      setAudioError(null);
      setIsRecording(true);

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      });

      recorder.addEventListener("error", () => {
        shouldTranscribe = false;
        setIsRecording(false);
        setAudioError("録音中にエラーが発生しました");
        mediaRecorderRef.current = null;
        clearRecordingStopTimer();
        stopMediaStream();
      });

      recorder.addEventListener("stop", () => {
        const effectiveMimeType = recorder.mimeType || preferredMimeType || "audio/webm";
        mediaRecorderRef.current = null;
        clearRecordingStopTimer();
        stopMediaStream();
        setIsRecording(false);

        if (!shouldTranscribe) {
          return;
        }

        const audioBlob = new Blob(chunks, { type: effectiveMimeType });
        if (audioBlob.size === 0) {
          setAudioError("録音データを取得できませんでした");
          return;
        }

        setIsTranscribingAudio(true);
        void (async () => {
          try {
            await transcribeAudioBlob(audioBlob, effectiveMimeType);
          } catch (error) {
            const message = error instanceof Error ? error.message : "音声入力に失敗しました";
            const isTimeout = message === "timeout";
            setAudioError(isTimeout ? "音声の文字起こしがタイムアウトしました。短めに録音して再試行してください。" : message);
          } finally {
            setIsTranscribingAudio(false);
          }
        })();
      });

      recorder.start();
      recordingStopTimerRef.current = window.setTimeout(() => {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      }, MAX_RECORDING_MS);
    } catch (error) {
      const message = error instanceof Error ? error.message : "マイクの利用を開始できませんでした";
      stopMediaStream();
      mediaRecorderRef.current = null;
      clearRecordingStopTimer();
      setIsRecording(false);
      setAudioError(message.includes("Permission") ? "マイクへのアクセスが許可されていません" : "マイクの利用を開始できませんでした");
    }
  }, [
    clearRecordingStopTimer,
    isEnded,
    isLoading,
    isRecording,
    isTranscribingAudio,
    showExtendConfirmModal,
    stopMediaStream,
    stopRecording,
    transcribeAudioBlob,
    voiceInputSupported,
  ]);

  const formatTime = (seconds: number) => {
    const minute = Math.floor(seconds / 60);
    const second = seconds % 60;
    return `${minute}:${second.toString().padStart(2, "0")}`;
  };

  const applySummary = (data: SummaryApiResponse) => {
    setSummaryView(data.summaryView);
    setCodingPrimaryIssueCategories(data.codingPrimary.issueCategories);
    setCodingPrimaryCompetencyCategories(data.codingPrimary.competencyCategories);
    setCodingPrimaryCoreItems(data.codingPrimary.coreItems);
    setCodingPrimaryInVivoCodes(data.codingPrimary.inVivoCodes);
    setCodingSensitivity(data.codingSensitivity);
  };

  const summarizeConversation = useCallback(async () => {
    if (isSummarizing || summaryRequested) {
      return;
    }
    if (messagesRef.current.length === 0) {
      return;
    }

    setIsSummarizing(true);
    setSummaryRequested(true);
    setSummaryError(null);

    try {
      const sessionId = localStorage.getItem("sessionId");
      const formResponseId = localStorage.getItem("formResponseId");
      const endedAt = new Date().toISOString();

      const data = await fetchJsonWithTimeout(
        "/api/summary",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messagesRef.current.map((message) => ({ role: message.role, content: message.content })),
            sessionId,
            formResponseId,
            startedAt: startedAt ?? undefined,
            endedAt,
            summaryScope: "conversation_all",
            codingScope: "participant_only",
            codingMethod: "in_vivo",
            runSensitivityCoding: true,
          }),
        },
        SUMMARY_TIMEOUT_MS,
      );

      applySummary(data as SummaryApiResponse);
      focusSidePanel();
    } catch (error) {
      const message = error instanceof Error ? error.message : "サマリー生成に失敗しました";
      const isTimeout = message === "timeout";
      setSummaryError(isTimeout ? "サマリー生成がタイムアウトしました。再試行できます。" : message);
      setSummaryRequested(false);
    } finally {
      setIsSummarizing(false);
    }
  }, [focusSidePanel, isSummarizing, startedAt, summaryRequested]);

  const handleEnd = () => {
    if (isEnded || isSummarizing) {
      return;
    }
    setShowExtendConfirmModal(true);
    setExtendConfirmCountdown(60);
  };

  const handleExtendFromModal = () => {
    setRemainingTime((previous) => previous + EXTENSION_SECONDS);
    setTotalExtendedTime((previous) => previous + EXTENSION_SECONDS);
    setIsExpired(false);
    setShowExtendConfirmModal(false);
    if (extendConfirmTimerRef.current) {
      clearInterval(extendConfirmTimerRef.current);
    }
  };

  const handleSkipExtend = async () => {
    setShowExtendConfirmModal(false);
    setIsEnded(true);
    focusSidePanel();
    if (extendConfirmTimerRef.current) {
      clearInterval(extendConfirmTimerRef.current);
    }
    await summarizeConversation();
  };

  const handleDownloadTxt = useCallback(() => {
    if (!summaryView) {
      return;
    }

    const separator = "--------------------------------------------------";
    const reportGeneratedAt = new Date().toLocaleString("ja-JP");
    let text = "\uFEFF";
    text += `医学教育モデル・コア・カリキュラム 次期改定 事前調査レポート\r\n`;
    text += `作成日: ${reportGeneratedAt}\r\n`;
    text += `${separator}\r\n\r\n`;

    text += `■会話全体サマリー\r\n`;
    summaryView.summaryBullets.forEach((bullet) => {
      text += `・${bullet}\r\n`;
    });
    text += `\r\n`;

    if (summaryView.topicGroups.length > 0) {
      text += `■会話全体トピック\r\n`;
      summaryView.topicGroups.forEach((group) => {
        text += `[${group.category}]: ${group.keywords.join(" / ")}\r\n`;
      });
      text += `\r\n`;
    }

    if (codingPrimaryInVivoCodes.length > 0) {
      text += `■主要分析（参加者発話のみ / in vivo coding）\r\n`;
      codingPrimaryInVivoCodes.forEach((code) => {
        text += `- ${code.code}`;
        if (code.quote) {
          text += ` | 引用: ${code.quote}`;
        }
        if (typeof code.messageIndex === "number") {
          text += ` | messageIndex: ${code.messageIndex}`;
        }
        text += `\r\n`;
      });
      text += `\r\n`;
    }

    if (codingPrimaryIssueCategories.length > 0) {
      text += `■困り事カテゴリ\r\n`;
      codingPrimaryIssueCategories.forEach((group) => {
        text += `[${group.category}]: ${group.items.join(" / ")}\r\n`;
      });
      text += `\r\n`;
    }

    if (codingPrimaryCompetencyCategories.length > 0) {
      text += `■資質・能力カテゴリ\r\n`;
      codingPrimaryCompetencyCategories.forEach((group) => {
        text += `[${group.category}]: ${group.items.join(" / ")}\r\n`;
      });
      text += `\r\n`;
    }

    if (codingPrimaryCoreItems.length > 0) {
      text += `■該当するコアカリ項目\r\n${codingPrimaryCoreItems.join(", ")}\r\n\r\n`;
    }

    if (codingSensitivity?.topicGroups.length) {
      text += `■感度分析（会話全体トピック coding）\r\n`;
      codingSensitivity.topicGroups.forEach((group) => {
        text += `[${group.category}]: ${group.keywords.join(" / ")}\r\n`;
      });
      text += `\r\n`;
    }

    text += `${separator}\r\n`;
    text += `■会話ログ\r\n\r\n`;
    messages.forEach((message) => {
      text += `${message.role === "user" ? "あなた" : "AI"}:\r\n${message.content}\r\n\r\n`;
    });

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filenameDate = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `survey-report-${filenameDate}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [
    codingPrimaryCompetencyCategories,
    codingPrimaryCoreItems,
    codingPrimaryInVivoCodes,
    codingPrimaryIssueCategories,
    codingSensitivity,
    messages,
    summaryView,
  ]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || isEnded || showExtendConfirmModal) {
      return;
    }

    const userMessage: Message = {
      id: createId(),
      role: "user",
      content: input.trim(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    await runChatRequest({ action: "chat", messages: nextMessages });
  };

  const handleRetryChat = async () => {
    if (!pendingChatRequest) {
      return;
    }
    await runChatRequest(pendingChatRequest);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void handleSend();
    }
  };

  const isInputDisabled = isLoading || isEnded || showExtendConfirmModal || isRecording || isTranscribingAudio;
  const inputPlaceholder = isRecording
    ? "録音中..."
    : isTranscribingAudio
      ? "音声を文字起こし中..."
      : isEnded || showExtendConfirmModal
        ? "制限時間終了"
        : "回答を入力してください...";
  const voiceStatusMessage = isRecording
    ? "録音中です。もう一度押すか、90秒で自動停止します。"
    : isTranscribingAudio
      ? "Mistral で文字起こししています..."
      : voiceInputSupported
        ? "マイク入力が使えます。録音後、文字起こし結果が入力欄へ入ります。"
        : "このブラウザでは音声入力を利用できません。";
  const shouldShowChatTransfer = summaryRequested || isEnded;

  return (
    <main style={{ padding: "20px", maxWidth: 1200, margin: "0 auto" }}>
      <a className="top-link" href="/survey">
        ← 戻る
      </a>

      <header className="survey-header">
        <h2>モデル・コア・カリキュラム改定事前調査</h2>
        <p style={{ color: "#666", fontSize: 14 }}>
          現場で感じる課題と、次期改定への期待を対話形式でうかがいます。
        </p>
      </header>

      {isExpired && !showExtendConfirmModal && isEnded && <div className="alert">制限時間が終了しました。ご協力ありがとうございました。</div>}

      <div className="survey-grid">
        <section className="chat-panel">
          <div className="message-stack">
            {messages.map((message, index) => (
              <div
                key={message.id}
                ref={message.role === "assistant" && index === messages.length - 1 ? lastAiMessageRef : null}
                className={`message ${message.role === "user" ? "message-user" : "message-ai"}`}
              >
                <div className="message-role">{message.role === "user" ? "あなた" : "AI"}</div>
                <div className="message-content markdown-content">
                  <MarkdownContent content={message.content} />
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="message message-ai thinking">
                <div className="message-role">AI</div>
                <div>考え中...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {chatError && (
            <div className="alert" style={{ marginBottom: 12 }}>
              {chatError}
              {pendingChatRequest && (
                <button onClick={() => void handleRetryChat()} className="btn btn-ghost" style={{ marginLeft: 8 }}>
                  再試行
                </button>
              )}
            </div>
          )}

          {audioError && <div className="alert" style={{ marginBottom: 12 }}>{audioError}</div>}

          {!isEnded && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSend();
              }}
              className="input-row"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={inputPlaceholder}
                disabled={isInputDisabled}
                rows={1}
                className="text-input"
                style={{ resize: "none", fontFamily: "inherit", fontSize: 14, minHeight: 44 }}
              />
              <button
                type="button"
                onClick={() => void handleToggleRecording()}
                disabled={!voiceInputSupported || isEnded || showExtendConfirmModal || isLoading || isTranscribingAudio}
                className={`btn input-action-btn ${isRecording ? "voice-btn-recording" : "btn-ghost"}`}
              >
                {isRecording ? "録音停止" : isTranscribingAudio ? "文字起こし中..." : "音声入力"}
              </button>
              <button type="submit" disabled={!input.trim() || isInputDisabled} className="btn btn-primary input-action-btn">
                送信
              </button>
            </form>
          )}

          <div className="summary-controls">
            {!isEnded && messages.length > 0 && (
              <button onClick={handleEnd} disabled={isSummarizing || isLoading} className="btn-end-summarize">
                {isSummarizing ? <span className="blink">サマライズ中...</span> : "終了してサマライズ"}
              </button>
            )}
            <div className={`timer ${remainingTime < 60 ? "is-urgent" : ""}`}>
              残り {formatTime(remainingTime)}
              {totalExtendedTime > 0 && (
                <span style={{ fontSize: "0.85em", marginLeft: 4 }}>(+{Math.floor(totalExtendedTime / 60)}分延長中)</span>
              )}
            </div>
          </div>

          <p className="note">
            {isEnded
              ? "終了しました。右側のサマリーと分析結果をご確認ください。"
              : `Ctrl/Cmd + Enter で送信、Shift + Enter は改行です。${voiceStatusMessage} 個人を特定する情報は入力しないでください。`}
          </p>
        </section>

        <aside ref={sidePanelRef} className={`side-panel ${sidePanelFocus ? "is-front" : ""}`}>
          <div className="summary-card">
            <h3 className="panel-title">ユーザー向けサマリー</h3>
            {isSummarizing && <p className="note blink">サマライズ中...</p>}
            {summaryError && (
              <div style={{ color: "#b00020", marginBottom: 8 }}>
                {summaryError}
                <button onClick={() => void summarizeConversation()} className="btn btn-ghost" style={{ marginLeft: 8 }}>
                  再試行
                </button>
              </div>
            )}
            {!isSummarizing && !summaryError && !summaryView && (
              <p className="note">{isEnded ? "サマリーはまだありません。" : "終了するとサマリーが生成されます。"}</p>
            )}

            {summaryView && (
              <>
                <ul>
                  {summaryView.summaryBullets.map((bullet, index) => (
                    <li key={index}>{bullet}</li>
                  ))}
                </ul>

                {summaryView.topicGroups.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div className="log-section-title">会話全体のトピック</div>
                    <div className="keyword-grid">
                      {summaryView.topicGroups.map((group, index) => (
                        <div key={index} className="keyword-item">
                          <div className="keyword-title">{group.category}</div>
                          <div style={{ color: "#555", marginTop: 4 }}>{group.keywords.join(" / ")}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {(codingPrimaryInVivoCodes.length > 0 ||
            codingPrimaryIssueCategories.length > 0 ||
            codingPrimaryCompetencyCategories.length > 0 ||
            codingPrimaryCoreItems.length > 0) && (
            <div className="summary-card" style={{ marginTop: 12 }}>
              <h3 className="panel-title">主要分析（参加者発話のみ）</h3>

              {codingPrimaryInVivoCodes.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="log-section-title">in vivo codes</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {codingPrimaryInVivoCodes.map((code, index) => (
                      <div key={`${code.code}-${index}`} className="keyword-item">
                        <div className="keyword-title">{code.code}</div>
                        {code.quote && <div style={{ color: "#555", marginTop: 4 }}>引用: {code.quote}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {codingPrimaryIssueCategories.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="log-section-title">困り事カテゴリ</div>
                  <div className="keyword-grid">
                    {codingPrimaryIssueCategories.map((group, index) => (
                      <div key={index} className="keyword-item">
                        <div className="keyword-title">{group.category}</div>
                        <div style={{ color: "#555", marginTop: 4 }}>{group.items.join(" / ")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {codingPrimaryCompetencyCategories.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="log-section-title">資質・能力カテゴリ</div>
                  <div className="keyword-grid">
                    {codingPrimaryCompetencyCategories.map((group, index) => (
                      <div key={index} className="keyword-item">
                        <div className="keyword-title">{group.category}</div>
                        <div style={{ color: "#555", marginTop: 4 }}>{group.items.join(" / ")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {codingPrimaryCoreItems.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="log-section-title">該当するコアカリ項目</div>
                  <div style={{ color: "#555", fontSize: 14 }}>{codingPrimaryCoreItems.join(", ")}</div>
                </div>
              )}
            </div>
          )}

          {codingSensitivity?.topicGroups.length ? (
            <div className="summary-card" style={{ marginTop: 12 }}>
              <h3 className="panel-title">感度分析（会話全体）</h3>
              <div className="keyword-grid">
                {codingSensitivity.topicGroups.map((group, index) => (
                  <div key={index} className="keyword-item">
                    <div className="keyword-title">{group.category}</div>
                    <div style={{ color: "#555", marginTop: 4 }}>{group.keywords.join(" / ")}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {summaryView && (
            <div className="report-card">
              <div className="report-title">ご協力ありがとうございました</div>
              <p className="report-text">対話内容と分析結果をテキストファイルでダウンロードできます。</p>
              <button onClick={handleDownloadTxt} className="btn btn-primary">
                レポートをダウンロード（.txt）
              </button>
            </div>
          )}

          {shouldShowChatTransfer && (
            <div className="summary-card" style={{ marginTop: 12 }}>
              <h3 className="panel-title">チャット履歴</h3>
              {messages.length === 0 ? (
                <p className="note">まだ会話がありません。</p>
              ) : (
                <div className="message-stack compact">
                  {messages.map((message) => (
                    <div key={message.id} className={`message ${message.role === "user" ? "message-user" : "message-ai"}`}>
                      <div className="message-role">{message.role === "user" ? "あなた" : "AI"}</div>
                      <div className="message-content markdown-content">
                        <MarkdownContent content={message.content} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {showExtendConfirmModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 24,
              maxWidth: 400,
              width: "90%",
              boxShadow: "0 24px 60px rgba(35, 27, 32, 0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", textAlign: "center", fontSize: "1.2rem" }}>もう少し続けますか？</h3>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button onClick={() => void handleSkipExtend()} className="btn btn-ghost" style={{ padding: "12px 20px", borderColor: "var(--accent)" }}>
                終了してサマライズ
              </button>
              <button onClick={handleExtendFromModal} className="btn btn-primary" style={{ padding: "12px 20px" }}>
                もう少し続ける (+3分)
              </button>
            </div>
            <p style={{ margin: "16px 0 0 0", textAlign: "center", color: "#666", fontSize: "0.85rem", lineHeight: 1.8 }}>
              あと1分で自動的に終了します（残り{extendConfirmCountdown}秒）
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
