"use client";

import { useEffect, useState, useRef } from "react";
import NextImage from "next/image";
import { supabase } from "../lib/supabaseClient";

export default function ImageGeneratorPage() {
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
  const [isFree, setIsFree] = useState(true);
  const [plan, setPlan] = useState("free");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("");
  const bumpStat = (key) => {
    try {
      const v = parseInt(localStorage.getItem(key) || "0", 10) || 0;
      localStorage.setItem(key, String(v + 1));
    } catch (_) {}
  };
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState([]);
  const [aspect, setAspect] = useState("landscape");
  const [count, setCount] = useState(1);
  const [model, setModel] = useState("nano-banana");
  const [projectId, setProjectId] = useState("");
  const [refs, setRefs] = useState([null, null, null]);
  const [refPreviews, setRefPreviews] = useState([]);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImg, setCropImg] = useState(null);
  const [cropQueue, setCropQueue] = useState([]);
  const [cropTargetIndex, setCropTargetIndex] = useState(0);
  const [cropScale, setCropScale] = useState(1);
  const [cropScaleMin, setCropScaleMin] = useState(0.2);
  const [cropScaleMax, setCropScaleMax] = useState(4);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [mediaIdText, setMediaIdText] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryItems, setGalleryItems] = useState([]);
  const [galleryStatus, setGalleryStatus] = useState("");
  const [gallerySlot, setGallerySlot] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const [cropTargetSlot, setCropTargetSlot] = useState(null);
  const [showRefSection, setShowRefSection] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch("/api/config");
        const d = await r.json();
        if (mounted) {
          const pid = d?.clientContext?.projectId || "";
          setProjectId(pid);
        }
      } catch (_) {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      const v = refs
        .filter(Boolean)
        .map((r) => r.mediaId)
        .join(", ");
      setMediaIdText(v);
    } catch (_) {}
  }, [refs]);

  useEffect(() => {
    try {
      document.title = "Image Generator | Fokus AI";
    } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      const m = document.cookie.match(/(?:^|; )plan=([^;]+)/);
      const p = (m && m[1] ? decodeURIComponent(m[1]) : "").toLowerCase();
      setIsFree(p === "free");
      setPlan(p || "free");
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
        let p = "";
        try {
          const token = String(session.access_token || "");
          if (token) {
            const resp = await fetch("/api/me/plan", {
              headers: { Authorization: `Bearer ${token}` },
            });
            const d = await resp.json();
            p = String(d?.plan || "").toLowerCase();
          }
        } catch (_) {}
        if (!p) {
          try {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            p = String(user?.user_metadata?.plan || "").toLowerCase();
          } catch (_) {}
        }
        if (!p) p = "free";
        setPlan(p);
        setIsFree(p === "free");
        try {
          document.cookie = `plan=${encodeURIComponent(p)}; path=/; max-age=${
            60 * 60 * 24 * 30
          }`;
        } catch (_) {}
      } catch (_) {}
    })();
  }, []);

  // Reaksi terhadap event plan realtime dari PlanSync
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

  const openGalleryPicker = async () => setStatus("Galeri dinonaktifkan.");
  const pickFromGallery = async () => setStatus("Galeri dinonaktifkan.");

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

  useEffect(() => {
    try {
      const m = document.cookie.match(/(?:^|; )plan=([^;]+)/);
      const p = (m && m[1] ? decodeURIComponent(m[1]) : "").toLowerCase();
      setIsFree(p === "free");
    } catch (_) {}
  }, []);

  const generate = async () => {
    const text = (prompt || "").trim();
    if (!text) {
      setStatus("Isi prompt gambar terlebih dahulu.");
      return;
    }
    setBusy(true);
    setStatus("Membuat gambar...");
    try {
      const size = aspect === "landscape" ? [768, 432] : [432, 768];
      const c = Math.max(1, Math.min(2, Number(count || 1)));
      const aspectKey =
        aspect === "landscape"
          ? "IMAGE_ASPECT_RATIO_LANDSCAPE"
          : "IMAGE_ASPECT_RATIO_PORTRAIT";
      const hasRefs = refs.filter(Boolean).length > 0;
      const modelKey =
        model === "imagen-4"
          ? hasRefs
            ? "R2I"
            : "IMAGEN_3_5"
          : model === "nano-banana-pro"
          ? "GEM_PIX_2"
          : "GEM_PIX";
      const sessionId = ";" + Date.now();
      // Pastikan semua referensi memiliki mediaId; jika hanya dataUrl/URL, unggah dulu
      for (let i = 0; i < refPreviews.length; i++) {
        const rp = refPreviews[i];
        if (rp && !refs[i]) {
          const du = rp?.dataUrl
            ? rp.dataUrl
            : rp?.url
            ? await (await fetch(rp.url)).blob().then(
                (b) =>
                  new Promise((resolve) => {
                    const r = new FileReader();
                    r.onload = () => resolve(r.result);
                    r.readAsDataURL(b);
                  })
              )
            : undefined;
          if (du) {
            const existingName =
              typeof rp?.url === "string" && rp.url.startsWith("/uploads/")
                ? rp.url.split("/").pop()
                : undefined;
            await uploadDataUrlAsRef(
              i,
              du,
              rp.fileName || `ref-${i + 1}.png`,
              existingName
            );
          }
        }
      }
      const payload = {
        requests: Array.from({ length: c }).map((_, i) => ({
          clientContext: { sessionId },
          seed: Math.floor(Math.random() * 1e6),
          imageModelName: modelKey,
          imageAspectRatio: aspectKey,
          prompt: text,
          imageInputs: refs.filter(Boolean).map((r) => ({
            name: r.mediaId,
            imageInputType: "IMAGE_INPUT_TYPE_REFERENCE",
          })),
        })),
      };
      const project = projectId || "";
      const url = project
        ? `https://aisandbox-pa.googleapis.com/v1/projects/${project}/flowMedia:batchGenerateImages`
        : `https://aisandbox-pa.googleapis.com/v1/projects/unknown/flowMedia:batchGenerateImages`;
      const resp = await fetch("/api/labsflow/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          method: "POST",
          headers: {
            "Content-Type": "text/plain; charset=UTF-8",
            Accept: "*/*",
            Origin: "https://labs.google",
            Referer: "https://labs.google/",
            "Accept-Language": "en-US,en;q=0.9",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
            "x-client-data": "CI+2yQEIpLbJAQipncoBCNbrygEIlKHLAQiFoM0BGLGKzwE=",
            "x-browser-channel": "stable",
            "x-browser-copyright":
              "Copyright 2025 Google LLC. All Rights reserved.",
            "x-browser-validation": "Aj9fzfu+SaGLBY9Oqr3S7RokOtM=",
            "x-browser-year": "2025",
          },
          payload,
        }),
      });
      const ct = resp.headers.get("content-type") || "";
      const data = ct.includes("application/json")
        ? await resp.json()
        : await resp.text();
      if (!resp.ok) {
        const detail = typeof data === "string" ? data : JSON.stringify(data);
        setStatus(`Gagal generate gambar (HTTP ${resp.status}): ${detail}`);
        return;
      }
      const imgs = extractImageUrls(data);
      const take = imgs.slice(0, c);
      setImages(take.map((u, i) => ({ url: u, title: `Gambar ${i + 1}` })));
      setStatus(
        take.length
          ? `Berhasil, ${take.length} gambar siap dilihat.`
          : "Respons tanpa gambar yang dapat diputar."
      );
      if (take.length) {
        try {
          bumpStat("stat.veo.image.success");
          for (let i = 0; i < take.length; i++) {
            bumpStat(`stat.image.model.${model}`);
          }
        } catch (_) {}
      }
    } catch (e) {
      setStatus(String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  const uploadRef = async (slot, file) => {
    try {
      setStatus("Mengunggah gambar referensi...");
      const dataUrl = await readFileAsDataUrl(file);
      const aspectKey =
        aspect === "landscape"
          ? "IMAGE_ASPECT_RATIO_LANDSCAPE"
          : aspect === "portrait"
          ? "IMAGE_ASPECT_RATIO_PORTRAIT"
          : "IMAGE_ASPECT_RATIO_SQUARE";
      await uploadDataUrlAsRef(slot, dataUrl, file.name);
      setStatus("Gambar referensi tersimpan.");
    } catch (e) {
      setStatus(String(e.message || e));
    }
  };

  const readFileAsDataUrl = (file) => {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      } catch (e) {
        reject(e);
      }
    });
  };

  const uploadDataUrlAsRef = async (slot, dataUrl, fileName, existingName) => {
    const aspectKey =
      aspect === "landscape"
        ? "IMAGE_ASPECT_RATIO_LANDSCAPE"
        : aspect === "portrait"
        ? "IMAGE_ASPECT_RATIO_PORTRAIT"
        : "IMAGE_ASPECT_RATIO_SQUARE";
    const resp = await fetch("/api/labs/upload_image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, dataUrl, imageAspectRatio: aspectKey }),
    });
    const ct = resp.headers.get("content-type") || "";
    const data = ct.includes("application/json")
      ? await resp.json()
      : await resp.text();
    if (!resp.ok) {
      const detail = typeof data === "string" ? data : JSON.stringify(data);
      setStatus(`Upload gagal: ${detail}`);
      return;
    }
    const mediaId =
      data?.mediaId || data?.upload?.metadata?.name || data?.upload?.name;
    if (!mediaId) {
      setStatus("Upload berhasil, tetapi mediaId tidak ditemukan.");
      return;
    }
    let galleryUrl = "";
    let nameForPersist =
      existingName && typeof existingName === "string" ? existingName : "";
    if (!nameForPersist) {
      const upResp = await fetch("/api/upload_base64", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, dataUrl }),
      });
      const upCT = upResp.headers.get("content-type") || "";
      const upData = upCT.includes("application/json")
        ? await upResp.json()
        : await upResp.text();
      if (!upResp.ok) {
        const detail =
          typeof upData === "string" ? upData : JSON.stringify(upData);
        setStatus(`Simpan ke galeri gagal: ${detail}`);
      } else {
        galleryUrl = upData?.url || "";
        if (
          typeof galleryUrl === "string" &&
          galleryUrl.startsWith("/uploads/")
        ) {
          nameForPersist = galleryUrl.split("/").pop();
        }
      }
    }
    if (nameForPersist) {
      try {
        await fetch(
          `/api/uploads/${encodeURIComponent(nameForPersist)}/media-id`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mediaId,
              aspect: aspectKey,
              uploadInfo: typeof data === "object" ? data : undefined,
            }),
          }
        );
      } catch (_) {}
    }
    const nextRefs = refs.slice();
    const nextPrev = refPreviews.slice();
    nextRefs[slot] = { mediaId, url: galleryUrl };
    if (galleryUrl) {
      nextPrev[slot] = {
        ...(nextPrev[slot] || {}),
        url: galleryUrl,
        fileName: nextPrev[slot]?.fileName || fileName || `ref-${slot + 1}.png`,
      };
    }
    setRefs(nextRefs);
    setRefPreviews(nextPrev);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    try {
      const files = Array.from(e.dataTransfer.files || [])
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, 3);
      const list = [];
      for (const f of files) {
        const dataUrl = await readFileAsDataUrl(f);
        list.push({ dataUrl, fileName: f.name });
      }
      if (!list.length) return;
      setCropQueue(list);
      setCropTargetIndex(0);
      setCropImg(list[0]);
      setCropTargetSlot(null);
      setCropOpen(true);
      setStatus("Sesuaikan crop untuk gambar yang dipilih.");
    } catch (e) {
      setStatus(String(e.message || e));
    }
  };

  const pickFiles = async (files) => {
    try {
      const list = Array.from(files || [])
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, 3);
      const previews = [];
      for (const f of list) {
        const dataUrl = await readFileAsDataUrl(f);
        previews.push({ dataUrl, fileName: f.name });
      }
      if (!previews.length) return;
      setCropQueue(previews);
      setCropTargetIndex(0);
      setCropImg(previews[0]);
      setCropTargetSlot(null);
      setCropOpen(true);
      setStatus("Sesuaikan crop untuk gambar yang dipilih.");
    } catch (e) {
      setStatus(String(e.message || e));
    }
  };

  const pickFileForSlot = async (slot, files) => {
    try {
      const list = Array.from(files || [])
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, 1);
      if (!list.length) return;
      const f = list[0];
      const dataUrl = await readFileAsDataUrl(f);
      const preview = { dataUrl, fileName: f.name };
      setCropQueue([preview]);
      setCropTargetIndex(0);
      setCropImg(preview);
      setCropTargetSlot(slot);
      setCropOpen(true);
      setStatus("Sesuaikan crop untuk gambar yang dipilih.");
    } catch (e) {
      setStatus(String(e.message || e));
    }
  };

  const uploadAllRefs = async () => {
    for (let i = 0; i < Math.min(3, refPreviews.length); i++) {
      const rp = refPreviews[i];
      if (rp) {
        const du = rp?.dataUrl
          ? rp.dataUrl
          : rp?.url
          ? await (await fetch(rp.url)).blob().then(
              (b) =>
                new Promise((resolve) => {
                  const r = new FileReader();
                  r.onload = () => resolve(r.result);
                  r.readAsDataURL(b);
                })
            )
          : undefined;
        if (du) {
          const existingName =
            typeof rp?.url === "string" && rp.url.startsWith("/uploads/")
              ? rp.url.split("/").pop()
              : undefined;
          await uploadDataUrlAsRef(
            i,
            du,
            rp.fileName || `ref-${i + 1}.png`,
            existingName
          );
        }
      }
    }
  };

  const uploadRefSlot = async (slot) => {
    try {
      const rp = refPreviews[slot];
      if (!rp) {
        setStatus("Tidak ada pratinjau untuk slot ini.");
        return;
      }
      const du = rp?.dataUrl
        ? rp.dataUrl
        : rp?.url
        ? await (await fetch(rp.url)).blob().then(
            (b) =>
              new Promise((resolve) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.readAsDataURL(b);
              })
          )
        : undefined;
      if (!du) {
        setStatus("Gagal membaca gambar untuk slot ini.");
        return;
      }
      const existingName =
        typeof rp?.url === "string" && rp.url.startsWith("/uploads/")
          ? rp.url.split("/").pop()
          : undefined;
      await uploadDataUrlAsRef(
        slot,
        du,
        rp.fileName || `ref-${slot + 1}.png`,
        existingName
      );
      setStatus("Gambar slot terunggah dan Media ID terisi.");
    } catch (e) {
      setStatus(String(e.message || e));
    }
  };

  const clearRefs = () => {
    setRefPreviews([]);
    setRefs([null, null, null]);
  };
  const clearRefSlot = (slot) => {
    const nextPrev = refPreviews.slice();
    const nextRefs = refs.slice();
    nextPrev[slot] = null;
    nextRefs[slot] = null;
    setRefPreviews(nextPrev);
    setRefs(nextRefs);
  };

  const downloadImage = async (url, fileName) => {
    try {
      let blob;
      if (/^data:image\//i.test(url)) {
        const r = await fetch(url);
        if (!r.ok) {
          setStatus(`Gagal download (HTTP ${r.status})`);
          return;
        }
        blob = await r.blob();
      } else {
        const r = await fetch(
          `/api/labsflow/download?url=${encodeURIComponent(url)}`
        );
        if (!r.ok) {
          setStatus(`Gagal download (HTTP ${r.status})`);
          return;
        }
        blob = await r.blob();
      }
      const a = document.createElement("a");
      const href = URL.createObjectURL(blob);
      a.href = href;
      a.download = fileName || "image.png";
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(href);
      a.remove();
    } catch (e) {
      setStatus(String(e.message || e));
    }
  };

  const addManualMediaId = (id) => {
    const val = (id || "").trim();
    if (!val) return;
    const next = refs.slice();
    for (let i = 0; i < 3; i++) {
      if (!next[i]) {
        next[i] = { mediaId: val, url: "" };
        break;
      }
    }
    setRefs(next);
  };

  const setRefsFromText = (s) => {
    const ids = (s || "")
      .split(/[\s,]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!ids.length) return;
    const next = refs.slice();
    for (const id of ids) {
      if (next.some((r) => r && r.mediaId === id)) continue;
      for (let i = 0; i < 3; i++) {
        if (!next[i]) {
          next[i] = { mediaId: id, url: "" };
          break;
        }
      }
    }
    setRefs(next);
  };

  const extractImageUrls = (obj) => {
    const urls = [];
    const stack = [obj];
    const isBase64 = (s) =>
      /^[A-Za-z0-9+/]+=*$/.test(s || "") && (s || "").length > 1000;
    while (stack.length) {
      const cur = stack.pop();
      if (!cur || typeof cur !== "object") continue;
      try {
        if (Array.isArray(cur.images)) {
          for (const it of cur.images) {
            const d = it?.data || it?.imageData || it?.imageBase64;
            const mime = (
              it?.mimeType ||
              it?.contentType ||
              "image/png"
            ).toString();
            if (typeof d === "string" && isBase64(d))
              urls.push(`data:${mime};base64,${d}`);
            const u = it?.url || it?.downloadUrl;
            if (typeof u === "string" && /^https?:\/\//i.test(u)) urls.push(u);
          }
        }
      } catch (_) {}
      for (const k of Object.keys(cur)) {
        const v = cur[k];
        if (typeof v === "string") {
          const s = v.trim();
          if (
            /^https?:\/\//i.test(s) &&
            /(\.png|\.jpg|\.jpeg|\.webp|\/images?\/)/i.test(s)
          )
            urls.push(s);
          if (/^data:image\/(?:png|jpeg|jpg|webp);base64,/i.test(s))
            urls.push(s);
        } else if (v && typeof v === "object") {
          stack.push(v);
        }
      }
    }
    return Array.from(new Set(urls));
  };

  return (
    <>
      <div className="app-shell prompt-shell">
        <header className="page-header">
          <div className="page-brand">
            <NextImage
              src="/images/fokusAI.png"
              alt="Logo FokusAI Studio"
              width={50}
              height={50}
              className="brand-logo"
              priority
            />
            <div className="brand-text">
              <span className="page-badge">FokusAI Studio</span>
              <h1 className="page-title">Image Generator</h1>
              <p className="page-subtitle">
                Buat gambar untuk materi video Anda
              </p>
            </div>
          </div>
          <div
            style={{ display: "flex", gap: 8, alignItems: "center" }}
            ref={userMenuRef}
          >
            <a
              className="settings-btn"
              href="/sora2"
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
              <span aria-hidden="true">🎥</span>
              <span className="sr-only">Sora 2</span>
            </a>
            <a
              className="settings-btn"
              href="/prompt-tunggal"
              title="Video Generator"
            >
              <span aria-hidden="true">🎬</span>
              <span className="sr-only">Video Generator</span>
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
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="card">
          <div className="generator-layout">
            <aside className="sidebar">
              <h2 className="section-title">Prompt Gambar</h2>
              <textarea
                className="scene-textarea"
                rows={4}
                placeholder="Deskripsikan gambar..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={generate}
                >
                  Buat Gambar
                </button>
                <span className="settings-help">{status}</span>
              </div>
              <div style={{ marginTop: 14 }}>
                <div className="row">
                  <div style={{ flex: 1 }}>
                    <label>Rasio Aspek</label>
                    <select
                      className="dropdown"
                      value={aspect}
                      onChange={(e) => setAspect(e.target.value)}
                    >
                      <option value="landscape">Lanskap (16:9)</option>
                      <option value="portrait">Potret (9:16)</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Output per perintah</label>
                    <select
                      className="dropdown"
                      value={count}
                      onChange={(e) =>
                        setCount(Math.min(2, Number(e.target.value)))
                      }
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                    </select>
                  </div>
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label>Model</label>
                    <select
                      className="dropdown"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    >
                      <option value="imagen-4">Imagen 4</option>
                      <option value="nano-banana">Nano Banana</option>
                      <option value="nano-banana-pro">Nano Banana Pro</option>
                    </select>
                  </div>
                  <div
                    style={{ flex: 1, display: "flex", alignItems: "flex-end" }}
                  ></div>
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        marginBottom: 12,
                      }}
                      onClick={() => setShowRefSection(!showRefSection)}
                    >
                      <label style={{ cursor: "pointer", margin: 0 }}>
                        Gambar Referensi (opsional)
                      </label>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>
                        {showRefSection ? "▼" : "▶"}
                      </span>
                    </div>
                    {showRefSection && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div
                            key={`slot-${i}`}
                            className="photo-card"
                            style={{ padding: 12 }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const files = Array.from(
                                e.dataTransfer.files || []
                              )
                                .filter((f) => f.type.startsWith("image/"))
                                .slice(0, 1);
                              if (files.length) pickFileForSlot(i, files);
                            }}
                          >
                            <div
                              className="photo-name"
                              style={{ marginBottom: 6 }}
                            >
                              Referensi {i + 1}
                            </div>
                            {refPreviews[i] ? (
                              <img
                                src={
                                  refPreviews[i].dataUrl || refPreviews[i].url
                                }
                                alt={`Ref ${i + 1}`}
                                style={{
                                  width: "100%",
                                  height: "auto",
                                  borderRadius: 6,
                                }}
                              />
                            ) : (
                              <div className="settings-help">
                                Belum ada gambar untuk slot ini.
                              </div>
                            )}
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                marginTop: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <label
                                className="btn ghost"
                                style={{ cursor: "pointer" }}
                              >
                                Pilih / Unggah
                                <input
                                  type="file"
                                  accept="image/*"
                                  style={{ display: "none" }}
                                  onChange={(e) =>
                                    pickFileForSlot(i, e.target.files)
                                  }
                                />
                              </label>
                              <button
                                className="btn ghost"
                                onClick={() => uploadRefSlot(i)}
                              >
                                Upload ke Labs
                              </button>
                              <button
                                className="btn ghost"
                                onClick={() => clearRefSlot(i)}
                              >
                                Hapus
                              </button>
                            </div>
                            {refs[i]?.mediaId ? (
                              <div className="settings-help">
                                Media ID: {refs[i].mediaId}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <input
                        type="text"
                        className="dropdown"
                        placeholder="Tempel Media ID dari Labs (pisahkan dengan koma)"
                        value={mediaIdText}
                        onChange={(e) => setMediaIdText(e.target.value)}
                        onBlur={(e) => setRefsFromText(e.target.value)}
                      />
                    </div>
                    <div style={{ marginTop: 6 }}>
                      {refs.filter(Boolean).length ? (
                        <span className="settings-help">
                          Media ID:{" "}
                          {refs
                            .filter(Boolean)
                            .map((r) => r.mediaId)
                            .join(", ")}
                        </span>
                      ) : (
                        <span className="settings-help">
                          Jika Media ID diisi, generate akan memakai referensi
                          tersebut.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </aside>
            <section className="result-pane">
              <h3>Pratinjau Gambar</h3>
              <div
                className="gallery-grid"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 10,
                }}
              >
                {images.map((img, i) => (
                  <div
                    key={`${img.url}-${i}`}
                    className="photo-card"
                    style={{ padding: 12 }}
                  >
                    <div className="photo-name" style={{ marginBottom: 6 }}>
                      {img.title}
                    </div>
                    <img
                      src={img.url}
                      alt={img.title}
                      style={{
                        width: "100%",
                        height: "auto",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                      onClick={() => setPreviewImg(img)}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button
                        className="btn ghost"
                        onClick={() =>
                          downloadImage(img.url, `image-${i + 1}.jpg`)
                        }
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
                {!images.length ? (
                  <div className="settings-help">Belum ada gambar.</div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </div>
      {cropOpen ? (
        <div className="modal show">
          <div className="modal-content" style={{ maxWidth: 860 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 700 }}>Crop Gambar</div>
              <button className="btn" onClick={() => setCropOpen(false)}>
                Tutup
              </button>
            </div>
            <div className="modal-body" style={{ display: "flex", gap: 12 }}>
              <div
                className="crop-left"
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#0b1020",
                  border: "1px solid #1f2937",
                  borderRadius: 8,
                }}
              >
                <CropCanvas
                  src={cropImg?.dataUrl || ""}
                  aspect={aspect}
                  scale={cropScale}
                  offset={cropOffset}
                  onOffsetChange={setCropOffset}
                  onScaleInit={(min, max, base, initOffset) => {
                    setCropScaleMin(min);
                    setCropScaleMax(max);
                    setCropScale(base);
                    setCropOffset(initOffset);
                  }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <div
                className="crop-right"
                style={{ width: 260, maxWidth: "60%" }}
              >
                <label style={{ fontSize: 12, color: "#9ca3af" }}>Zoom</label>
                <input
                  type="range"
                  min={cropScaleMin}
                  max={cropScaleMax}
                  step={0.01}
                  value={cropScale}
                  onChange={(e) => setCropScale(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
                <div className="settings-help">
                  Seret gambar untuk posisi; geser slider untuk zoom.
                </div>
              </div>
              <button
                className="btn primary"
                onClick={async () => {
                  try {
                    const outUrl = await renderCropToDataUrl(
                      cropImg?.dataUrl || "",
                      aspect,
                      cropScale,
                      cropOffset
                    );
                    const next = refPreviews.slice();
                    let slot =
                      typeof cropTargetSlot === "number" ? cropTargetSlot : 0;
                    if (typeof cropTargetSlot !== "number") {
                      for (let i = 0; i < 3; i++) {
                        if (!next[i]) {
                          slot = i;
                          break;
                        }
                      }
                    }
                    next[slot] = {
                      dataUrl: outUrl,
                      fileName: cropImg?.fileName || `ref-${slot + 1}.png`,
                    };
                    setRefPreviews(next);
                    const nextIndex = cropTargetIndex + 1;
                    if (nextIndex < cropQueue.length) {
                      setCropTargetIndex(nextIndex);
                      setCropImg(cropQueue[nextIndex]);
                      setStatus(
                        `Crop disimpan (${nextIndex}/${cropQueue.length}). Lanjutkan.`
                      );
                    } else {
                      setCropOpen(false);
                      setCropQueue([]);
                      setCropTargetSlot(null);
                      setStatus(
                        "Crop selesai. Klik Upload ke Labs untuk mendapatkan Media ID."
                      );
                    }
                  } catch (e) {
                    setStatus(String(e.message || e));
                  }
                }}
              >
                Simpan Crop
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {previewImg ? (
        <div
          className="modal show"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewImg(null);
          }}
        >
          <div className="modal-content" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 700 }}>Pratinjau Gambar</div>
            </div>
            <div
              className="modal-body"
              style={{ justifyContent: "center", alignItems: "center" }}
            >
              <img
                src={previewImg.url}
                alt={previewImg.title}
                style={{
                  maxWidth: "100%",
                  height: "auto",
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.35)",
                }}
              />
            </div>
            <div
              className="modal-footer"
              style={{ justifyContent: "flex-end", gap: 10 }}
            >
              <button
                className="btn ghost"
                onClick={() =>
                  downloadImage(previewImg.url, previewImg.title || "image.png")
                }
              >
                Download
              </button>
              <button className="btn primary" onClick={() => setPreviewImg(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {galleryOpen ? (
        <div className="modal show">
          <div className="modal-content" style={{ maxWidth: 760 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 700 }}>Pilih Gambar dari Galeri</div>
              <button className="btn" onClick={() => setGalleryOpen(false)}>
                Tutup
              </button>
            </div>
            <div className="modal-body">
              <div className="settings-help">{galleryStatus}</div>
              <div className="gallery-grid">
                {galleryItems.map((it, idx) => (
                  <div key={`${it.url}-${idx}`} className="photo-card">
                    <img
                      className="photo-thumb"
                      src={it.url}
                      alt={it.name || `Foto ${idx + 1}`}
                    />
                    <div className="photo-meta">
                      <div className="photo-name" title={it.name || ""}>
                        {it.name || ""}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <button
                          className="btn"
                          onClick={() => pickFromGallery(it)}
                        >
                          Pilih
                        </button>
                      </div>
                    </div>
                    {it.mediaId ? (
                      <div className="settings-help">
                        Media ID: {it.mediaId}
                      </div>
                    ) : null}
                  </div>
                ))}
                {!galleryItems.length ? (
                  <div className="settings-help">Belum ada foto di galeri.</div>
                ) : null}
              </div>
            </div>
            <div
              className="modal-footer"
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button className="btn" onClick={() => setGalleryOpen(false)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showLogoutModal ? (
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
      ) : null}
    </>
  );
}
function CropCanvas({
  src,
  aspect,
  scale,
  offset,
  onOffsetChange,
  onScaleInit,
}) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const w = aspect === "landscape" ? 720 : aspect === "portrait" ? 405 : 512;
  const h = aspect === "landscape" ? 405 : aspect === "portrait" ? 720 : 512;

  useEffect(() => {
    if (!src) return;
    const img = new window.Image();
    img.onload = () => {
      imgRef.current = img;
      const base = Math.max(w / img.width, h / img.height);
      const min = base;
      const max = base * 4;
      const initOffset = {
        x: (w - img.width * base) / 2,
        y: (h - img.height * base) / 2,
      };
      if (typeof onScaleInit === "function")
        onScaleInit(min, max, base, initOffset);
      renderToCanvas();
    };
    img.src = src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, aspect]);

  useEffect(() => {
    renderToCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, offset]);

  const renderToCanvas = () => {
    const cv = canvasRef.current;
    const img = imgRef.current;
    if (!cv || !img) return;
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d");
    const rw = img.width * scale;
    const rh = img.height * scale;
    const dx = offset?.x || 0;
    const dy = offset?.y || 0;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, dx, dy, rw, rh);
    ctx.strokeStyle = "#16a34a";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  };

  const startDrag = (x, y) => {
    draggingRef.current = true;
    startRef.current = { x, y };
  };

  const moveDrag = (x, y) => {
    if (!draggingRef.current) return;
    const dx = x - startRef.current.x;
    const dy = y - startRef.current.y;
    startRef.current = { x, y };
    onOffsetChange({ x: (offset?.x || 0) + dx, y: (offset?.y || 0) + dy });
  };

  const onUp = () => {
    draggingRef.current = false;
  };

  const onPointerDown = (e) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      e.preventDefault?.();
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    startDrag(e.clientX, e.clientY);
  };

  const onPointerMove = (e) => {
    if (!draggingRef.current) return;
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      e.preventDefault?.();
    }
    moveDrag(e.clientX, e.clientY);
  };

  const onPointerUp = (e) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    onUp();
  };

  // Fallback untuk browser yang belum mendukung Pointer Events
  const supportsPointer =
    typeof window !== "undefined" && "PointerEvent" in window;

  const onTouchStart = (e) => {
    if (supportsPointer) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    e.preventDefault?.();
    startDrag(t.clientX, t.clientY);
  };

  const onTouchMove = (e) => {
    if (supportsPointer) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    e.preventDefault?.();
    moveDrag(t.clientX, t.clientY);
  };

  return (
    <canvas
      ref={canvasRef}
      width={w}
      height={h}
      style={{
        maxWidth: "100%",
        border: "2px solid #16a34a",
        borderRadius: 6,
        userSelect: "none",
        cursor: "grab",
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onUp}
      onTouchCancel={onUp}
    />
  );
}

async function renderCropToDataUrl(src, aspect, scale, offset) {
  return new Promise((resolve, reject) => {
    try {
      const img = new window.Image();
      img.onload = () => {
        const w =
          aspect === "landscape" ? 720 : aspect === "portrait" ? 405 : 512;
        const h =
          aspect === "landscape" ? 405 : aspect === "portrait" ? 720 : 512;
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const ctx = cv.getContext("2d");
        const rw = img.width * scale;
        const rh = img.height * scale;
        ctx.fillStyle = "#0b1020";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, offset?.x || 0, offset?.y || 0, rw, rh);
        resolve(cv.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = src;
    } catch (e) {
      reject(e);
    }
  });
}
