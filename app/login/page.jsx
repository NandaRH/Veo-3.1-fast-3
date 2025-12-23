"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    try {
      document.title = "Login | Fokus AI";
    } catch (_) {}
  }, []);

  const navigateDashboard = () => {
    try {
      router.push("/dashboard");
    } catch (_) {
      try {
        window.location.href = "/dashboard";
      } catch (_) {}
    }
  };

  const checkSessionAndRedirect = async () => {
    try {
      if (!supabase) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        try {
          const token = String(session.access_token || "");
          let plan = "";
          if (token) {
            const resp = await fetch("/api/me/plan", {
              headers: { Authorization: `Bearer ${token}` },
            });
            const pdata = await resp.json();
            plan = String(pdata?.plan || "").toLowerCase();
          }
          if (plan === "admin") {
            router.push("/admin/dashboard");
            return;
          }
        } catch (_) {}
        navigateDashboard();
      }
    } catch (_) {}
  };

  // No auto-redirect from login page; wait for explicit login

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setStatus("Isi email dan password.");
      return;
    }
    try {
      setBusy(true);
      setStatus("Mencoba masuk...");
      if (!supabase) {
        setStatus("Konfigurasi Supabase belum diset.");
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });
      if (error) {
        setStatus(error.message || "Gagal login");
        return;
      }
      setStatus("Berhasil login.");
      let dest = "/dashboard";
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = String(sessionData?.session?.access_token || "");
        let plan = "";
        if (token) {
          try {
            await fetch("/api/session/establish", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
          } catch (_) {}
          try {
            const resp = await fetch("/api/me/plan", {
              headers: { Authorization: `Bearer ${token}` },
            });
            const pdata = await resp.json();
            plan = String(pdata?.plan || "").toLowerCase();
            const pe = pdata?.expiry;
            try {
              if (
                plan === "monthly" &&
                (typeof pe === "number" || typeof pe === "string")
              ) {
                const n = Number(pe);
                if (isFinite(n) && n > 0)
                  document.cookie = `planExpiry=${encodeURIComponent(
                    String(n)
                  )}; path=/; max-age=${60 * 60 * 24 * 30}`;
              } else {
                document.cookie = "planExpiry=; path=/; max-age=0";
              }
            } catch (_) {}
          } catch (_) {}
        }
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const uname = String(user?.user_metadata?.name || "").trim();
        if (!plan)
          plan = String(user?.user_metadata?.plan || "free").toLowerCase();
        if (plan === "admin") {
          try {
            await supabase.auth.signOut();
          } catch (_) {}
          try {
            await fetch("/api/session/logout", { method: "POST" });
          } catch (_) {}
          setStatus("Akun admin. Gunakan halaman Admin Login.");
          try {
            router.push("/admin/login");
          } catch (_) {
            window.location.href = "/admin/login";
          }
          return;
        }
        try {
          document.cookie = `plan=${encodeURIComponent(
            plan
          )}; path=/; max-age=${60 * 60 * 24 * 30}`;
        } catch (_) {}
        try {
          if (uname) {
            document.cookie = `username=${encodeURIComponent(
              uname
            )}; path=/; max-age=${60 * 60 * 24 * 30}`;
            document.cookie = `name=${encodeURIComponent(
              uname
            )}; path=/; max-age=${60 * 60 * 24 * 30}`;
          }
        } catch (_) {}
        try {
          const uid = String(user?.id || "");
          const email = String(user?.email || "");
          if (uid)
            document.cookie = `uid=${encodeURIComponent(
              uid
            )}; path=/; max-age=${60 * 60 * 24 * 30}`;
          if (email)
            document.cookie = `email=${encodeURIComponent(
              email
            )}; path=/; max-age=${60 * 60 * 24 * 30}`;
        } catch (_) {}
        dest = "/dashboard";
      } catch (_) {}
      try {
        document.cookie = `sessionExpiry=1; path=/; max-age=${60 * 60 * 5}`;
      } catch (_) {}
      try {
        router.push(dest);
      } catch (_) {
        try {
          window.location.href = dest;
        } catch (_) {}
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell no-bg page-login">
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
            Unlock Your Creative Potential with AI Video Generation.
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
            </div>
          </div>
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">
            Masuk ke akun Anda untuk melanjutkan.
          </p>

          <form
            onSubmit={onSubmit}
            className="card"
            style={{ gap: 16, opacity: 1 }}
          >
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
                onChange={(e) => setEmail(e.target.value)}
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

            <div className="login-actions">
              <a href="#" className="btn ghost">
                Lupa Password?
              </a>
            </div>

            <button className="btn gold wide" type="submit" disabled={busy}>
              {busy ? "Memproses..." : "Masuk"}
            </button>

            <div className="settings-help">
              Belum punya akun? <a href="/register">Daftar di sini</a>
            </div>
            {status ? (
              <div className="feature-sub" style={{ marginTop: 6 }}>
                {status}
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
