"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function AdminDashboardPage() {
  const [plan, setPlan] = useState("admin");
  const [userName, setUserName] = useState("Admin");
  const [now, setNow] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [soraCredits, setSoraCredits] = useState(0);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditStatus, setCreditStatus] = useState("");
  const [creditBusy, setCreditBusy] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      document.title = "Admin Dashboard | Fokus AI";
    } catch (_) {}
  }, []);

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
        const nm = String(session.user.user_metadata?.name || "").trim();
        if (nm) setUserName(nm);
        try {
          const token = String(session.access_token || "");
          if (token) {
            const r = await fetch("/api/admin/credits", {
              headers: { Authorization: `Bearer ${token}` },
            });
            const d = await r.json();
            const n = Number(d?.credits?.sora2 || 0);
            if (Number.isFinite(n)) setSoraCredits(n);
          }
        } catch (_) {}
        try {
          const m = document.cookie.match(/(?:^|; )plan=([^;]+)/);
          const p = (m && m[1] ? decodeURIComponent(m[1]) : "").toLowerCase();
          setPlan(p || "admin");
          if (p !== "admin") window.location.href = "/dashboard";
        } catch (_) {}
      } catch (_) {}
    })();
    try {
      setNow(new Date().toISOString());
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

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setShowLogoutModal(false);
    };
    if (showLogoutModal) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showLogoutModal]);

  const planText = useMemo(() => "Admin", []);

  return (
    <div
      className="app-shell prompt-shell"
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <header className="page-header" style={{ position: "relative" }}>
        <div className="page-brand">
          <img src="/images/fokusAI.png" alt="FokusAI" className="brand-logo" />
          <div className="brand-text">
            <span className="page-badge">FokusAI Studio</span>
            <h1 className="page-title">Admin Dashboard</h1>
            <p className="page-subtitle">Kelola sistem dan pengguna.</p>
          </div>
        </div>
        <div
          style={{ display: "flex", gap: 8, alignItems: "center" }}
          ref={userMenuRef}
        >
          <button
            className="settings-btn"
            title="Credits Sora 2"
            onClick={(e) => {
              e.preventDefault();
              setShowCreditModal(true);
            }}
          >
            <span aria-hidden="true">💳</span>
            <span className="sr-only">Credits Sora 2</span>
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
              {new Intl.NumberFormat("id-ID").format(soraCredits)}
            </span>
          </button>
          <a
            href="/prompt-tunggal"
            className="settings-btn"
            title="Video Generator"
          >
            <span aria-hidden="true">🎬</span>
            <span className="sr-only">Video Generator</span>
          </a>
          <a
            href="/image-generator"
            className="settings-btn"
            title="Image Generator"
          >
            <span aria-hidden="true">🖼️</span>
            <span className="sr-only">Image Generator</span>
          </a>
          <a href="/sora2" className="settings-btn" title="Sora 2">
            <span aria-hidden="true">🎞️</span>
            <span className="sr-only">Sora 2</span>
          </a>
          <a
            href="/browser-mode"
            className="settings-btn"
            title="Browser Mode (Anti-CAPTCHA)"
            style={{
              background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(123,47,247,0.2))",
              border: "1px solid rgba(0,212,255,0.4)",
            }}
          >
            <span aria-hidden="true">🌐</span>
            <span className="sr-only">Browser Mode</span>
          </a>
          <div className="user-menu">
            <button
              className="settings-btn user-btn"
              aria-haspopup="true"
              aria-expanded={showUserMenu ? "true" : "false"}
              title="Admin menu"
              onClick={(e) => {
                e.preventDefault();
                setShowUserMenu((v) => !v);
              }}
            >
              <span aria-hidden="true">👤</span>
              <span className="sr-only">Admin menu</span>
            </button>
            <div
              className={`user-menu-dropdown ${showUserMenu ? "show" : ""}`}
              hidden={!showUserMenu}
            >
              {pathname !== "/admin/dashboard" ? (
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
              ) : null}
              {pathname !== "/admin/users" ? (
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
              ) : null}
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

      <main
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 18,
          padding: 24,
        }}
      >
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: 700, color: "#f4d03f" }}>
              Akun Admin
            </span>
            <span
              style={{ fontSize: 12, color: "#b8a97a" }}
              suppressHydrationWarning
            >
              {now ? new Date(now).toLocaleString("id-ID") : "—"}
            </span>
          </div>
          <div style={{ color: "#e2e8f0" }}>Nama: {userName}</div>
          <div style={{ color: "#e2e8f0" }}>Peran: {planText}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <a className="btn gold" href="/admin/users">
              Kelola Users
            </a>
          </div>
        </section>
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontWeight: 700, color: "#f4d03f" }}>
            Ringkasan Sistem
          </div>
          <div style={{ color: "#94a3b8" }}>
            Gunakan menu untuk navigasi administrasi.
          </div>
        </section>
      </main>

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

      {showCreditModal && (
        <div
          className="modal show"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreditModal(false);
          }}
          style={{ backdropFilter: "blur(10px)" }}
        >
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 700, color: "#f4d03f" }}>
                Tambah Credits Sora 2
              </div>
              <button
                className="btn ghost"
                onClick={() => setShowCreditModal(false)}
              >
                Tutup
              </button>
            </div>
            <div
              className="modal-body"
              style={{ flexDirection: "column", gap: 10 }}
            >
              <div style={{ color: "#e2e8f0", fontWeight: 600 }}>
                Isi jumlah credit yang ingin ditambahkan.
              </div>
              <input
                type="number"
                className="dropdown"
                placeholder="Masukkan angka"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
              />
              <div style={{ color: "#94a3b8", fontSize: 13 }}>
                Saldo saat ini: {new Intl.NumberFormat("id-ID").format(soraCredits)}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>{creditStatus}</div>
            </div>
            <div className="modal-footer" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button className="btn ghost" onClick={() => setShowCreditModal(false)}>
                Batal
              </button>
              <button
                className="btn primary"
                disabled={creditBusy}
                onClick={() => {
                  (async () => {
                    try {
                      setCreditBusy(true);
                      setCreditStatus("Memproses...");
                      const amt = Number(creditAmount || 0);
                      if (!Number.isFinite(amt)) {
                        setCreditStatus("Jumlah tidak valid");
                        setCreditBusy(false);
                        return;
                      }
                      const {
                        data: { session },
                      } = await supabase.auth.getSession();
                      const token = String(session?.access_token || "");
                      const resp = await fetch("/api/admin/credits/add", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ amount: amt }),
                      });
                      const data = await resp.json();
                      if (!resp.ok) {
                        setCreditStatus(String(data?.error || "Gagal"));
                        setCreditBusy(false);
                        return;
                      }
                      const n = Number(data?.credits?.sora2 || 0);
                      setSoraCredits(Number.isFinite(n) ? n : 0);
                      setCreditStatus("Berhasil ditambahkan");
                      setCreditAmount("");
                    } catch (e) {
                      setCreditStatus(String(e?.message || e || ""));
                    } finally {
                      setCreditBusy(false);
                    }
                  })();
                }}
              >
                Tambah
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
