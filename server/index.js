import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import next from "next";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { createClient } from "@supabase/supabase-js";
import { createProxyMiddleware } from "http-proxy-middleware";

// Playwright Browser Automation untuk bypass reCAPTCHA
import playwrightVeo from "./playwright-veo.js";

const envLocalPath = path.resolve(process.cwd(), ".env.server.local");

// Prefer .env.server.local, fallback to .env
try {
  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
  } else {
    dotenv.config();
  }
} catch (e) {
  // If dotenv fails, continue; handler below will surface missing LABS_BEARER
}

const app = express();
const PORT = process.env.PORT || 8790;
const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev, dir: path.resolve(process.cwd(), ".") });
const handleNext = nextApp.getRequestHandler();

app.use(cors());
// Naikkan limit agar bisa upload gambar kecil via base64
app.use(express.json({ limit: "25mb" }));
// Serve folder uploads untuk gambar referensi
const uploadsDir = path.resolve(process.cwd(), "uploads");
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
} catch (_) { }
app.use("/uploads", express.static(uploadsDir));

// === noVNC Proxy untuk akses virtual display via browser ===
// Akses: https://fokusai.fun/vnc?secret=YOUR_VNC_SECRET
// Ini memungkinkan login Google langsung di Railway tanpa upload session
const VNC_SECRET = process.env.VNC_SECRET || "";
const NOVNC_PORT = 6080;

// Simple auth check for VNC access
app.use("/vnc", (req, res, next) => {
  // Check secret from query param or header
  const secret = req.query.secret || req.headers["x-vnc-secret"] || "";

  // If VNC_SECRET is set, require it
  if (VNC_SECRET && secret !== VNC_SECRET) {
    return res.status(403).json({
      error: "VNC access requires secret",
      hint: "Add ?secret=YOUR_VNC_SECRET to URL"
    });
  }
  next();
});

// Proxy to noVNC
app.use("/vnc", createProxyMiddleware({
  target: `http://localhost:${NOVNC_PORT}`,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxy
  pathRewrite: {
    "^/vnc": "" // Remove /vnc prefix when forwarding
  },
  onError: (err, req, res) => {
    console.error("[VNC Proxy] Error:", err.message);
    if (res.writeHead) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: "VNC not available",
        detail: "noVNC service may not be running. Check if running in Railway with Xvfb."
      }));
    }
  }
}));

// Set ffmpeg binary path (ffmpeg-static)
try {
  if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
} catch (_) { }

// Metadata store for uploads (e.g., persisted Media ID per file)
const uploadsMetaPath = path.join(uploadsDir, "uploads-meta.json");
const usageStatsPath = path.join(uploadsDir, "usage-stats.json");
const sessionsPath = path.join(uploadsDir, "sessions.json");
const creditsPath = path.join(uploadsDir, "credits.json");
const userCreditsPath = path.join(uploadsDir, "user-credits.json");

const readUploadsMeta = () => {
  try {
    if (!fs.existsSync(uploadsMetaPath)) return {};
    const raw = fs.readFileSync(uploadsMetaPath, "utf8");
    const json = JSON.parse(raw);
    return json && typeof json === "object" ? json : {};
  } catch (_) {
    return {};
  }
};
const writeUploadsMeta = (meta) => {
  try {
    const content = JSON.stringify(meta || {}, null, 2);
    fs.writeFileSync(uploadsMetaPath, content, "utf8");
  } catch (_) { }
};

// Lokal fallback storage untuk kredit admin (file JSON).
// Di production (Railway), data utama disimpan di Supabase supaya tidak reset saat redeploy.
const readCredits = () => {
  try {
    if (!fs.existsSync(creditsPath)) return { sora2: 0 };
    const raw = fs.readFileSync(creditsPath, "utf8");
    const json = JSON.parse(raw);
    const v = json && typeof json === "object" ? json : {};
    const n = Number(v.sora2 || 0);
    return { sora2: Number.isFinite(n) ? n : 0 };
  } catch (_) {
    return { sora2: 0 };
  }
};
const writeCredits = (credits) => {
  try {
    const payload = { sora2: Number(credits?.sora2 || 0) || 0 };
    const content = JSON.stringify(payload, null, 2);
    fs.writeFileSync(creditsPath, content, "utf8");
  } catch (_) { }
};

// Lokal fallback storage untuk kredit per-user (file JSON).
// Di production (Railway), data utama disimpan di Supabase supaya tidak reset saat redeploy.
const readUserCredits = () => {
  try {
    if (!fs.existsSync(userCreditsPath)) return {};
    const raw = fs.readFileSync(userCreditsPath, "utf8");
    const json = JSON.parse(raw);
    return json && typeof json === "object" ? json : {};
  } catch (_) {
    return {};
  }
};
const writeUserCredits = (map) => {
  try {
    const content = JSON.stringify(map || {}, null, 2);
    fs.writeFileSync(userCreditsPath, content, "utf8");
  } catch (_) { }
};

const readUsageStats = () => {
  try {
    if (!fs.existsSync(usageStatsPath)) return {};
    const raw = fs.readFileSync(usageStatsPath, "utf8");
    const json = JSON.parse(raw);
    return json && typeof json === "object" ? json : {};
  } catch (_) {
    return {};
  }
};
const writeUsageStats = (stats) => {
  try {
    const content = JSON.stringify(stats || {}, null, 2);
    fs.writeFileSync(usageStatsPath, content, "utf8");
  } catch (_) { }
};
const readSessions = () => {
  try {
    if (!fs.existsSync(sessionsPath)) return {};
    const raw = fs.readFileSync(sessionsPath, "utf8");
    const json = JSON.parse(raw);
    return json && typeof json === "object" ? json : {};
  } catch (_) {
    return {};
  }
};
const writeSessions = (sessions) => {
  try {
    const content = JSON.stringify(sessions || {}, null, 2);
    fs.writeFileSync(sessionsPath, content, "utf8");
  } catch (_) { }
};

const parseCookies = (cookieHeader) => {
  try {
    const map = Object.fromEntries(
      String(cookieHeader || "")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const i = s.indexOf("=");
          const k = i >= 0 ? s.slice(0, i).trim() : s;
          const v = i >= 0 ? s.slice(i + 1).trim() : "";
          return [k, decodeURIComponent(v)];
        })
    );
    return map;
  } catch (_) {
    return {};
  }
};

// Zona waktu logika reset kuota (menit offset dari UTC).
// Default: 420 menit (UTC+7, mis. WIB). Bisa di-override via env QUOTA_TZ_OFFSET_MINUTES.
const QUOTA_TZ_OFFSET_MINUTES = Number(
  process.env.QUOTA_TZ_OFFSET_MINUTES || "420"
);

