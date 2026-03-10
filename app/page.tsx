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

const INITIAL_TIME = 10.0;
const WARNING_THRESHOLD = 3.0;  // 赤警告
const YELLOW_THRESHOLD = 7.0;   // 黄色警告
const SOFT_DELETE_INTERVAL = 500;

// 回復時のメッセージ（残り時間で分岐）
const RECOVER_MESSAGES = {
  red: ["EXCELLENT!!", "CRITICAL SAVE!!", "GOD SPEED!!", "MIRACLE!!", "BRAVO!!"],
  yellow: ["GREAT!", "NICE CATCH!", "GOOD RECOVERY!", "SAFE!"],
  green: ["+10.0"],
};

// タイムアップ時のランダムメッセージ（main + 小さいサブ）
const DEATH_MESSAGES: { main: string; sub: string }[] = [
  { main: "You died.", sub: "考えすぎた。手が止まった。" },
  { main: "GAME OVER", sub: "また最初からやれ。" },
  { main: "消えた。", sub: "完璧を求めた代償だ。" },
  { main: "遅すぎた。", sub: "0.1秒でも早く打て。" },
  { main: "思考、停止。", sub: "脳より手を先に動かせ。" },
  { main: "ドンマイ。次は書け。", sub: "失敗は許す。停止は許さない。" },
  { main: "R.I.P. あなたの文章", sub: "消えた文章は、もとから存在しなかった。" },
  { main: "脳みそ、フリーズ。", sub: "再起動して、また挑め。" },
  { main: "完璧主義に負けた。", sub: "完璧な文章より、存在する文章の方が価値がある。" },
  { main: "仕事が遅い。", sub: "エジソンも最初の一文字を書いた。" },
  { main: "お前の手、飾りか。", sub: "飾りなら外せ。道具は使え。" },
  { main: "A型かよ。", sub: "血液型のせいにするな。" },
  { main: "それが限界か。", sub: "10秒間だぞ。" },
  { main: "悔しくないのか。", sub: "悔しければ、すぐに書け。" },
  { main: "次は逃げるな。", sub: "逃げた先に文章はない。" },
  { main: "惜しい。次こそ。", sub: "惜しいは成長の証だ。" },
];

