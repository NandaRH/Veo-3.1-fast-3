"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

const PLAN_LABEL = {
  free: "Gratis",
  veo_lifetime: "Veo 3.1 — Lifetime",
  veo_sora_unlimited: "Veo 3.1 + Sora 2 — Unlimited",
  monthly: "Perbulan",
};

export default function DashboardPage() {
  const [plan, setPlan] = useState("free");
  const [userName, setUserName] = useState("Pengguna FokusAI");
  const [expiryText, setExpiryText] = useState("");
  const [stats, setStats] = useState({
    veoVideo: 0,
    soraVideo: 0,
    veoImage: 0,
    nanoBanana: 0,
    nanoBananaPro: 0,
    imagen4: 0,
  });
  const [now, setNow] = useState("");
  const bgRef = useRef(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [credits, setCredits] = useState(0);
  const [creditScope, setCreditScope] = useState("none");

  useEffect(() => {
    try {
      document.title = "Dashboard | Fokus AI";
    } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      const m = document.cookie.match(/(?:^|; )plan=([^;]+)/);
      const p = (m && m[1] ? decodeURIComponent(m[1]) : "").toLowerCase();
      setPlan(p || "free");
    } catch (_) {}
    try {
      const u = document.cookie.match(/(?:^|; )username=([^;]+)/);
      const name = u && u[1] ? decodeURIComponent(u[1]) : "";
      setUserName(name || "Pengguna FokusAI");
    } catch (_) {}
    try {
      const read = (k) => parseInt(localStorage.getItem(k) || "0", 10) || 0;
      setStats({
        veoVideo: read("stat.veo.video.success"),
        soraVideo: read("stat.sora.video.success"),
        veoImage: read("stat.veo.image.success"),
        nanoBanana: read("stat.image.model.nano-banana"),
        nanoBananaPro: read("stat.image.model.nano-banana-pro"),
        imagen4: read("stat.image.model.imagen-4"),
      });
    } catch (_) {}
    try {
      setNow(new Date().toISOString());
    } catch (_) {}
  }, []);

  const refreshCredits = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = String(session?.access_token || "");
      if (!token) return;
      const r = await fetch("/api/me/credits", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (r.ok) {
        setCredits(Number(d?.credits || 0));
        setCreditScope(String(d?.scope || "none"));
      }
    } catch (_) {}
  };
  useEffect(() => {
    if (plan === "veo_sora_unlimited") refreshCredits();
  }, [plan]);

  // Dengarkan event realtime plan yang dipush dari PlanSync (SSE)
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
    let timer = null;
    const updateText = (expMs) => {
      try {
        const now = Date.now();
        const diff = Math.max(0, Number(expMs || 0) - now);
        const d = Math.floor(diff / (24 * 60 * 60 * 1000));
        const h = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
        setExpiryText(
          d > 0
            ? `${d} hari lagi`
            : h > 0
            ? `${h} jam ${m} menit lagi`
            : `${m} menit lagi`
        );
      } catch (_) {}
    };
    const init = async () => {
      try {
        if (plan !== "monthly") {
          setExpiryText("");
          return;
        }
        const ce = document.cookie.match(/(?:^|; )planExpiry=([^;]+)/);
        let exp = ce && ce[1] ? Number(decodeURIComponent(ce[1])) : 0;
        if (!exp || !isFinite(exp)) {
          if (supabase) {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            const token = String(session?.access_token || "");
            if (token) {
              const r = await fetch("/api/me/plan", {
                headers: { Authorization: `Bearer ${token}` },
              });
              const d = await r.json();
              const pe = Number(d?.expiry || 0);
              if (isFinite(pe) && pe > 0) {
                exp = pe;
                document.cookie = `planExpiry=${encodeURIComponent(
                  String(pe)
                )}; path=/; max-age=${60 * 60 * 24 * 30}`;
              }
            }
          }
        }
        updateText(exp);
        timer = setInterval(() => updateText(exp), 60000);
      } catch (_) {}
    };
    init();
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [plan]);

  useEffect(() => {
    (async () => {
      try {
        if (!supabase) return;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          window.location.href = "/login";
          return;
        }
        const nm = String(session.user.user_metadata?.name || "").trim();
        if (nm) setUserName(nm);
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setShowLogoutModal(false);
    };
    if (showLogoutModal) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showLogoutModal]);

  const planText = useMemo(() => PLAN_LABEL[plan] || PLAN_LABEL.free, [plan]);
  const totalVideo = useMemo(() => stats.veoVideo + stats.soraVideo, [stats]);
  const totalImage = useMemo(
    () => stats.nanoBanana + stats.nanoBananaPro + stats.imagen4,
    [stats]
  );
  const totalAll = useMemo(
    () => totalVideo + totalImage,
    [totalVideo, totalImage]
  );
  const fmt = (n) => new Intl.NumberFormat("id-ID").format(n);
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const isFree = plan === "free";

  useEffect(() => {
    const root = bgRef.current;
    if (!root) return;
    const orbs = Array.from(root.querySelectorAll("[data-orb]"));
    orbs.forEach((el, i) => {
      const dx = (Math.random() * 80 + 40) * (i % 2 ? 1 : -1);
      const dy = (Math.random() * 60 + 30) * (i % 3 ? 1 : -1);
      el.animate(
        [
          { transform: "translate(0px, 0px)" },
          { transform: `translate(${dx}px, ${dy}px)` },
        ],
        {
          duration: 9000 + i * 1500,
          iterations: Infinity,
          direction: "alternate",
          easing: "ease-in-out",
        }
      );
    });
    const waves = Array.from(root.querySelectorAll("[data-wave]"));
    waves.forEach((el, i) => {
      el.animate(
        [
          { transform: "translateY(0px) rotate(0deg)" },
          { transform: "translateY(-20px) rotate(2deg)" },
          { transform: "translateY(0px) rotate(0deg)" },
        ],
        {
          duration: 12000 + i * 1000,
          iterations: Infinity,
          easing: "ease-in-out",
        }
      );
    });
  }, []);

  return (
    <div
      className="app-shell prompt-shell"
      style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}
    >
      <div
        ref={bgRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(1000px 600px at 50% 100%, rgba(255,215,0,0.06), rgba(0,0,0,0.9))",
          }}
        />
        <div
          data-orb
          style={{
            position: "absolute",
            top: -80,
            left: -60,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background:
              "radial-gradient(140px 140px at 30% 40%, rgba(255,215,0,0.12), transparent 62%)",
            filter: "blur(6px)",
            opacity: 0.9,
          }}
        />
        <div
          data-orb
          style={{
            position: "absolute",
            bottom: -60,
            right: -80,
            width: 460,
            height: 460,
            borderRadius: "50%",
            background:
              "radial-gradient(180px 180px at 70% 60%, rgba(0,0,0,0.45), transparent 70%)",
          }}
        />
        <div
          data-orb
          style={{
            position: "absolute",
            top: 140,
            right: 120,
            width: 240,
            height: 240,
            borderRadius: "50%",
            background:
              "radial-gradient(120px 120px at 50% 50%, rgba(255,215,0,0.10), transparent 65%)",
            filter: "blur(8px)",
            opacity: 0.85,
          }}
        />
        <div
          data-orb
          style={{
            position: "absolute",
            bottom: 160,
            left: 80,
            width: 280,
            height: 280,
            borderRadius: "50%",
            background:
              "radial-gradient(120px 120px at 50% 50%, rgba(10,10,10,0.58), transparent 68%)",
          }}
        />
        <div
          data-wave
          style={{
            position: "absolute",
            left: "-10%",
            right: "-10%",
            top: "40%",
            height: 140,
            background:
              "linear-gradient(90deg, rgba(255,215,0,0.07), rgba(0,0,0,0.0), rgba(255,215,0,0.07))",
            filter: "blur(14px)",
            opacity: 0.7,
            borderRadius: 120,
          }}
        />
        <div
          data-wave
          style={{
            position: "absolute",
            left: "-10%",
            right: "-10%",
            bottom: "18%",
            height: 160,
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.4), rgba(255,215,0,0.06), rgba(0,0,0,0.4))",
            filter: "blur(16px)",
            opacity: 0.6,
            borderRadius: 140,
          }}
        />
      </div>
      <header className="page-header" style={{ position: "relative" }}>
        <div className="page-brand">
          <img src="/images/fokusAI.png" alt="FokusAI" className="brand-logo" />
          <div className="brand-text">
            <span className="page-badge">FokusAI Studio</span>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">
              Ringkasan akun & aktivitas generate.
            </p>
          </div>
        </div>
        <div
          style={{ display: "flex", gap: 8, alignItems: "center" }}
          ref={userMenuRef}
        >
          {plan === "veo_sora_unlimited" ? (
            <button
              className="settings-btn"
              title="Credits"
              onClick={(e) => e.preventDefault()}
            >
              <span aria-hidden="true">💳</span>
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
                {new Intl.NumberFormat("id-ID").format(credits)}
              </span>
            </button>
          ) : null}
          <a
            href="/prompt-tunggal"
            className="settings-btn"
            title="Video Generator"
            aria-disabled={isFree ? "true" : undefined}
            tabIndex={isFree ? -1 : 0}
            style={isFree ? { opacity: 0.5, pointerEvents: "none" } : undefined}
          >
            <span aria-hidden="true">🎬</span>
            <span className="sr-only">Video Generator</span>
          </a>
          <a
            href="/image-generator"
            className="settings-btn"
            title="Image Generator"
            aria-disabled={isFree ? "true" : undefined}
            tabIndex={isFree ? -1 : 0}
            style={isFree ? { opacity: 0.5, pointerEvents: "none" } : undefined}
          >
            <span aria-hidden="true">🖼️</span>
            <span className="sr-only">Image Generator</span>
          </a>
          <a
            href="/sora2"
            className="settings-btn"
            title="Sora 2"
            aria-disabled={
              isFree || plan === "veo_lifetime" ? "true" : undefined
            }
            tabIndex={isFree || plan === "veo_lifetime" ? -1 : 0}
            style={
              isFree || plan === "veo_lifetime"
                ? { opacity: 0.5, pointerEvents: "none" }
                : undefined
            }
          >
            <span aria-hidden="true">🎞️</span>
            <span className="sr-only">Sora 2</span>
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
            </div>
          </div>
        </div>
      </header>

      <div style={{ padding: 24, gap: 18 }}>
        <div
          className="features-grid"
          style={{
            marginTop: 6,
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          }}
        >
          <div className="feature-card" style={{ gap: 12 }}>
            <div
              className="feature-title"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Akun</span>
              <span
                style={{ fontSize: 12, color: "#b8a97a" }}
                suppressHydrationWarning
              >
                {now ? new Date(now).toLocaleString("id-ID") : "—"}
              </span>
            </div>
            <div className="feature-sub">Nama: {userName}</div>
            <div className="feature-sub">Paket Aktif: {planText}</div>
            {plan === "monthly" && expiryText ? (
              <div className="feature-sub" style={{ color: "#b8a97a" }}>
                Masa aktif: {expiryText}
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <a className="btn ghost" href="/profile">
                Kelola Profil
              </a>
              <a className="btn ghost" href="/credit">
                Kelola Paket
              </a>
            </div>
          </div>

          <div className="feature-card" style={{ gap: 12 }}>
            <div className="feature-title">Ringkasan</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(15,12,10,0.45)",
                  border: "1px solid rgba(255,215,0,0.12)",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ color: "#b8a97a", fontSize: 12 }}>Total</div>
                <div
                  style={{ fontSize: 26, fontWeight: 800, color: "#f5e6d3" }}
                >
                  {fmt(totalAll)}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  Video {fmt(totalVideo)} · Image {fmt(totalImage)}
                </div>
              </div>
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(12,20,32,0.5)",
                  border: "1px solid #334155",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ color: "#9dbbf2", fontSize: 12 }}>Veo Video</div>
                <div
                  style={{ fontSize: 24, fontWeight: 800, color: "#bcd0ff" }}
                >
                  {fmt(stats.veoVideo)}
                </div>
                <div
                  style={{ height: 6, borderRadius: 6, background: "#0b1220" }}
                >
                  <div
                    style={{
                      width: `${pct(stats.veoVideo, Math.max(1, totalVideo))}%`,
                      height: 6,
                      borderRadius: 6,
                      background: "linear-gradient(90deg,#1e3a8a,#2563eb)",
                    }}
                  ></div>
                </div>
              </div>
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(12,20,32,0.5)",
                  border: "1px solid #334155",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ color: "#9dbbf2", fontSize: 12 }}>Sora Video</div>
                <div
                  style={{ fontSize: 24, fontWeight: 800, color: "#bcd0ff" }}
                >
                  {fmt(stats.soraVideo)}
                </div>
                <div
                  style={{ height: 6, borderRadius: 6, background: "#0b1220" }}
                >
                  <div
                    style={{
                      width: `${pct(
                        stats.soraVideo,
                        Math.max(1, totalVideo)
                      )}%`,
                      height: 6,
                      borderRadius: 6,
                      background: "linear-gradient(90deg,#7c3aed,#f59e0b)",
                    }}
                  ></div>
                </div>
              </div>
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(10,18,14,0.5)",
                  border: "1px solid #3b7a4c",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ color: "#84f0a3", fontSize: 12 }}>
                  Nano Banana
                </div>
                <div
                  style={{ fontSize: 24, fontWeight: 800, color: "#d5ffe6" }}
                >
                  {fmt(stats.nanoBanana)}
                </div>
              </div>
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(10,18,14,0.5)",
                  border: "1px solid #3b7a4c",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ color: "#84f0a3", fontSize: 12 }}>
                  Nano Banana Pro
                </div>
                <div
                  style={{ fontSize: 24, fontWeight: 800, color: "#d5ffe6" }}
                >
                  {fmt(stats.nanoBananaPro)}
                </div>
              </div>
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(10,18,14,0.5)",
                  border: "1px solid #3b7a4c",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ color: "#84f0a3", fontSize: 12 }}>Imagen 4</div>
                <div
                  style={{ fontSize: 24, fontWeight: 800, color: "#d5ffe6" }}
                >
                  {fmt(stats.imagen4)}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}></div>
          </div>
        </div>
      </div>
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
