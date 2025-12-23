"use client";

import { useState, useLayoutEffect, useEffect } from "react"; // Tambah useLayoutEffect
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    try {
      document.title = "Register | Fokus AI";
    } catch (_) {}
  }, []);

  // --- TAMBAHAN: FORCE STYLE BODY ---
  useLayoutEffect(() => {
    // Paksa tambah class 'route-login' ke body saat halaman ini dimuat
    document.body.classList.add("route-login");

    // Hapus class saat pindah ke halaman lain (cleanup)
    return () => {
      document.body.classList.remove("route-login");
    };
  }, []);
  // ----------------------------------

  const REGISTER_LIMIT_KEY = "register.limit";
  const todayStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const s = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${s}`;
  };
  const checkRegisterLimit = () => {
    try {
      const MIN_INTERVAL_MS = 60 * 1000; // minimal jeda 1 menit
      const MAX_PER_DAY = 5; // maksimal 5 percobaan per hari per browser
      const now = Date.now();
      let raw = "";
      try {
        raw = localStorage.getItem(REGISTER_LIMIT_KEY) || "";
      } catch (_) {}
      let obj = {};
      try {
        obj = raw ? JSON.parse(raw) : {};
      } catch (_) {
        obj = {};
      }
      const today = todayStr();
      if (!obj || obj.date !== today) {
        obj = { date: today, count: 0, lastTs: 0 };
      }
      const lastTs = Number(obj.lastTs || 0);
      const count = Number(obj.count || 0);
      if (count >= MAX_PER_DAY) {
        setStatus("Percobaan registrasi hari ini sudah mencapai batas.");
        return false;
      }
      if (lastTs && now - lastTs < MIN_INTERVAL_MS) {
        setStatus("Terlalu sering mencoba. Tunggu sebentar sebelum mencoba lagi.");
        return false;
      }
      const next = {
        date: today,
        count: count + 1,
        lastTs: now,
      };
      try {
        localStorage.setItem(REGISTER_LIMIT_KEY, JSON.stringify(next));
      } catch (_) {}
      return true;
    } catch (_) {
      // Jika ada error, jangan blokir registrasi
      return true;
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim() || !confirm.trim()) {
      setStatus("Isi semua field.");
      return;
    }
    if (password !== confirm) {
      setStatus("Konfirmasi password tidak cocok.");
      return;
    }
    if (!checkRegisterLimit()) {
      return;
    }
    try {
      setBusy(true);
      // Reset pesan status setiap submit ulang
      setStatus("");
      if (!supabase) {
        setStatus("Konfigurasi Supabase belum diset.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          // Paksa Supabase mengirim link verifikasi ke URL produksi
          // setelah user klik "Confirm your mail".
          emailRedirectTo: "https://fokusai.fun/login",
          data: { name: name.trim(), full_name: name.trim(), plan: "free" },
        },
      });

      // Jika Supabase mengembalikan error
      if (error) {
        const rawMsg = (error.message || "").toLowerCase();

        // Mapping khusus jika email sudah pernah digunakan / terdaftar
        if (
          rawMsg.includes("already registered") ||
          rawMsg.includes("already exists") ||
          rawMsg.includes("user already exists") ||
          rawMsg.includes("user already registered")
        ) {
          setStatus("Email Sudah Terdaftar");
        } else {
          setStatus(error.message || "Gagal mendaftar");
        }
        return;
      }

      // Pola resmi dari Supabase:
      // kalau signUp dipanggil lagi dengan email yang sama,
      // sering kali TIDAK ada error, tapi identities = [] (kosong).
      const identities = data?.user?.identities;
      if (Array.isArray(identities) && identities.length === 0) {
        setStatus("Email Sudah Terdaftar");
        return; // jangan redirect ke login
      }

      setStatus("Registrasi berhasil. Silakan login.");
      router.push("/login");
    } finally {
      setBusy(false);
    }
  };

  return (
    // Pastikan class 'page-login' ada di sini juga untuk mengambil style layout login
    <div className="app-shell no-bg page-login page-register">
      <div className="hero-circuit-bg" />
      <div className="landing-gold-bg" />
      <div className="landing-gold-stars" />

      <div className="login-layout">
        <div className="login-media">
          <video
            className="login-video"
            src="/video/videologin.mp4"
            autoPlay
            muted
            loop
            playsInline
          />
          <div className="login-media-caption">
            Create your account to explore.
          </div>
        </div>

        <div className="login-panel">
          <a
            href="/landing"
            className="btn ghost login-back"
            aria-label="Kembali ke halaman utama"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                d="M15 6l-6 6 6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 12h10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Kembali</span>
          </a>

          <div className="page-brand" style={{ alignItems: "center" }}>
            <img
              src="/images/fokusAI.png"
              alt="FokusAI"
              className="brand-logo"
              style={{ width: 40, height: 40, borderRadius: 12 }}
            />
            <div className="brand-text">
              <span className="page-badge">FokusAI Studio</span>
            </div>
          </div>

          <h1 className="login-title">Buat Akun</h1>
          <p className="login-subtitle">
            Daftar untuk mulai menggunakan generator.
          </p>

          <form
            onSubmit={onSubmit}
            className="card"
            style={{ gap: 16, opacity: 1 }}
          >
            <div className="input-wrap">
              <svg className="icon" viewBox="0 0 24 24">
                <path
                  d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M4 21v-1c0-3.866 3.582-7 8-7s8 3.134 8 7v1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
              <input
                type="text"
                className="dropdown"
                placeholder="Username"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="input-wrap">
              <svg className="icon" viewBox="0 0 24 24">
                <path
                  d="M3 5h18v14H3z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M3 6l9 7 9-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
              <input
                type="email"
                className="dropdown"
                placeholder="Email Address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  // Hapus pesan error saat user mengubah email
                  if (status) setStatus("");
                }}
              />
            </div>

            <div className="input-wrap password-wrap">
              <svg className="icon" viewBox="0 0 24 24">
                <rect
                  x="5"
                  y="11"
                  width="14"
                  height="9"
                  rx="2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M8 11V8a4 4 0 018 0v3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
              <input
                type={showPwd ? "text" : "password"}
                className="dropdown"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="eye-toggle"
                aria-label={
                  showPwd ? "Sembunyikan password" : "Tampilkan password"
                }
                onClick={() => setShowPwd((v) => !v)}
              >
                {showPwd ? (
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path
                      d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path
                      d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <line
                      x1="3"
                      y1="3"
                      x2="21"
                      y2="21"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                  </svg>
                )}
              </button>
            </div>

            <div className="input-wrap password-wrap">
              <svg className="icon" viewBox="0 0 24 24">
                <rect
                  x="5"
                  y="11"
                  width="14"
                  height="9"
                  rx="2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M8 11V8a4 4 0 018 0v3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
              <input
                type={showConfirm ? "text" : "password"}
                className="dropdown"
                placeholder="Konfirmasi Password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <button
                type="button"
                className="eye-toggle"
                aria-label={
                  showConfirm
                    ? "Sembunyikan konfirmasi"
                    : "Tampilkan konfirmasi"
                }
                onClick={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? (
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path
                      d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path
                      d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <line
                      x1="3"
                      y1="3"
                      x2="21"
                      y2="21"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                  </svg>
                )}
              </button>
            </div>

            <button className="btn gold wide" type="submit" disabled={busy}>
              {busy ? "Memproses..." : "Daftar"}
            </button>

            <div className="settings-help">
              Sudah punya akun? <a href="/login">Masuk</a>
            </div>
            {status ? (
              <div className="settings-help" style={{ color: "#f5d876" }}>
                {status}
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