type Mode = "hard" | "soft";
type AppState = "lp" | "idle" | "running" | "stopped" | "soft-deleting";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("lp");
  const [text, setText] = useState("");
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
  const [mode, setMode] = useState<Mode>("hard");
  const [quote] = useState(
    () => QUOTES[Math.floor(Math.random() * QUOTES.length)]
  );
  const [showCopied, setShowCopied] = useState(false);
  const [isWarning, setIsWarning] = useState(false);
  // ホバー中のモード（ツールチップ表示用）
  const [hoveredMode, setHoveredMode] = useState<Mode | null>(null);
  // タイムアップ時に表示するメッセージ
  const [deletedMessage, setDeletedMessage] = useState<{ main: string; sub: string } | null>(null);
  // 設定モーダル表示
  const [showSettings, setShowSettings] = useState(false);
  // 「このサイトとは？」モーダル表示
  const [showAbout, setShowAbout] = useState(false);
  // コピーショートカット設定　'cmd+enter' | 'shift+enter'
  const [copyShortcut, setCopyShortcut] = useState<'cmd+enter' | 'shift+enter'>('cmd+enter');
  // ランダム背景画像
  const [bgImage, setBgImage] = useState<string>('/hero-bg.png');
  // 回復時のホイミ（グリーンフラッシュ）エフェクトのトリガーと種類
  const [recoverCount, setRecoverCount] = useState(0);
  const [recoverType, setRecoverType] = useState<"green" | "yellow" | "red">("green");
  const [recoverMessage, setRecoverMessage] = useState<string>("+10.0");
  // 長く残るメッセージ用（EXCELLENT等）
  const [stickyMessage, setStickyMessage] = useState<string | null>(null);
  const [stickyType, setStickyType] = useState<"yellow" | "red">("red");
  const [stickyKey, setStickyKey] = useState(0); // アニメーション再トリガー用
  const recoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stickyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // スマホ判定（マウント後に判定）
  const [isMobile, setIsMobile] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const softIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeLeftRef = useRef(INITIAL_TIME);
  const appStateRef = useRef<AppState>("lp");

  const clearTimerInterval = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const clearSoftInterval = useCallback(() => {
    if (softIntervalRef.current) { clearInterval(softIntervalRef.current); softIntervalRef.current = null; }
  }, []);

  // マウント時にランダム背景を設定＆スマホ判定
  useEffect(() => {
    const randomNum = Math.floor(Math.random() * 13) + 1;
    setBgImage(`/bg/${randomNum}.png`);

    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const resetTimer = useCallback(() => {
    clearSoftInterval();
    timeLeftRef.current = INITIAL_TIME;
    setTimeLeft(INITIAL_TIME);
    setIsWarning(false);
    setAppState("running");
    appStateRef.current = "running";
  }, [clearSoftInterval]);

  const stopTimer = useCallback(() => {
    clearTimerInterval();
    clearSoftInterval();
    setAppState("stopped");
    appStateRef.current = "stopped";
    setIsWarning(false);
  }, [clearTimerInterval, clearSoftInterval]);

  const handleCopy = useCallback(async () => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      // タイマーを停止するが stopped にせず idle に戻す → 続けて入力可能
      clearTimerInterval();
      clearSoftInterval();
      timeLeftRef.current = INITIAL_TIME;
      setTimeLeft(INITIAL_TIME);
      setIsWarning(false);
      setAppState("idle");
      appStateRef.current = "idle";
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 1500);
    } catch (e) {
      console.error("コピー失敗:", e);
    }
  }, [text, clearTimerInterval, clearSoftInterval]);

  // タイマー本体 (100ms ごと) — showSettings/showAboutが開いている間は停止
  useEffect(() => {
    if (appState !== "running" || showSettings || showAbout) return;
    clearTimerInterval();

    timerRef.current = setInterval(() => {
      const newTime = Math.round((timeLeftRef.current - 0.1) * 10) / 10;

      if (newTime <= 0) {
        clearTimerInterval();
        timeLeftRef.current = 0;
        setTimeLeft(0);

        if (mode === "hard") {
          // ランダムな死亡メッセージを設定
          setDeletedMessage(DEATH_MESSAGES[Math.floor(Math.random() * DEATH_MESSAGES.length)]);
          setText("");
          setAppState("stopped");
          appStateRef.current = "stopped";
          setIsWarning(false);
        } else {
          setAppState("soft-deleting");
          appStateRef.current = "soft-deleting";
          setIsWarning(false);
          softIntervalRef.current = setInterval(() => {
            setText((prev) => {
              if (prev.length <= 1) {
                clearSoftInterval();
                // Softモードでも全消去時にメッセージ表示
                setDeletedMessage(DEATH_MESSAGES[Math.floor(Math.random() * DEATH_MESSAGES.length)]);
                setAppState("stopped");
                appStateRef.current = "stopped";
                return "";
              }
              return prev.slice(0, -1);
            });
          }, SOFT_DELETE_INTERVAL);
        }
      } else {
        timeLeftRef.current = newTime;
        setTimeLeft(newTime);
        setIsWarning(newTime <= WARNING_THRESHOLD);
      }
    }, 100);

    return () => clearTimerInterval();
  }, [appState, mode, showSettings, showAbout, clearTimerInterval, clearSoftInterval]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (copyShortcut === 'cmd+enter') {
        // Cmd/Ctrl + Enter でコピー（デフォルト）
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          handleCopy();
        }
      } else {
        // Shift + Enter でコピー、Enter は改行
        if (e.shiftKey && e.key === "Enter") {
          e.preventDefault();
          handleCopy();
        } else if (appStateRef.current === "stopped") {
          resetTimer();
        }
      }
    },
    [handleCopy, copyShortcut, appStateRef, resetTimer]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      const s = appStateRef.current;
      if (s !== "stopped") {
        if (timeLeftRef.current < 10.0) {
          // 残り時間（回復前の状態）に応じてエフェクトの派手さを変える
          let type: "green" | "yellow" | "red" = "green";
          if (timeLeftRef.current <= 3.0) type = "red";
          else if (timeLeftRef.current <= 7.0) type = "yellow";

          setRecoverType(type);
          const messages = RECOVER_MESSAGES[type];
          setRecoverMessage(messages[Math.floor(Math.random() * messages.length)]);
          setRecoverCount((c) => c + 1);

          // red/yellowゾーンからの回復時のみ、長く残るメッセージを更新
          if (type === "red" || type === "yellow") {
            const msg = messages[Math.floor(Math.random() * messages.length)];
            setStickyMessage(msg);
            setStickyType(type);
            setStickyKey((k) => k + 1);
            if (stickyTimeoutRef.current) clearTimeout(stickyTimeoutRef.current);
            stickyTimeoutRef.current = setTimeout(() => {
              setStickyMessage(null);
            }, 2500);
          }

          if (recoverTimeoutRef.current) clearTimeout(recoverTimeoutRef.current);
          recoverTimeoutRef.current = setTimeout(() => {
            setRecoverCount(0);
          }, 800);
        }
        resetTimer();
      }
    },
    [resetTimer]
  );

  const handleStart = useCallback(() => {
    setAppState("idle");
    appStateRef.current = "idle";
  }, []);

  const formattedTime = timeLeft.toFixed(1);
  const showWarning = isWarning && appState === "running";    // 3秒以下：赤
  const showYellow = appState === "running" && timeLeft <= YELLOW_THRESHOLD && !showWarning; // 6秒以下：黄
  const charCount = text.replace(/[\s\n\r]/g, "").length;

  // 透かしタイマーの色：通常→黄色→赤で段階的に濃く
  const overlayTimerColor = showWarning
    ? "rgba(239, 68, 68, 0.55)"
    : showYellow
      ? "rgba(234, 179, 8, 0.30)"
      : "rgba(255, 255, 255, 0.06)";

  const bgAnimation = showWarning
    ? "pulse-red 0.4s ease-in-out infinite"
    : showYellow
      ? "pulse-yellow 1.0s ease-in-out infinite"
      : "none";

  // ヘッダータイマーの色
  const timerColor = appState === "stopped"
    ? "#222"
    : showWarning
      ? "#ef4444"
      : showYellow
        ? "#eab308"
        : "#ffffff";

  // ─── 説明モーダル—どの画面からでも開ける最先期リターン ───────────────
  if (showAbout) {
    return (
      <div
        onClick={() => setShowAbout(false)}
        style={{
          position: "fixed", inset: 0,
          backgroundColor: "rgba(0,0,0,0.92)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 200, padding: "16px",
          fontFamily: "var(--font-mono)",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: "#0d0d0d", border: "1px solid #222",
            borderRadius: "14px", padding: "28px 28px 24px",
            width: "min(520px, 95vw)", maxHeight: "85vh",
            overflowY: "auto", fontFamily: "var(--font-mono)", scrollbarWidth: "none",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <div>
              <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.15em", marginBottom: "4px" }}>FORCED WRITING TOOL</div>
              <div style={{ fontSize: "20px", fontWeight: "bold", color: "#fff", letterSpacing: "0.03em" }}>書け、消えるぞ とは？</div>
            </div>
            <button onClick={() => setShowAbout(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: "4px" }}>✕</button>
          </div>
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.12em", marginBottom: "10px" }}>📌 このサービスの思想</div>
            <div style={{ fontSize: "13px", color: "#999", lineHeight: "2.0" }}>
              「完璧な文章を書こう」と思った瞬間、人は止まります。<br />
              このツールは、その<span style={{ color: "#fff" }}>「考えすぎ」を物理的に不可能にする</span>ために作られました。<br /><br />
              10秒間キーを叩かなければ、文章は消えます。<br />
              だから、とにかく書く。整形や推謠は、コピーした後AIに任せれば十分です。<br /><br />
              <span style={{ color: "#666" }}>アウトプットが先。完璧さは後からでいい。</span>
            </div>
          </div>
          <div style={{ height: "1px", backgroundColor: "#1a1a1a", marginBottom: "24px" }} />
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.12em", marginBottom: "12px" }}>⌨️ 基本操作</div>
            {[
              { key: "文字を入力する", desc: "タイマーが10秒にリセットされます。とにかく何かを打ち続けてください。" },
              { key: "⌘ / Ctrl + Enter", desc: "書いた内容をクリップボードにコピーして、入力画面に戻ります。" },
              { key: "タイムアップ", desc: "10秒間入力がないと文章が消えます。消えた後もクリックまたはキー入力で再挑戦できます。" },
            ].map((item) => (
              <div key={item.key} style={{ marginBottom: "14px", paddingLeft: "12px", borderLeft: "2px solid #222" }}>
                <div style={{ fontSize: "12px", color: "#fff", fontWeight: "bold", marginBottom: "3px" }}>{item.key}</div>
                <div style={{ fontSize: "11px", color: "#666", lineHeight: "1.7" }}>{item.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ height: "1px", backgroundColor: "#1a1a1a", marginBottom: "24px" }} />
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.12em", marginBottom: "12px" }}>⚔️ HARDモード と SOFTモードの違い</div>
            <div style={{ display: "flex", gap: "10px" }}>
              {[
                { label: "HARD", color: "#ef4444", desc: "10秒間入力がないと、書いた文章が全て即座に消えます。容赦なし。" },
                { label: "SOFT", color: "#eab308", desc: "10秒経過後、末尾から1文字ずつ削除されていきます。書き続ければ止まります。" },
              ].map((m) => (
                <div key={m.label} style={{ flex: 1, padding: "14px", borderRadius: "8px", border: "1px solid #1e1e1e", backgroundColor: "rgba(255,255,255,0.02)" }}>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: m.color, marginBottom: "6px", letterSpacing: "0.1em" }}>{m.label}</div>
                  <div style={{ fontSize: "11px", color: "#666", lineHeight: "1.7" }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ height: "1px", backgroundColor: "#1a1a1a", marginBottom: "24px" }} />
          <div style={{ marginBottom: "8px" }}>
            <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.12em", marginBottom: "12px" }}>💡 使い方のヒント</div>
            {[
              "文章の質を気にしないでください。誤字でも断片でも、出すことが大事です。",
              "コピー後はChatGPTや Claude などのAIに「整形して」と貼り付けるだけでOKです。",
              "設定（⚙️）からコピーのショートカットキーを変更できます。",
              "タイマーが赤くなってからの回復は特別な演出が出ます。ギリギリまで粸ってみてください。",
            ].map((tip, i) => (
              <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                <span style={{ color: "#333", fontSize: "11px", flexShrink: 0 }}>—</span>
                <span style={{ fontSize: "11px", color: "#666", lineHeight: "1.7" }}>{tip}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowAbout(false)}
            style={{
              width: "100%", marginTop: "20px", padding: "12px",
              backgroundColor: "transparent", border: "1px solid #222",
              borderRadius: "8px", color: "#555", cursor: "pointer",
              fontFamily: "var(--font-mono)", fontSize: "12px",
              letterSpacing: "0.08em", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#555"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#222"; e.currentTarget.style.color = "#555"; }}
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }

  // ─── LP画面 ──────────────────────────────────────────────────
  if (appState === "lp") {
    return (
      <main
        style={{
          height: "100dvh",
          backgroundColor: "#000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          padding: "0 24px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 背景画像 — スーパーかっこいいサイバー空間（ランダム） */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url('${bgImage}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.85,
            filter: "brightness(0.6) contrast(1.2)",
            zIndex: 0,
          }}
        />
        {/* 背景グラデーションオーバーレイ（中央のテキストを読みやすく） */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at center 40%, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.1) 100%)",
            zIndex: 1,
          }}
        />

        {/* コンテンツ（z-index 2以上） */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            maxWidth: "500px",
          }}
        >
          {/* キャッチコピー（小さく、上） */}
          <p
            style={{
              fontSize: "11px",
              color: "#555",
              letterSpacing: "0.2em",
              marginBottom: "16px",
              textTransform: "uppercase",
            }}
          >
            Forced Writing Tool
          </p>

          {/* タイトル + ?ボタン */}
          <div style={{ position: "relative", display: "inline-block", textAlign: "center", marginBottom: "16px" }}>
            <h1
              style={{
                fontSize: "clamp(36px, 8vw, 68px)",
                fontWeight: "bold",
                color: "#fff",
                letterSpacing: "0.03em",
                lineHeight: 1.1,
              }}
            >
              書け、消えるぞ
            </h1>
            <button
              onClick={() => setShowAbout(true)}
              style={{
                position: "absolute",
                top: "0",
                right: "-40px",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "#444",
                background: "transparent",
                border: "1px solid #333",
                borderRadius: "50%",
                width: "26px",
                height: "26px",
                cursor: "pointer",
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "color 0.2s, border-color 0.2s",
                zIndex: 10,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#aaa"; e.currentTarget.style.borderColor = "#777"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#444"; e.currentTarget.style.borderColor = "#333"; }}
              title="このサイトとは？"
            >
              ?
            </button>
          </div>

          {/* サブコピー */}
          <p
            style={{
              fontSize: "clamp(13px, 1.8vw, 15px)",
              color: "#555",
              marginBottom: "52px",
              textAlign: "center",
              lineHeight: "1.9",
              maxWidth: "340px",
            }}
          >
            手を止めた瞬間、テキストが消える。<br />
            完璧主義をぶっ壊す、10秒の恐怖。
          </p>

          {/* Hard / Soft カード */}
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginBottom: "28px",
              width: "100%",
            }}
          >
            {(["hard", "soft"] as Mode[]).map((m) => {
              const isSelected = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    flex: 1,
                    fontFamily: "var(--font-mono)",
                    padding: "14px 12px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    border: isSelected ? "1.5px solid rgba(255,255,255,0.8)" : "1px solid #1e1e1e",
                    backgroundColor: isSelected ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.6)",
                    backdropFilter: "blur(8px)",
                    transition: "all 0.2s",
                    textAlign: "left",
                    position: "relative",
                  }}
                >
                  {isSelected && (
                    <span style={{ position: "absolute", top: "10px", right: "10px", fontSize: "11px", color: "#fff" }}>✓</span>
                  )}
                  <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "5px", letterSpacing: "0.1em", color: isSelected ? "#fff" : "#555" }}>
                    {m.toUpperCase()}
                  </div>
                  <div style={{ fontSize: "10px", lineHeight: "1.6", color: isSelected ? "#aaa" : "#3a3a3a" }}>
                    {m === "hard"
                      ? "10秒で全文即削除。\n容赦なし。"
                      : "末尾から1文字ずつ削除。\n書けば止まる。"}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Start Writing ボタン */}
          <button
            onClick={handleStart}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "clamp(14px, 2vw, 16px)",
              padding: "15px 56px",
              borderRadius: "6px",
              backgroundColor: "#ffffff",
              color: "#000000",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
              letterSpacing: "0.08em",
              transition: "all 0.15s",
              width: "100%",
              maxWidth: "320px",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#e5e5e5"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#ffffff"; }}
          >
            Start Writing →
          </button>

        </div>
      </main>
    );
  }


  // ─── ライティング画面 ─────────────────────────────────────
  // 画面揺れのアニメーション適用（タイピング時 > ピンチ時）
  let currentAnimation = bgAnimation;
  if (showWarning) {
    currentAnimation = "rumble 0.2s ease-in-out infinite"; // 赤色時は常に揺れる
  }

  // ホイミの色・アニメーション定義
  const flashAnim =
    recoverType === "red" ? "flash-green-max 0.8s ease-out forwards" :
      recoverType === "yellow" ? "flash-green-mid 0.7s ease-out forwards" :
        "flash-green 0.6s ease-out forwards";

  const healTextAnim =
    recoverType === "red" ? "heal-text-max 0.9s ease-out forwards" :
      recoverType === "yellow" ? "heal-text-mid 0.8s ease-out forwards" :
        "heal-text-green 0.7s ease-out forwards";

  const healTextColor = "#4ade80"; // 常に癒やしのグリーン

  return (
    <main
      style={{
        height: "100dvh",
        backgroundColor: "#000",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        animation: currentAnimation,
        transformOrigin: "center center",
      }}
    >
      {/* ホイミ（回復）フラッシュオーバーレイ */}
      {recoverCount > 0 && (
        <div
          key={`flash-${recoverCount}`}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            animation: flashAnim,
            zIndex: 10,
          }}
        />
      )}

      {/* ホイミ（回復）浮き出しテキスト — フラッシュに連動した短い演出（greenのみ） */}
      {recoverCount > 0 && recoverType === "green" && (
        <div
          key={`text-${recoverCount}`}
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: healTextColor,
            fontFamily: "var(--font-mono)",
            fontSize: "28px",
            fontWeight: "bold",
            pointerEvents: "none",
            zIndex: 15,
            animation: "heal-text-green 0.7s ease-out forwards",
            textAlign: "center",
          }}
        >
          RESET
        </div>
      )}

      {/* sticky演出 — red/yellowゾーンからの回復時に長くゆっくり残る */}
      {stickyMessage && (
        <div
          key={`sticky-${stickyKey}`}
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: stickyType === "red" ? "#ffffff" : healTextColor,
            fontFamily: "var(--font-mono)",
            fontSize: stickyType === "red" ? "72px" : "48px",
            fontWeight: "bold",
            pointerEvents: "none",
            zIndex: 15,
            animation: "sticky-message 2.5s ease-out forwards",
            textAlign: "center",
            textShadow: stickyType === "red"
              ? "0 0 20px rgba(74, 222, 128, 0.9), 0 0 40px rgba(74, 222, 128, 0.5)"
              : "0 0 12px rgba(74, 222, 128, 0.4)",
            fontStyle: stickyType === "red" ? "italic" : "normal",
            letterSpacing: stickyType === "red" ? "0.05em" : "0",
          }}
        >
          <div style={{ fontSize: stickyType === "red" ? "22px" : "15px", color: healTextColor, marginBottom: "4px", fontStyle: "normal", letterSpacing: "0" }}>RESET</div>
          <div>{stickyMessage}</div>
        </div>
      )}
      {/* ヘッダー：モード切替 + 小さいタイマー */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px 6px",
          flexShrink: 0,
        }}
      >
        {/* モード切替 + ツールチップ */}
        <div style={{ display: "flex", gap: "6px", position: "relative" }}>
          {(["hard", "soft"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              onMouseEnter={() => setHoveredMode(m)}
              onMouseLeave={() => setHoveredMode(null)}
              style={{
                fontFamily: "var(--font-mono)",
                padding: "4px 12px",
                fontSize: "11px",
                borderRadius: "4px",
                cursor: "pointer",
                border: "1px solid",
                backgroundColor: mode === m ? "#fff" : "transparent",
                color: mode === m ? "#000" : "#444",
                borderColor: mode === m ? "#fff" : "#333",
                transition: "all 0.2s",
              }}
            >
              {m.toUpperCase()}
            </button>
          ))}

          {/* ツールチップ */}
          {hoveredMode && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                backgroundColor: "#111",
                border: "1px solid #2a2a2a",
                borderRadius: "6px",
                padding: "10px 14px",
                width: "220px",
                zIndex: 100,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: "bold",
                  color: "#fff",
                  marginBottom: "4px",
                  letterSpacing: "0.08em",
                }}
              >
                {hoveredMode.toUpperCase()}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "#666",
                  lineHeight: "1.6",
                }}
              >
                {hoveredMode === "hard"
                  ? "10秒間手を止めると全文を即削除。\n容赦なし。"
                  : "10秒間手を止めると末尾から1文字ずつ削除。\n書き続ければ止まる。"}
              </div>
            </div>
          )}
        </div>

        {/* 右上：文字数 + 設定ボタン */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "bold",
              fontVariantNumeric: "tabular-nums",
              fontSize: "clamp(24px, 5vw, 42px)",
              lineHeight: 1,
              color: appState === "stopped" ? "#222" : "#fff",
              transition: "color 0.2s",
            }}
          >
            {charCount}
            <span style={{ fontSize: "0.4em", color: "#444", marginLeft: "4px", fontWeight: "normal" }}>ch</span>
          </div>
          {/* 設定ボタン */}
          <button
            onClick={() => setShowSettings(true)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "18px",
              background: "transparent",
              border: "none",
              color: "#333",
              cursor: "pointer",
              padding: "4px",
              lineHeight: 1,
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#888")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#333")}
            title="設定"
          >
            ⚙️
          </button>
          {/* ? ボタン（ライティング画面） */}
          <button
            onClick={() => setShowAbout(true)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              background: "transparent",
              border: "1px solid #222",
              borderRadius: "50%",
              color: "#333",
              cursor: "pointer",
              width: "26px",
              height: "26px",
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.2s, border-color 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#888"; e.currentTarget.style.borderColor = "#555"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#333"; e.currentTarget.style.borderColor = "#222"; }}
            title="このサイトとは？"
          >
            ?
          </button>
        </div>
      </div>

      {/* メインエリア */}
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          padding: "0 12px 4px",
        }}
      >
        {/* 巨大透かしタイマー：常に背面に表示、段階的に濃くなる */}
        {appState !== "stopped" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              userSelect: "none",
              zIndex: 0,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: "bold",
                fontVariantNumeric: "tabular-nums",
                fontSize: "45vw", // 画面幅に対してほぼ限界まで大きく
                lineHeight: 0.8,
                color: overlayTimerColor,
                transition: "color 0.3s ease",
                animation: showWarning ? "glow-red 0.4s ease-in-out infinite" : "none",
                filter: showYellow && !showWarning ? "drop-shadow(0 0 12px rgba(234,179,8,0.4))" : "none",
                letterSpacing: "-0.05em",
              }}
            >
              {appState === "idle" ? "0.0" : formattedTime}
            </span>
          </div>
        )}

        {/* 格言（下部に薄く） */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 0,
            padding: "12px 12px 16px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              color: "rgba(255, 255, 255, 0.07)",
              fontSize: "clamp(11px, 2vw, 16px)",
              textAlign: "center",
            }}
          >
            {quote}
          </span>
        </div>

        {/* エンプティ時の鼓舞メッセージ（textareaの上に重ねろ） */}
        {text === "" && appState !== "stopped" && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              padding: "16px 20px",
              pointerEvents: "none",
              userSelect: "none",
              zIndex: 2,
            }}
          >
            <p style={{
              fontFamily: "var(--font-mono)",
              fontSize: "clamp(14px, 2vw, 18px)",
              lineHeight: "2.0",
              color: "rgba(255,255,255,0.22)",
              margin: 0,
            }}>
              頭の中のものを、そのまま出せ。<br />
              整形はこの後、コピペしてAIに任せればいい。<br />
              <span style={{ color: "rgba(255,255,255,0.12)" }}>いいから、早く書け。</span>
            </p>
          </div>
        )}

        {/* テキストエリア（z-index 3 でオーバーレイより前面） */}
        <textarea
          autoFocus
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          readOnly={appState === "stopped"}
          style={{
            width: "100%",
            height: "100%",
            resize: "none",
            outline: "none",
            fontFamily: "var(--font-mono)",
            fontSize: "clamp(16px, 2.5vw, 22px)",
            lineHeight: "1.8",
            backgroundColor: "transparent",
            color: "#ffffff",
            caretColor: "#ffffff",
            border: "none",
            padding: "8px",
            position: "relative",
            zIndex: 3,
          }}
          placeholder=""
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>

      {/* フッター */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px 18px",
          borderTop: "1px solid #111",
          gap: "12px",
        }}
      >
        {/* 文字数 + ヒント */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", flexShrink: 0 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "20px",
              fontWeight: "bold",
              color: charCount > 0 ? "#fff" : "#333",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {charCount}
            <span style={{ fontSize: "11px", color: "#444", marginLeft: "4px" }}>chars</span>
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "#333" }}>
            {appState === "stopped" ? "タイムアップ" : "⌘ + Enter"}
          </span>
        </div>

        {/* Copy & Exit ボタン — 大型CTA */}
        <button
          onClick={handleCopy}
          disabled={!text.trim() || appState === "stopped"}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "clamp(14px, 2vw, 17px)",
            fontWeight: "bold",
            padding: "14px 0",
            borderRadius: "8px",
            flex: 1,
            cursor: !text.trim() || appState === "stopped" ? "not-allowed" : "pointer",
            border: "2px solid",
            backgroundColor: !text.trim() || appState === "stopped" ? "#0d0d0d" : "#ffffff",
            color: !text.trim() || appState === "stopped" ? "#333" : "#000",
            borderColor: !text.trim() || appState === "stopped" ? "#1a1a1a" : "#ffffff",
            transition: "all 0.2s",
            letterSpacing: "0.05em",
          }}
        >
          Copy &amp; Exit
        </button>
      </div>

      {/* Copied! オーバーレイ */}
      {showCopied && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 50,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "28px",
              fontWeight: "bold",
              padding: "20px 48px",
              borderRadius: "10px",
              backgroundColor: "#fff",
              color: "#000",
              animation: "fade-in-out 1.5s ease forwards",
            }}
          >
            Copied!
          </div>
        </div>
      )}

      {/* タイムアップ死亡メッセージオーバーレイ */}
      {appState === "stopped" && deletedMessage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 40,
            backgroundColor: "rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "clamp(32px, 8vw, 72px)",
              fontWeight: "bold",
              color: "#ef4444",
              letterSpacing: "0.04em",
              textAlign: "center",
              animation: "glow-red 2s ease-in-out infinite",
              padding: "0 24px",
            }}
          >
            {deletedMessage.main}
          </div>
          <div
            style={{
              marginTop: "12px",
              fontFamily: "var(--font-mono)",
              fontSize: "clamp(12px, 2vw, 14px)",
              color: "#555",
              textAlign: "center",
              letterSpacing: "0.04em",
              padding: "0 24px",
            }}
          >
            {deletedMessage.sub}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "20px",
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              color: "#555",
              background: "transparent",
              border: "1px solid #2a2a2a",
              borderRadius: "6px",
              padding: "8px 20px",
              cursor: "pointer",
              letterSpacing: "0.04em",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              pointerEvents: "auto",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#555"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#555"; e.currentTarget.style.borderColor = "#2a2a2a"; }}
          >
            <span style={{ fontSize: "16px" }}>↺</span>
            やり直す
          </button>
        </div>
      )}

      {/* 設定モーダル */}
      {showSettings && (
        <div
          onClick={() => setShowSettings(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#0d0d0d",
              border: "1px solid #222",
              borderRadius: "12px",
              padding: "28px 28px 24px",
              width: "min(360px, 90vw)",
              fontFamily: "var(--font-mono)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "14px", fontWeight: "bold", color: "#fff", letterSpacing: "0.06em" }}>SETTINGS</span>
              <button
                onClick={() => setShowSettings(false)}
                style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "18px", lineHeight: 1 }}
              >✕</button>
            </div>

            {/* タイマー一時停止バナー */}
            {appState === "running" || appState === "idle" || appState === "soft-deleting" ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: "rgba(234,179,8,0.08)",
                  border: "1px solid rgba(234,179,8,0.25)",
                  borderRadius: "6px",
                  padding: "7px 12px",
                  marginBottom: "20px",
                }}
              >
                <span style={{ fontSize: "13px" }}>⏸</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#ca8a04", letterSpacing: "0.04em" }}>
                  タイマーを一時停止しています
                </span>
              </div>
            ) : (
              <div style={{ marginBottom: "20px" }} />
            )}

            {/* コピーショートカット（PCのみ） */}
            {!isMobile && (
              <div style={{ marginBottom: "24px" }}>
                <div style={{ fontSize: "11px", color: "#555", marginBottom: "10px", letterSpacing: "0.06em" }}>COPY SHORTCUT</div>
                {([
                  { value: "cmd+enter" as const, label: "⌘ / Ctrl + Enter", desc: "このショートカットでコピー＆一時停止" },
                  { value: "shift+enter" as const, label: "Shift + Enter", desc: "Enterで改行、このショートカットでコピー" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setCopyShortcut(opt.value)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "flex-start",
                      width: "100%", padding: "12px 14px", marginBottom: "6px",
                      borderRadius: "8px", border: "1px solid", textAlign: "left",
                      backgroundColor: copyShortcut === opt.value ? "#fff" : "transparent",
                      color: copyShortcut === opt.value ? "#000" : "#555",
                      borderColor: copyShortcut === opt.value ? "#fff" : "#222",
                      cursor: "pointer", fontFamily: "var(--font-mono)", transition: "all 0.15s",
                      position: "relative",
                    }}
                  >
                    {copyShortcut === opt.value && <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)" }}>✓</span>}
                    <span style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "2px" }}>{opt.label}</span>
                    <span style={{ fontSize: "10px", color: copyShortcut === opt.value ? "#555" : "#444" }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            )}

            {/* モード */}
            <div>
              <div style={{ fontSize: "11px", color: "#555", marginBottom: "10px", letterSpacing: "0.06em" }}>MODE</div>
              {([
                { value: "hard" as const, label: "HARD", desc: "タイムアップで全文を即削除。潔く再スタート。" },
                { value: "soft" as const, label: "SOFT", desc: "書き続けることで文章が生き延びる。" },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start",
                    width: "100%", padding: "12px 14px", marginBottom: "6px",
                    borderRadius: "8px", border: "1px solid", textAlign: "left",
                    backgroundColor: mode === opt.value ? "#fff" : "transparent",
                    color: mode === opt.value ? "#000" : "#555",
                    borderColor: mode === opt.value ? "#fff" : "#222",
                    cursor: "pointer", fontFamily: "var(--font-mono)", transition: "all 0.15s",
                    position: "relative",
                  }}
                >
                  {mode === opt.value && <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)" }}>✓</span>}
                  <span style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "2px" }}>{opt.label}</span>
                  <span style={{ fontSize: "10px", color: mode === opt.value ? "#555" : "#444" }}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* このサイトとは？ モーダル */}
      {showAbout && (
        <div
          onClick={() => setShowAbout(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.82)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#0d0d0d",
              border: "1px solid #222",
              borderRadius: "14px",
              padding: "28px 28px 24px",
              width: "min(520px, 95vw)",
              maxHeight: "85vh",
              overflowY: "auto",
              fontFamily: "var(--font-mono)",
              scrollbarWidth: "none",
            }}
          >
            {/* ヘッダー */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.15em", marginBottom: "4px" }}>FORCED WRITING TOOL</div>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "#fff", letterSpacing: "0.03em" }}>書け、消えるぞ とは？</div>
              </div>
              <button
                onClick={() => setShowAbout(false)}
                style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: "4px" }}
              >✕</button>
            </div>

            {/* 思想セクション */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.12em", marginBottom: "10px" }}>📌 このサービスの思想</div>
              <div style={{ fontSize: "13px", color: "#999", lineHeight: "2.0" }}>
                「完璧な文章を書こう」と思った瞬間、人は止まります。<br />
                このツールは、その<span style={{ color: "#fff" }}>「考えすぎ」を物理的に不可能にする</span>ために作られました。<br /><br />
                10秒間キーを叩かなければ、文章は消えます。<br />
                だから、とにかく書く。整形や推敲は、コピーした後でAIに任せれば十分です。<br /><br />
                <span style={{ color: "#666" }}>アウトプットが先。完璧さは後からでいい。</span>
              </div>
            </div>

            <div style={{ height: "1px", backgroundColor: "#1a1a1a", marginBottom: "24px" }} />

            {/* 基本操作 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.12em", marginBottom: "12px" }}>⌨️ 基本操作</div>
              {[
                { key: "文字を入力する", desc: "タイマーが10秒にリセットされます。とにかく何かを打ち続けてください。" },
                { key: "⌘ / Ctrl + Enter", desc: "書いた内容をクリップボードにコピーして、入力画面に戻ります。" },
                { key: "タイムアップ", desc: "10秒間入力がないと文章が消えます。消えた後もクリックまたはキー入力で再挑戦できます。" },
              ].map((item) => (
                <div key={item.key} style={{ marginBottom: "14px", paddingLeft: "12px", borderLeft: "2px solid #222" }}>
                  <div style={{ fontSize: "12px", color: "#fff", fontWeight: "bold", marginBottom: "3px" }}>{item.key}</div>
                  <div style={{ fontSize: "11px", color: "#666", lineHeight: "1.7" }}>{item.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ height: "1px", backgroundColor: "#1a1a1a", marginBottom: "24px" }} />

            {/* モードの違い */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.12em", marginBottom: "12px" }}>⚔️ HARDモード と SOFTモードの違い</div>
              <div style={{ display: "flex", gap: "10px" }}>
                {[
                  { label: "HARD", color: "#ef4444", desc: "10秒間入力がないと、書いた文章が全て即座に消えます。容赦なし。" },
                  { label: "SOFT", color: "#eab308", desc: "10秒経過後、末尾から1文字ずつ削除されていきます。書き続ければ止まります。" },
                ].map((m) => (
                  <div
                    key={m.label}
                    style={{
                      flex: 1, padding: "14px", borderRadius: "8px",
                      border: `1px solid #1e1e1e`, backgroundColor: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: "bold", color: m.color, marginBottom: "6px", letterSpacing: "0.1em" }}>{m.label}</div>
                    <div style={{ fontSize: "11px", color: "#666", lineHeight: "1.7" }}>{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ height: "1px", backgroundColor: "#1a1a1a", marginBottom: "24px" }} />

            {/* ヒント */}
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.12em", marginBottom: "12px" }}>💡 使い方のヒント</div>
              {[
                "文章の質を気にしないでください。誤字でも断片でも、出すことが大事です。",
                "コピー後はChatGPTや Claude などのAIに「整形して」と貼り付けるだけでOKです。",
                "設定（⚙️）からコピーのショートカットキーを変更できます。",
                "タイマーが赤くなってからの回復は特別な演出が出ます。ギリギリまで粘ってみてください。",
              ].map((tip, i) => (
                <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                  <span style={{ color: "#333", fontSize: "11px", flexShrink: 0 }}>—</span>
                  <span style={{ fontSize: "11px", color: "#666", lineHeight: "1.7" }}>{tip}</span>
                </div>
              ))}
            </div>

            {/* 閉じるボタン */}
            <button
              onClick={() => setShowAbout(false)}
              style={{
                width: "100%", marginTop: "20px", padding: "12px",
                backgroundColor: "transparent", border: "1px solid #222",
                borderRadius: "8px", color: "#555", cursor: "pointer",
                fontFamily: "var(--font-mono)", fontSize: "12px",
                letterSpacing: "0.08em", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#555"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#222"; e.currentTarget.style.color = "#555"; }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