const quotaTodayStr = () => {
  try {
    const now = new Date();
    // Konversi ke UTC lalu geser ke zona kuota tetap (mis. WIB)
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const localMs = utcMs + QUOTA_TZ_OFFSET_MINUTES * 60000;
    const d = new Date(localMs);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const s = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${s}`;
  } catch (_) {
    try {
      return new Date().toISOString().slice(0, 10);
    } catch (_) {
      return "1970-01-01";
    }
  }
};
const bumpUsage = (user, type) => {
  try {
    const { id, email, name, plan } = user || {};
    const uid = String(id || "").trim();
    if (!uid) return;
    const stats = readUsageStats();
    const nowIso = new Date().toISOString();
    const cur = stats[uid] || {
      id: uid,
      email: email || undefined,
      name: name || undefined,
      plan: plan || undefined,
      counts: { veo: 0, sora2: 0, image: 0 },
      createdAt: nowIso,
      updatedAt: nowIso,
      daily: {},
    };
    cur.counts = cur.counts || { veo: 0, sora2: 0, image: 0 };
    cur.daily = cur.daily || {};
    if (type === "veo") cur.counts.veo = (cur.counts.veo || 0) + 1;
    else if (type === "sora2") cur.counts.sora2 = (cur.counts.sora2 || 0) + 1;
    else if (type === "image") cur.counts.image = (cur.counts.image || 0) + 1;
    const dayKey = quotaTodayStr();
    const baseDaily = cur.daily[dayKey] || {
      veo: 0,
      sora2: 0,
      image: 0,
    };
    if (type === "veo") baseDaily.veo = (baseDaily.veo || 0) + 1;
    else if (type === "sora2")
      baseDaily.sora2 = (baseDaily.sora2 || 0) + 1;
    else if (type === "image")
      baseDaily.image = (baseDaily.image || 0) + 1;
    cur.daily[dayKey] = baseDaily;
    cur.email = email || cur.email;
    cur.name = name || cur.name;
    cur.plan = plan || cur.plan;
    cur.updatedAt = nowIso;
    stats[uid] = cur;
    writeUsageStats(stats);
  } catch (_) { }
};

// Establish server-side session via HttpOnly cookies after verifying Supabase token
app.post("/api/session/establish", async (req, res) => {
  try {
    if (!srSupabase)
      return res.status(500).json({ error: "Supabase not configured" });
    const authHeader = String(req.headers["authorization"] || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Missing token" });
    const { data: userData, error } = await srSupabase.auth.getUser(token);
    if (error)
      return res.status(401).json({ error: String(error.message || error) });
    const uid = String(userData?.user?.id || "").trim();
    const email = String(userData?.user?.email || "").toLowerCase();
    if (!uid) return res.status(401).json({ error: "Invalid user" });
    try {
      const cookies = [];
      const sessionKey = crypto.randomBytes(16).toString("hex");
      await setSessionForUser(uid, sessionKey, email);
      cookies.push(
        `auth_ok=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
      );
      cookies.push(
        `auth_uid=${encodeURIComponent(
          uid
        )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
      );
      cookies.push(
        `auth_email=${encodeURIComponent(
          email
        )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
      );
      cookies.push(
        `auth_session=${encodeURIComponent(
          sessionKey
        )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
      );
      res.setHeader("Set-Cookie", cookies);
    } catch (_) { }
    res.json({ ok: true, uid, email });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/api/session/logout", async (req, res) => {
  try {
    try {
      const cookieHeader = String(req.headers["cookie"] || "");
      const cookiesIn = parseCookies(cookieHeader);
      const uid = String(cookiesIn.auth_uid || "").trim();
      if (uid) {
        await deleteSessionForUser(uid);
      }
    } catch (_) { }
    const cookies = [];
    const expire = "Max-Age=0";
    cookies.push(`auth_ok=; Path=/; HttpOnly; SameSite=Lax; ${expire}`);
    cookies.push(`auth_uid=; Path=/; HttpOnly; SameSite=Lax; ${expire}`);
    cookies.push(`auth_email=; Path=/; HttpOnly; SameSite=Lax; ${expire}`);
    cookies.push(`auth_session=; Path=/; HttpOnly; SameSite=Lax; ${expire}`);
    res.setHeader("Set-Cookie", cookies);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/session/validate", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    const cookieHeader = String(req.headers["cookie"] || "");
    const cookies = parseCookies(cookieHeader);
    const uid = String(cookies.auth_uid || "").trim();
    const key = String(cookies.auth_session || "").trim();
    if (!uid || !key) {
      return res
        .status(401)
        .json({ ok: false, reason: "NO_SESSION", uid: uid || null });
    }
    const current = await getSessionForUser(uid);
    if (!current || current.key !== key) {
      return res.status(401).json({ ok: false, reason: "OTHER_LOGIN", uid });
    }
    return res.json({ ok: true, uid });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// List files in /uploads for gallery
app.get("/api/uploads", async (req, res) => {
  try {
    const files = await fs.promises.readdir(uploadsDir);
    const imageExts = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
    const items = [];
    const meta = readUploadsMeta();
    for (const name of files) {
      const ext = path.extname(name).toLowerCase();
      if (!imageExts.has(ext)) continue;
      const full = path.join(uploadsDir, name);
      try {
        const stat = await fs.promises.stat(full);
        items.push({
          name,
          url: `/uploads/${name}`,
          size: stat.size,
          mtime:
            stat.mtime?.toISOString?.() || new Date(stat.mtime).toISOString(),
          mediaId: meta?.[name]?.mediaId || undefined,
          aspect: meta?.[name]?.aspect || undefined,
        });
      } catch (_) {
        // skip unreadable entries
      }
    }
    // Sort by modified time desc
    items.sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
    res.json({ ok: true, items });
  } catch (err) {
    console.error("List uploads error", err);
    res
      .status(500)
      .json({ error: "Failed to list uploads", detail: String(err) });
  }
});

// Delete a file from /uploads by name
app.delete("/api/uploads/:name", async (req, res) => {
  try {
    const rawName = req.params.name || "";
    const safeName = path.basename(rawName).replace(/[^a-zA-Z0-9_.-]/g, "_");
    const targetPath = path.join(uploadsDir, safeName);
    // Ensure targetPath is under uploadsDir
    const uploadsDirResolved = path.resolve(uploadsDir);
    const targetResolved = path.resolve(targetPath);
    if (!targetResolved.startsWith(uploadsDirResolved)) {
      return res.status(400).json({ error: "Invalid file path" });
    }
    // Check existence
    if (!fs.existsSync(targetResolved)) {
      return res.status(404).json({ error: "File not found" });
    }
    await fs.promises.unlink(targetResolved);
    // Remove metadata if present
    try {
      const meta = readUploadsMeta();
      if (meta && Object.prototype.hasOwnProperty.call(meta, safeName)) {
        const { [safeName]: _omit, ...rest } = meta;
        writeUploadsMeta(rest);
      }
    } catch (_) { }
    res.json({ ok: true, name: safeName });
  } catch (err) {
    console.error("Delete upload error", err);
    res
      .status(500)
      .json({ error: "Failed to delete file", detail: String(err) });
  }
});

// Persist mediaId for a given upload file name
app.post("/api/uploads/:name/media-id", async (req, res) => {
  try {
    const rawName = req.params.name || "";
    const safeName = path.basename(rawName).replace(/[^a-zA-Z0-9_.-]/g, "_");
    const targetPath = path.join(uploadsDir, safeName);
    const uploadsDirResolved = path.resolve(uploadsDir);
    const targetResolved = path.resolve(targetPath);
    if (!targetResolved.startsWith(uploadsDirResolved)) {
      return res.status(400).json({ error: "Invalid file path" });
    }
    if (!fs.existsSync(targetResolved)) {
      return res.status(404).json({ error: "File not found" });
    }
    const { mediaId, aspect, uploadInfo } = req.body || {};
    if (!mediaId || typeof mediaId !== "string") {
      return res.status(400).json({ error: "Missing mediaId" });
    }
    const meta = readUploadsMeta();
    meta[safeName] = {
      ...(meta?.[safeName] || {}),
      mediaId,
      aspect: typeof aspect === "string" ? aspect : meta?.[safeName]?.aspect,
      uploadInfo:
        uploadInfo && typeof uploadInfo === "object"
          ? uploadInfo
          : meta?.[safeName]?.uploadInfo,
      updatedAt: new Date().toISOString(),
    };
    writeUploadsMeta(meta);
    try {
      const cookies = parseCookies(req.headers["cookie"] || "");
      const user = {
        id: cookies.uid || "",
        email: cookies.email || "",
        name: cookies.name || "",
        plan: cookies.plan || "",
      };
      bumpUsage(user, "image");
    } catch (_) { }
    res.json({ ok: true, name: safeName, mediaId });
  } catch (err) {
    console.error("Persist mediaId error", err);
    res
      .status(500)
      .json({ error: "Failed to persist mediaId", detail: String(err) });
  }
});

const persistEnvValue = (key, value) => {
  const sanitized =
    typeof value === "string" ? value.replace(/\r?\n/g, "").trim() : "";
  let lines = [];
  if (fs.existsSync(envLocalPath)) {
    try {
      const raw = fs.readFileSync(envLocalPath, "utf8");
      lines = raw.split(/\r?\n/);
    } catch (err) {
      console.warn("[settings] Failed to read existing env file:", err);
      lines = [];
    }
  }
  const keyPattern = new RegExp(`^\\s*${key}\\s*=`);
  let replaced = false;
  const nextLines = [];
  for (const line of lines) {
    if (keyPattern.test(line)) {
      if (!replaced) {
        nextLines.push(`${key}=${sanitized}`);
        replaced = true;
      }
      continue;
    }
    if (line !== undefined) {
      nextLines.push(line);
    }
  }
  if (!replaced) {
    if (nextLines.length && nextLines[nextLines.length - 1] !== "") {
      nextLines.push("");
    }
    nextLines.push(`${key}=${sanitized}`);
  }
  const finalContent = nextLines.join("\n");
  fs.writeFileSync(
    envLocalPath,
    finalContent.endsWith("\n") ? finalContent : `${finalContent}\n`,
    "utf8"
  );
  return sanitized;
};

// === Activation state storage (single-use enforcement) ===
const activationStatePath = path.resolve(
  process.cwd(),
  "license",
  "activation-state.json"
);
const soraJobsPath = path.resolve(uploadsDir, "sora-jobs.json");

const readSoraJobs = () => {
  try {
    if (!fs.existsSync(soraJobsPath)) return {};
    const raw = fs.readFileSync(soraJobsPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const writeSoraJobs = (jobs) => {
  try {
    fs.writeFileSync(soraJobsPath, JSON.stringify(jobs, null, 2), "utf8");
  } catch (_) { }
};

const readActivationState = () => {
  try {
    const s = fs.readFileSync(activationStatePath, "utf8");
    return JSON.parse(s);
  } catch {
    return { licenses: {} };
  }
};
const writeActivationState = (state) => {
  try {
    fs.mkdirSync(path.dirname(activationStatePath), { recursive: true });
    fs.writeFileSync(
      activationStatePath,
      JSON.stringify(state, null, 2),
      "utf8"
    );
  } catch (e) {
    console.warn("[license] Failed to persist activation-state:", e);
  }
};

// Basic health check
app.get("/health", (_, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Redirect root to activation page if not activated, else to prompt-tunggal
// Allow Next.js to serve landing page at '/'
app.get("/aktivasi", (req, res) => {
  res.redirect("/prompt-tunggal");
});

// === App Credential Gate (server-side) ===
const requireAppCredentialConfigured = (req, res, next) => {
  // Deprecated gate: keep for compatibility but allow pass-through
  next();
};

const verifyAppCredential = (req, res, next) => {
  next();
};

// Terapkan gate ke endpoint sensitif
app.use(["/api/labsflow/execute", "/api/generate"], verifyAppCredential);

// Gabungkan beberapa video (concat) menjadi satu file MP4 di /uploads
app.post("/api/video/concat", async (req, res) => {
  try {
    const { sources } = req.body || {};
    const list = Array.isArray(sources)
      ? sources.filter((s) => typeof s === "string" && s.trim().length)
      : [];
    if (list.length < 2) {
      return res.status(400).json({ error: "Minimal pilih dua sumber video." });
    }
    // Unduh setiap sumber ke file temp lokal
    const tmpDir = path.join(uploadsDir, "tmp");
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
    } catch (_) { }
    const tmpFiles = [];
    for (let i = 0; i < list.length; i++) {
      const url = list[i];
      const name = `concat_${Date.now()}_${i}.mp4`;
      const dest = path.join(tmpDir, name);
      const r = await fetch(url);
      if (!r.ok) {
        return res
          .status(400)
          .json({ error: `Gagal unduh sumber: ${url} (HTTP ${r.status})` });
      }
      const buf = Buffer.from(await r.arrayBuffer());
      await fs.promises.writeFile(dest, buf);
      tmpFiles.push(dest);
    }
    // Buat file daftar untuk concat demuxer
    const listPath = path.join(tmpDir, `list_${Date.now()}.txt`);
    const listContent = tmpFiles
      .map((p) => `file '${p.replace(/'/g, "'''")}'`)
      .join("\n");
    await fs.promises.writeFile(listPath, listContent, "utf8");

    const outName = `merged_${Date.now()}.mp4`;
    const outPath = path.join(uploadsDir, outName);

    // Jalankan ffmpeg: -f concat -safe 0 -i list.txt -c copy
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions(["-c copy"])
        .on("error", (err) => reject(err))
        .on("end", () => resolve())
        .save(outPath);
    });

    // Bersihkan temp
    try {
      await fs.promises.unlink(listPath);
      for (const f of tmpFiles) {
        try {
          await fs.promises.unlink(f);
        } catch (_) { }
      }
    } catch (_) { }

    const url = `/uploads/${outName}`;
    res.json({ ok: true, url, path: url });
  } catch (err) {
    console.error("Concat error", err);
    res
      .status(500)
      .json({ error: "Gagal menggabungkan video", detail: String(err) });
  }
});

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
let srSupabase = null;
try {
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    srSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
} catch (_) { }

// ===== Server-side session storage via Supabase (persisten) dengan fallback file JSON =====
const SESSIONS_TABLE =
  process.env.SUPABASE_SESSIONS_TABLE || "user_sessions";

const getSessionForUser = async (uid) => {
  const id = String(uid || "").trim();
  if (!id) return null;
  if (!srSupabase) {
    const all = readSessions();
    return all && all[id] ? all[id] : null;
  }
  try {
    const { data, error } = await srSupabase
      .from(SESSIONS_TABLE)
      .select("user_id, session_key, email, updated_at")
      .eq("user_id", id)
      .single();
    if (error) throw error;
    if (!data) return null;
    return {
      uid: String(data.user_id || id),
      key: String(data.session_key || ""),
      email: String(data.email || ""),
      updatedAt: data.updated_at || null,
    };
  } catch (_) {
    const all = readSessions();
    return all && all[id] ? all[id] : null;
  }
};

const setSessionForUser = async (uid, sessionKey, email) => {
  const id = String(uid || "").trim();
  const key = String(sessionKey || "").trim();
  if (!id || !key) return;
  const normalized = {
    uid: id,
    key,
    email: String(email || "").toLowerCase(),
    updatedAt: new Date().toISOString(),
  };
  // Fallback lokal
  try {
    const sessions = readSessions();
    sessions[id] = normalized;
    writeSessions(sessions);
  } catch (_) { }
  // Persisten di Supabase bila tersedia
  if (!srSupabase) return;
  try {
    await srSupabase.from(SESSIONS_TABLE).upsert({
      user_id: id,
      session_key: key,
      email: normalized.email,
      updated_at: normalized.updatedAt,
    });
  } catch (_) { }
};

const deleteSessionForUser = async (uid) => {
  const id = String(uid || "").trim();
  if (!id) return;
  try {
    const sessions = readSessions();
    if (sessions && sessions[id]) {
      delete sessions[id];
      writeSessions(sessions);
    }
  } catch (_) { }
  if (!srSupabase) return;
  try {
    await srSupabase.from(SESSIONS_TABLE).delete().eq("user_id", id);
  } catch (_) { }
};

// ===== Kredit admin & user via kolom di tabel users (Supabase) =====
// Kolom yang digunakan: users.sora2_credits (bigint / numeric)
const getUserCredits = async (uid) => {
  const id = String(uid || "").trim();
  if (!id) return 0;
  if (!srSupabase) {
    return 0;
  }
  try {
    const { data, error } = await srSupabase
      .from("users")
      .select("sora2_credits")
      .eq("id", id)
      .single();
    if (error) throw error;
    const n = Number(data?.sora2_credits || 0);
    return Number.isFinite(n) ? n : 0;
  } catch (_) {
    return 0;
  }
};

// Simpan kredit untuk satu user ke kolom users.sora2_credits
const setUserCredits = async (uid, value) => {
  const id = String(uid || "").trim();
  if (!id) return;
  const n = Number(value || 0) || 0;
  if (!srSupabase) return;
  try {
    await srSupabase
      .from("users")
      .update({ sora2_credits: n })
      .eq("id", id);
  } catch (_) { }
};

// Sinkronkan kredit semua akun dengan plan 'admin' ke nilai yang sama
const syncAdminCredits = async (value) => {
  if (!srSupabase) return;
  const n = Number(value || 0) || 0;
  try {
    await srSupabase
      .from("users")
      .update({ sora2_credits: n })
      .eq("plan", "admin");
  } catch (_) { }
};

