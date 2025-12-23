"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Image from "next/image";

export default function LanggananPage() {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const [isFree, setIsFree] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [plan, setPlan] = useState("free");
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    try {
      document.title = "Langganan | Fokus AI";
    } catch (_) {}
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

  const refreshCredits = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = String(session?.access_token || "");
      if (!token) return;
      const rMe = await fetch("/api/me/credits", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dM = await rMe.json();
      if (rMe.ok) {
        setCredits(Number(dM?.credits || 0));
      }
    } catch (_) {}
  };
  useEffect(() => {
    refreshCredits();
  }, []);
  useEffect(() => {
    if (plan === "veo_sora_unlimited") refreshCredits();
  }, [plan]);

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
    try {
      const m = document.cookie.match(/(?:^|; )plan=([^;]+)/);
      const p = (m && m[1] ? decodeURIComponent(m[1]) : "").toLowerCase();
      setIsFree(p === "free");
      setPlan(p || "free");
    } catch (_) {}
  }, []);

  // Realtime sinkron plan dari PlanSync (SSE)
  useEffect(() => {
    const handler = (e) => {
      try {
        const p = String(e.detail?.plan || "").toLowerCase();
        if (!p) return;
        setPlan(p);
        setIsFree(p === "free");
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
    const onKey = (e) => {
      if (e.key === "Escape") setShowLogoutModal(false);
    };
    if (showLogoutModal) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showLogoutModal]);

  return (
    <div className="app-shell prompt-shell">
      <header className="page-header">
        <div className="page-brand">
          <Image
            src="/images/fokusAI.png"
            alt="FokusAI"
            className="brand-logo"
            width={50}
            height={50}
            priority
          />
          <div className="brand-text">
            <span className="page-badge">FokusAI Studio</span>
            <h1 className="page-title">Langganan</h1>
            <p className="page-subtitle">
              Ubah paket, kelola penagihan, atau batalkan langganan Anda.
            </p>
          </div>
        </div>
        <div
          style={{ display: "flex", gap: 8, alignItems: "center" }}
          ref={userMenuRef}
        >
          <a
            className="settings-btn"
            href="/prompt-tunggal"
            title="Video Generator"
            aria-disabled={isFree ? "true" : undefined}
            tabIndex={isFree ? -1 : 0}
            style={isFree ? { opacity: 0.5, pointerEvents: "none" } : undefined}
          >
            <span aria-hidden="true">🎬</span>
            <span className="sr-only">Video Generator</span>
          </a>
          <a
            className="settings-btn"
            href="/image-generator"
            title="Image Generator"
            aria-disabled={isFree ? "true" : undefined}
            tabIndex={isFree ? -1 : 0}
            style={isFree ? { opacity: 0.5, pointerEvents: "none" } : undefined}
          >
            <span aria-hidden="true">🎨</span>
            <span className="sr-only">Image Generator</span>
          </a>
          <span
            className="settings-btn disabled"
            aria-disabled="true"
            title="Music (disabled)"
          >
            <span aria-hidden="true">🎵</span>
            <span className="sr-only">Music (disabled)</span>
          </span>
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
                  setShowLogoutModal(true);
                  setShowUserMenu(false);
                }}
              >
                <span aria-hidden="true">🚪</span>
                <span>Logout</span>
              </button>
              <div className="user-menu-divider"></div>
            </div>
          </div>
        </div>
      </header>

      <div className="card" style={{ padding: 28, gap: 18 }}>
        <div className="feature-card" style={{ gap: 12 }}>
          <div className="feature-title" style={{ fontSize: 18 }}>
            {plan === "free"
              ? "Langganan Aktif — Gratis"
              : plan === "veo_lifetime"
              ? "Langganan Aktif — Veo 3.1 Lifetime"
              : plan === "veo_sora_unlimited"
              ? "Langganan Aktif — Veo 3.1 + Sora 2 Unlimited"
              : "Langganan Aktif — Perbulan"}
          </div>
          <div className="feature-sub" style={{ fontSize: 14 }}>
            {plan === "free"
              ? "Anda menggunakan paket Gratis"
              : plan === "veo_lifetime"
              ? "Bayar sekali, akses selamanya"
              : plan === "veo_sora_unlimited"
              ? "Paket terlengkap, aktif selamanya"
              : "Berlangganan per bulan dengan fitur penuh"}
          </div>
        </div>

        {plan !== "veo_sora_unlimited" && (
          <div
            className="features-grid"
            style={{
              marginTop: 6,
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            }}
          >
            {(() => {
              const pk = {
                lifetime: {
                  title: "Veo 3.1 — Lifetime",
                  price: "300k",
                  sub: "Bayar sekali, akses selamanya.",
                  features: [
                    "Akses Penuh Dashboard",
                    "Generate Video (Unlimited)",
                    "Generate Image (Unlimited)",
                    "Generate Music (Unlimited)",
                    "Teknologi Veo 3.1",
                  ],
                  exclude: ["Teknologi Sora 2"],
                  href: "https://lynk.id/fokusai17",
                  ctaClass: "btn gold",
                },
                unlimited: {
                  title: "Veo 3.1 + Sora 2 — Unlimited",
                  price: "370k",
                  sub: "Paket terlengkap, bayar sekali aktif selamanya.",
                  features: [
                    "Akses Penuh Dashboard",
                    "Generate Video (Unlimited)",
                    "Generate Image (Unlimited)",
                    "Generate Music (Unlimited)",
                    "Teknologi Veo 3.1",
                    "Teknologi Sora 2",
                  ],
                  exclude: [],
                  href: "https://lynk.id/fokusai17",
                  ctaClass: "btn gold",
                },
                monthly: {
                  title: "Perbulan",
                  price: "70k",
                  sub: "Berlangganan fleksibel dengan fitur penuh.",
                  features: [
                    "Akses Penuh Dashboard",
                    "Generate Video",
                    "Generate Image",
                    "Generate Music",
                    "Teknologi Veo 3.1",
                    "Teknologi Sora 2",
                  ],
                  exclude: [],
                  href: "https://lynk.id/fokusai17",
                  ctaClass: "btn primary",
                },
              };
              const visible =
                plan === "free"
                  ? ["lifetime", "unlimited", "monthly"]
                  : plan === "veo_lifetime"
                  ? ["unlimited"]
                  : plan === "monthly"
                  ? ["unlimited", "lifetime"]
                  : [];
              return visible.map((key) => {
                const v = pk[key];
                return (
                  <div key={key} className="feature-card" style={{ gap: 10 }}>
                    <div className="feature-title" style={{ fontSize: 16 }}>
                      {v.title}
                    </div>
                    <div className="feature-sub" style={{ fontSize: 14 }}>
                      {v.sub}
                    </div>
                    <div className="feature-title" style={{ fontSize: 32 }}>
                      {v.price}
                    </div>
                    <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
                      {v.features.map((text) => (
                        <div
                          key={text}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            color: "#f5e6d3",
                          }}
                        >
                          <span style={{ color: "#22c55e" }}>✔</span>
                          <span>{text}</span>
                        </div>
                      ))}
                      {v.exclude.map((text) => (
                        <div
                          key={text}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            color: "#f5e6d3",
                          }}
                        >
                          <span style={{ color: "#f87171" }}>✕</span>
                          <span>{text}</span>
                        </div>
                      ))}
                    </div>
                    <a
                      href={v.href}
                      className={v.ctaClass}
                      style={{ marginTop: 10 }}
                    >
                      Coba Sekarang
                    </a>
                  </div>
                );
              });
            })()}
          </div>
        )}

        <div className="feature-card" style={{ gap: 10 }}>
          <div className="feature-title" style={{ fontSize: 16 }}>
            Add-on & Credit
          </div>
          <div
            className="feature-sub"
            style={{
              fontSize: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>
              Tambah credit ekstra, seat tim, atau kapasitas render sesuai
              kebutuhan.
            </span>
            {plan === "veo_sora_unlimited" && (
              <span
                style={{
                  marginLeft: 10,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontSize: 12,
                  color: "#f8fafc",
                }}
              >
                Credit saat ini:{" "}
                {new Intl.NumberFormat("id-ID").format(credits)}
              </span>
            )}
          </div>
          {plan === "veo_sora_unlimited" && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a
                href="https://lynk.id/fokusai17/j4qmne076wok"
                className="btn primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Tambah Credit
              </a>
            </div>
          )}
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
