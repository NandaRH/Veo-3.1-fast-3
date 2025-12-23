"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ProfileClient() {
  const [isFree, setIsFree] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const userMenuRef = useRef(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

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
    try {
      const m = document.cookie.match(/(?:^|; )plan=([^;]+)/);
      const p = (m && m[1] ? decodeURIComponent(m[1]) : "").toLowerCase();
      setIsFree(p === "free");
    } catch (_) {}
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
          return;
        }
        const uid = session.user.id;
        const uemail = session.user.email || "";
        setEmail(uemail);
        const { data: profile } = await supabase
          .from("users")
          .select("full_name,email")
          .eq("id", uid)
          .single();
        if (profile) {
          setName(profile.full_name || "");
          setEmail(profile.email || uemail);
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

  return (
    <div className="app-shell prompt-shell">
      <header className="page-header">
        <div className="page-brand">
          <img src="/images/fokusAI.png" alt="FokusAI" className="brand-logo" />
          <div className="brand-text">
            <span className="page-badge">FokusAI Studio</span>
            <h1 className="page-title">Profil Pengguna</h1>
            <p className="page-subtitle">
              Informasi umum akun, ganti foto profil, nama, dan kata sandi.
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
              <div className="user-menu-divider"></div>
            </div>
          </div>
        </div>
      </header>

      <div className="feature-card" style={{ gap: 14 }}>
        <div
          className="feature-title"
          style={{ fontSize: 16, marginBottom: 2 }}
        >
          Informasi Umum
        </div>
        <label style={{ color: "#cbd5e1", fontSize: 13 }}>Nama Pengguna</label>
        <input
          className="dropdown"
          type="text"
          placeholder="Nama Anda"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%" }}
        />

        <label style={{ color: "#cbd5e1", fontSize: 13, marginTop: 6 }}>
          Email (tidak dapat diubah)
        </label>
        <input
          className="dropdown"
          type="email"
          value={email}
          readOnly
          style={{ width: "100%", opacity: 0.7, cursor: "not-allowed" }}
        />

        <div className="feature-sub" style={{ marginTop: 6, color: "#b8a97a" }}>
          Untuk mengganti email, hubungi admin atau dukungan.
        </div>
        <div
          style={{
            height: 1,
            background: "rgba(255,255,255,0.08)",
            margin: "24px 0",
          }}
        />

        <div className="feature-title" style={{ fontSize: 16 }}>
          Ganti Kata Sandi
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ color: "#cbd5e1", fontSize: 13 }}>
              Kata Sandi Baru
            </label>
            <input
              className="dropdown"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ color: "#cbd5e1", fontSize: 13 }}>
              Konfirmasi Kata Sandi
            </label>
            <input
              className="dropdown"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>
        <div className="feature-sub" style={{ marginTop: 4 }}>
          Pastikan kata sandi minimal 8 karakter.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            className="btn primary"
            type="button"
            onClick={() => {
              (async () => {
                try {
                  if (busy) return;
                  setBusy(true);
                  setStatus("");
                  if (!supabase) return;
                  const {
                    data: { user },
                  } = await supabase.auth.getUser();
                  if (!user) {
                    setStatus("Harus login.");
                    return;
                  }
                  if ((name || "").trim()) {
                    await supabase
                      .from("users")
                      .update({ full_name: String(name).trim() })
                      .eq("id", user.id);
                    try {
                      await supabase.auth.updateUser({
                        data: { name: String(name).trim() },
                      });
                    } catch (_) {}
                    try {
                      document.cookie = `username=${encodeURIComponent(
                        String(name).trim()
                      )}; path=/; max-age=${60 * 60 * 24 * 30}`;
                      document.cookie = `name=${encodeURIComponent(
                        String(name).trim()
                      )}; path=/; max-age=${60 * 60 * 24 * 30}`;
                    } catch (_) {}
                  }
                  if ((newPassword || confirmPassword).trim()) {
                    if (newPassword !== confirmPassword) {
                      setStatus("Konfirmasi password tidak cocok.");
                      return;
                    }
                    await supabase.auth.updateUser({ password: newPassword });
                  }
                  setStatus("Perubahan tersimpan.");
                } catch (e) {
                  setStatus(String(e?.message || e || "Gagal menyimpan"));
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Simpan Perubahan
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              setNewPassword("");
              setConfirmPassword("");
              setStatus("");
            }}
          >
            Batalkan
          </button>
        </div>
        {status ? (
          <div className="feature-sub" style={{ marginTop: 6 }}>
            {status}
          </div>
        ) : null}
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