const ADMIN_SECRET = (process.env.ADMIN_SECRET || "").trim();
const ADMIN_EMAIL_WHITELIST = (process.env.ADMIN_EMAIL_WHITELIST || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// ==== Realtime plan helpers (shared across routes) ====
const planSubscribers = new Map(); // userId -> Set(res)

const pushPlanEvent = (userId, event, data = {}) => {
  const set = planSubscribers.get(userId);
  if (!set || !set.size) return;
  const payload = { userId, event, ...data };
  const line = `event: ${event}\n` + `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try {
      res.write(line);
    } catch (_) { }
  }
};

const fetchPlanForUser = async (uid) => {
  const result = { plan: "free", expiry: null };
  if (!srSupabase || !uid) return result;
  try {
    const { data, error } = await srSupabase
      .from("users")
      .select("plan")
      .eq("id", uid)
      .single();
    if (!error && data) {
      result.plan = String(data.plan || "free").toLowerCase();
    }
  } catch (_) { }
  try {
    const { data: adminUser } = await srSupabase.auth.admin.getUserById(uid);
    const meta = adminUser?.user?.user_metadata || {};
    const pe = meta?.planExpiry;
    if (typeof pe === "number" && Number.isFinite(pe)) {
      result.expiry = pe;
    } else if (typeof pe === "string" && pe.trim()) {
      const n = Number(pe);
      if (Number.isFinite(n)) result.expiry = n;
    }
  } catch (_) { }
  return result;
};

// Admin check: fast-path with x-admin-secret; otherwise allow plan "admin" atau email whitelist
const requireAdmin = async (req, res, next) => {
  try {
    const adminSecret = String(req.headers["x-admin-secret"] || "").trim();
    if (ADMIN_SECRET && adminSecret === ADMIN_SECRET) {
      return next();
    }
    const authHeader = (req.headers["authorization"] || "").toString();
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!srSupabase || !token)
      return res.status(401).json({ error: "Unauthorized" });
    const { data: userData, error } = await srSupabase.auth.getUser(token);
    if (error)
      return res.status(401).json({ error: String(error.message || error) });
    const uid = String(userData?.user?.id || "");
    const email = String(userData?.user?.email || "").toLowerCase();
    let isAllowed = false;
    try {
      const { plan } = await fetchPlanForUser(uid);
      isAllowed = String(plan || "").toLowerCase() === "admin";
    } catch (_) { }
    if (!isAllowed) {
      try {
        if (
          Array.isArray(ADMIN_EMAIL_WHITELIST) &&
          ADMIN_EMAIL_WHITELIST.length
        ) {
          isAllowed = ADMIN_EMAIL_WHITELIST.includes(email);
        }
      } catch (_) { }
    }
    if (!isAllowed) return res.status(403).json({ error: "Forbidden" });
    try {
      req.adminUserId = uid;
      req.adminEmail = email;
    } catch (_) { }
    next();
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};
const ALLOWED_PLANS = new Set([
  "free",
  "veo_lifetime",
  "veo_sora_unlimited",
  "monthly",
  "admin",
]);

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    if (!srSupabase)
      return res.status(500).json({ error: "Supabase not configured" });
    const { data, error } = await srSupabase
      .from("users")
      .select("id,email,full_name,plan,sora2_credits,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (error)
      return res.status(500).json({ error: String(error.message || error) });

    const stats = readUsageStats();

    const users = await Promise.all(
      (data || []).map(async (u) => {
        const s = stats?.[String(u.id || "")] || {};
        let planExpiry = null;
        try {
          const { data: adminUser } = await srSupabase.auth.admin.getUserById(
            String(u.id || "")
          );
          const meta = adminUser?.user?.user_metadata || {};
          const pe = meta?.planExpiry;
          if (typeof pe === "number" && Number.isFinite(pe)) {
            planExpiry = pe;
          } else if (typeof pe === "string" && pe.trim()) {
            const n = Number(pe);
            if (Number.isFinite(n)) planExpiry = n;
          }
        } catch (_) { }
        return {
          ...u,
          plan_expiry: planExpiry,
          veo_count: (s.counts && s.counts.veo) || 0,
          sora2_count: (s.counts && s.counts.sora2) || 0,
          image_count: (s.counts && s.counts.image) || 0,
          sora2_credits:
            String(u.plan || "").toLowerCase() === "veo_sora_unlimited"
              ? Number(u.sora2_credits || 0) || 0
              : null,
        };
      })
    );

    return res.json({ ok: true, users });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/api/admin/users/:id/plan", requireAdmin, async (req, res) => {
  try {
    if (!srSupabase)
      return res.status(500).json({ error: "Supabase not configured" });
    const id = String(req.params.id || "").trim();
    const plan = String(req.body?.plan || "").toLowerCase();
    if (!id) return res.status(400).json({ error: "Missing id" });
    if (!ALLOWED_PLANS.has(plan))
      return res.status(400).json({ error: "Invalid plan" });
    const { data, error } = await srSupabase
      .from("users")
      .update({ plan })
      .eq("id", id)
      .select("id,email,full_name,plan")
      .single();
    if (error)
      return res.status(500).json({ error: String(error.message || error) });
    try {
      const meta = { plan };
      if (plan === "monthly") {
        const ms = Date.now() + 30 * 24 * 60 * 60 * 1000;
        meta.planExpiry = ms;
      } else {
        meta.planExpiry = null;
      }
      await srSupabase.auth.admin.updateUserById(id, { user_metadata: meta });
    } catch (_) { }
    // Jika user baru di-set sebagai admin, samakan kredit Sora dengan admin lain
    if (plan === "admin") {
      try {
        let baseCredits = 0;
        try {
          const actingAdminId = String(req.adminUserId || "").trim();
          if (actingAdminId) {
            baseCredits = await getUserCredits(actingAdminId);
          } else if (srSupabase) {
            const { data: anyAdmin } = await srSupabase
              .from("users")
              .select("sora2_credits")
              .eq("plan", "admin")
              .limit(1)
              .single();
            const n = Number(anyAdmin?.sora2_credits || 0);
            if (Number.isFinite(n)) baseCredits = n;
          }
        } catch (_) { }
        await syncAdminCredits(baseCredits);
      } catch (_) { }
    }
    // Push realtime plan update ke user terkait (jika ada subscriber)
    try {
      const { plan: curPlan, expiry } = await fetchPlanForUser(id);
      pushPlanEvent(id, "plan_update", { plan: curPlan, expiry });
    } catch (_) { }
    res.json({ ok: true, user: data });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    if (!srSupabase)
      return res.status(500).json({ error: "Supabase not configured" });
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "Missing id" });

    // Hapus dari tabel users
    try {
      await srSupabase.from("users").delete().eq("id", id);
    } catch (_) { }

    // Hapus akun auth Supabase (jika ada)
    try {
      await srSupabase.auth.admin.deleteUser(id);
    } catch (_) { }

    // Bersihkan statistik penggunaan lokal
    try {
      const stats = readUsageStats();
      if (stats && Object.prototype.hasOwnProperty.call(stats, id)) {
        const { [id]: _omit, ...rest } = stats;
        writeUsageStats(rest);
      }
    } catch (_) { }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Kredit admin: gunakan kolom sora2_credits milik admin yang sedang login
app.get("/api/admin/credits", requireAdmin, async (req, res) => {
  try {
    const { uid } = await requireAuthUser(req);
    const val = await getUserCredits(uid);
    res.json({ ok: true, credits: { sora2: val } });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/usage/veo-today", (req, res) => {
  try {
    const cookies = parseCookies(req.headers["cookie"] || "");
    const uid = String(
      cookies.auth_uid || cookies.uid || cookies.uid || ""
    ).trim();
    const dayKey = quotaTodayStr();
    if (!uid) {
      return res.json({
        ok: false,
        reason: "NO_USER",
        date: dayKey,
        veoCount: 0,
      });
    }
    const stats = readUsageStats();
    const cur = stats && stats[uid] ? stats[uid] : null;
    const daily =
      cur && cur.daily && typeof cur.daily === "object"
        ? cur.daily[dayKey] || {}
        : {};
    const rawCount = Number(daily.veo || 0);
    const veoCount = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 0;
    return res.json({
      ok: true,
      date: dayKey,
      veoCount,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

app.post("/api/admin/credits/add", requireAdmin, async (req, res) => {
  try {
    const amt = Number(req.body?.amount || 0);
    if (!Number.isFinite(amt))
      return res.status(400).json({ error: "Invalid amount" });
    const { uid } = await requireAuthUser(req);
    const cur = await getUserCredits(uid);
    const nextVal = Math.max(0, (cur || 0) + amt);
    await syncAdminCredits(nextVal);
    res.json({ ok: true, credits: { sora2: nextVal } });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/me/plan", async (req, res) => {
  try {
    if (!srSupabase)
      return res.status(500).json({ error: "Supabase not configured" });
    const auth = String(req.headers["authorization"] || "");
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Missing token" });
    const { data: userData, error: ue } = await srSupabase.auth.getUser(token);
    if (ue) return res.status(401).json({ error: String(ue.message || ue) });
    const uid = String(userData?.user?.id || "");
    if (!uid) return res.status(401).json({ error: "Invalid user" });
    const { plan, expiry } = await fetchPlanForUser(uid);
    res.json({ ok: true, plan, expiry });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Auth helper: verify bearer and return { uid, plan }
const requireAuthUser = async (req) => {
  if (!srSupabase) throw new Error("Supabase not configured");
  const auth = String(req.headers["authorization"] || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Error("Missing token");
  const { data: userData, error: ue } = await srSupabase.auth.getUser(token);
  if (ue) throw new Error(String(ue.message || ue));
  const uid = String(userData?.user?.id || "");
  if (!uid) throw new Error("Invalid user");
  const email = String(userData?.user?.email || "").toLowerCase();
  let { plan } = await fetchPlanForUser(uid);
  if (String(plan || "").toLowerCase() !== "admin") {
    try {
      if (ADMIN_EMAIL_WHITELIST && ADMIN_EMAIL_WHITELIST.includes(email)) {
        plan = "admin";
      }
    } catch (_) { }
  }
  return { uid, plan };
};

// Return credits for current user: admin -> global, unlimited -> per-user, others -> 0
app.get("/api/me/credits", async (req, res) => {
  try {
    const { uid, plan } = await requireAuthUser(req);
    const p = String(plan || "").toLowerCase();
    if (p === "admin") {
      const val = await getUserCredits(uid);
      return res.json({
        ok: true,
        credits: Number.isFinite(val) ? val : 0,
        scope: "admin",
      });
    }
    if (p === "veo_sora_unlimited") {
      const val = await getUserCredits(uid);
      return res.json({
        ok: true,
        credits: Number.isFinite(val) ? val : 0,
        scope: "user",
      });
    }
    return res.json({ ok: true, credits: 0, scope: "none" });
  } catch (e) {
    res.status(401).json({ error: String(e) });
  }
});

// Deduct credits from current user/admin
app.post("/api/credits/deduct", async (req, res) => {
  try {
    const { uid, plan } = await requireAuthUser(req);
    const amount = Number(req.body?.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    const p = String(plan || "").toLowerCase();
    if (p === "admin") {
      const prev = await getUserCredits(uid);
      if (prev < amount) {
        return res.status(400).json({ error: "Insufficient credits" });
      }
      const next = prev - amount;
      await syncAdminCredits(next);
      return res.json({ ok: true, credits: next, scope: "admin" });
    }
    if (p === "veo_sora_unlimited") {
      const prev = await getUserCredits(uid);
      if (prev < amount) {
        return res.status(400).json({ error: "Insufficient credits" });
      }
      const next = prev - amount;
      await setUserCredits(uid, next);
      return res.json({ ok: true, credits: next, scope: "user" });
    }
    return res.status(403).json({ error: "Plan not eligible" });
  } catch (e) {
    res.status(401).json({ error: String(e) });
  }
});

// Grant credits from admin to a user (veo_sora_unlimited)
app.post(
  "/api/admin/users/:id/credits/grant",
  requireAdmin,
  async (req, res) => {
    try {
      const uid = String(req.params.id || "");
      const amount = Number(req.body?.amount || 0);
      if (!uid) return res.status(400).json({ error: "Missing id" });
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }
      const { uid: adminUid, plan } = await requireAuthUser(req);
      const p = String(plan || "").toLowerCase();
      if (p !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const curAdmin = await getUserCredits(adminUid);
      if (curAdmin < amount) {
        return res.status(400).json({ error: "Insufficient admin credits" });
      }
      const prevUser = await getUserCredits(uid);
      const nextAdmin = curAdmin - amount;
      const nextUser = prevUser + amount;
      await syncAdminCredits(nextAdmin);
      await setUserCredits(uid, nextUser);
      return res.json({
        ok: true,
        admin_credits: nextAdmin,
        user_credits: nextUser,
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  }
);

app.post(
  "/api/admin/users/:id/credits/revoke",
  requireAdmin,
  async (req, res) => {
    try {
      const uid = String(req.params.id || "");
      const amount = Number(req.body?.amount || 0);
      if (!uid) return res.status(400).json({ error: "Missing id" });
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }
      const { uid: adminUid, plan } = await requireAuthUser(req);
      const p = String(plan || "").toLowerCase();
      if (p !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const prevUser = await getUserCredits(uid);
      if (prevUser < amount) {
        return res.status(400).json({ error: "Insufficient user credits" });
      }
      const curAdmin = await getUserCredits(adminUid);
      const nextUser = prevUser - amount;
      const nextAdmin = curAdmin + amount;
      await setUserCredits(uid, nextUser);
      await syncAdminCredits(nextAdmin);
      return res.json({
        ok: true,
        admin_credits: nextAdmin,
        user_credits: nextUser,
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  }
);

// SSE: realtime plan perubahan untuk user yang sedang login
app.get("/api/me/plan/stream", async (req, res) => {
  try {
    if (!srSupabase)
      return res.status(500).json({ error: "Supabase not configured" });
    const token = String(req.query.token || "");
    if (!token) return res.status(401).json({ error: "Missing token" });
    const { data: userData, error: ue } = await srSupabase.auth.getUser(token);
    if (ue) return res.status(401).json({ error: String(ue.message || ue) });
    const uid = String(userData?.user?.id || "");
    if (!uid) return res.status(401).json({ error: "Invalid user" });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("\n");

    let set = planSubscribers.get(uid);
    if (!set) {
      set = new Set();
      planSubscribers.set(uid, set);
    }
    set.add(res);

    req.on("close", () => {
      try {
        const s = planSubscribers.get(uid);
        if (s) s.delete(res);
      } catch (_) { }
    });

    const { plan, expiry } = await fetchPlanForUser(uid);
    pushPlanEvent(uid, "plan_snapshot", { plan, expiry });
  } catch (_) {
    try {
      res.end();
    } catch (_) { }
  }
});

// Simple proxy to Google Labs/Google APIs using Bearer from env
app.post("/api/labsflow/execute", async (req, res) => {
  try {
    const { url, method = "POST", payload, headers = {} } = req.body || {};

    if (!url || typeof url !== "string") {
      return res
        .status(400)
        .json({ error: 'Missing required "url" (string).' });
    }

    // Restrict proxy to Google domains for safety
    const allowed =
      /^https:\/\/([a-zA-Z0-9-]+\.)*(googleapis\.com|google\.com)\//.test(url);
    if (!allowed) {
      return res
        .status(400)
        .json({ error: "URL not allowed. Only googleapis.com/google.com." });
    }

    // Bearer from env (optional if browser mode works)
    const bearer = process.env.LABS_BEARER;

    // Decide remote Content-Type: Labs UI sends JSON as text/plain for video endpoints
    const lowerUrl = url.toLowerCase();
    const isGenText = lowerUrl.includes("/video:batchasyncgeneratevideotext");
    const isGenStartImage = lowerUrl.includes(
      "/video:batchasyncgeneratevideostartimage"
    );
    const isGenStartEndImage = lowerUrl.includes(
      "/video:batchasyncgeneratevideostartandendimage"
    );
    const isGenRefImages = lowerUrl.includes(
      "/video:batchasyncgeneratevideoreferenceimages"
    );
    const isGenExtend = lowerUrl.includes(
      "/video:batchasyncgeneratevideoextendvideo"
    );
    const isCheck =
      lowerUrl.includes("/video:batchcheckasyncvideogenerationstatus") ||
      lowerUrl.includes("/operations:batchcheckasyncvideogenerationstatus");

    const isReshoot = lowerUrl.includes(
      "/video:batchasyncgeneratevideoreshootvideo"
    );
    const isSoundDemo = lowerUrl.includes("/v1:sounddemo");
    const isFlowMediaImages = lowerUrl.includes(
      "/flowmedia:batchgenerateimages"
    );

    // ======= BROWSER MODE: Execute API from browser context =======
    // Untuk video & image generation, HARUS request dari browser agar token valid
    const isVideoGeneration =
      isGenText ||
      isGenStartImage ||
      isGenStartEndImage ||
      isGenRefImages ||
      isGenExtend ||
      isReshoot ||
      isCheck; // <-- TAMBAHKAN INI (Polling juga butuh browser)

    const isImageGeneration = isFlowMediaImages;
    const requiresBrowserMode = isVideoGeneration || isImageGeneration;

    if (requiresBrowserMode && payload) {
      try {
        // Cek apakah browser tersedia
        const browserStatus = await playwrightVeo.getBrowserStatus();

        if (browserStatus.browserRunning && browserStatus.pageReady && browserStatus.isLoggedIn) {
          console.log(`[labsflow/execute] 🌐 Using browser mode for ${isImageGeneration ? 'image' : 'video'} generation...`);

          // Execute request dari dalam browser context
          const browserResult = await playwrightVeo.executeApiRequest({
            url,
            method,
            headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
            payload
          });

          console.log("[labsflow/execute] Browser mode result:", {
            status: browserResult.status,
            hasToken: browserResult.hasToken,
            success: browserResult.success
          });

          // Return response dari browser
          return res.status(browserResult.status || 200).send(browserResult.data);
        } else {
          console.log("[labsflow/execute] ⚠ Browser not ready, falling back to direct API...");
          console.log("[labsflow/execute] Browser status:", browserStatus);
        }
      } catch (browserErr) {
        console.error("[labsflow/execute] Browser mode CRITICAL FAILURE:", browserErr);
        // JANGAN FALLBACK jika browser error, return error aslinya agar user tahu
        return res.status(500).json({
          error: "Browser Automation Failed",
          detail: browserErr.message,
          hint: "Please check VNC connection or restart browser via /api/browser/restart-visible"
        });
      }
    }

    // ======= FALLBACK: Direct API (requires Bearer) =======
    // Hanya masuk sini jika browser TIDAK ready (status check false), bukan jika browser error saat execute
    if (!bearer) {
      console.error("[labsflow/execute] Fallback failed: LABS_BEARER missing");
      return res.status(500).json({
        error: "Bearer kadaluarsa (Browser belum siap atau belum login). Cek status di /api/debug-browser.",
      });
    }

    let normalizedPayload = payload;

    const defaultContentType =
      isGenText ||
        isGenStartImage ||
        isGenStartEndImage ||
        isGenRefImages ||
        isGenExtend ||
        isCheck ||
        isReshoot ||
        isSoundDemo ||
        isFlowMediaImages
        ? "text/plain; charset=UTF-8"
        : "application/json";

    const mergedHeaders = {
      Authorization: `Bearer ${bearer}`,
      Accept: "application/json",
      "Content-Type": defaultContentType,
      ...headers,
    };

    // Add Origin and Referer for ALL video/image-related endpoints
    if (isVideoGeneration || isImageGeneration || isSoundDemo || isCheck) {
      if (!mergedHeaders["Origin"])
        mergedHeaders["Origin"] = "https://labs.google";
      if (!mergedHeaders["Referer"])
        mergedHeaders["Referer"] = "https://labs.google/";
    }

    if (isSoundDemo) {
      if (!headers["Accept"]) mergedHeaders["Accept"] = "*/*";
      if (!mergedHeaders["Accept-Language"])
        mergedHeaders["Accept-Language"] = "en-US,en;q=0.9";
    }

    // Basic diagnostics to help troubleshoot INVALID_ARGUMENT
    try {
      console.log(
        "[labsflow/execute] URL:",
        url,
        "method:",
        method,
        "ct:",
        mergedHeaders["Content-Type"]
      );
      if (normalizedPayload && Array.isArray(normalizedPayload.requests)) {
        const first = normalizedPayload.requests[0] || {};
        console.log("[labsflow/execute] first request sample:", {
          aspectRatio: first.aspectRatio,
          videoModelKey: first.videoModelKey,
          hasPrimaryMediaId: !!first.primaryMediaId,
        });
      }
      // Log if token is present
      if (normalizedPayload?.clientContext?.recaptchaToken) {
        console.log("[labsflow/execute] ✓ Has reCAPTCHA token in payload");
      }
    } catch (_) { }

    const response = await fetch(url, {
      method,
      headers: mergedHeaders,
      body:
        method.toUpperCase() === "GET"
          ? undefined
          : JSON.stringify(normalizedPayload ?? {}),
    });

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const data = isJson ? await response.json() : await response.text();

    // Forward rate limit-related headers when present (e.g., Retry-After)
    try {
      const retryAfter = response.headers.get("retry-after");
      if (retryAfter) {
        res.set("Retry-After", retryAfter);
      }
    } catch (_) { }

    try {
      console.log("[labsflow/execute] status:", response.status);
    } catch (_) { }
    res.status(response.status).send(data);
  } catch (err) {
    console.error("Proxy error", err);
    res.status(500).json({ error: "Proxy failed", detail: String(err) });
  }
});

// Upload gambar (base64 data URL) -> simpan file ke /uploads dan balas URL
app.post("/api/upload_base64", async (req, res) => {
  try {
    const { fileName, mime, dataUrl } = req.body || {};
    if (!dataUrl || typeof dataUrl !== "string") {
      return res.status(400).json({ error: "Missing dataUrl" });
    }
    const match = dataUrl.match(/^data:(.*?);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: "Invalid dataUrl format" });
    }
    const contentType = mime || match[1] || "image/png";
    const base64 = match[2];
    const buf = Buffer.from(base64, "base64");
    const ext =
      contentType.includes("jpeg") || contentType.includes("jpg")
        ? "jpg"
        : contentType.includes("png")
          ? "png"
          : "bin";
    const safeName = (fileName || `upload-${Date.now()}`).replace(
      /[^a-zA-Z0-9_.-]/g,
      "_"
    );
    const destName = `${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}-${safeName}.${ext}`;
    const destPath = path.join(uploadsDir, destName);
    fs.writeFileSync(destPath, buf);
    const url = `/uploads/${destName}`;
    res.json({ url, contentType });
  } catch (err) {
    console.error("Upload error", err);
    res.status(500).json({ error: "Upload failed", detail: String(err) });
  }
});

// Upload gambar ke Google Labs dan coba finalisasi menjadi Media (mengambil mediaId)
app.post("/api/labs/upload_image", async (req, res) => {
  try {
    const { fileName, mime, dataUrl, imageAspectRatio } = req.body || {};
    if (!dataUrl || typeof dataUrl !== "string") {
      return res.status(400).json({ error: "Missing dataUrl" });
    }
    const m = dataUrl.match(/^data:(.*?);base64,(.+)$/);
    if (!m) {
      return res.status(400).json({ error: "Invalid dataUrl format" });
    }
    const contentType = mime || m[1] || "image/png";
    const base64 = m[2];
    const bearer = process.env.LABS_BEARER;
    if (!bearer) {
      return res
        .status(500)
        .json({ error: "LABS_BEARER is not set on server." });
    }

    // 1) Upload ke Labs sebagai text/plain (meniru panggilan Labs UI)
    const uploadUrl =
      process.env.LABS_IMAGE_UPLOAD_URL ||
      "https://aisandbox-pa.googleapis.com/v1:uploadUserImage";
    // Untuk upload biner, banyak Google APIs memakai prefix /upload dan query uploadType=media
    const uploadMediaUrl =
      process.env.LABS_IMAGE_UPLOAD_MEDIA_URL ||
      (() => {
        const base = uploadUrl.includes("/upload/")
          ? uploadUrl
          : uploadUrl.replace(
            "https://aisandbox-pa.googleapis.com/",
            "https://aisandbox-pa.googleapis.com/upload/"
          );
        const hasQuery = base.includes("?");
        return base + (hasQuery ? "&" : "?") + "uploadType=media";
      })();

    const tryPlain = async (bodyText) => {
      return fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "text/plain; charset=UTF-8",
          Accept: "application/json",
        },
        body: bodyText,
      });
    };

    const tryBinary = async (buf, mimeType) => {
      // Gunakan endpoint /upload dengan uploadType=media untuk raw bytes
      return fetch(uploadMediaUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/octet-stream",
          "X-Goog-Upload-Content-Type": mimeType || "application/octet-stream",
          "X-Goog-Upload-Protocol": "raw",
          ...(fileName ? { "X-Goog-Upload-File-Name": fileName } : {}),
          Accept: "application/json",
        },
        body: buf,
      });
    };

    const tryJson = async (payload) => {
      return fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
    };

    // UI Labs mengirim JSON sebagai text/plain; kita tiru pola itu
    const tryPlainJson = async (payload) => {
      return fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "text/plain; charset=UTF-8",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
    };

    // Prioritas pertama: kirim payload persis seperti DevTools UI
    let uploadResp;
    let lastResp; // simpan respons terakhir untuk detail error
    const attempts = []; // kumpulkan detail setiap percobaan untuk diagnosa
    const selectedImageAspect =
      imageAspectRatio ||
      process.env.LABS_DEFAULT_IMAGE_ASPECT ||
      "IMAGE_ASPECT_RATIO_LANDSCAPE";
    const envClientContext = (() => {
      try {
        return JSON.parse(process.env.LABS_DEFAULT_CLIENT_CONTEXT || "null");
      } catch (_) {
        return undefined;
      }
    })();
    const uiPayload = {
      imageInput: {
        rawImageBytes: base64,
        mimeType: contentType,
        isUserUploaded: true,
        aspectRatio: selectedImageAspect,
      },
      ...(envClientContext ? { clientContext: envClientContext } : {}),
    };
    {
      const resp = await tryPlainJson(uiPayload);
      try {
        console.log(
          "[labs/upload_image] try text/plain JSON uiPayload",
          "status:",
          resp.status
        );
      } catch (_) { }
      if (resp.ok) {
        uploadResp = resp;
      } else {
        try {
          const ct = resp.headers?.get("content-type") || "";
          const detail = ct.includes("application/json")
            ? await resp.json()
            : await resp.text();
          attempts.push({
            type: "text_plain_json",
            keys: Object.keys(uiPayload.imageInput || {}),
            status: resp.status,
            detail,
          });
        } catch (e) {
          attempts.push({
            type: "text_plain_json",
            keys: Object.keys(uiPayload.imageInput || {}),
            status: resp.status,
            detail: String(e),
          });
        }
        lastResp = resp;
      }
    }
    // Jika masih gagal, coba kandidat JSON lain
    const jsonCandidates = [
      // Kandidat sebelumnya (tetap agar dapat melihat pesan unknown yang membantu)
      { imageBytes: base64, mimeType: contentType, fileName },
      { base64Data: base64, mimeType: contentType, fileName },
      { data: base64, mimeType: contentType, fileName },
      { bytes: base64, mimeType: contentType, fileName },
      { content: base64, mimeType: contentType, fileName },
      { imageBase64: base64, mimeType: contentType, fileName },
      { userImage: { mimeType: contentType, imageBytes: base64, fileName } },
      { media: { mimeType: contentType, data: base64, fileName } },
      { image: base64, mimeType: contentType, fileName },
      // Kandidat yang menyebut 'userUploadedImage' secara top-level
      {
        userUploadedImage: {
          mimeType: contentType,
          imageData: base64,
          fileName,
        },
      },
      {
        userUploadedImage: {
          mimeType: contentType,
          imageBase64: base64,
          fileName,
        },
      },
      {
        userUploadedImage: {
          mimeType: contentType,
          dataUrl: dataUrl,
          fileName,
        },
      },
      // Kandidat baru yang mengikuti pola Google Vision/Proto JSON: image.content berisi base64
      { image: { content: base64 } },
      { image: { content: base64, mimeType: contentType }, fileName },
      { image: { data: base64, mimeType: contentType }, fileName },
      { image: { dataUrl: dataUrl, mimeType: contentType }, fileName },
      // Top-level dataUrl sederhana
      { dataUrl: dataUrl },
      { dataUrl: dataUrl, fileName },
      { dataUrl: dataUrl, mimeType: contentType, fileName },
    ];
    for (const jc of jsonCandidates) {
      const resp = await tryJson(jc);
      try {
        console.log(
          "[labs/upload_image] try json candidate keys:",
          Object.keys(jc),
          "status:",
          resp.status
        );
      } catch (_) { }
      if (resp.ok) {
        uploadResp = resp;
        break;
      }
      // Baca detail error untuk diagnosa
      try {
        const ct = resp.headers?.get("content-type") || "";
        const detail = ct.includes("application/json")
          ? await resp.json()
          : await resp.text();
        attempts.push({
          type: "json",
          keys: Object.keys(jc),
          status: resp.status,
          detail,
        });
      } catch (e) {
        attempts.push({
          type: "json",
          keys: Object.keys(jc),
          status: resp.status,
          detail: String(e),
        });
      }
      lastResp = resp;
    }
    if (!uploadResp) {
      // Fallback: kirim bytes biner + X-Goog headers (meski service /upload bisa 404)
      const buf = Buffer.from(base64, "base64");
      const respBin = await tryBinary(buf, contentType);
      try {
        console.log(
          "[labs/upload_image] try binary bytes",
          contentType,
          "url:",
          uploadMediaUrl,
          "status:",
          respBin.status
        );
      } catch (_) { }
      if (respBin.ok) uploadResp = respBin;
      else {
        try {
          const ct = respBin.headers?.get("content-type") || "";
          const detail = ct.includes("application/json")
            ? await respBin.json()
            : await respBin.text();
          attempts.push({
            type: "binary",
            status: respBin.status,
            url: uploadMediaUrl,
            detail,
          });
        } catch (e) {
          attempts.push({
            type: "binary",
            status: respBin.status,
            url: uploadMediaUrl,
            detail: String(e),
          });
        }
        lastResp = respBin;
      }
    }
    if (!uploadResp) {
      // Fallback: text/plain base64
      const respPlain = await tryPlain(base64);
      try {
        console.log(
          "[labs/upload_image] try text/plain base64, status:",
          respPlain.status
        );
      } catch (_) { }
      if (respPlain.ok) uploadResp = respPlain;
      else {
        try {
          const ct = respPlain.headers?.get("content-type") || "";
          const detail = ct.includes("application/json")
            ? await respPlain.json()
            : await respPlain.text();
          attempts.push({
            type: "text_base64",
            status: respPlain.status,
            detail,
          });
        } catch (e) {
          attempts.push({
            type: "text_base64",
            status: respPlain.status,
            detail: String(e),
          });
        }
        lastResp = respPlain;
      }
    }
    if (!uploadResp) {
      // Fallback: text/plain full dataUrl
      const respDataUrl = await tryPlain(dataUrl);
      try {
        console.log(
          "[labs/upload_image] try text/plain dataUrl, status:",
          respDataUrl.status
        );
      } catch (_) { }
      if (respDataUrl.ok) uploadResp = respDataUrl;
      else {
        try {
          const ct = respDataUrl.headers?.get("content-type") || "";
          const detail = ct.includes("application/json")
            ? await respDataUrl.json()
            : await respDataUrl.text();
          attempts.push({
            type: "text_dataurl",
            status: respDataUrl.status,
            detail,
          });
        } catch (e) {
          attempts.push({
            type: "text_dataurl",
            status: respDataUrl.status,
            detail: String(e),
          });
        }
        lastResp = respDataUrl;
      }
    }

    // Jika semua percobaan gagal, jangan akses uploadResp (undefined)
    if (!uploadResp) {
      // Jangan baca ulang body lastResp agar tidak memicu "Body already read"
      const lastAttemptDetail = attempts.length
        ? attempts[attempts.length - 1].detail
        : undefined;
      return res.status(lastResp?.status || 400).json({
        error: "uploadUserImage failed",
        detail: lastAttemptDetail,
        attempts,
      });
    }

    const uploadCT = uploadResp.headers.get("content-type") || "";
    const uploadData = uploadCT.includes("application/json")
      ? await uploadResp.json()
      : await uploadResp.text();
    if (!uploadResp.ok) {
      return res
        .status(uploadResp.status)
        .json({ error: "uploadUserImage failed", detail: uploadData });
    }

    // Normalisasi respons upload dan coba ekstrak token/handle
    const uploadText = typeof uploadData === "string" ? uploadData : "";
    const uploadJson =
      typeof uploadData === "string"
        ? (() => {
          try {
            return JSON.parse(uploadData);
          } catch {
            return {};
          }
        })()
        : uploadData;
    const uploadToken =
      uploadJson?.uploadToken ||
      uploadJson?.token ||
      (uploadText ? uploadText.trim() : undefined);
    const candidateMediaId =
      uploadJson?.image?.metadata?.name ||
      uploadJson?.metadata?.name ||
      uploadJson?.name;
    // Deteksi mediaGenerationId dari respons upload
    const mediaGenId = (() => {
      try {
        if (typeof uploadJson?.mediaGenerationId === "string")
          return uploadJson.mediaGenerationId;
        if (typeof uploadJson?.mediaGenerationId === "object")
          return uploadJson.mediaGenerationId?.mediaGenerationId;
        return undefined;
      } catch (_) {
        return undefined;
      }
    })();

    // 2) Opsional: coba finalisasi menjadi Media jika mediaId belum didapat
    let mediaId = candidateMediaId || mediaGenId;
    let finalizeData;
    try {
      const finalizeUrl =
        process.env.LABS_IMAGE_FINALIZE_URL ||
        "https://aisandbox-pa.googleapis.com/v1/userMedia:create";
      // Sederhanakan ke varian yang paling masuk akal
      const payloads = [];
      if (uploadToken) {
        payloads.push({
          simpleMediaItem: {
            uploadToken,
            fileName: fileName || `upload-${Date.now()}`,
          },
        });
      }
      if (mediaGenId) {
        payloads.push({
          userUploadedImage: {
            mediaGenerationId: mediaGenId,
            mimeType: contentType,
            fileName: fileName || `upload-${Date.now()}`,
          },
        });
      }
      for (const fp of payloads) {
        const finResp = await fetch(finalizeUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${bearer}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fp),
        });
        const finCT = finResp.headers.get("content-type") || "";
        finalizeData = finCT.includes("application/json")
          ? await finResp.json()
          : await finResp.text();
        if (finResp.ok) {
          const finJson =
            typeof finalizeData === "string"
              ? (() => {
                try {
                  return JSON.parse(finalizeData);
                } catch {
                  return {};
                }
              })()
              : finalizeData;
          mediaId =
            finJson?.image?.metadata?.name ||
            finJson?.metadata?.name ||
            mediaId;
          if (mediaId) break;
        }
      }
    } catch (_) {
      // Biarkan tanpa mediaId jika finalisasi gagal; respons upload tetap dikembalikan
    }

    return res.json({
      ok: true,
      mediaId: mediaId || undefined,
      upload: uploadJson,
      finalize: finalizeData || undefined,
    });
  } catch (err) {
    console.error("Labs upload_image error", err);
    res
      .status(500)
      .json({ error: "Labs upload_image failed", detail: String(err) });
  }
});

// Download a resource via Bearer auth and stream it back to the client
app.get("/api/labsflow/download", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url || typeof url !== "string") {
      return res
        .status(400)
        .json({ error: "Missing required query parameter 'url'" });
    }

    // Allow only Google-related domains for safety
    const allowed =
      /^https:\/\/(?:[a-zA-Z0-9-]+\.)*(googleapis\.com|google\.com|gstatic\.com|googleusercontent\.com|storage\.googleapis\.com)\//.test(
        url
      );
    if (!allowed) {
      return res
        .status(400)
        .json({ error: "URL not allowed for download proxy." });
    }

    const bearer = process.env.LABS_BEARER;
    if (!bearer) {
      return res
        .status(500)
        .json({ error: "LABS_BEARER is not set on server." });
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: "*/*",
      },
    });

    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const contentLength = response.headers.get("content-length");

    res.status(response.status);
    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);

    if (!response.ok) {
      const text = await response.text();
      return res.send(text);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.send(buffer);
  } catch (err) {
    console.error("Download proxy error", err);
    res
      .status(500)
      .json({ error: "Download proxy failed", detail: String(err) });
  }
});

// Proxy to GeminiGen Sora 2 API with SORA_API_KEY
app.post("/api/sora/execute", async (req, res) => {
  try {
    const cookies = parseCookies(req.headers["cookie"] || "");
    const userForStats = {
      id: cookies.uid || "",
      email: cookies.email || "",
      name: cookies.name || "",
      plan: cookies.plan || "",
    };
    const userId = cookies.auth_uid || cookies.uid || "";
    const {
      prompt,
      model = "sora-2",
      aspect_ratio = "landscape",
      resolution = "small",
      duration = 10,
      provider = "openai",
      webhook_url,
    } = req.body || {};

    // Prefer SORA_API_KEY, fallback to SORA_BEARER for migration
    const apiKey = (
      process.env.SORA_API_KEY ||
      process.env.SORA_BEARER ||
      ""
    ).trim();

    console.log(
      "[Sora] Using API Key:",
      apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : "NONE"
    );

    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "SORA_API_KEY is not set on server." });
    }

    // Determine effective webhook URL
    const effectiveWebhookUrl =
      webhook_url || process.env.SORA_WEBHOOK_URL || undefined;

    console.log(
      "[Sora] Webhook URL:",
      effectiveWebhookUrl || "NONE (Polling only)"
    );

    // Use FormData for Sora 2 (GeminiGen) as per new docs
    const formData = new FormData();
    formData.append("prompt", String(prompt || ""));
    formData.append("model", String(model || "sora-2"));
    formData.append(
      "aspect_ratio",
      aspect_ratio === "portrait" ? "portrait" : "landscape"
    );
    formData.append("resolution", String(resolution || "small"));
    formData.append("duration", String(Number(duration || 10)));

    // Append webhook_url if available (hope it's supported)
    if (effectiveWebhookUrl) {
      formData.append("webhook_url", effectiveWebhookUrl);
    }

    // Include image data if present
    if (
      typeof req.body?.image_data === "string" &&
      req.body.image_data.trim().length
    ) {
      const base64Data = req.body.image_data.trim();
      const mime = req.body.image_mime || "image/jpeg";
      const buffer = Buffer.from(base64Data, "base64");
      const blob = new Blob([buffer], { type: mime });
      formData.append("files", blob, "image.jpg");
    } else if (
      typeof req.body?.image_url === "string" &&
      req.body.image_url.trim().length
    ) {
      formData.append("file_urls", req.body.image_url.trim());
    }

    // Use x-api-key header
    const headers = {
      "x-api-key": apiKey,
      Accept: "application/json",
    };

    console.log(
      "[sora/execute] Sending multipart request to GeminiGen Sora 2 API..."
    );

    const response = await fetch(
      "https://api.geminigen.ai/uapi/v1/video-gen/sora",
      {
        method: "POST",
        headers: {
          ...headers,
          Origin: "https://geminigen.ai",
          Referer: "https://geminigen.ai/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        },
        body: formData,
      }
    );

    const ct = response.headers.get("content-type") || "";
    const data = ct.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      console.error(
        "[sora/execute] Upstream error:",
        response.status,
        JSON.stringify(data)
      );
    } else {
      console.log("[sora/execute] Upstream success:", JSON.stringify(data));
    }

    if (response.ok) {
      try {
        bumpUsage(userForStats, "sora2");
      } catch (_) { }

      // If API returns a job ID (Async), persist it locally
      if (data && typeof data === "object" && (data.id || data.uuid)) {
        const jobId = data.id || data.uuid;
        const jobs = readSoraJobs();
        const baseJob = {
          id: jobId,
          uuid: data.uuid, // Store UUID for polling
          status: data.status || "processing",
          created_at: new Date().toISOString(),
          // custom_id removed as it's not sent
          result: null,
        };
        jobs[jobId] = baseJob;
        // Simpan juga dengan key UUID agar lookup polling/webhook konsisten
        if (data.uuid && data.uuid !== jobId) {
          jobs[data.uuid] = { ...baseJob, id: data.id || jobId };
        }
        writeSoraJobs(jobs);
      }
    }

    res.status(response.status).send(data);
  } catch (err) {
    console.error("[sora/execute] Proxy error", err);
    res.status(500).json({ error: "Sora proxy failed", detail: String(err) });
  }
});

import { createHash, createVerify } from "crypto";

// Verify Signature Helper
function verifySignatureByPublicKey(data, signature, publicKey) {
  try {
    // Create MD5 hash of the data
    const eventDataHash = createHash("md5").update(data).digest("hex");

    // Verify the signature
    const verifier = createVerify("RSA-SHA256");
    verifier.update(eventDataHash);
    return verifier.verify(publicKey, Buffer.from(signature, "hex"));
  } catch (e) {
    console.error("[Sora] Signature verification error:", e);
    return false;
  }
}

// Webhook receiver for Sora 2
app.post("/api/sora/webhook", async (req, res) => {
  try {
    // Capture raw body for signature verification if needed
    // Note: Express body-parser usually consumes the stream.
    // In a real production env, you'd need the raw buffer.
    // Here we assume 'req.body' is JSON parsed.
    // If strict verification is needed, we must use verify callback in body-parser.

    const body = req.body || {};
    console.log("[Sora] Webhook headers:", JSON.stringify(req.headers));
    console.log("[Sora] Webhook received:", JSON.stringify(body));

    // Signature Verification (Optional)
    const signature = req.headers["x-signature"];
    let publicKey = process.env.SORA_WEBHOOK_PUBLIC_KEY;

    // Try reading from file if not in env
    if (!publicKey) {
      try {
        const keyPath = path.resolve(process.cwd(), "sora_public_key.pem");
        if (fs.existsSync(keyPath)) {
          publicKey = fs.readFileSync(keyPath, "utf8");
        }
      } catch (e) {
        console.warn("[Sora] Failed to read public key file:", e.message);
      }
    }

    if (publicKey && signature) {
      // Note: This is a simplified check. 'JSON.stringify(body)' might not match original raw body exactly.
      // For strict compliance, we need the raw request body string.
      const isValid = verifySignatureByPublicKey(
        JSON.stringify(body),
        signature,
        publicKey
      );
      if (!isValid) {
        console.warn("[Sora] Invalid webhook signature!");
        // return res.status(401).json({ error: "Invalid signature" }); // Uncomment to enforce
      } else {
        console.log("[Sora] Webhook signature verified.");
      }
    }

    // Adjust field names based on actual webhook payload
    // GeminiGen Webhook structure: { event, uuid, data: { id, status, media_url, thumbnail_url, error_message } }
    const { event, uuid: eventUuid, data } = body;
    const payloadData = data || body; // Fallback to body if data is missing

    const {
      id,
      uuid,
      status,
      output,
      error,
      video_url,
      media_url,
      error_message,
    } = payloadData;

    // Job ID can be in various places
    const jobId = id || uuid || eventUuid || payloadData.id || payloadData.uuid;

    if (jobId) {
      const jobs = readSoraJobs();
      const relatedKeys = new Set(
        [jobId, uuid, id, eventUuid, payloadData.id, payloadData.uuid]
          .filter(Boolean)
          .map((x) => String(x))
      );

      // Jika ada job lain yang mencatat uuid yang sama, ikut perbarui
      if (uuid) {
        for (const [k, v] of Object.entries(jobs)) {
          if (v && v.uuid && String(v.uuid) === String(uuid)) {
            relatedKeys.add(k);
          }
        }
      }

      const applyUpdate = (key) => {
        const current = jobs[key] || {};
        const next = {
          ...current,
          id: current.id || key,
          uuid: current.uuid || uuid || id || eventUuid,
          status: status || current.status || "unknown",
          updated_at: new Date().toISOString(),
          result: output || current.result || null,
          video_url: media_url || video_url || current.video_url,
          error: error_message || error || current.error,
          webhook_payload: body,
          received_at: current.received_at || new Date().toISOString(),
        };
        jobs[key] = next;
      };

      relatedKeys.forEach((k) => applyUpdate(k));
      writeSoraJobs(jobs);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("Webhook error", e);
    res.status(500).json({ error: String(e) });
  }
});

// Job status polling with Upstream Fallback (for local testing without webhooks)
app.get("/api/sora/status", async (req, res) => {
  try {
    const rawId = String(req.query.id || "").trim();
    const rawUuid = String(req.query.uuid || "").trim();
    if (!rawId && !rawUuid)
      return res.status(400).json({ error: "Missing id or uuid" });

    const jobs = readSoraJobs();
    const findJob = () => {
      if (rawUuid && jobs[rawUuid]) return jobs[rawUuid];
      if (rawId && jobs[rawId]) return jobs[rawId];
      if (rawUuid) {
        for (const v of Object.values(jobs)) {
          if (v && String(v.uuid || "") === rawUuid) return v;
        }
      }
      return null;
    };
    let job = findJob();

    // If job is locally known but not finished, OR not known (maybe created elsewhere?),
    // try to poll upstream API to update local state.
    // This mimics "webhook" behavior for local dev.
    const statusLower = String(job?.status || "").toLowerCase();
    const isFinished =
      !!job &&
      (statusLower === "completed" ||
        statusLower === "failed" ||
        statusLower === "succeeded" ||
        statusLower === "success" ||
        statusLower === "done" ||
        statusLower === "2" ||
        job.status === 2 ||
        !!job.video_url); // treat status=2 (from docs) or existing video_url as finished

    if (!isFinished) {
      try {
        const apiKey = (
          process.env.SORA_API_KEY ||
          process.env.SORA_BEARER ||
          ""
        ).trim();
        if (apiKey) {
          // Try fetching detail/status from GeminiGen (termasuk endpoint khusus Sora)
          const idsToPoll = Array.from(
            new Set(
              [
                rawId,
                rawUuid,
                job?.id,
                job?.uuid,
                // kalau job belum dikenal, tetap coba id/uuid yang ada
              ]
                .filter(Boolean)
                .map((x) => String(x))
            )
          );

          const endpoints = [];
          for (const target of idsToPoll) {
            endpoints.push(
              `https://api.geminigen.ai/uapi/v1/video-gen/status?id=${encodeURIComponent(
                target
              )}`
            );
            endpoints.push(
              `https://api.geminigen.ai/uapi/v1/video-gen/status?uuid=${encodeURIComponent(
                target
              )}`
            );
            endpoints.push(
              `https://api.geminigen.ai/uapi/v1/sora/status?id=${encodeURIComponent(
                target
              )}`
            );
            endpoints.push(
              `https://api.geminigen.ai/uapi/v1/sora/status?uuid=${encodeURIComponent(
                target
              )}`
            );
            endpoints.push(
              `https://api.geminigen.ai/uapi/v1/video-gen/sora/status?id=${encodeURIComponent(
                target
              )}`
            );
            endpoints.push(
              `https://api.geminigen.ai/uapi/v1/video-gen/sora/status?uuid=${encodeURIComponent(
                target
              )}`
            );
            endpoints.push(
              `https://api.geminigen.ai/api/video-gen/detail?uuid=${encodeURIComponent(
                target
              )}`
            );
            // History detail API (terdokumentasi) — sering lebih stabil
            endpoints.push(
              `https://api.geminigen.ai/uapi/v1/history/${encodeURIComponent(
                target
              )}`
            );
          }

          for (const upstreamUrl of endpoints) {
            try {
              console.log(
                `[sora/status] Polling ${upstreamUrl} ... Key: ${apiKey.slice(
                  0,
                  5
                )}...`
              );
              const resp = await fetch(upstreamUrl, {
                method: "GET",
                headers: {
                  "x-api-key": apiKey, // Try both headers
                  Authorization: `Bearer ${apiKey}`,
                  Accept: "application/json",
                  "User-Agent": "Veo/3.1 (Local Dev)",
                },
              });

              if (resp.ok) {
                const data = await resp.json();
                // Check if we got valid data
                const validData = data.data || data.result || data; // uapi might wrap in data or result
                const newStatus = validData.status;
                const remoteId = validData.id || validData.uuid;

                console.log(
                  `[sora/status] Poll success. ID: ${remoteId}, Status: ${newStatus}`
                );

                if (remoteId || newStatus) {
                  const now = new Date().toISOString();
                  const normalizeStatus = (s) => {
                    if (s === 3 || s === "3") return "completed";
                    if (s === 4 || s === "4") return "failed";
                    if (s === 2 || s === "2") return "completed";
                    if (s === 1 || s === "1") return "processing";
                    return s || "processing";
                  };
                  const mergedJob = job || {
                    id: remoteId || rawId || rawUuid,
                    uuid: validData.uuid || rawUuid || rawId,
                    created_at: now,
                  };
                  mergedJob.status = normalizeStatus(newStatus);
                  mergedJob.updated_at = now;
                  if (validData.video_url)
                    mergedJob.video_url = validData.video_url;
                  if (validData.media_url)
                    mergedJob.video_url = validData.media_url;
                  if (validData.generate_result)
                    mergedJob.video_url = validData.generate_result;
                  if (validData.output) mergedJob.result = validData.output;
                  if (validData.error) mergedJob.error = validData.error;
                  if (validData.error_message)
                    mergedJob.error = validData.error_message;

                  if (
                    Array.isArray(validData.generated_video) &&
                    validData.generated_video[0]
                  ) {
                    mergedJob.video_url =
                      validData.generated_video[0].video_url ||
                      mergedJob.video_url;
                    mergedJob.result = {
                      generated_video: validData.generated_video,
                    };
                  }

                  // Beberapa respons history memakai field 'generated_video' bertingkat
                  if (
                    Array.isArray(validData.generated_video) &&
                    validData.generated_video[0]?.video_url
                  ) {
                    mergedJob.video_url =
                      validData.generated_video[0].video_url ||
                      mergedJob.video_url;
                  }

                  // Simpan ke semua key yang relevan (id & uuid)
                  const keysToUpdate = new Set(
                    [
                      rawId,
                      rawUuid,
                      mergedJob.id,
                      mergedJob.uuid,
                      remoteId,
                      validData.uuid,
                    ]
                      .filter(Boolean)
                      .map((x) => String(x))
                  );
                  keysToUpdate.forEach((k) => {
                    const current = jobs[k] || {};
                    jobs[k] = {
                      ...current,
                      ...mergedJob,
                      id: current.id || mergedJob.id || k,
                      uuid: mergedJob.uuid || current.uuid,
                    };
                  });

                  job = mergedJob;
                  writeSoraJobs(jobs);
                  break; // Stop trying endpoints if successful
                }
              } else {
                console.warn(
                  `[sora/status] Poll failed ${resp.status} for ${upstreamUrl}`
                );
                try {
                  const errText = await resp.text();
                  console.warn(`[sora/status] Error body: ${errText}`);
                } catch (_) { }
              }
            } catch (e) {
              console.warn(
                `[sora/status] Poll failed for ${upstreamUrl}:`,
                e.message
              );
            }
          }
        }
      } catch (err) {
        // Ignore upstream polling errors, just serve what we have
        console.warn("[sora/status] Upstream polling failed:", err);
      }
    }

    // Re-read job setelah update
    job = findJob();

    if (!job) {
      return res
        .status(404)
        .json({ error: "Job not found locally or upstream" });
    }

    // Construct response compatible with frontend expectations
    const response = {
      id: job.id,
      status: job.status,
      // If we have result or video_url, expose it
      video_url: job.video_url || job.result?.video_url,
      generated_video:
        job.result?.generated_video ||
        (job.video_url ? [{ video_url: job.video_url }] : []),
    };

    res.json(response);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Download proxy for Sora result urls, forcing attachment
app.get("/api/sora/download", async (req, res) => {
  try {
    const rawUrl = String(req.query.url || "").trim();
    if (!rawUrl) return res.status(400).json({ error: "Missing 'url' query" });
    const url = rawUrl.replace(/[`"']/g, "");
    const allowed =
      /^https:\/\/(?:[a-zA-Z0-9-]+\.)*(geminigen\.ai|cloudflarestorage\.com|tksou\.com|user-files-downloader\.geminigen\.ai|cdn\.geminigen\.ai)\//.test(
        url
      );
    if (!allowed)
      return res
        .status(400)
        .json({ error: "URL not allowed for Sora download proxy." });

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "*/*",
        Origin: "https://geminigen.ai",
        Referer: "https://geminigen.ai/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      },
    });
    const ct =
      response.headers.get("content-type") || "application/octet-stream";
    const cl = response.headers.get("content-length");
    // derive filename from path
    const pathname = (() => {
      try {
        return new URL(url).pathname;
      } catch {
        return "";
      }
    })();
    let fname =
      pathname.split("/").filter(Boolean).pop() || `sora-${Date.now()}.mp4`;
    if (!/\.\w+$/.test(fname)) fname = `${fname}.mp4`;

    res.status(response.status);
    res.setHeader("Content-Type", ct);
    if (cl) res.setHeader("Content-Length", cl);
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);

    if (!response.ok) {
      const text = await response.text();
      return res.send(text);
    }
    const buf = Buffer.from(await response.arrayBuffer());
    return res.send(buf);
  } catch (err) {
    console.error("[sora/download] error", err);
    res
      .status(500)
      .json({ error: "Download proxy failed", detail: String(err) });
  }
});

