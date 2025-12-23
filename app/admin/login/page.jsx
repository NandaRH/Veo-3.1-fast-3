"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      document.title = "Admin Login | Fokus AI";
    } catch (_) {}
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          const token = String(session.access_token || "");
          const resp = await fetch("/api/me/plan", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await resp.json();
          const plan = String(data?.plan || "").toLowerCase();
          if (plan === "admin") {
            router.push("/admin/dashboard");
            return;
          }
        }
      } catch (_) {}
    })();
  }, [router]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setStatus(error.message || "Gagal login");
        return;
      }
      let plan = "";
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = String(session?.access_token || "");
        if (token) {
          const resp = await fetch("/api/me/plan", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const d = await resp.json();
          plan = String(d?.plan || "").toLowerCase();
        }
      } catch (_) {}
      if (plan !== "admin") {
        setStatus("Akun bukan admin.");
        try {
          await supabase.auth.signOut();
        } catch (_) {}
        return;
      }
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = String(session?.access_token || "");
        if (token) {
          await fetch("/api/session/establish", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch (_) {}
      try {
        document.cookie = `plan=admin; path=/; max-age=${60 * 60 * 24 * 30}`;
      } catch (_) {}
      try {
        document.cookie = `sessionExpiry=1; path=/; max-age=${60 * 60 * 5}`;
      } catch (_) {}
      try {
        router.push("/admin/dashboard");
      } catch (_) {
        window.location.href = "/admin/dashboard";
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell prompt-shell">
      <header className="page-header">
        <div className="page-brand">
          <img src="/images/fokusAI.png" alt="FokusAI" className="brand-logo" />
          <div className="brand-text">
            <span className="page-badge">FokusAI Studio</span>
            <h1 className="page-title">Admin Login</h1>
            <p className="page-subtitle">Masuk untuk mengelola sistem.</p>
          </div>
        </div>
      </header>
      <div className="card" style={{ padding: 24, maxWidth: 460 }}>
        <form onSubmit={onSubmit}>
          <label>Email</label>
          <input
            className="dropdown"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
          />
          <label style={{ marginTop: 10 }}>Password</label>
          <input
            className="dropdown"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <button
            className="btn primary"
            type="submit"
            disabled={busy}
            style={{ marginTop: 12 }}
          >
            {busy ? "Memproses..." : "Masuk"}
          </button>
          {status ? (
            <div className="feature-sub" style={{ marginTop: 10 }}>
              {status}
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
