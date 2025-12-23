"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Sora2Page() {
  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          window.location.href = "/login";
          return;
        }
      } catch (_) {}
    })();
  }, []);
  useEffect(() => {
    try {
      document.title = "Sora 2 | Fokus AI";
    } catch (_) {}
  }, []);
  const [isFree, setIsFree] = useState(false);
  const [mode, setMode] = useState("basic");
  const [prompt, setPrompt] = useState("");
  const [subject, setSubject] = useState("");
  const [action, setAction] = useState("");
  const [setting, setSetting] = useState("");
  const [lighting, setLighting] = useState("");
  const [style, setStyle] = useState("");
  const [shot, setShot] = useState("");
  const [details, setDetails] = useState("");
  const [orientation, setOrientation] = useState("landscape");
  const [model, setModel] = useState("sora-2");
  const [duration, setDuration] = useState(10);
  const [showJson, setShowJson] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbUrl, setThumbUrl] = useState("");
  const [imageData, setImageData] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [imageName, setImageName] = useState("");
  const [imageMime, setImageMime] = useState("image/jpeg");
  const [refThumbs, setRefThumbs] = useState([]);
  const videoUrlRef = useRef("");
  const creditsDeductedRef = useRef(false);
  const costCreditsRef = useRef(0);
  useEffect(() => {
    videoUrlRef.current = videoUrl;
  }, [videoUrl]);
  const [genSeconds, setGenSeconds] = useState(0);
  const [isTiming, setIsTiming] = useState(false);
  const genTimerRef = useRef(null);
  const genStartRef = useRef(0);
  const [jobUuid, setJobUuid] = useState("");
  const [jobId, setJobId] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const pollSessionRef = useRef(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [defaultOrientation, setDefaultOrientation] = useState("landscape");
  const [defaultDuration, setDefaultDuration] = useState(10);
  const [defaultStyle, setDefaultStyle] = useState("");

  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [plan, setPlan] = useState("free");
  const [credits, setCredits] = useState(0);
  const [creditScope, setCreditScope] = useState("none");

  // Durasi yang valid per model (sesuai docs Sora)
  const allowedDurations = useMemo(() => {
    if (model === "sora-2-pro") return [15]; // sesuai permintaan: hanya 15s
    if (model === "sora-2-pro-hd") return [15];
    return [10, 15]; // default sora-2
  }, [model]);

  // Pastikan durasi selalu valid ketika model berubah
  useEffect(() => {
    if (!allowedDurations.includes(duration)) {
      setDuration(allowedDurations[0]);
    }
  }, [allowedDurations, duration]);
  const bumpStat = (key) => {
    try {
      const v = parseInt(localStorage.getItem(key) || "0", 10) || 0;
      localStorage.setItem(key, String(v + 1));
    } catch (_) {}
  };
  useEffect(() => {
    try {
      const m = document.cookie.match(/(?:^|; )plan=([^;]+)/);
      const p = (m && m[1] ? decodeURIComponent(m[1]) : "").toLowerCase();
      setIsFree(p === "free");
    } catch (_) {}
  }, []);
  useEffect(() => {
    try {
      const m = document.cookie.match(/(?:^|; )plan=([^;]+)/);
      const p = (m && m[1] ? decodeURIComponent(m[1]) : "").toLowerCase();
      setPlan(p || "free");
    } catch (_) {}
  }, []);
  const refreshCredits = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = String(session?.access_token || "");
      if (!token) return;
      // Try admin credits first (if admin, returns value; else 403)
      const rAdmin = await fetch("/api/admin/credits", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (rAdmin.ok) {
        const dA = await rAdmin.json();
        setCreditScope("admin");
        setCredits(Number(dA?.credits?.sora2 || 0));
        return;
      }
      // Fallback to scoped credits
      const rMe = await fetch("/api/me/credits", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dM = await rMe.json();
      if (rMe.ok) {
        setCreditScope(String(dM?.scope || "none"));
        setCredits(Number(dM?.credits || 0));
      }
    } catch (_) {}
  };
  useEffect(() => {
    refreshCredits();
  }, []);
  useEffect(() => {
    refreshCredits();
  }, [plan]);
  // Realtime sinkron plan dari PlanSync
  useEffect(() => {
    const handler = (e) => {
      try {
        const p = String(e.detail?.plan || "").toLowerCase();
        if (p) setPlan(p);
      } catch (_) {}
    };
    try {
      window.addEventListener("plan-updated", handler);
    } catch (_) {}
    return () => {
      try {
        window.removeEventListener("plan-updated", handler);
      } catch (_) {}
    };
  }, []);
  useEffect(() => {
    (async () => {
      try {
        if (!supabase) return;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          window.location.href = "/login";
        }
      } catch (_) {}
    })();
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setShowLogoutModal(false);
    };
    if (showLogoutModal) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showLogoutModal]);

  const displayStatus = useMemo(() => {
    const s = Number(result?.status || 0);
    const pct =
      typeof result?.status_percentage !== "undefined"
        ? Number(result?.status_percentage)
        : undefined;
    if (videoUrl) return "Status: 2 — 100%";
    if (s && pct !== undefined) return `Status: ${s} — ${pct}%`;
    if (s) return `Status: ${s}`;
    return "";
  }, [result, videoUrl]);

  const finalPrompt = useMemo(() => {
    if (mode === "basic") return (prompt || "").trim();
    const parts = [
      subject ? `subjek: ${subject}` : "",
      action ? `aksi: ${action}` : "",
      setting ? `setting: ${setting}` : "",
      lighting ? `pencahayaan/waktu: ${lighting}` : "",
      style ? `gaya visual: ${style}` : "",
      shot ? `camera shot: ${shot}` : "",
      details ? `detail: ${details}` : "",
    ].filter(Boolean);
    return parts.join(", ");
  }, [mode, prompt, subject, action, setting, lighting, style, shot, details]);

  const payload = useMemo(
    () => ({
      prompt: finalPrompt,
      orientation,
      resolution: "720p",
      durationSeconds: duration,
      model: model,
    }),
    [finalPrompt, orientation, duration, model]
  );

  const advancedJson = useMemo(() => {
    const snake = (x) =>
      String(x || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    const parts = [];
    if ((subject || "").trim()) parts.push(String(subject).trim());
    if ((action || "").trim()) parts.push(String(action).trim());
    if ((setting || "").trim()) parts.push(`in ${String(setting).trim()}`);
    if ((shot || "").trim()) parts.push(`shot with a ${String(shot).trim()}`);
    if ((style || "").trim()) parts.push(`using ${String(style).trim()} style`);
    if ((lighting || "").trim())
      parts.push(`with ${String(lighting).trim()} lighting`);
    if ((details || "").trim()) parts.push(String(details).trim());
    const prompt_summary = parts.join(", ");
    return {
      prompt_summary,
      parameters: {
        subject: (subject || "").trim(),
        action: (action || "").trim(),
        environment: {
          setting: (setting || "").trim(),
          lighting: (lighting || "").trim(),
        },
        style: {
          visual: snake(style),
          camera: {
            shot_type: snake(shot),
          },
        },
        additional_details: (details || "").trim(),
      },
    };
  }, [subject, action, setting, shot, style, lighting, details]);

  const startTimer = () => {
    try {
      if (genTimerRef.current) clearInterval(genTimerRef.current);
    } catch (_) {}
    genStartRef.current = Date.now();
    setGenSeconds(0);
    setIsTiming(true);
    try {
      genTimerRef.current = setInterval(() => {
        const diff = Math.floor((Date.now() - genStartRef.current) / 1000);
        setGenSeconds(diff >= 0 ? diff : 0);
      }, 250);
    } catch (_) {}
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const stopTimer = () => {
    setIsTiming(false);
    try {
      if (genTimerRef.current) clearInterval(genTimerRef.current);
    } catch (_) {}
    genTimerRef.current = null;
  };

  const deductCreditsOnce = async () => {
    const amount = Number(costCreditsRef.current || 0);
    if (!amount || creditsDeductedRef.current) return;
    creditsDeductedRef.current = true;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = String(session?.access_token || "");
      if (!token) return;
      const resp = await fetch("/api/credits/deduct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount }),
      });
      const dd = await resp.json();
      if (resp.ok) {
        setCredits(Number(dd?.credits || 0));
        refreshCredits();
      }
    } catch (_) {}
  };

  const generate = async () => {
    const text = (finalPrompt || "").trim();
    if (!text) {
      setStatus("Isi prompt terlebih dahulu.");
      return;
    }
    const costCredits = model === "sora-2" ? 1 : 120;
    costCreditsRef.current = costCredits;
    creditsDeductedRef.current = false;
    const sscope = String(creditScope || "none");
    if (!(sscope === "admin" || sscope === "user")) {
      setStatus("Plan tidak eligible untuk Sora 2.");
      return;
    }
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = String(session?.access_token || "");
      if (token) {
        const r = await fetch("/api/me/credits", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json();
        if (r.ok) {
          const cur = Number(d?.credits || 0);
          const scope = String(d?.scope || "none");
          setCredits(cur);
          setCreditScope(scope);
          if ((scope === "admin" || scope === "user") && cur < costCredits) {
            setStatus("Credit tidak mencukupi.");
            return;
          }
        }
      }
    } catch (_) {}
    try {
      setStatus("Mengirim ke Sora...");
      startTimer();
      setResult(null);
      setVideoUrl("");
      setThumbUrl("");
      setRefThumbs([]);
      setJobUuid("");
      setJobId("");
      setIsPolling(false);
      pollSessionRef.current += 1;
      const session = pollSessionRef.current;
      const formData = new FormData();
      formData.append("prompt", finalPrompt);
      formData.append("model", model);
      formData.append(
        "aspect_ratio",
        orientation === "portrait" ? "portrait" : "landscape"
      );
      formData.append("resolution", "small");
      formData.append("duration", duration);
      formData.append("provider", "openai");
      if (imageData) formData.append("image_data", imageData);
      if (imageName) formData.append("image_name", imageName);
      if (imageMime) formData.append("image_mime", imageMime);

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("licenseActivationToken") || ""
          : "";

      // Send as JSON (backend converts to FormData for upstream)
      // We keep sending JSON to our backend for simplicity, or we can switch to FormData if backend expects it.
      // Looking at backend: it parses req.body for JSON.
      // So we stick to JSON.
      const fields = {
        prompt: finalPrompt,
        model: model,
        aspect_ratio: orientation === "portrait" ? "portrait" : "landscape",
        resolution: "small",
        duration: duration,
        provider: "openai",
        image_data: imageData || undefined,
        image_name: imageName || undefined,
        image_mime: imageMime || undefined,
      };

      const resp = await fetch("/api/sora/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-credential": token,
        },
        body: JSON.stringify(fields),
      });
      const ct = resp.headers.get("content-type") || "";
      let data = ct.includes("application/json")
        ? await resp.json()
        : await resp.text();
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          /* keep as text */
        }
      }
      if (!resp.ok) {
        const msg =
          typeof data === "string" && data.trim().startsWith("<")
            ? "Gagal: Server mengembalikan HTML (kemungkinan 404/401)."
            : `Gagal: ${
                typeof data === "string"
                  ? data
                  : data?.error || "HTTP " + resp.status
              }`;
        setStatus(msg);
        setResult(null);
        setVideoUrl("");
        setThumbUrl("");
        stopTimer();
        return;
      }
      setResult(data);
      try {
        const gv = Array.isArray(data?.generated_video)
          ? data.generated_video[0]
          : undefined;
        const vurl = sanitizeUrl(
          gv?.video_url ||
            gv?.file_download_url ||
            data?.video_url ||
            data?.file_download_url ||
            ""
        );
        const turl = sanitizeUrl(
          gv?.thumbnail_url || data?.thumbnail_url || data?.last_frame_url || ""
        );
        if (vurl) {
          setVideoUrl(vurl);
          stopTimer();
          deductCreditsOnce();
        }
        setThumbUrl(turl);
        const refs = Array.isArray(data?.reference_item)
          ? data.reference_item
          : [];
        const rthumbs = refs
          .map((x) => {
            const a = sanitizeUrl(x?.thumbnail_url || "");
            if (a) return a;
            const b = sanitizeUrl(x?.uri || "");
            if (b) return sanitizeUrl(`https://cdn.geminigen.ai/${b}`);
            return "";
          })
          .filter(Boolean);
        setRefThumbs(rthumbs);
        const ju = String(data?.uuid || gv?.uuid || "");
        const jid = String(data?.id || gv?.history_id || "");
        setJobUuid(ju);
        setJobId(jid);
        if (!vurl && (ju || jid)) {
          setIsPolling(true);
          pollStatus(ju, jid, 0, session);
        }
      } catch (_) {
        /* ignore */
      }
      setStatus("Berhasil.");
      try {
        bumpStat("stat.sora.video.success");
      } catch (_) {}
    } catch (e) {
      const msg = String(e?.message || e || "").trim();
      setStatus(msg.length > 180 ? msg.slice(0, 180) + "…" : msg);
      stopTimer();
    }
  };

  const pollStatus = async (uuid, id, attempt, session) => {
    try {
      if (session !== pollSessionRef.current) {
        setIsPolling(false);
        stopTimer();
        return;
      }
      if (!uuid && !id) {
        setIsPolling(false);
        stopTimer();
        return;
      }
      const q = new URLSearchParams();
      if (uuid) q.set("uuid", uuid);
      if (id) q.set("id", id);
      const resp = await fetch(`/api/sora/status?${q.toString()}`, {
        method: "GET",
      });
      const ct = resp.headers.get("content-type") || "";
      let d = ct.includes("application/json")
        ? await resp.json()
        : await resp.text();
      if (typeof d === "string") {
        try {
          d = JSON.parse(d);
        } catch {
          /* keep */
        }
      }
      if (resp.ok && d) {
        setResult(d);
        const gv = Array.isArray(d?.generated_video)
          ? d.generated_video[0]
          : undefined;
        const vuri = sanitizeUrl(gv?.video_uri || d?.video_uri || "");
        let vurl = sanitizeUrl(
          gv?.video_url ||
            gv?.file_download_url ||
            d?.video_url ||
            d?.file_download_url ||
            ""
        );
        const turl = sanitizeUrl(
          gv?.thumbnail_url || d?.thumbnail_url || d?.last_frame_url || ""
        );
        if (!vurl && vuri) {
          vurl = sanitizeUrl(
            `https://user-files-downloader.geminigen.ai/${vuri}`
          );
        }
        if (vurl) {
          if (!videoUrlRef.current || videoUrlRef.current !== vurl)
            setVideoUrl(vurl);
          stopTimer();
          deductCreditsOnce();
          if (turl) setThumbUrl(turl);
          const refs = Array.isArray(d?.reference_item) ? d.reference_item : [];
          const rthumbs = refs
            .map((x) => sanitizeUrl(x?.thumbnail_url || ""))
            .filter(Boolean);
          if (rthumbs.length) {
            setRefThumbs(rthumbs);
            setIsPolling(false);
            return;
          }
        }
        if (turl) setThumbUrl(turl);
        const refs = Array.isArray(d?.reference_item) ? d.reference_item : [];
        const rthumbs = refs
          .map((x) => {
            const a = sanitizeUrl(x?.thumbnail_url || "");
            if (a) return a;
            const b = sanitizeUrl(x?.uri || "");
            if (b) return sanitizeUrl(`https://cdn.geminigen.ai/${b}`);
            return "";
          })
          .filter(Boolean);
        if (rthumbs.length) setRefThumbs(rthumbs);
      } else {
        // Untuk error jelas seperti 404/400, hentikan lebih cepat
        if (resp.status === 404 || resp.status === 400) {
          setIsPolling(false);
          stopTimer();
          setStatus(
            "Job Sora tidak ditemukan atau sudah kadaluarsa. Coba kirim ulang."
          );
          return;
        }
      }
    } catch (_) {}
    const next = attempt + 1;
    // Batasi maksimal ~6 menit polling (120 x 3s)
    if (next > 120) {
      setIsPolling(false);
      stopTimer();
      setStatus(
        "Timeout saat mengecek status Sora. Jika video belum muncul, klik 'Check Status Manually' atau kirim ulang."
      );
      return;
    }
    setTimeout(() => pollStatus(uuid, id, next, session), 3000);
  };

  const sanitizeUrl = (s) => {
    try {
      let v = typeof s === "string" ? s : "";
      v = v.replace(/[`"']/g, "").trim();
      v = v.replace(/\s+/g, " ");
      v = v.replace(/ /g, "%20");
      return v;
    } catch {
      return "";
    }
  };

  return (
    <div className="sora-v2-container">
      <header className="sora-v2-header">
        <div className="sora-v2-brand">
          <img
            src="/images/fokusAI.png"
            alt="Logo FokusAI Studio"
            className="sora-v2-logo"
          />
          <div className="sora-v2-title-group">
            <h1>Sora 2</h1>
            <p>Cinematic Video Generation</p>
          </div>
        </div>
        <div
          style={{ display: "flex", gap: 12, alignItems: "center" }}
          ref={userMenuRef}
        >
          <button
            className="sora-v2-btn secondary"
            title="Credits"
            onClick={(e) => e.preventDefault()}
          >
            💳
            <span
              style={{
                marginLeft: 6,
                padding: "2px 6px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                fontSize: 12,
                color: "#f8fafc",
              }}
            >
              {(() => {
                const s = String(creditScope || "none");
                if (s === "admin" || s === "user") {
                  return new Intl.NumberFormat("id-ID").format(credits);
                }
                return "tidak tersedia";
              })()}
            </span>
          </button>
          <a
            className="sora-v2-btn secondary"
            href="/prompt-tunggal"
            title="Video Generator"
          >
            🎬
          </a>
          <span
            className="sora-v2-btn secondary"
            aria-disabled="true"
            title="Music (disabled)"
            style={{ opacity: 0.5, pointerEvents: "none" }}
          >
            🎵
          </span>
          <a
            className="sora-v2-btn secondary"
            href="/image-generator"
            title="Image Generator"
          >
            🖼️
          </a>
          <div className="user-menu">
            <button
              className="settings-btn user-btn"
              aria-haspopup="true"
              aria-expanded={showUserMenu ? "true" : "false"}
              title="User menu"
              onClick={(e) => {
                e.preventDefault();
                setShowUserMenu((v) => !v);
              }}
            >
              <span aria-hidden="true">👤</span>
              <span className="sr-only">User menu</span>
            </button>
            <div
              className={`user-menu-dropdown ${showUserMenu ? "show" : ""}`}
              hidden={!showUserMenu}
            >
              {plan === "admin" ? (
                <>
                  <button
                    className="user-menu-item"
                    type="button"
                    onClick={() => {
                      window.location.href = "/admin/dashboard";
                      setShowUserMenu(false);
                    }}
                  >
                    <span aria-hidden="true">🏛️</span>
                    <span>Admin Dashboard</span>
                  </button>
                  <button
                    className="user-menu-item"
                    type="button"
                    onClick={() => {
                      window.location.href = "/admin/users";
                      setShowUserMenu(false);
                    }}
                  >
                    <span aria-hidden="true">👥</span>
                    <span>Manage Users</span>
                  </button>
                  <div className="user-menu-divider"></div>
                  <button
                    className="user-menu-item"
                    type="button"
                    onClick={() => {
                      setShowLogoutModal(true);
                      setShowUserMenu(false);
                    }}
                  >
                    <span aria-hidden="true">🚪</span>
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="user-menu-item"
                    type="button"
                    onClick={() => {
                      window.location.href = "/dashboard";
                      setShowUserMenu(false);
                    }}
                  >
                    <span aria-hidden="true">🏠</span>
                    <span>Dashboard</span>
                  </button>
                  <button
                    className="user-menu-item"
                    type="button"
                    onClick={() => {
                      window.location.href = "/profile";
                      setShowUserMenu(false);
                    }}
                  >
                    <span aria-hidden="true">👤</span>
                    <span>User Profile</span>
                  </button>
                  <button
                    className="user-menu-item"
                    type="button"
                    onClick={() => {
                      window.location.href = "/credit";
                      setShowUserMenu(false);
                    }}
                  >
                    <span aria-hidden="true">💳</span>
                    <span>Credit</span>
                  </button>
                  <button
                    className="user-menu-item"
                    type="button"
                    onClick={() => {
                      setShowLogoutModal(true);
                      setShowUserMenu(false);
                    }}
                  >
                    <span aria-hidden="true">🚪</span>
                    <span>Logout</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="sora-v2-grid">
        <div className="sora-v2-card">
          <div className="sora-v2-section-title">Configuration</div>

          <div className="sora-v2-tabs">
            <div
              className={`sora-v2-tab ${mode === "basic" ? "active" : ""}`}
              onClick={() => setMode("basic")}
            >
              Basic Mode
            </div>
            <div
              className={`sora-v2-tab ${mode === "advanced" ? "active" : ""}`}
              onClick={() => setMode("advanced")}
            >
              Advanced Mode
            </div>
          </div>

          {mode === "basic" ? (
            <div className="sora-v2-input-group">
              <label className="sora-v2-label">Prompt</label>
              <textarea
                className="sora-v2-textarea"
                placeholder="Describe the video you want to generate with Sora..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div style={{ marginTop: 12 }}>
                <button
                  className="sora-v2-btn secondary"
                  style={{ fontSize: 12, padding: "8px 16px" }}
                >
                  Add Cameo
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className="sora-v2-grid"
                style={{
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <div className="sora-v2-input-group">
                  <label className="sora-v2-label">Main Subject</label>
                  <input
                    className="sora-v2-input"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., A majestic lion"
                  />
                </div>
                <div className="sora-v2-input-group">
                  <label className="sora-v2-label">Action</label>
                  <input
                    className="sora-v2-input"
                    type="text"
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    placeholder="e.g., walking on a beach"
                  />
                </div>
              </div>

              <div
                className="sora-v2-grid"
                style={{
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <div className="sora-v2-input-group">
                  <label className="sora-v2-label">Setting</label>
                  <input
                    className="sora-v2-input"
                    type="text"
                    value={setting}
                    onChange={(e) => setSetting(e.target.value)}
                    placeholder="e.g., futuristic city"
                  />
                </div>
                <div className="sora-v2-input-group">
                  <label className="sora-v2-label">Lighting</label>
                  <input
                    className="sora-v2-input"
                    type="text"
                    value={lighting}
                    onChange={(e) => setLighting(e.target.value)}
                    placeholder="e.g., golden hour"
                  />
                </div>
              </div>

              <div
                className="sora-v2-grid"
                style={{
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <div className="sora-v2-input-group">
                  <label className="sora-v2-label">Visual Style</label>
                  <input
                    className="sora-v2-input"
                    type="text"
                    list="visualStyleList"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    placeholder="Select style..."
                  />
                  <datalist id="visualStyleList">
                    <option value="Photorealistic" />
                    <option value="Cinematic" />
                    <option value="Anime" />
                    <option value="Cyberpunk" />
                    <option value="3D Render" />
                  </datalist>
                </div>
                <div className="sora-v2-input-group">
                  <label className="sora-v2-label">Camera Shot</label>
                  <input
                    className="sora-v2-input"
                    type="text"
                    list="cameraShotList"
                    value={shot}
                    onChange={(e) => setShot(e.target.value)}
                    placeholder="Select shot..."
                  />
                  <datalist id="cameraShotList">
                    <option value="Wide Shot" />
                    <option value="Close-Up" />
                    <option value="Drone Shot" />
                    <option value="Tracking Shot" />
                  </datalist>
                </div>
              </div>

              <div className="sora-v2-input-group">
                <label className="sora-v2-label">Additional Details</label>
                <textarea
                  className="sora-v2-textarea"
                  style={{ minHeight: 80 }}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="e.g., in slow motion, with lens flare"
                />
              </div>

              <div
                className="sora-v2-grid"
                style={{ gridTemplateColumns: "1fr", gap: 16 }}
              >
                <div className="sora-v2-input-group">
                  <label className="sora-v2-label">Upload Ref Image</label>
                  <input
                    className="sora-v2-input"
                    type="file"
                    accept="image/*"
                    style={{ padding: 10 }}
                    onChange={(e) => {
                      try {
                        const f = e.target.files?.[0];
                        if (!f) {
                          setImageData("");
                          setImagePreview("");
                          return;
                        }
                        setImageName(String(f.name || "reference.jpg"));
                        setImageMime(String(f.type || "image/jpeg"));
                        const reader = new FileReader();
                        reader.onload = () => {
                          const res = String(reader.result || "");
                          setImagePreview(res);
                          const base64 = res.includes(",")
                            ? res.split(",")[1]
                            : res;
                          setImageData(base64);
                        };
                        reader.readAsDataURL(f);
                      } catch (_) {
                        setImageData("");
                        setImagePreview("");
                      }
                    }}
                  />
                </div>
              </div>
              {imagePreview ? (
                <div style={{ marginBottom: 16 }}>
                  <img
                    src={imagePreview}
                    alt="Reference preview"
                    style={{
                      width: 120,
                      height: "auto",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  />
                </div>
              ) : null}
            </>
          )}

          <div className="sora-v2-input-group" style={{ marginTop: 8 }}>
            <label className="sora-v2-label">Model</label>
            <div
              className="sora-v2-options-grid"
              style={{ gridTemplateColumns: "1fr 1fr" }}
            >
              <div
                className={`sora-v2-option-btn ${
                  model === "sora-2" ? "active" : ""
                }`}
                onClick={() => setModel("sora-2")}
              >
                Sora 2
              </div>
              <div
                className={`sora-v2-option-btn ${
                  model === "sora-2-pro" ? "active" : ""
                }`}
                onClick={() => setModel("sora-2-pro")}
              >
                Sora 2 Pro
              </div>
            </div>
          </div>

          <div
            className="sora-v2-grid"
            style={{ gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}
          >
            <div className="sora-v2-input-group">
              <label className="sora-v2-label">Orientation</label>
              <div
                className="sora-v2-options-grid"
                style={{ gridTemplateColumns: "1fr 1fr" }}
              >
                <div
                  className={`sora-v2-option-btn ${
                    orientation === "landscape" ? "active" : ""
                  }`}
                  onClick={() => setOrientation("landscape")}
                >
                  Landscape (16:9)
                </div>
                <div
                  className={`sora-v2-option-btn ${
                    orientation === "portrait" ? "active" : ""
                  }`}
                  onClick={() => setOrientation("portrait")}
                >
                  Portrait (9:16)
                </div>
              </div>
            </div>
            <div className="sora-v2-input-group">
              <label className="sora-v2-label">Duration</label>
              <div
                className="sora-v2-options-grid"
                style={{
                  gridTemplateColumns:
                    allowedDurations.length === 1 ? "1fr" : "1fr 1fr",
                }}
              >
                {allowedDurations.map((d) => (
                  <div
                    key={d}
                    className={`sora-v2-option-btn ${
                      duration === d ? "active" : ""
                    }`}
                    onClick={() => setDuration(d)}
                  >
                    {d}s
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <button
              className="sora-v2-btn glow"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={generate}
            >
              {status === "Mengirim ke Sora..." ? (
                <>
                  <span className="sora-v2-status-dot active"></span>{" "}
                  Generating...
                </>
              ) : (
                `Generate Video  ⚡ ${model === "sora-2" ? 1 : 120} credits`
              )}
            </button>
            <div
              style={{
                textAlign: "center",
                marginTop: 12,
                fontSize: 13,
                color: "#94a3b8",
              }}
            >
              {status}
            </div>
          </div>
        </div>

        <div className="sora-v2-card">
          <div className="sora-v2-section-title">
            Result
            {displayStatus && (
              <span
                className="sora-v2-status-pill"
                style={{ marginLeft: "auto", fontSize: 11 }}
              >
                {displayStatus}
              </span>
            )}
            {(isTiming || genSeconds > 0) && (
              <span className="sora-v2-status-pill" style={{ fontSize: 11 }}>
                {genSeconds}s
              </span>
            )}
          </div>

          {videoUrl ? (
            <div className="sora-v2-video-wrapper">
              <video
                controls
                preload="metadata"
                playsInline
                autoPlay
                muted
                loop
              >
                <source src={videoUrl} type="video/mp4" />
              </video>
              <div
                style={{
                  padding: 16,
                  background: "rgba(0,0,0,0.5)",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <a
                  className="sora-v2-btn secondary"
                  href={`/api/sora/download?url=${encodeURIComponent(
                    videoUrl
                  )}`}
                  style={{ fontSize: 13, padding: "8px 16px" }}
                >
                  Download MP4
                </a>
              </div>
            </div>
          ) : (
            <div
              className={`sora-v2-result-placeholder ${
                status === "Mengirim ke Sora..." ? "active" : ""
              }`}
            >
              {status === "Mengirim ke Sora..." ? (
                <>
                  <div
                    className="sora-v2-status-dot active"
                    style={{ width: 16, height: 16 }}
                  ></div>
                  <div>Creating your masterpiece...</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 48, opacity: 0.3 }}>🎬</div>
                  <div>Video result will appear here</div>
                </>
              )}
            </div>
          )}

          <div
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
              gap: 12,
            }}
          >
            {thumbUrl && (
              <img
                src={thumbUrl}
                alt="Thumbnail"
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
            )}
            {refThumbs &&
              refThumbs.map((u, i) => (
                <img
                  key={i}
                  src={u}
                  alt="Ref"
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                />
              ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              className="sora-v2-btn secondary"
              style={{ width: "100%" }}
              disabled={!jobUuid && !jobId}
              onClick={() => {
                setIsPolling(true);
                pollSessionRef.current += 1;
                const s = pollSessionRef.current;
                pollStatus(jobUuid, jobId, 0, s);
              }}
            >
              {isPolling ? "Checking Status..." : "Check Status Manually"}
            </button>
          </div>
        </div>
      </div>

      {settingsOpen && (
        <div className="modal show" style={{ backdropFilter: "blur(10px)" }}>
          <div
            className="sora-v2-card"
            style={{
              width: "min(600px, 95vw)",
              padding: 32,
              background: "#0f172a",
              border: "1px solid #334155",
            }}
          >
            <div
              className="sora-v2-section-title"
              style={{ justifyContent: "space-between" }}
            >
              <span>Settings</span>
              <button
                className="sora-v2-btn secondary"
                style={{ padding: "4px 12px" }}
                onClick={() => setSettingsOpen(false)}
              >
                Close
              </button>
            </div>

            <div
              className="sora-v2-grid"
              style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}
            >
              <div className="sora-v2-input-group">
                <label className="sora-v2-label">Default Orientation</label>
                <select
                  className="sora-v2-select"
                  value={defaultOrientation}
                  onChange={(e) => setDefaultOrientation(e.target.value)}
                >
                  <option value="landscape">Landscape</option>
                  <option value="portrait">Portrait</option>
                </select>
              </div>
              <div className="sora-v2-input-group">
                <label className="sora-v2-label">Default Duration</label>
                <select
                  className="sora-v2-select"
                  value={defaultDuration}
                  onChange={(e) =>
                    setDefaultDuration(parseInt(e.target.value, 10))
                  }
                >
                  <option value={10}>10s</option>
                  <option value={15}>15s</option>
                </select>
              </div>
            </div>

            <div
              style={{
                marginTop: 24,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                className="sora-v2-btn"
                onClick={() => {
                  setOrientation(defaultOrientation);
                  setDuration(defaultDuration);
                  if (defaultStyle && !style) setStyle(defaultStyle);
                  setSettingsOpen(false);
                }}
              >
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}
      {showLogoutModal && (
        <div
          className="modal show"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLogoutModal(false);
          }}
          style={{ backdropFilter: "blur(10px)" }}
        >
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 700, color: "#f4d03f" }}>
                Konfirmasi Logout
              </div>
              <button
                className="btn ghost"
                onClick={() => setShowLogoutModal(false)}
              >
                Tutup
              </button>
            </div>
            <div
              className="modal-body"
              style={{ flexDirection: "column", gap: 10 }}
            >
              <div style={{ color: "#e2e8f0", fontWeight: 600 }}>
                Apakah Anda yakin ingin logout?
              </div>
              <div style={{ color: "#94a3b8", fontSize: 14 }}>
                Sesi Anda akan diakhiri dan Anda akan kembali ke halaman login.
              </div>
            </div>
            <div
              className="modal-footer"
              style={{ justifyContent: "flex-end", gap: 10 }}
            >
              <button
                className="btn ghost"
                onClick={() => setShowLogoutModal(false)}
              >
                Batal
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  (async () => {
                    try {
                      if (supabase) await supabase.auth.signOut();
                    } catch {}
                    try {
                      await fetch("/api/session/logout", { method: "POST" });
                    } catch (_) {}
                    try {
                      document.cookie = "plan=; path=/; max-age=0";
                      document.cookie = "uid=; path=/; max-age=0";
                      document.cookie = "email=; path=/; max-age=0";
                      document.cookie = "name=; path=/; max-age=0";
                      document.cookie = "username=; path=/; max-age=0";
                    } catch (_) {}
                    window.location.href = "/login";
                  })();
                }}
              >
                Ya, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
