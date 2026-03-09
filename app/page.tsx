"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// 透かし用の格言リスト
const QUOTES = [
  "迷っている時間がいちばん無駄",
  "完璧じゃなくていい、まず出せ",
  "あとで直せばいい、今は書け",
  "20点でいい、手を動かせ",
  "考えるな、書け",
  "動かなければ何も変わらない",
  "完成より完成させることが大事",
  "最初の一文が最大の壁",
];

// タイマーの初期値（秒）
const INITIAL_TIME = 10.0;
// 警告開始の残り時間（秒）
const WARNING_THRESHOLD = 3.0;
// Softモードの削除間隔（ms）
const SOFT_DELETE_INTERVAL = 500;

type Mode = "hard" | "soft";
type AppState = "idle" | "running" | "stopped" | "copying" | "soft-deleting";

export default function Home() {
  const [text, setText] = useState("");
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
  const [appState, setAppState] = useState<AppState>("idle");
  const [mode, setMode] = useState<Mode>("hard");
  const [quote] = useState(
    () => QUOTES[Math.floor(Math.random() * QUOTES.length)]
  );
  const [showCopied, setShowCopied] = useState(false);
  const [isWarning, setIsWarning] = useState(false);

  // タイマーIntervalのref
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Softモード削除IntervalのRef
  const softIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // タイムレフト精度管理用（setStateの遅延を避けるため）
  const timeLeftRef = useRef(INITIAL_TIME);
  const appStateRef = useRef<AppState>("idle");

  // タイマーをクリア
  const clearTimerInterval = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Softモード削除インターバルをクリア
  const clearSoftInterval = useCallback(() => {
    if (softIntervalRef.current) {
      clearInterval(softIntervalRef.current);
      softIntervalRef.current = null;
    }
  }, []);

  // タイマーリセット（入力のたびに呼ぶ）
  const resetTimer = useCallback(() => {
    clearSoftInterval();
    timeLeftRef.current = INITIAL_TIME;
    setTimeLeft(INITIAL_TIME);
    setIsWarning(false);
    setAppState("running");
    appStateRef.current = "running";
  }, [clearSoftInterval]);

  // タイマー停止（コピー完了時など）
  const stopTimer = useCallback(() => {
    clearTimerInterval();
    clearSoftInterval();
    setAppState("stopped");
    appStateRef.current = "stopped";
    setIsWarning(false);
  }, [clearTimerInterval, clearSoftInterval]);

  // コピー処理
  const handleCopy = useCallback(async () => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      stopTimer();
      setShowCopied(true);
      // 1.5秒後にCopied!を非表示
      setTimeout(() => setShowCopied(false), 1500);
    } catch (e) {
      console.error("クリップボードへのコピーに失敗:", e);
    }
  }, [text, stopTimer]);

  // タイマーの本体（setIntervalで100msごとに実行）
  useEffect(() => {
    if (appState !== "running") return;

    clearTimerInterval();

    timerRef.current = setInterval(() => {
      const newTime = Math.round((timeLeftRef.current - 0.1) * 10) / 10;

      if (newTime <= 0) {
        // タイムアップ処理
        clearTimerInterval();
        timeLeftRef.current = 0;
        setTimeLeft(0);

        if (mode === "hard") {
          // Hardモード: 即座に全削除
          setText("");
          setAppState("stopped");
          appStateRef.current = "stopped";
          setIsWarning(false);
        } else {
          // Softモード: 末尾から1文字ずつ削除
          setAppState("soft-deleting");
          appStateRef.current = "soft-deleting";
          setIsWarning(false);
          softIntervalRef.current = setInterval(() => {
            setText((prev) => {
              if (prev.length <= 1) {
                clearSoftInterval();
                return "";
              }
              return prev.slice(0, -1);
            });
          }, SOFT_DELETE_INTERVAL);
        }
      } else {
        timeLeftRef.current = newTime;
        setTimeLeft(newTime);
        // 警告状態更新
        setIsWarning(newTime <= WARNING_THRESHOLD);
      }
    }, 100);

    return () => clearTimerInterval();
  }, [appState, mode, clearTimerInterval, clearSoftInterval]);

  // キーボードショートカット（Cmd/Ctrl+Enter でコピー）
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleCopy();
      }
    },
    [handleCopy]
  );

  // テキスト変更ハンドラ
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setText(newText);

      // stopped状態以外ではタイマーをリセット
      if (
        appStateRef.current !== "stopped" &&
        appStateRef.current !== "copying"
      ) {
        resetTimer();
      }

      // Softモード削除中にキー入力があれば停止してリセット
      if (appStateRef.current === "soft-deleting") {
        resetTimer();
      }

      // idleから最初の入力でタイマースタート
      if (appStateRef.current === "idle") {
        resetTimer();
      }
    },
    [resetTimer]
  );

  // タイマー表示フォーマット（1桁小数点）
  const formattedTime = timeLeft.toFixed(1);

  // 警告中かどうか（Softモード削除中も警告OFF）
  const showWarning = isWarning && appState === "running";

  return (
    <main
      className="relative flex flex-col"
      style={{
        height: "100dvh",
        backgroundColor: "#000",
        // 警告時にパルスアニメーションを適用
        animation: showWarning ? "pulse-red 0.8s ease-in-out infinite" : "none",
      }}
    >
      {/* ─── ヘッダー：モード切替とタイマー ─── */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
        {/* モード切替 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode("hard")}
            className="px-3 py-1 text-xs rounded transition-all duration-200 cursor-pointer"
            style={{
              fontFamily: "var(--font-mono)",
              backgroundColor: mode === "hard" ? "#fff" : "transparent",
              color: mode === "hard" ? "#000" : "#444",
              border: "1px solid",
              borderColor: mode === "hard" ? "#fff" : "#333",
            }}
          >
            HARD
          </button>
          <button
            onClick={() => setMode("soft")}
            className="px-3 py-1 text-xs rounded transition-all duration-200 cursor-pointer"
            style={{
              fontFamily: "var(--font-mono)",
              backgroundColor: mode === "soft" ? "#fff" : "transparent",
              color: mode === "soft" ? "#000" : "#444",
              border: "1px solid",
              borderColor: mode === "soft" ? "#fff" : "#333",
            }}
          >
            SOFT
          </button>
        </div>

        {/* タイマー表示 */}
        <div
          className="text-4xl font-bold tabular-nums transition-all duration-200"
          style={{
            fontFamily: "var(--font-mono)",
            color:
              appState === "stopped"
                ? "#333"
                : showWarning
                  ? "#ef4444"
                  : "#ffffff",
            animation:
              showWarning ? "glow-red 0.8s ease-in-out infinite" : "none",
          }}
        >
          {appState === "stopped" ? "STOP" : formattedTime}
        </div>
      </div>

      {/* ─── メインエリア：透かし + テキストエリア ─── */}
      <div className="relative flex-1 min-h-0 px-3 pb-2">
        {/* 透かしメッセージ（絶対配置で背面に） */}
        <div
          className="absolute inset-3 flex items-center justify-center pointer-events-none select-none"
          style={{
            zIndex: 0,
          }}
        >
          <span
            className="text-lg text-center leading-relaxed"
            style={{
              fontFamily: "var(--font-mono)",
              color: "rgba(255, 255, 255, 0.12)",
              fontSize: "clamp(14px, 3vw, 22px)",
            }}
          >
            {quote}
          </span>
        </div>

        {/* テキストエリア本体 */}
        <textarea
          autoFocus
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          readOnly={appState === "stopped"}
          className="w-full h-full resize-none outline-none"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "clamp(16px, 2vw, 20px)",
            lineHeight: "1.8",
            backgroundColor: "transparent",
            color: "#ffffff",
            caretColor: "#ffffff",
            zIndex: 1,
            position: "relative",
            border: "none",
            padding: "8px",
          }}
          placeholder=" "
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>

      {/* ─── フッター：コピーボタン（モバイル用） ─── */}
      <div
        className="flex-shrink-0 px-4 pb-4 pt-2 flex items-center justify-between"
        style={{ borderTop: "1px solid #111" }}
      >
        {/* 操作ヒント（PC向け） */}
        <span
          className="text-xs hidden sm:block"
          style={{ color: "#333", fontFamily: "var(--font-mono)" }}
        >
          ⌘ + Enter でコピー
        </span>
        <span
          className="text-xs sm:hidden"
          style={{ color: "#333", fontFamily: "var(--font-mono)" }}
        >
          {appState === "idle"
            ? "書き始めてください"
            : appState === "stopped"
              ? "タイムアップ"
              : `残り ${formattedTime}s`}
        </span>

        {/* Copy & Exit ボタン */}
        <button
          onClick={handleCopy}
          disabled={!text.trim() || appState === "stopped"}
          className="px-5 py-2 text-sm rounded transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
          style={{
            fontFamily: "var(--font-mono)",
            backgroundColor:
              !text.trim() || appState === "stopped" ? "#111" : "#ffffff",
            color: !text.trim() || appState === "stopped" ? "#333" : "#000000",
            border: "1px solid",
            borderColor: !text.trim() || appState === "stopped" ? "#222" : "#fff",
          }}
        >
          Copy &amp; Exit
        </button>
      </div>

      {/* ─── Copied! オーバーレイ ─── */}
      {showCopied && (
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 50 }}
        >
          <div
            className="px-8 py-4 rounded-lg text-2xl font-bold"
            style={{
              fontFamily: "var(--font-mono)",
              backgroundColor: "#ffffff",
              color: "#000000",
              animation: "fade-in-out 1.5s ease forwards",
            }}
          >
            Copied!
          </div>
        </div>
      )}
    </main>
  );
}