app.get("/api/settings", (req, res) => {
  res.json({
    labsBearer: process.env.LABS_BEARER || "",
  });
});

app.post("/api/settings", (req, res) => {
  try {
    const { labsBearer } = req.body || {};
    const sanitizedBearer = persistEnvValue(
      "LABS_BEARER",
      typeof labsBearer === "string" ? labsBearer : ""
    );
    process.env.LABS_BEARER = sanitizedBearer;
    res.json({ ok: true, labsBearer: sanitizedBearer });
  } catch (err) {
    console.error(
      "[settings] Failed to persist LABS_BEARER / APP_CREDENTIAL",
      err
    );
    res
      .status(500)
      .json({ error: "Failed to update settings", detail: String(err) });
  }
});

// === Sora 2 specific bearer settings ===
// Removed per instruction: settings managed via server ENV only.

// === License Activation: verify signed activation token and set APP_CREDENTIAL ===
const readPublicKey = () => {
  let pk = (process.env.LICENSE_PUBLIC_KEY || "").trim();
  const p = (process.env.LICENSE_PUBLIC_KEY_PATH || "").trim();
  if (!pk && p) {
    try {
      pk = fs.readFileSync(path.resolve(process.cwd(), p), "utf8");
    } catch (e) {
      console.warn("[license] Failed to read LICENSE_PUBLIC_KEY_PATH:", e);
    }
  }
  return pk;
};

