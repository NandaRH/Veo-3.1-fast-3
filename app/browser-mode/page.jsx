"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function BrowserModePage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [browserStatus, setBrowserStatus] = useState({
    browserRunning: false,
    pageReady: false,
    isGenerating: false,
    currentUrl: null,
    isLoggedIn: false,
    isOnVideoFx: false,
  });
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [capturedToken, setCapturedToken] = useState(null);
  const [tokenAge, setTokenAge] = useState(null);
  const [isCapturingToken, setIsCapturingToken] = useState(false);
  const eventSourceRef = useRef(null);
  const logsEndRef = useRef(null);

  // Auth check + Admin check
  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      // Cek plan dari cookie
      let plan = "";
      try {
        const m = document.cookie.match(/(?:^|; )plan=([^;]+)/);
        plan = (m && m[1] ? decodeURIComponent(m[1]) : "").toLowerCase();
      } catch (_) {}

      // Hanya admin yang boleh akses
      if (plan !== "admin") {
        router.push("/dashboard");
        return;
      }

      setIsAdmin(true);
      setSession(session);
    })();
  }, [router]);

  // SSE connection untuk browser events
  useEffect(() => {
    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource("/api/browser/events");

      es.onopen = () => {
        addLog("info", "Terhubung ke server events");
      };

      es.onerror = () => {
        addLog("error", "Koneksi terputus, mencoba reconnect...");
        setTimeout(connectSSE, 3000);
      };

      es.addEventListener("browser-status", (e) => {
        const data = JSON.parse(e.data);
        addLog("info", `Browser status: ${data.status}`);
        fetchBrowserStatus();
      });

      es.addEventListener("login-required", (e) => {
        const data = JSON.parse(e.data);
        addLog("warning", `⚠️ ${data.message}`);
      });

      es.addEventListener("ready", (e) => {
        const data = JSON.parse(e.data);
        addLog("success", `✅ ${data.message}`);
        fetchBrowserStatus();
      });

      es.addEventListener("captcha-required", (e) => {
        const data = JSON.parse(e.data);
        addLog("warning", `🔐 CAPTCHA diperlukan: ${data.message}`);
      });

      es.addEventListener("job-started", (e) => {
        const data = JSON.parse(e.data);
        addLog("info", `🚀 Job dimulai: ${data.jobId}`);
        setCurrentJobId(data.jobId);
      });

      es.addEventListener("job-progress", (e) => {
        const data = JSON.parse(e.data);
        addLog("info", `⏳ ${data.message || "Memproses..."}`);
      });

      es.addEventListener("job-completed", (e) => {
        const data = JSON.parse(e.data);
        addLog("success", `✅ Video selesai! URL: ${data.videoUrl}`);
        setCurrentJobId(null);
        fetchBrowserStatus();
      });

      es.addEventListener("job-failed", (e) => {
        const data = JSON.parse(e.data);
        addLog("error", `❌ Job gagal: ${data.error}`);
        setCurrentJobId(null);
        fetchBrowserStatus();
      });

      es.addEventListener("job-cancelled", (e) => {
        addLog("warning", "🛑 Job dibatalkan");
        setCurrentJobId(null);
        fetchBrowserStatus();
      });

      // Token capture events
      es.addEventListener("recaptcha-token-captured", (e) => {
        const data = JSON.parse(e.data);
        addLog(
          "success",
          `🔑 Token reCAPTCHA berhasil di-capture! (${data.length} chars)`
        );
        setCapturedToken(data.token);
        setTokenAge(0);
      });

      es.addEventListener("token-capture-started", (e) => {
        const data = JSON.parse(e.data);
        addLog("info", `🔄 Memulai capture token...`);
        setIsCapturingToken(true);
      });

      es.addEventListener("token-capture-success", (e) => {
        const data = JSON.parse(e.data);
        addLog(
          "success",
          `✅ Token berhasil di-capture! (${data.length} chars)`
        );
        setIsCapturingToken(false);
        fetchTokenStatus();
      });

      es.addEventListener("token-capture-failed", (e) => {
        const data = JSON.parse(e.data);
        addLog("error", `❌ Gagal capture token: ${data.error}`);
        setIsCapturingToken(false);
      });

      eventSourceRef.current = es;
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (type, message) => {
    const timestamp = new Date().toLocaleTimeString("id-ID");
    setLogs((prev) => [...prev.slice(-99), { type, message, timestamp }]);
  };

  const fetchBrowserStatus = async () => {
    try {
      const res = await fetch("/api/browser/status");
      const data = await res.json();
      setBrowserStatus(data);
      // Update token age from status
      if (data.hasToken) {
        setTokenAge(data.tokenAge);
      }
    } catch (e) {
      console.error("Failed to fetch browser status:", e);
    }
  };

  const fetchTokenStatus = async () => {
    try {
      const res = await fetch("/api/browser/get-recaptcha-token");
      const data = await res.json();
      if (data.success) {
        setCapturedToken(data.token.substring(0, 50) + "...");
        setTokenAge(data.age);
      } else {
        setCapturedToken(null);
        setTokenAge(null);
      }
    } catch (e) {
      console.error("Failed to fetch token status:", e);
    }
  };

  // Fetch status on mount
  useEffect(() => {
    fetchBrowserStatus();
    const interval = setInterval(fetchBrowserStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLaunchBrowser = async () => {
    setIsLoading(true);
    addLog("info", "Membuka browser...");
    try {
      const res = await fetch("/api/browser/launch", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        addLog("success", data.message);
        // Auto navigate ke Labs setelah launch
        setTimeout(async () => {
          addLog("info", "Navigasi ke Google Labs...");
          const navRes = await fetch("/api/browser/navigate", {
            method: "POST",
          });
          const navData = await navRes.json();
          if (navData.needsLogin) {
            addLog(
              "warning",
              "⚠️ Silakan login ke Google di browser yang terbuka"
            );
          } else if (navData.ready) {
            addLog("success", "✅ Siap generate video!");
          }
          fetchBrowserStatus();
        }, 2000);
      } else {
        addLog("error", data.error || "Gagal membuka browser");
      }
    } catch (e) {
      addLog("error", `Error: ${e.message}`);
    }
    setIsLoading(false);
  };

  const handleCloseBrowser = async () => {
    setIsLoading(true);
    addLog("info", "Menutup browser...");
    try {
      const res = await fetch("/api/browser/close", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        addLog("success", data.message);
      } else {
        addLog("error", data.error || "Gagal menutup browser");
      }
      fetchBrowserStatus();
    } catch (e) {
      addLog("error", `Error: ${e.message}`);
    }
    setIsLoading(false);
  };

  const handleNavigate = async () => {
    setIsLoading(true);
    addLog("info", "Navigasi ke Google Labs...");
    try {
      const res = await fetch("/api/browser/navigate", { method: "POST" });
      const data = await res.json();
      if (data.needsLogin) {
        addLog("warning", "⚠️ Silakan login ke Google di browser yang terbuka");
      } else if (data.ready) {
        addLog("success", "✅ Siap generate video!");
      } else {
        addLog("info", data.message);
      }
      fetchBrowserStatus();
    } catch (e) {
      addLog("error", `Error: ${e.message}`);
    }
    setIsLoading(false);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      addLog("error", "Prompt tidak boleh kosong");
      return;
    }
    if (!browserStatus.browserRunning) {
      addLog("error", "Browser belum dibuka");
      return;
    }

    setIsLoading(true);
    addLog("info", `Memulai generate: "${prompt.substring(0, 50)}..."`);

    try {
      const res = await fetch("/api/browser/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, aspectRatio }),
      });
      const data = await res.json();
      if (data.success) {
        addLog("info", `Job ID: ${data.jobId}`);
        setCurrentJobId(data.jobId);
      } else {
        addLog("error", data.error || "Gagal memulai generate");
      }
      fetchBrowserStatus();
    } catch (e) {
      addLog("error", `Error: ${e.message}`);
    }
    setIsLoading(false);
  };

  const handleCancel = async () => {
    addLog("info", "Membatalkan generate...");
    try {
      const res = await fetch("/api/browser/cancel", { method: "POST" });
      const data = await res.json();
      addLog(data.success ? "success" : "error", data.message || data.error);
      fetchBrowserStatus();
    } catch (e) {
      addLog("error", `Error: ${e.message}`);
    }
  };

  const handleScreenshot = async () => {
    addLog("info", "Mengambil screenshot...");
    try {
      const res = await fetch("/api/browser/screenshot");
      const data = await res.json();
      if (data.success) {
        addLog("success", `Screenshot disimpan: ${data.path}`);
      } else {
        addLog("error", data.error || "Gagal screenshot");
      }
    } catch (e) {
      addLog("error", `Error: ${e.message}`);
    }
  };

  // Trigger token capture - klik Generate di browser untuk capture token
  const handleTriggerTokenCapture = async () => {
    if (!browserStatus.browserRunning) {
      addLog("error", "Browser belum dibuka");
      return;
    }

    setIsCapturingToken(true);
    addLog("info", "Memulai capture token reCAPTCHA...");

    try {
      const res = await fetch("/api/browser/trigger-token-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt || "beautiful nature video" }),
      });
      const data = await res.json();

      if (data.success) {
        addLog("success", "✅ Token berhasil di-capture!");
        setCapturedToken(data.token.substring(0, 50) + "...");
        setTokenAge(0);
      } else {
        addLog("error", data.error || "Gagal capture token");
      }
    } catch (e) {
      addLog("error", `Error: ${e.message}`);
    }

    setIsCapturingToken(false);
    fetchBrowserStatus();
  };

  // Get current token
  const handleGetToken = async () => {
    addLog("info", "Mengambil token...");
    try {
      const res = await fetch("/api/browser/get-recaptcha-token");
      const data = await res.json();

      if (data.success) {
        addLog(
          "success",
          `✅ Token tersedia! Umur: ${data.age}s (max: ${data.maxAge}s)`
        );
        setCapturedToken(data.token.substring(0, 50) + "...");
        setTokenAge(data.age);

        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(data.token);
          addLog("info", "📋 Token disalin ke clipboard!");
        } catch (_) {}
      } else {
        addLog("warning", data.error);
        setCapturedToken(null);
        setTokenAge(null);
      }
    } catch (e) {
      addLog("error", `Error: ${e.message}`);
    }
  };

  if (!session || !isAdmin) {
    return (
      <div className="browser-mode-loading">
        <div className="spinner"></div>
        <p>{!session ? "Memuat..." : "Memeriksa akses..."}</p>
      </div>
    );
  }

  return (
    <div className="browser-mode-container">
      <style jsx>{`
        .browser-mode-container {
          min-height: 100vh;
          background: linear-gradient(
            135deg,
            #0a0a0a 0%,
            #1a1a2e 50%,
            #0a0a0a 100%
          );
          color: #e0e0e0;
          padding: 20px;
          font-family: "Segoe UI", system-ui, sans-serif;
        }

        .browser-mode-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .browser-mode-header h1 {
          font-size: 24px;
          font-weight: 600;
          background: linear-gradient(90deg, #00d4ff, #7b2ff7);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
        }

        .back-btn {
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .status-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .status-card h2 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px 0;
          color: #888;
        }

        .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
        }

        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .status-dot.active {
          background: #00ff88;
          box-shadow: 0 0 10px #00ff88;
        }

        .status-dot.inactive {
          background: #ff4444;
        }

        .status-dot.warning {
          background: #ffaa00;
        }

        .controls-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .controls-card h2 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px 0;
          color: #888;
        }

        .btn-group {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: linear-gradient(135deg, #00d4ff, #7b2ff7);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(0, 212, 255, 0.3);
        }

        .btn-success {
          background: #00aa66;
          color: white;
        }

        .btn-success:hover:not(:disabled) {
          background: #00cc77;
        }

        .btn-danger {
          background: #cc3333;
          color: white;
        }

        .btn-danger:hover:not(:disabled) {
          background: #ee4444;
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .btn-secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.2);
        }

        .prompt-section {
          margin-top: 20px;
        }

        .prompt-section label {
          display: block;
          margin-bottom: 8px;
          color: #aaa;
          font-size: 14px;
        }

        .prompt-textarea {
          width: 100%;
          min-height: 100px;
          padding: 12px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          color: white;
          font-size: 14px;
          resize: vertical;
          font-family: inherit;
        }

        .prompt-textarea:focus {
          outline: none;
          border-color: #00d4ff;
        }

        .aspect-select {
          margin-top: 12px;
        }

        .aspect-select select {
          padding: 10px 16px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          color: white;
          font-size: 14px;
          cursor: pointer;
        }

        .logs-card {
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 20px;
        }

        .logs-card h2 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px 0;
          color: #888;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .logs-container {
          background: rgba(0, 0, 0, 0.5);
          border-radius: 8px;
          padding: 12px;
          height: 300px;
          overflow-y: auto;
          font-family: "Consolas", "Monaco", monospace;
          font-size: 13px;
        }

        .log-entry {
          padding: 4px 0;
          display: flex;
          gap: 8px;
        }

        .log-timestamp {
          color: #666;
          flex-shrink: 0;
        }

        .log-message {
          word-break: break-word;
        }

        .log-message.info {
          color: #88ccff;
        }

        .log-message.success {
          color: #00ff88;
        }

        .log-message.warning {
          color: #ffaa00;
        }

        .log-message.error {
          color: #ff6666;
        }

        .browser-mode-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: #0a0a0a;
          color: white;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top-color: #00d4ff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .info-banner {
          background: linear-gradient(
            135deg,
            rgba(0, 212, 255, 0.1),
            rgba(123, 47, 247, 0.1)
          );
          border: 1px solid rgba(0, 212, 255, 0.3);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .info-banner h3 {
          margin: 0 0 8px 0;
          color: #00d4ff;
          font-size: 16px;
        }

        .info-banner p {
          margin: 0;
          color: #aaa;
          font-size: 14px;
          line-height: 1.5;
        }

        .info-banner ul {
          margin: 8px 0 0 0;
          padding-left: 20px;
          color: #aaa;
          font-size: 14px;
        }

        .info-banner li {
          margin: 4px 0;
        }

        .token-card {
          background: linear-gradient(
            135deg,
            rgba(0, 200, 100, 0.1),
            rgba(0, 150, 200, 0.1)
          );
          border: 1px solid rgba(0, 200, 100, 0.3);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .token-card h2 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px 0;
          color: #00c864;
        }

        .token-status {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          padding: 12px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
        }

        .token-status-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .token-status-indicator.available {
          background: #00ff88;
          box-shadow: 0 0 10px #00ff88;
        }

        .token-status-indicator.expired {
          background: #ffaa00;
        }

        .token-status-indicator.none {
          background: #666;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .token-info {
          flex: 1;
        }

        .token-info strong {
          color: #fff;
          display: block;
          margin-bottom: 4px;
        }

        .token-info small {
          color: #888;
        }

        .token-value {
          font-family: "Consolas", monospace;
          font-size: 12px;
          color: #00d4ff;
          background: rgba(0, 0, 0, 0.4);
          padding: 8px 12px;
          border-radius: 6px;
          margin-bottom: 12px;
          word-break: break-all;
        }

        .btn-token {
          background: linear-gradient(135deg, #00c864, #00a050);
          color: white;
        }

        .btn-token:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(0, 200, 100, 0.3);
        }
      `}</style>

      <div className="browser-mode-header">
        <h1>🌐 Browser Mode - Veo Generate</h1>
        <button className="back-btn" onClick={() => router.push("/admin/dashboard")}>
          ← Kembali
        </button>
      </div>

      <div className="info-banner">
        <h3>ℹ️ Cara Kerja - Capture reCAPTCHA Token</h3>
        <p>
          Mode ini membuka browser untuk{" "}
          <strong>mengambil token reCAPTCHA</strong> dari Google Labs. Token
          akan <strong>otomatis digunakan</strong> oleh halaman generate (Prompt
          Tunggal, Prompt Batch, Frame to Video).
        </p>
        <ul>
          <li>
            Klik <strong>Buka Browser</strong> → Login ke Google
          </li>
          <li>
            Klik <strong>Get Token (Auto)</strong> → Token langsung diambil via
            JS
          </li>
          <li>Token valid selama 2 menit, refresh jika expired</li>
          <li>User bisa generate video tanpa error reCAPTCHA</li>
        </ul>
        <p style={{ marginTop: "8px", color: "#00d4ff" }}>
          ⚡ Tidak perlu klik Generate - token diambil langsung via JavaScript!
        </p>
      </div>

      {/* Token Capture Section */}
      <div className="token-card">
        <h2>🔑 reCAPTCHA Token Capture</h2>

        <div className="token-status">
          <span
            className={`token-status-indicator ${
              capturedToken && tokenAge !== null && tokenAge < 120
                ? "available"
                : capturedToken && tokenAge >= 120
                ? "expired"
                : "none"
            }`}
          ></span>
          <div className="token-info">
            <strong>
              {capturedToken && tokenAge !== null && tokenAge < 120
                ? "✅ Token Tersedia"
                : capturedToken && tokenAge >= 120
                ? "⚠️ Token Expired"
                : "❌ Belum Ada Token"}
            </strong>
            <small>
              {tokenAge !== null
                ? `Umur: ${tokenAge}s (max: 120s)`
                : "Capture token untuk menggunakannya di API"}
            </small>
          </div>
        </div>

        {capturedToken && <div className="token-value">{capturedToken}</div>}

        <div className="btn-group">
          <button
            className="btn btn-token"
            onClick={handleTriggerTokenCapture}
            disabled={
              !browserStatus.browserRunning ||
              isCapturingToken ||
              browserStatus.isGenerating
            }
          >
            {isCapturingToken ? "⏳ Capturing..." : "🔑 Get Token (Auto)"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleGetToken}
            disabled={!browserStatus.browserRunning}
          >
            📋 Copy Token
          </button>
        </div>
        <p style={{ marginTop: "8px", fontSize: "12px", color: "#888" }}>
          Token diambil langsung via JavaScript - tidak perlu klik Generate!
        </p>
      </div>

      <div className="status-card">
        <h2>📊 Status Browser</h2>
        <div className="status-grid">
          <div className="status-item">
            <span
              className={`status-dot ${
                browserStatus.browserRunning ? "active" : "inactive"
              }`}
            ></span>
            <span>
              Browser {browserStatus.browserRunning ? "Aktif" : "Mati"}
            </span>
          </div>
          <div className="status-item">
            <span
              className={`status-dot ${
                browserStatus.isLoggedIn ? "active" : "inactive"
              }`}
            ></span>
            <span>Login {browserStatus.isLoggedIn ? "Ya" : "Tidak"}</span>
          </div>
          <div className="status-item">
            <span
              className={`status-dot ${
                browserStatus.isOnVideoFx ? "active" : "warning"
              }`}
            ></span>
            <span>
              Di Video FX: {browserStatus.isOnVideoFx ? "Ya" : "Tidak"}
            </span>
          </div>
          <div className="status-item">
            <span
              className={`status-dot ${
                browserStatus.isGenerating ? "warning" : "inactive"
              }`}
            ></span>
            <span>
              {browserStatus.isGenerating ? "Sedang Generate..." : "Idle"}
            </span>
          </div>
          <div className="status-item">
            <span
              className={`status-dot ${
                browserStatus.hasToken ? "active" : "inactive"
              }`}
            ></span>
            <span>
              Token:{" "}
              {browserStatus.hasToken
                ? `${browserStatus.tokenAge}s`
                : "Tidak ada"}
            </span>
          </div>
        </div>
      </div>

      <div className="controls-card">
        <h2>🎮 Kontrol Browser</h2>
        <div className="btn-group">
          {!browserStatus.browserRunning ? (
            <button
              className="btn btn-primary"
              onClick={handleLaunchBrowser}
              disabled={isLoading}
            >
              🚀 Buka Browser
            </button>
          ) : (
            <>
              <button
                className="btn btn-danger"
                onClick={handleCloseBrowser}
                disabled={isLoading || browserStatus.isGenerating}
              >
                ❌ Tutup Browser
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleNavigate}
                disabled={isLoading}
              >
                🔄 Refresh Labs
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleScreenshot}
                disabled={isLoading}
              >
                📸 Screenshot
              </button>
            </>
          )}
        </div>

        {browserStatus.browserRunning && (
          <div className="prompt-section">
            <label>Prompt Video:</label>
            <textarea
              className="prompt-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Deskripsikan video yang ingin Anda buat..."
              disabled={browserStatus.isGenerating}
            />

            <div className="aspect-select">
              <label>Aspect Ratio: </label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                disabled={browserStatus.isGenerating}
              >
                <option value="16:9">16:9 (Landscape)</option>
                <option value="9:16">9:16 (Portrait)</option>
                <option value="1:1">1:1 (Square)</option>
              </select>
            </div>

            <div className="btn-group" style={{ marginTop: 16 }}>
              {!browserStatus.isGenerating ? (
                <button
                  className="btn btn-success"
                  onClick={handleGenerate}
                  disabled={isLoading || !prompt.trim()}
                >
                  ▶️ Generate Video
                </button>
              ) : (
                <button className="btn btn-danger" onClick={handleCancel}>
                  ⏹️ Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="logs-card">
        <h2>📜 Log Events</h2>
        <div className="logs-container">
          {logs.length === 0 ? (
            <div className="log-entry">
              <span className="log-message info">Menunggu aktivitas...</span>
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="log-entry">
                <span className="log-timestamp">[{log.timestamp}]</span>
                <span className={`log-message ${log.type}`}>{log.message}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