const b64urlToBuffer = (s) => {
  const normalized = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64");
};

const b64urlJson = (s) => {
  try {
    return JSON.parse(Buffer.from(b64urlToBuffer(s)).toString("utf8"));
  } catch {
    return null;
  }
};

app.post("/api/license/activate", (req, res) => {
  return res.status(410).json({ error: "Activation disabled" });
});

// Query current activation state
app.get("/api/license/state", (req, res) => {
  try {
    const state = readActivationState();
    const activated = !!Object.values(state.licenses || {}).some(
      (x) => x && x.activated
    );
    res.json({ activated });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Provide default configuration from environment for the client UI
app.get("/api/config", (req, res) => {
  const parseJsonEnv = (name) => {
    const v = process.env[name];
    if (!v) return undefined;
    try {
      return JSON.parse(v);
    } catch {
      return undefined;
    }
  };
  const config = {
    defaultGenerateUrl:
      process.env.LABS_DEFAULT_GENERATE_URL ||
      "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText",
    defaultCheckUrl:
      process.env.LABS_DEFAULT_CHECK_URL ||
      "https://aisandbox-pa.googleapis.com/v1/operations:batchCheckAsyncVideoGenerationStatus",
    defaultModelKey: process.env.LABS_DEFAULT_MODEL_KEY || "",
    defaultAspectRatio:
      process.env.LABS_DEFAULT_ASPECT_RATIO || "VIDEO_ASPECT_RATIO_LANDSCAPE",
    defaultImageAspect:
      process.env.LABS_DEFAULT_IMAGE_ASPECT || "IMAGE_ASPECT_RATIO_LANDSCAPE",
    defaultHeaders: parseJsonEnv("LABS_DEFAULT_HEADERS") || {},
    clientContext: parseJsonEnv("LABS_DEFAULT_CLIENT_CONTEXT") || undefined,
  };
  res.json(config);
});

// =============================================================================
// === PLAYWRIGHT BROWSER AUTOMATION ENDPOINTS (bypass reCAPTCHA) ==============
// === ADMIN ONLY - Fitur ini hanya untuk admin =================================
// =============================================================================

// Middleware untuk memeriksa apakah user adalah admin (via cookie atau JWT)
const requireBrowserAdmin = async (req, res, next) => {
  try {
    // Cek via cookie plan
    const cookies = parseCookies(req.headers.cookie);
    const planFromCookie = String(cookies.plan || "").toLowerCase();

    if (planFromCookie === "admin") {
      return next();
    }

    // Fallback: cek via JWT jika ada
    const authHeader = String(req.headers["authorization"] || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (token && srSupabase) {
      try {
        const { data: userData } = await srSupabase.auth.getUser(token);
        const uid = String(userData?.user?.id || "");
        if (uid) {
          const { plan } = await fetchPlanForUser(uid);
          if (String(plan || "").toLowerCase() === "admin") {
            return next();
          }
        }
      } catch (_) { }
    }

    return res.status(403).json({
      success: false,
      error: "Akses ditolak. Fitur ini hanya untuk Admin."
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: String(e) });
  }
};

// Store SSE connections for browser events
const browserEventSubscribers = new Set();

// Forward playwright events to SSE subscribers
playwrightVeo.veoEvents.on("browser-status", (data) => {
  broadcastBrowserEvent("browser-status", data);
});
playwrightVeo.veoEvents.on("login-required", (data) => {
  broadcastBrowserEvent("login-required", data);
});
playwrightVeo.veoEvents.on("ready", (data) => {
  broadcastBrowserEvent("ready", data);
});
playwrightVeo.veoEvents.on("captcha-required", (data) => {
  broadcastBrowserEvent("captcha-required", data);
});
playwrightVeo.veoEvents.on("job-started", (data) => {
  broadcastBrowserEvent("job-started", data);
});
playwrightVeo.veoEvents.on("job-progress", (data) => {
  broadcastBrowserEvent("job-progress", data);
});
playwrightVeo.veoEvents.on("job-completed", (data) => {
  broadcastBrowserEvent("job-completed", data);
});
playwrightVeo.veoEvents.on("job-failed", (data) => {
  broadcastBrowserEvent("job-failed", data);
});
playwrightVeo.veoEvents.on("job-cancelled", (data) => {
  broadcastBrowserEvent("job-cancelled", data);
});
playwrightVeo.veoEvents.on("recaptcha-token-captured", (data) => {
  broadcastBrowserEvent("recaptcha-token-captured", data);
});
playwrightVeo.veoEvents.on("token-capture-started", (data) => {
  broadcastBrowserEvent("token-capture-started", data);
});
playwrightVeo.veoEvents.on("token-capture-success", (data) => {
  broadcastBrowserEvent("token-capture-success", data);
});
playwrightVeo.veoEvents.on("token-capture-failed", (data) => {
  broadcastBrowserEvent("token-capture-failed", data);
});

function broadcastBrowserEvent(event, data) {
  const payload = JSON.stringify({ event, ...data, timestamp: Date.now() });
  for (const res of browserEventSubscribers) {
    try {
      res.write(`event: ${event}\ndata: ${payload}\n\n`);
    } catch (_) { }
  }
}

// SSE endpoint untuk browser events (Admin only)
app.get("/api/browser/events", requireBrowserAdmin, (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write("event: connected\ndata: {}\n\n");
  browserEventSubscribers.add(res);
  req.on("close", () => {
    browserEventSubscribers.delete(res);
  });
});

// Launch browser (Admin only)
app.post("/api/browser/launch", requireBrowserAdmin, async (req, res) => {
  try {
    const result = await playwrightVeo.launchBrowser(req.body || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Close browser (Admin only)
app.post("/api/browser/close", requireBrowserAdmin, async (req, res) => {
  try {
    const result = await playwrightVeo.closeBrowser();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Restart browser dengan VISIBLE mode (untuk login/ganti akun)
// Support both GET and POST for convenience
const restartVisibleHandler = async (req, res) => {
  try {
    console.log("[Admin] Restarting browser in visible mode...");

    // Close existing browser first
    await playwrightVeo.closeBrowser();

    // Wait a bit
    await new Promise(r => setTimeout(r, 1000));

    // Launch dengan forceVisible
    const result = await playwrightVeo.launchBrowser({ forceVisible: true });

    if (result.success) {
      // Navigate ke Labs
      await playwrightVeo.navigateToLabs();
    }

    res.json({ ...result, message: "Browser dibuka dalam mode visible. Silakan login di browser yang muncul." });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
};

app.get("/api/browser/restart-visible", requireBrowserAdmin, restartVisibleHandler);
app.post("/api/browser/restart-visible", requireBrowserAdmin, restartVisibleHandler);

// Restart browser ke HEADLESS mode (setelah login)
const restartHeadlessHandler = async (req, res) => {
  try {
    console.log("[Admin] Restarting browser in headless mode...");

    // Close existing browser first
    await playwrightVeo.closeBrowser();

    // Wait a bit
    await new Promise(r => setTimeout(r, 1000));

    // Launch headless
    const result = await playwrightVeo.launchBrowser({ headless: true });

    if (result.success) {
      // Navigate ke Labs
      await playwrightVeo.navigateToLabs();
    }

    res.json({ ...result, message: "Browser sekarang jalan di background (headless). Session tersimpan." });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
};

app.get("/api/browser/restart-headless", requireBrowserAdmin, restartHeadlessHandler);
app.post("/api/browser/restart-headless", requireBrowserAdmin, restartHeadlessHandler);

// Navigate to Google Labs (Admin only)
app.post("/api/browser/navigate", requireBrowserAdmin, async (req, res) => {
  try {
    const result = await playwrightVeo.navigateToLabs();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Get browser status (Admin only)
app.get("/api/browser/status", requireBrowserAdmin, async (req, res) => {
  try {
    const status = await playwrightVeo.getBrowserStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Generate video via browser - Admin only (dengan CAPTCHA manual jika perlu)
app.post("/api/browser/generate", requireBrowserAdmin, async (req, res) => {
  try {
    const { prompt, aspectRatio, duration, model } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ success: false, error: "Prompt required" });
    }
    const jobId = `browser-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Jalankan generate di background
    playwrightVeo.generateVideo({
      jobId,
      prompt,
      aspectRatio: aspectRatio || "16:9",
      duration: duration || "8s",
      model: model || "veo-2",
    });

    // Return job ID immediately
    res.json({ success: true, jobId, message: "Generate dimulai di browser" });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Cancel browser generate (Admin only)
app.post("/api/browser/cancel", requireBrowserAdmin, async (req, res) => {
  try {
    const result = await playwrightVeo.cancelGenerate();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Screenshot - Admin only (debugging)
app.get("/api/browser/screenshot", requireBrowserAdmin, async (req, res) => {
  try {
    const result = await playwrightVeo.takeScreenshot();
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Get captured reCAPTCHA token (Admin only - full token)
// Token ini bisa dipakai untuk API generate yang sudah ada
app.get("/api/browser/get-recaptcha-token", requireBrowserAdmin, async (req, res) => {
  try {
    const result = await playwrightVeo.getRecaptchaToken();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Cek status token (Public - untuk UI generate pages)
// Hanya return status, bukan token lengkap
app.get("/api/recaptcha-token-status", async (req, res) => {
  try {
    const result = await playwrightVeo.getRecaptchaToken();
    res.json({
      available: result.success,
      age: result.age || null,
      maxAge: result.maxAge || 120,
      fresh: result.fresh || false,
      message: result.success
        ? `Token tersedia (${result.age}s)`
        : "Token tidak tersedia. Admin perlu capture token di Browser Mode."
    });
  } catch (err) {
    res.json({
      available: false,
      message: "Browser Mode belum aktif"
    });
  }
});

// Trigger reCAPTCHA capture - klik Generate di browser untuk capture token
app.post("/api/browser/trigger-token-capture", requireBrowserAdmin, async (req, res) => {
  try {
    const { prompt } = req.body || {};
    const result = await playwrightVeo.triggerRecaptchaCapture(prompt || "beautiful sunset over ocean waves");
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// =============================================================================

// === Simple per-IP rate limiter for /api/generate ===
const RATE_LIMIT_WINDOW_MS = parseInt(
  process.env.RATE_LIMIT_WINDOW_MS || "60000",
  10
);
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || "20", 10);
const rateBuckets = new Map(); // ip -> { count, resetAt }
const rateLimitGenerate = (req, res, next) => {
  try {
    const fwd = (req.headers["x-forwarded-for"] || "").toString();
    const ip = fwd.split(",")[0]?.trim() || req.ip || "unknown";
    const now = Date.now();
    let bucket = rateBuckets.get(ip);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
      rateBuckets.set(ip, bucket);
    }
    if (bucket.count >= RATE_LIMIT_MAX) {
      const retrySec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", retrySec.toString());
      return res.status(429).json({
        error: "Rate limit exceeded",
        windowMs: RATE_LIMIT_WINDOW_MS,
        max: RATE_LIMIT_MAX,
        resetAt: new Date(bucket.resetAt).toISOString(),
      });
    }
    bucket.count++;
    next();
  } catch (err) {
    // Fail open: if limiter errors, allow the request
    next();
  }
};

const startServer = async () => {
  try {
    await nextApp.prepare();
    // ==== Lightweight Job Queue + SSE for concurrent generates ====
    const jobs = new Map(); // jobId -> { id, status, createdAt, payload, url, method, headers, operations, attempts, error }
    const subscribers = new Map(); // jobId -> Set(res)
    const queue = [];
    let active = 0;
    const CONCURRENCY = parseInt(process.env.JOBS_CONCURRENCY || "4", 10);
    const POLL_DELAY_MS = parseInt(process.env.POLL_DELAY_MS || "3000", 10);

    const pushEvent = (jobId, event, data = {}) => {
      const set = subscribers.get(jobId);
      if (!set || !set.size) return;
      const payload = { jobId, event, ...data };
      const line = `event: ${event}\n` + `data: ${JSON.stringify(payload)}\n\n`;
      for (const res of set) {
        try {
          res.write(line);
        } catch (_) { }
      }
    };

    const labsExecute = async ({
      url,
      method = "POST",
      headers = {},
      payload,
    }) => {
      // Reuse the proxy logic to call Google endpoints (avoids duplication)
      const resp = await fetch(
        `http://localhost:${PORT}/api/labsflow/execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-app-credential": process.env.APP_CREDENTIAL || "",
          },
          body: JSON.stringify({ url, method, headers, payload }),
        }
      );
      const ct = resp.headers.get("content-type") || "";
      const isJson = ct.includes("application/json");
      const data = isJson ? await resp.json() : await resp.text();
      // capture Retry-After (in seconds) if provided by upstream
      let retryAfterSec = undefined;
      try {
        const ra = resp.headers.get("retry-after");
        if (ra) {
          const parsed = parseInt(String(ra), 10);
          if (!Number.isNaN(parsed) && parsed >= 0) retryAfterSec = parsed;
        }
      } catch (_) { }
      return { ok: resp.ok, status: resp.status, data, retryAfterSec };
    };

    const pollStatus = async (
      operations,
      headers = {},
      maxAttempts = 10000,
      delayMs = POLL_DELAY_MS
    ) => {
      let url =
        process.env.LABS_DEFAULT_CHECK_URL ||
        "https://aisandbox-pa.googleapis.com/v1/operations:batchCheckAsyncVideoGenerationStatus";
      const method = "POST";
      let attempt = 0;
      // loop
      while (attempt < maxAttempts) {
        attempt++;
        const payload = {
          operations: operations.map((t) => ({ operation: { name: t.name } })),
        };
        let resp = await labsExecute({ url, method, headers, payload });
        if (!resp.ok && resp.status === 404) {
          const alt = url.includes("/video:")
            ? url.replace("/video:", "/operations:")
            : "https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus";
          resp = await labsExecute({ url: alt, method, headers, payload });
          url = alt;
        }
        let opStatuses = [];
        let composite = "UNKNOWN";
        if (resp.ok && resp.data && resp.data.operations) {
          opStatuses = resp.data.operations.map((o) => o?.status || "UNKNOWN");
          composite = opStatuses.join(", ");
        }
        const stillPending = opStatuses.some((s) =>
          /PENDING|IN_PROGRESS|ACTIVE/i.test(s)
        );
        if (!stillPending) {
          return { done: true, resp };
        }
        await new Promise((r) => setTimeout(r, delayMs));
      }
      return { done: false };
    };

    const schedule = () => {
      while (active < CONCURRENCY && queue.length) {
        const jobId = queue.shift();
        const job = jobs.get(jobId);
        if (!job || job.status !== "queued") continue;
        if (job.cancelRequested) {
          job.status = "cancelled";
          pushEvent(jobId, "cancelled", {});
          continue;
        }
        active++;
        (async () => {
          try {
            job.status = "started";
            pushEvent(jobId, "started", {});
            if (job.cancelRequested) {
              job.status = "cancelled";
              pushEvent(jobId, "cancelled", {});
              return;
            }
            // Helper for 429 backoff and retry
            const RETRY_MAX_429 = parseInt(
              process.env.RETRY_MAX_429 || "0",
              10
            ); // 0 = unlimited
            const DEFAULT_DELAY_MS = parseInt(
              process.env.RETRY_DELAY_429_MS || "30000",
              10
            );
            const awaitBackoff = async (status, retryAfterSec) => {
              let delayMs = DEFAULT_DELAY_MS;
              if (typeof retryAfterSec === "number" && retryAfterSec >= 0) {
                delayMs = retryAfterSec * 1000;
              }
              const untilTs = Date.now() + delayMs;
              pushEvent(jobId, "backoff", {
                reason: `HTTP ${status}`,
                delayMs,
                untilTs,
                attempts: job.attempts + 1,
              });
              await new Promise((r) => setTimeout(r, delayMs));
            };

            // Initial generate with backoff + retry on 429
            while (true) {
              const exec = await labsExecute({
                url: job.url,
                method: job.method,
                headers: job.headers,
                payload: job.payload,
              });
              if (exec.ok) {
                // success, proceed
                // Track operations from initial generate response
                try {
                  const ops = (exec.data?.operations || [])
                    .map((op, i) => ({ name: op?.operation?.name, index: i }))
                    .filter((o) => o.name);
                  job.operations = ops;
                } catch (_) { }
                pushEvent(jobId, "initial", { data: exec.data });
                break;
              }
              // handle error
              if (exec.status === 429) {
                // respect max retry if >0, else unlimited
                if (RETRY_MAX_429 > 0 && job.attempts >= RETRY_MAX_429) {
                  job.status = "failed";
                  job.error =
                    exec.data?.error || exec.data || `HTTP ${exec.status}`;
                  pushEvent(jobId, "failed", {
                    error: job.error,
                    status: exec.status,
                  });
                  return;
                }
                job.attempts = (job.attempts || 0) + 1;
                if (job.cancelRequested) {
                  job.status = "cancelled";
                  pushEvent(jobId, "cancelled", {});
                  return;
                }
                await awaitBackoff(exec.status, exec.retryAfterSec);
                if (job.cancelRequested) {
                  job.status = "cancelled";
                  pushEvent(jobId, "cancelled", {});
                  return;
                }
                // retry loop continues
                continue;
              } else {
                job.status = "failed";
                job.error =
                  exec.data?.error || exec.data || `HTTP ${exec.status}`;
                pushEvent(jobId, "failed", {
                  error: job.error,
                  status: exec.status,
                });
                return;
              }
            }
            // Track operations from initial generate response
            if (!job.operations || !job.operations.length) {
              job.status = "completed";
              pushEvent(jobId, "completed", { data: {} });
              try {
                bumpUsage(job.user, "veo");
              } catch (_) { }
              return;
            }
            // Poll until done
            let attempt = 0;
            const headers = job.headers || {};
            while (attempt < 10000) {
              attempt++;
              if (job.cancelRequested) {
                job.status = "cancelled";
                pushEvent(jobId, "cancelled", { attempt });
                break;
              }
              const payload = {
                operations: job.operations.map((t) => ({
                  operation: { name: t.name },
                })),
              };
              let checkUrl =
                process.env.LABS_DEFAULT_CHECK_URL ||
                "https://aisandbox-pa.googleapis.com/v1/operations:batchCheckAsyncVideoGenerationStatus";
              let p = await labsExecute({
                url: checkUrl,
                method: "POST",
                headers,
                payload,
              });
              if (!p.ok && p.status === 404) {
                const alt = checkUrl.includes("/operations:")
                  ? checkUrl.replace("/operations:", "/video:")
                  : "https://aisandbox-pa.googleapis.com/v1/operations:batchCheckAsyncVideoGenerationStatus";
                p = await labsExecute({
                  url: alt,
                  method: "POST",
                  headers,
                  payload,
                });
              }
              if (p.ok) {
                pushEvent(jobId, "polled", { attempt, data: p.data });
                const statuses = (p.data?.operations || []).map(
                  (o) => o?.status || "UNKNOWN"
                );
                const pending = statuses.some((s) =>
                  /PENDING|IN_PROGRESS|ACTIVE/i.test(s)
                );
                if (!pending) {
                  job.status = "completed";
                  pushEvent(jobId, "completed", { data: p.data });
                  try {
                    bumpUsage(job.user, "veo");
                  } catch (_) { }
                  break;
                }
              } else {
                // Handle errors
                const isRetryable = p.status === 429 || p.status >= 500;

                if (isRetryable) {
                  // Retry logic for 429 AND Server Errors (5xx)
                  // respect max retry if >0, else unlimited
                  if (RETRY_MAX_429 > 0 && job.attempts >= RETRY_MAX_429) {
                    job.status = "failed";
                    job.error = p.data?.error || p.data || `HTTP ${p.status}`;
                    pushEvent(jobId, "failed", {
                      error: job.error,
                      status: p.status,
                    });
                    break;
                  }
                  job.attempts = (job.attempts || 0) + 1;
                  if (job.cancelRequested) {
                    job.status = "cancelled";
                    pushEvent(jobId, "cancelled", { attempt });
                    break;
                  }

                  // Use backoff
                  await awaitBackoff(p.status, p.retryAfterSec);

                  if (job.cancelRequested) {
                    job.status = "cancelled";
                    pushEvent(jobId, "cancelled", { attempt });
                    break;
                  }
                  // continue polling after backoff
                } else {
                  // Permanent error (e.g. 400, 401, 403)
                  job.status = "failed";
                  job.error = p.data?.error || p.data || `HTTP ${p.status}`;
                  pushEvent(jobId, "failed", {
                    error: job.error,
                    status: p.status,
                  });
                  break;
                }
              }
              await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
            }
          } catch (err) {
            job.status = "failed";
            job.error = String(err);
            pushEvent(jobId, "failed", { error: job.error });
          } finally {
            active--;
            setImmediate(schedule);
          }
        })();
      }
    };

    // Create job endpoint with rate limiting
    app.post("/api/generate", rateLimitGenerate, (req, res) => {
      try {
        const cookie = String(req.headers["cookie"] || "");
        const map = Object.fromEntries(
          cookie
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => {
              const i = s.indexOf("=");
              const k = i >= 0 ? s.slice(0, i).trim() : s;
              const v = i >= 0 ? s.slice(i + 1).trim() : "";
              return [k, decodeURIComponent(v)];
            })
        );
        const plan = (map["plan"] || "").toLowerCase();
        const planExpiry = parseInt(map["planExpiry"] || "0", 10);
        const now = Date.now();
        const isMonthlyExpired =
          plan === "monthly" && (!!planExpiry ? now > planExpiry : true);
        const allowed =
          plan === "admin" ||
          plan === "veo_sora_unlimited" ||
          plan === "veo_lifetime" ||
          (plan === "monthly" && !isMonthlyExpired);
        if (!allowed) {
          return res
            .status(403)
            .json({ error: "Akses generate video dibatasi oleh paket akun." });
        }
        const { url, method = "POST", headers = {}, payload } = req.body || {};
        if (!payload || !Array.isArray(payload?.requests)) {
          return res.status(400).json({ error: "Missing payload.requests" });
        }
        const jobId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const cookiesForJob = parseCookies(req.headers["cookie"] || "");
        const userForJob = {
          id: cookiesForJob.uid || "",
          email: cookiesForJob.email || "",
          name: cookiesForJob.name || "",
          plan: cookiesForJob.plan || "",
        };
        jobs.set(jobId, {
          id: jobId,
          status: "queued",
          createdAt: Date.now(),
          url,
          method,
          headers,
          payload,
          attempts: 0,
          user: userForJob,
        });
        queue.push(jobId);
        pushEvent(jobId, "queued", {});
        setImmediate(schedule);
        res.json({ ok: true, jobId });
      } catch (err) {
        res
          .status(500)
          .json({ error: "Failed to create job", detail: String(err) });
      }
    });

    // Job snapshot
    app.get("/api/jobs/:id", (req, res) => {
      const job = jobs.get(req.params.id);
      if (!job) return res.status(404).json({ error: "Not found" });
      res.json({ id: job.id, status: job.status, createdAt: job.createdAt });
    });

    // SSE stream
    app.get("/api/jobs/:id/stream", (req, res) => {
      const jobId = req.params.id;
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("\n");
      let set = subscribers.get(jobId);
      if (!set) {
        set = new Set();
        subscribers.set(jobId, set);
      }
      set.add(res);
      req.on("close", () => {
        try {
          set.delete(res);
        } catch (_) { }
      });
      const job = jobs.get(jobId);
      if (job) {
        pushEvent(jobId, "snapshot", { status: job.status });
      }
    });

    // Cancel job: queued -> cancelled, started -> request cancel
    app.post("/api/jobs/:id/cancel", (req, res) => {
      const jobId = req.params.id;
      const job = jobs.get(jobId);
      if (!job) return res.status(404).json({ error: "Not found" });
      job.cancelRequested = true;
      if (job.status === "queued") {
        job.status = "cancelled";
        pushEvent(jobId, "cancelled", {});
      }
      // Worker loop will observe cancelRequested and stop
      res.json({ ok: true, jobId, status: job.status });
    });

    // Server-side guards for protected pages
    const protectedPaths = [
      "/prompt-tunggal",
      "/prompt-batch",
      "/frame-ke-video",
      "/sora2",
      "/image-generator",
      "/dashboard",
      "/credit",
      "/profile",
      "/admin/users",
      "/admin/dashboard",
    ];
    for (const p of protectedPaths) {
      app.get(p, async (req, res) => {
        try {
          const cookies = parseCookies(req.headers["cookie"] || "");
          const ok = cookies.auth_ok === "1";
          const uid = String(cookies.auth_uid || "").trim();
          if (!ok || !uid) {
            res.status(302).setHeader("Location", "/login").end();
            return;
          }
          if (p.startsWith("/admin")) {
            let isAllowed = false;
            try {
              if (srSupabase) {
                const { data: profile } = await srSupabase
                  .from("users")
                  .select("plan")
                  .eq("id", uid)
                  .single();
                isAllowed =
                  String(profile?.plan || "").toLowerCase() === "admin";
              }
            } catch (_) { }
            if (!isAllowed) {
              const email = String(cookies.auth_email || "").toLowerCase();
              if (
                Array.isArray(ADMIN_EMAIL_WHITELIST) &&
                ADMIN_EMAIL_WHITELIST.length
              ) {
                isAllowed = ADMIN_EMAIL_WHITELIST.includes(email);
              }
            }
            if (!isAllowed) {
              res.status(302).setHeader("Location", "/login").end();
              return;
            }
          }
        } catch (_) {
          res.status(302).setHeader("Location", "/login").end();
          return;
        }
        return handleNext(req, res);
      });
    }

    // Explicit 404 for /musik
    app.get("/musik", (req, res) => {
      res.status(404).send("Not Found");
    });

    // === Browser Management Endpoints ===

    // Debug Browser Status (Public for diagnostics)
    app.get("/api/debug-browser", async (req, res) => {
      try {
        const status = await playwrightVeo.getBrowserStatus();
        res.json(status);
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    // Manual Restart Browser (Visible Mode) - Bypass Admin Check sementara untuk setup
    app.get("/api/browser/restart-visible", async (req, res) => {
      try {
        console.log("[API] Manual browser restart requested...");
        await playwrightVeo.closeBrowser();
        const result = await playwrightVeo.launchBrowser({ forceVisible: true });
        if (result.success) {
          await playwrightVeo.navigateToLabs();
        }
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    // Check Status (Official)
    app.get("/api/browser/status", async (req, res) => {
      const status = await playwrightVeo.getBrowserStatus();
      res.json(status);
    });

    // Next.js Catch-all Handler (MUST BE LAST)
    app.all("*", (req, res) => handleNext(req, res));

    app.listen(PORT, async () => {
      console.log(
        `Labs Flow proxy server (Next.js + API) running at http://localhost:${PORT}`
      );

      // Auto-launch browser untuk video generation
      console.log("");
      console.log("═══════════════════════════════════════════════════════════════");
      console.log("   🎬 AUTO-STARTING PLAYWRIGHT BROWSER FOR VIDEO GENERATION");
      console.log("═══════════════════════════════════════════════════════════════");

      try {
        const sessionExists = playwrightVeo.hasValidSession();
        console.log(`[Server] Session exists: ${sessionExists}`);

        if (sessionExists) {
          // Session ada, jalankan browser
          // TIDAK pakai headless karena reCAPTCHA mendeteksi headless browser
          console.log("[Server] ✓ Valid session found! Starting browser in visible mode...");
          console.log("[Server] Note: Headless mode tidak bekerja dengan reCAPTCHA, gunakan visible mode");
          const result = await playwrightVeo.launchBrowser(); // Default: visible mode

          if (result.success) {
            // Navigate ke Labs untuk verify session
            const navResult = await playwrightVeo.navigateToLabs();
            console.log("[Server] ✓ Browser ready! Headless:", result.headless);
            console.log("[Server] ✓ Navigate result:", navResult.message || "OK");
          } else {
            console.log("[Server] ⚠ Browser launch failed:", result.error);
          }
        } else {
          // Session tidak ada
          console.log("");
          console.log("   ⚠️  SESSION TIDAK DITEMUKAN!");
          console.log("   📋  Langkah untuk setup:");
          console.log("   1. Jalankan server di LOKAL (laptop admin)");
          console.log("   2. Akses /admin/browser dan klik Launch Browser");
          console.log("   3. Login ke Google di browser yang muncul");
          console.log("   4. Deploy folder browser-data/ ke Railway");
          console.log("");
        }
      } catch (err) {
        console.log("[Server] Browser auto-start error:", err.message);
      }

      console.log("═══════════════════════════════════════════════════════════════");
      console.log("");
    });
  } catch (err) {
    console.error("Failed to start server", err);
    process.exit(1);
  }
};

startServer();
