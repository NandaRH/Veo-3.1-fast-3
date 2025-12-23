"use client";

export function initLegacyApp({ initialMode } = {}) {
  if (typeof window === "undefined") return;
  if (window.__legacyAppInitialized) return;
  window.__legacyAppInitialized = true;
  const cleanupFns = [];
  window.__legacyCleanup = () => {
    while (cleanupFns.length > 0) {
      const fn = cleanupFns.pop();
      try {
        fn();
      } catch (_) {
        /* ignore */
      }
    }
    // Matikan polling/status stream yang mungkin masih berjalan
    try {
      resetPolling();
    } catch (_) {}
    // Reset seluruh state global agar tidak menempel lintas halaman
    try {
      window.__isGenerating = false;
    } catch (_) {}
    try {
      window.__appendBase = 0;
    } catch (_) {}
    try {
      window.__sceneDone = {};
    } catch (_) {}
    try {
      trackedOps = [];
    } catch (_) {}
    try {
      lastStatusData = null;
    } catch (_) {}
    try {
      scenes = [];
    } catch (_) {}
    try {
      renderScenes();
    } catch (_) {}
    // Tutup dan bersihkan panel extend jika masih ada
    try {
      const panel = document.getElementById("extend-input-panel");
      if (panel) panel.remove();
    } catch (_) {}
    window.__legacyAppInitialized = false;
  };
  const setSettingsStatus = (text, tone = "info") => {
    const statusEl = el("settingsBearerStatus");
    if (settingsState.statusTimer) {
      clearTimeout(settingsState.statusTimer);
      settingsState.statusTimer = null;
    }
    if (!statusEl) return;
    statusEl.textContent = text || "";
    const color =
      tone === "error" ? "#f87171" : tone === "success" ? "#34d399" : "#94a3b8";
    statusEl.style.color = color;
    if (text) {
      settingsState.statusTimer = setTimeout(
        () => {
          if (settingsState.visible) {
            statusEl.textContent = "";
          }
          settingsState.statusTimer = null;
        },
        tone === "error" ? 5000 : 3000
      );
    }
  };
  const syncSettingsInputState = () => {
    const input = el("settingsLabsBearer");
    if (input) {
      input.type = settingsState.reveal ? "text" : "password";
      if (!settingsState.busy) {
        input.value = settingsState.bearer || "";
      }
    }
    const toggleBtn = el("settingsToggleVisibility");
    if (toggleBtn) {
      toggleBtn.textContent = settingsState.reveal
        ? "Sembunyikan"
        : "Tampilkan";
    }
  };
  const setAppLocked = (locked) => {
    try {
      document.body.classList.toggle("app-locked", !!locked);
    } catch (_) {}
    try {
      const overlay = el("appLockOverlay");
      if (overlay) overlay.style.display = locked ? "flex" : "none";
    } catch (_) {}
    // Nonaktifkan efek lock pada kontrol utama agar UI tetap bisa diklik
    try {
      const g = el("quickGenerate");
      if (g) g.disabled = false;
    } catch (_) {}
    try {
      const s = el("stopGenerate");
      if (s) s.disabled = false;
    } catch (_) {}
    try {
      const sp = el("singlePrompt");
      if (sp) sp.disabled = false;
    } catch (_) {}
    try {
      const bp = el("batchPrompts");
      if (bp) bp.disabled = false;
    } catch (_) {}
  };
  const ensureSettingsLoaded = async () => {
    if (settingsState.loaded || settingsState.busy) {
      syncSettingsInputState();
      return;
    }
    settingsState.busy = true;
    setSettingsStatus("Memuat bearer...", "info");
    try {
      const resp = await fetch("/api/settings");
      const ct = resp.headers.get("content-type") || "";
      let data;
      if (ct.includes("application/json")) {
        data = await resp.json();
      } else {
        const text = await resp.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }
      if (!resp.ok) {
        const detail =
          (data && data.error) || data?.raw || `HTTP ${resp.status}`;
        throw new Error(detail);
      }
      settingsState.bearer = data?.labsBearer || "";
      settingsState.loaded = true;
      if (settingsState.bearer) {
        setSettingsStatus("Bearer dimuat.", "success");
      } else {
        setSettingsStatus("Belum ada bearer yang tersimpan.", "info");
      }
      setAppLocked(false);
    } catch (err) {
      setSettingsStatus(`Gagal memuat bearer: ${String(err)}`, "error");
    } finally {
      settingsState.busy = false;
      syncSettingsInputState();
    }
  };
  const closeSettingsModal = () => {
    const modal = el("settingsModal");
    if (!modal) return;
    modal.classList.remove("show");
    settingsState.visible = false;
    settingsState.reveal = false;
    setSettingsStatus("");
    syncSettingsInputState();
    // Jika masih terkunci (credential kosong), tampilkan overlay kembali
    try {
      setAppLocked(false);
    } catch (_) {}
  };
  const openSettingsModal = async () => {
    const modal = el("settingsModal");
    if (!modal) return;
    modal.classList.add("show");
    settingsState.visible = true;
    syncSettingsInputState();
    // Sembunyikan overlay lock saat Pengaturan dibuka agar tidak menghalangi
    try {
      const overlay = el("appLockOverlay");
      if (overlay) overlay.style.display = "none";
    } catch (_) {}
    await ensureSettingsLoaded();
  };
  const saveSettingsBearer = async () => {
    const input = el("settingsLabsBearer");
    if (!input) return;
    const value = input.value.trim();
    settingsState.busy = true;
    setSettingsStatus("Menyimpan pengaturan...", "info");
    try {
      const resp = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labsBearer: value }),
      });
      const ct = resp.headers.get("content-type") || "";
      let data;
      if (ct.includes("application/json")) {
        data = await resp.json();
      } else {
        const text = await resp.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }
      if (!resp.ok) {
        const detail =
          (data && data.error) || data?.raw || `HTTP ${resp.status}`;
        throw new Error(detail);
      }
      settingsState.bearer = value;
      settingsState.loaded = true;
      setSettingsStatus("Pengaturan berhasil disimpan.", "success");
      setAppLocked(false);
    } catch (err) {
      setSettingsStatus(`Gagal menyimpan bearer: ${String(err)}`, "error");
    } finally {
      settingsState.busy = false;
      syncSettingsInputState();
    }
  };

  const activateAppWithToken = async () => {
    const tokenInput = el("settingsActivationToken");
    const token = (tokenInput?.value || "").trim();
    if (!token) {
      setSettingsStatus("Masukkan kode aktivasi terlebih dahulu.", "error");
      return;
    }
    settingsState.busy = true;
    setSettingsStatus("Memverifikasi kode aktivasi...", "info");
    try {
      const resp = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activationToken: token }),
      });
      const ct = resp.headers.get("content-type") || "";
      let data;
      if (ct.includes("application/json")) {
        data = await resp.json();
      } else {
        const text = await resp.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }
      if (!resp.ok) {
        const detail =
          (data && data.error) || data?.raw || `HTTP ${resp.status}`;
        throw new Error(detail);
      }
      // Simpan token untuk dipakai di header permintaan
      try {
        localStorage.setItem("licenseActivationToken", token);
      } catch (_) {}
      settingsState.activationToken = token;
      setSettingsStatus("Aktivasi berhasil. Aplikasi terbuka.", "success");
      setAppLocked(false);
    } catch (err) {
      setSettingsStatus(`Aktivasi gagal: ${String(err)}`, "error");
    } finally {
      settingsState.busy = false;
      syncSettingsInputState();
    }
  };
  const copySettingsBearer = async () => {
    if (!settingsState.bearer) {
      setSettingsStatus("Tidak ada bearer untuk disalin.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(settingsState.bearer);
      setSettingsStatus("Bearer disalin ke clipboard.", "success");
    } catch (err) {
      setSettingsStatus(`Gagal menyalin: ${String(err)}`, "error");
    }
  };
  const setupSettingsModal = () => {
    const modal = el("settingsModal");
    if (!modal) return;
    const openBtn = el("settingsButton");
    const closeBtn = el("settingsClose");
    const saveBtn = el("settingsSave");
    const activateBtn = el("settingsActivate");
    const toggleBtn = el("settingsToggleVisibility");
    const copyBtn = el("settingsCopyBearer");
    const input = el("settingsLabsBearer");
    const lockBtn = el("lockOpenSettings");

    if (openBtn) {
      register(openBtn, "click", (ev) => {
        ev.preventDefault();
        openSettingsModal();
      });
    }
    if (lockBtn) {
      register(lockBtn, "click", (ev) => {
        ev.preventDefault();
        openSettingsModal();
      });
    }
    if (closeBtn) {
      register(closeBtn, "click", (ev) => {
        ev.preventDefault();
        closeSettingsModal();
      });
    }
    register(modal, "click", (ev) => {
      if (ev.target === modal) {
        closeSettingsModal();
      }
    });
    if (saveBtn) {
      register(saveBtn, "click", async (ev) => {
        ev.preventDefault();
        await saveSettingsBearer();
      });
    }
    if (activateBtn) {
      register(activateBtn, "click", async (ev) => {
        ev.preventDefault();
        await activateAppWithToken();
      });
    }
    if (toggleBtn) {
      register(toggleBtn, "click", (ev) => {
        ev.preventDefault();
        settingsState.reveal = !settingsState.reveal;
        syncSettingsInputState();
      });
    }
    if (copyBtn) {
      register(copyBtn, "click", async (ev) => {
        ev.preventDefault();
        await copySettingsBearer();
      });
    }
    if (input) {
      register(input, "input", (ev) => {
        settingsState.bearer = ev.target.value;
      });
    }
    register(window, "keydown", (ev) => {
      if (ev.key === "Escape" && settingsState.visible) {
        closeSettingsModal();
      }
    });
    syncSettingsInputState();
  };

  const register = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    cleanupFns.push(() => {
      try {
        target.removeEventListener(type, handler, options);
      } catch (_) {
        /* ignore */
      }
    });
  };

  const setupUserMenu = () => {
    const btn = el("userMenuButton");
    const dropdown = el("userMenuDropdown");
    if (!btn || !dropdown) return;

    const closeMenu = () => {
      dropdown.classList.remove("show");
      dropdown.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    };

    const openMenu = () => {
      dropdown.hidden = false;
      requestAnimationFrame(() => dropdown.classList.add("show"));
      btn.setAttribute("aria-expanded", "true");
    };

    const toggleMenu = () => {
      if (dropdown.classList.contains("show")) {
        closeMenu();
      } else {
        openMenu();
      }
    };

    register(btn, "click", (ev) => {
      ev.preventDefault();
      toggleMenu();
    });
    register(document, "click", (ev) => {
      if (btn.contains(ev.target) || dropdown.contains(ev.target)) return;
      closeMenu();
    });
    register(document, "keydown", (ev) => {
      if (ev.key === "Escape") {
        closeMenu();
      }
    });
    const plan = (
      document.cookie.match(/(?:^|; )plan=([^;]+)/)?.[1] || ""
    ).toLowerCase();
    const isAdmin = plan === "admin";
    if (isAdmin) {
      dropdown.innerHTML = `
        <button class="user-menu-item" type="button" data-action="admin_dashboard">
          <span aria-hidden="true">🏛️</span>
          <span>Admin Dashboard</span>
        </button>
        <button class="user-menu-item" type="button" data-action="admin_users">
          <span aria-hidden="true">👥</span>
          <span>Manage Users</span>
        </button>
        <div class="user-menu-divider"></div>
        <button class="user-menu-item" type="button" data-action="logout">
          <span aria-hidden="true">🚪</span>
          <span>Logout</span>
        </button>
      `;
    }
    dropdown.querySelectorAll("[data-action]").forEach((item) => {
      register(item, "click", (ev) => {
        ev.preventDefault();
        const a = item.getAttribute("data-action");
        if (a === "dashboard") {
          try {
            window.location.href = "/dashboard";
          } catch (_) {}
        } else if (a === "profile") {
          try {
            window.location.href = "/profile";
          } catch (_) {}
        } else if (a === "credit") {
          try {
            window.location.href = "/credit";
          } catch (_) {}
        } else if (a === "settings") {
          try {
            openQuotaModal();
          } catch (_) {}
        } else if (a === "admin_dashboard") {
          try {
            window.location.href = "/admin/dashboard";
          } catch (_) {}
        } else if (a === "admin_users") {
          try {
            window.location.href = "/admin/users";
          } catch (_) {}
        } else if (a === "logout") {
          try {
            openLogoutModal();
          } catch (_) {}
        }
        closeMenu();
      });
    });
  };

  const openLogoutModal = () => {
    const modal = el("logoutModal");
    if (!modal) return;
    modal.classList.add("show");
  };

  const closeLogoutModal = () => {
    const modal = el("logoutModal");
    if (!modal) return;
    modal.classList.remove("show");
  };

  const setupLogoutModal = () => {
    const modal = el("logoutModal");
    if (!modal) return;
    const confirmBtn = el("logoutConfirm");
    const cancelBtn = el("logoutCancel");
    const closeBtn = el("logoutClose");
    const redirectTo = "/login";

    register(modal, "click", (ev) => {
      if (ev.target === modal) {
        closeLogoutModal();
      }
    });
    if (cancelBtn) {
      register(cancelBtn, "click", (ev) => {
        ev.preventDefault();
        closeLogoutModal();
      });
    }
    if (closeBtn) {
      register(closeBtn, "click", (ev) => {
        ev.preventDefault();
        closeLogoutModal();
      });
    }
    if (confirmBtn) {
      register(confirmBtn, "click", (ev) => {
        ev.preventDefault();
        try {
          window.location.href = redirectTo;
        } catch (_) {}
      });
    }
    register(window, "keydown", (ev) => {
      if (ev.key === "Escape") {
        closeLogoutModal();
      }
    });
  };

  // Collapsible sections (dropdown-like)
  const setupCollapsibles = () => {
    const toggles = document.querySelectorAll(".collapse-toggle");
    toggles.forEach((btn) => {
      const targetSel = btn.getAttribute("data-target");
      if (!targetSel) return;
      const target = document.querySelector(targetSel);
      if (!target) return;
      const setState = (expanded) => {
        btn.setAttribute("aria-expanded", expanded ? "true" : "false");
        target.classList.toggle("hidden", !expanded);
      };
      // init from aria-expanded
      const initial = btn.getAttribute("aria-expanded") !== "false";
      setState(initial);
      register(btn, "click", (ev) => {
        ev.preventDefault();
        const expanded = btn.getAttribute("aria-expanded") === "true";
        setState(!expanded);
      });
    });
  };

  const MODEL_KEY_MAP = {
    VIDEO_ASPECT_RATIO_LANDSCAPE: {
      text: "veo_3_1_t2v_fast_ultra",
      startImage: "veo_3_1_i2v_s_fast_ultra_fl",
      referenceImages: "veo_3_0_r2v_fast_ultra",
      extend: "veo_3_1_extend_fast_landscape_ultra",
      reshoot: "veo_3_0_reshoot_landscape",
      label: "Veo 3.1 Fast - Landscape",
    },
    VIDEO_ASPECT_RATIO_PORTRAIT: {
      text: "veo_3_1_t2v_fast_portrait_ultra",
      startImage: "veo_3_1_i2v_s_fast_portrait_ultra_fl",
      referenceImages: "veo_3_0_r2v_fast_portrait_ultra",
      extend: "veo_3_1_extend_fast_portrait_ultra",
      reshoot: "veo_3_0_reshoot_portrait",
      label: "Veo 3.1 Fast - Portrait",
    },
  };
  const fallbackModelConfig = MODEL_KEY_MAP.VIDEO_ASPECT_RATIO_LANDSCAPE;

  const allowedModes = new Set(["single", "batch", "director", "frame"]);
  const cardRoot = document.querySelector(".card");
  const initialFromDom = cardRoot?.dataset?.initialMode;
  let promptMode = allowedModes.has(initialMode)
    ? initialMode
    : allowedModes.has(initialFromDom)
    ? initialFromDom
    : "single";
  if (cardRoot) cardRoot.dataset.initialMode = promptMode;

  const el = (id) => document.getElementById(id);
  const statusEl = el("status");
  const outputEl = el("output");
  const mediaEl = el("media");
  // Tracking multi-ops
  let trackedOps = []; // [{ name, sceneId }]
  // Polling control to avoid duplicate timers/status
  let pollState = {
    sessionId: 0,
    initialTimer: null,
    loopTimer: null,
    stream: null,
    currentJobId: null,
  };
  let quotaPendingIncrement = 0;
  const resetPolling = () => {
    try {
      if (pollState.initialTimer) clearTimeout(pollState.initialTimer);
    } catch (_) {}
    try {
      if (pollState.loopTimer) clearTimeout(pollState.loopTimer);
    } catch (_) {}
    try {
      if (pollState.backoffTimer) clearInterval(pollState.backoffTimer);
    } catch (_) {}
    try {
      if (pollState.stream) pollState.stream.close();
    } catch (_) {}
    pollState.initialTimer = null;
    pollState.loopTimer = null;
    pollState.backoffTimer = null;
    pollState.stream = null;
  };
  let scenes = []; // [{ id, prompt, linkPrev }]
  let singleImage = {
    imageUrl: "",
    dataUrl: "",
    mediaId: "",
    uploadInfo: undefined,
    fileName: "",
    imageAspect: "",
    manualAspect: false,
  };
  let batchImage = {
    imageUrl: "",
    dataUrl: "",
    mediaId: "",
    uploadInfo: undefined,
    fileName: "",
    imageAspect: "",
    manualAspect: false,
  };
  let frameStartImage = {
    imageUrl: "",
    dataUrl: "",
    mediaId: "",
    uploadInfo: undefined,
    fileName: "",
    imageAspect: "",
    manualAspect: false,
  };
  let frameEndImage = {
    imageUrl: "",
    dataUrl: "",
    mediaId: "",
    uploadInfo: undefined,
    fileName: "",
    imageAspect: "",
    manualAspect: false,
  };
  let frameImageEventsReady = false;
  let singleImageEventsReady = false;
  let settingsState = {
    bearer: "",
    appCredential: "",
    loaded: false,
    busy: false,
    visible: false,
    reveal: false,
    statusTimer: null,
  };
  let characters = []; // [{ id, name, imageUrl, mediaId }]
  let lastRequestAspects = []; // remember aspect ratio for each request in last generate batch

  let CONFIG = {
    defaultGenerateUrl: "",
    defaultCheckUrl: "",
    defaultModelKey: "veo_3_1_t2v_fast_ultra",
    defaultAspectRatio: "VIDEO_ASPECT_RATIO_LANDSCAPE",
    defaultHeaders: {},
    clientContext: undefined,
  };

  // Load default config from server
    (async () => {
      try {
        const r = await fetch("/api/config");
        const cfg = await r.json();
        CONFIG = { ...CONFIG, ...cfg };
        // Set default UI nilai dari config
        try {
          el("settingAspect").value =
            CONFIG.defaultAspectRatio || "VIDEO_ASPECT_RATIO_LANDSCAPE";
        } catch (_) {}
        try {
          updateModelBadge();
        } catch (_) {}
        try {
          await syncQuotaFromServer();
        } catch (_) {}
        try {
          updateQuotaUI();
        } catch (_) {}
        if (!singleImage.manualAspect) {
          const aspectValue =
            el("settingAspect")?.value ||
            CONFIG.defaultAspectRatio ||
            "VIDEO_ASPECT_RATIO_LANDSCAPE";
          singleImage.imageAspect = mapVideoAspectToImageAspect(aspectValue);
        }
        try {
          renderSingleImage();
        } catch (_) {}
        statusEl.textContent = "Config default dimuat.";
      } catch (_) {}
    })();

  // ======= reCAPTCHA Token Status Check =======
  const updateTokenStatus = async () => {
    const dotEl = el("tokenStatusDot");
    const textEl = el("tokenStatusText");
    const barEl = el("tokenStatusBar");
    if (!dotEl || !textEl) return;
    
    try {
      const res = await fetch("/api/recaptcha-token-status");
      const data = await res.json();
      
      if (data.available) {
        dotEl.style.background = "#00ff88";
        dotEl.style.boxShadow = "0 0 6px #00ff88";
        textEl.style.color = "#00ff88";
        textEl.textContent = `✓ Token tersedia (${data.age}s/${data.maxAge}s)`;
        if (barEl) barEl.style.background = "rgba(0, 200, 100, 0.15)";
      } else {
        dotEl.style.background = "#ff6666";
        dotEl.style.boxShadow = "none";
        textEl.style.color = "#ff6666";
        textEl.textContent = "✗ Token tidak tersedia - Admin perlu capture di Browser Mode";
        if (barEl) barEl.style.background = "rgba(255, 100, 100, 0.15)";
      }
    } catch (_) {
      dotEl.style.background = "#888";
      dotEl.style.boxShadow = "none";
      textEl.style.color = "#888";
      textEl.textContent = "? Tidak dapat mengecek status token";
      if (barEl) barEl.style.background = "rgba(100, 100, 100, 0.15)";
    }
  };
  
  // Check token status on load and every 30 seconds
  updateTokenStatus();
  const tokenCheckInterval = setInterval(updateTokenStatus, 30000);
  cleanupFns.push(() => clearInterval(tokenCheckInterval));

  const getModelConfig = (aspectValue) => {
    if (!aspectValue) return fallbackModelConfig;
    return MODEL_KEY_MAP[aspectValue] || fallbackModelConfig;
  };

  const mapVideoAspectToImageAspect = (aspectKey) => {
    switch (aspectKey) {
      case "VIDEO_ASPECT_RATIO_PORTRAIT":
        return "IMAGE_ASPECT_RATIO_PORTRAIT";
      case "VIDEO_ASPECT_RATIO_SQUARE":
        return "IMAGE_ASPECT_RATIO_SQUARE";
      default:
        return "IMAGE_ASPECT_RATIO_LANDSCAPE";
    }
  };
  // Frame-to-Frame dihapus: tidak ada lagi fungsi atau UI terkait.

  const updateModelBadge = () => {
    const aspectValue =
      el("settingAspect")?.value ||
      CONFIG.defaultAspectRatio ||
      "VIDEO_ASPECT_RATIO_LANDSCAPE";
    const cfg = getModelConfig(aspectValue);
    const sel = el("settingModelKey");
    if (sel) {
      const opts = Array.from(sel.options || []);
      const allowPortrait = aspectValue === "VIDEO_ASPECT_RATIO_PORTRAIT";
      const allowLandscape = aspectValue === "VIDEO_ASPECT_RATIO_LANDSCAPE";
      const allowAll = aspectValue === "VIDEO_ASPECT_RATIO_SQUARE";
      for (const opt of opts) {
        const targetAspect = (opt.dataset?.aspect || "").trim();
        const allowed =
          allowAll ||
          (allowPortrait && targetAspect === "VIDEO_ASPECT_RATIO_PORTRAIT") ||
          (allowLandscape && targetAspect === "VIDEO_ASPECT_RATIO_LANDSCAPE") ||
          !targetAspect;
        opt.hidden = !allowed;
        opt.disabled = !allowed;
      }
      const desired =
        cfg?.text || CONFIG.defaultModelKey || "veo_3_1_t2v_fast_ultra";
      const desiredOpt = opts.find((o) => o.value === desired && !o.disabled);
      const firstAllowed = opts.find((o) => !o.disabled);
      sel.value = desiredOpt
        ? desiredOpt.value
        : firstAllowed
        ? firstAllowed.value
        : "";
    }
  };

  const getPlan = () =>
    (document.cookie.match(/(?:^|; )plan=([^;]+)/)?.[1] || "").toLowerCase();
  const isVeoFastModelKey = (key) =>
    typeof key === "string" && /veo_3_1/i.test(key) && /fast/i.test(key);
  const isUnlimitedModelKey = (key) =>
    typeof key === "string" && /ultra_relaxed/i.test(key);
  const isPaidPlan = (plan) => plan && plan !== "free";
  const isAdminPlan = (plan) => plan === "admin";
  const quotaKeyForMode = (mode) =>
    mode === "batch" ? "batch" : mode === "frame" ? "frame" : "single";
  const relaxedModelForAspect = (aspect) => {
    const a = String(aspect || "");
    if (/PORTRAIT/i.test(a)) return "veo_3_1_t2v_fast_portrait_ultra_relaxed";
    return "veo_3_1_t2v_fast_ultra_relaxed";
  };
    const DEFAULT_BUDGET = 75;
    const DEFAULT_ALLOC = { single: 25, batch: 25, frame: 25 };
    const readQuotaAlloc = () => {
    let raw = "";
    try {
      raw = localStorage.getItem("quota.veo3fast.alloc") || "";
    } catch (_) {}
    let obj = {};
    try {
      obj = raw ? JSON.parse(raw) : {};
    } catch (_) {
      obj = {};
    }
    const pick = (v, d) => (v === undefined || v === null ? d : v);
    const s = Number(pick(obj.single, DEFAULT_ALLOC.single));
    const b = Number(pick(obj.batch, DEFAULT_ALLOC.batch));
    const f = Number(pick(obj.frame, DEFAULT_ALLOC.frame));
    const sum = [s, b, f].reduce((a, c) => a + (Number.isFinite(c) ? c : 0), 0);
    if (!Number.isFinite(sum) || sum <= 0)
      return { ...DEFAULT_ALLOC, budget: DEFAULT_BUDGET };
      return {
        single: Math.max(0, s),
        batch: Math.max(0, b),
        frame: Math.max(0, f),
        budget: DEFAULT_BUDGET,
      };
    };
    const writeQuotaAlloc = (alloc) => {
    const s = Math.max(0, Number(alloc.single || 0));
    const b = Math.max(0, Number(alloc.batch || 0));
    const f = Math.max(0, Number(alloc.frame || 0));
    const payload = { single: s, batch: b, frame: f };
    try {
      localStorage.setItem("quota.veo3fast.alloc", JSON.stringify(payload));
    } catch (_) {}
  };
    const quotaLimitForMode = (mode) => {
      const alloc = readQuotaAlloc();
      const raw =
        mode === "batch"
          ? alloc.batch
          : mode === "frame"
          ? alloc.frame
          : alloc.single;
      const def =
        mode === "batch"
          ? DEFAULT_ALLOC.batch
          : mode === "frame"
          ? DEFAULT_ALLOC.frame
          : DEFAULT_ALLOC.single;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : def;
    };
    const todayStr = () => {
      try {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const s = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${s}`;
      } catch (_) {
        try {
          return new Date().toISOString().slice(0, 10);
        } catch (_) {
          return "1970-01-01";
        }
      }
    };
    const readQuota = (mode) => {
      const key = `quota.veo3fast.${quotaKeyForMode(mode)}`;
      let raw = "";
      try {
        raw = localStorage.getItem(key) || "";
      } catch (_) {}
      let obj = {};
      try {
        obj = raw ? JSON.parse(raw) : {};
      } catch (_) {
        obj = {};
      }
      const today = todayStr();
      if (!obj || obj.date !== today) return { date: today, count: 0 };
      const c = Number(obj.count || 0);
      return { date: today, count: Number.isFinite(c) ? c : 0 };
    };
    const writeQuota = (mode, count) => {
      const key = `quota.veo3fast.${quotaKeyForMode(mode)}`;
      const value = { date: todayStr(), count: Math.max(0, Number(count || 0)) };
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (_) {}
    };
    const syncQuotaFromServer = async () => {
      try {
        const resp = await fetch("/api/usage/veo-today", {
          method: "GET",
          cache: "no-store",
        });
        if (!resp.ok) return;
        const data = await resp.json().catch(() => null);
        if (!data || !data.ok) return;
        const serverCountRaw =
          data.veoCount !== undefined ? data.veoCount : data.count;
        const serverCount = Number(serverCountRaw || 0);
        if (!Number.isFinite(serverCount) || serverCount < 0) return;
        const today = todayStr();
        const modes = ["single", "batch", "frame"];
        for (const mode of modes) {
          const key = `quota.veo3fast.${quotaKeyForMode(mode)}`;
          let nextVal = { date: today, count: serverCount };
          try {
            const raw = localStorage.getItem(key) || "";
            if (raw) {
              try {
                const existing = JSON.parse(raw);
                if (existing && existing.date === today) {
                  const localCount = Number(existing.count || 0);
                  if (
                    Number.isFinite(localCount) &&
                    localCount > serverCount
                  ) {
                    nextVal.count = localCount;
                  }
                }
              } catch (_) {}
            }
            localStorage.setItem(key, JSON.stringify(nextVal));
          } catch (_) {}
        }
      } catch (_) {}
    };
  const updateQuotaUI = () => {
    const node = el("quotaLabel");
    if (!node) return;
    const plan = getPlan();
    const isAdmin = isAdminPlan(plan);
    const mode = promptMode;
    const aspectValue =
      el("settingAspect")?.value ||
      CONFIG.defaultAspectRatio ||
      "VIDEO_ASPECT_RATIO_LANDSCAPE";
    const cfg = getModelConfig(aspectValue);
    const selectedModelKey = (el("settingModelKey")?.value || "").trim();
    const fastCandidate =
      selectedModelKey || cfg?.text || CONFIG.defaultModelKey || "";
    const paid = isPaidPlan(plan);
    const isFast = isVeoFastModelKey(fastCandidate);
    const isUnlimited = isUnlimitedModelKey(fastCandidate);
    if (!paid || !isFast || isAdmin || isUnlimited) {
      node.textContent = "";
      return;
    }
    const limit = quotaLimitForMode(mode);
    const q = readQuota(mode);
    node.textContent = `Kuota Veo 3.1 Fast: ${q.count}/${limit} hari ini`;
    try {
      updateQuotaHint();
    } catch (_) {}
  };
  const updateQuotaHint = () => {
    const h = el("quotaHint");
    if (!h) return;
    const alloc = readQuotaAlloc();
    const qs = readQuota("single");
    const qb = readQuota("batch");
    const qf = readQuota("frame");
    const usedTotal = qs.count + qb.count + qf.count;
    h.textContent = `Total ${usedTotal}/${alloc.budget} sehari • Kuota hari ini: Tunggal ${qs.count}/${alloc.single}, Batch ${qb.count}/${alloc.batch}, Frame ${qf.count}/${alloc.frame}`;
  };

  const openQuotaModal = () => {
    const modal = el("quotaModal");
    if (!modal) return;
    const alloc = readQuotaAlloc();
    const s = el("quotaSingleInput");
    const b = el("quotaBatchInput");
    const f = el("quotaFrameInput");
    const h = el("quotaHint");
    if (s) s.value = String(alloc.single || 0);
    if (b) b.value = String(alloc.batch || 0);
    if (f) f.value = String(alloc.frame || 0);
    if (h) updateQuotaHint();
    modal.style.display = "";
    modal.classList.add("show");
  };
  const closeQuotaModal = () => {
    const modal = el("quotaModal");
    if (!modal) return;
    modal.classList.remove("show");
    modal.style.display = "none";
  };
  const setupQuotaModal = () => {
    const modal = el("quotaModal");
    if (!modal) return;
    const s = el("quotaSingleInput");
    const b = el("quotaBatchInput");
    const f = el("quotaFrameInput");
    const save = el("quotaSave");
    const reset = el("quotaReset");
    const closeBtn = el("quotaClose");
    const h = el("quotaHint");
    const updateHint = () => {
      const alloc = readQuotaAlloc();
      const sum = [s, b, f]
        .map((el) => Math.max(0, parseInt((el?.value || "0").trim(), 10) || 0))
        .reduce((a, c) => a + c, 0);
      const qs = readQuota("single");
      const qb = readQuota("batch");
      const qf = readQuota("frame");
      const usedTotal = qs.count + qb.count + qf.count;
      if (h)
        h.textContent = `Total ${sum}/${alloc.budget} sehari • Kuota hari ini: Tunggal ${qs.count}/${alloc.single}, Batch ${qb.count}/${alloc.batch}, Frame ${qf.count}/${alloc.frame}`;
    };
    [s, b, f].forEach((el) => el && el.addEventListener("input", updateHint));
    save?.addEventListener("click", (ev) => {
      ev.preventDefault();
      const alloc = readQuotaAlloc();
      const sv = Math.max(0, parseInt((s?.value || "0").trim(), 10) || 0);
      const bv = Math.max(0, parseInt((b?.value || "0").trim(), 10) || 0);
      const fv = Math.max(0, parseInt((f?.value || "0").trim(), 10) || 0);
      const sum = sv + bv + fv;
      if (sum !== alloc.budget) {
        if (h) h.textContent = `Total harus ${alloc.budget}.`;
        return;
      }
      writeQuotaAlloc({ single: sv, batch: bv, frame: fv });
      updateQuotaUI();
      closeQuotaModal();
    });
    reset?.addEventListener("click", (ev) => {
      ev.preventDefault();
      writeQuotaAlloc(DEFAULT_ALLOC);
      openQuotaModal();
      updateQuotaUI();
    });
    closeBtn?.addEventListener("click", (ev) => {
      ev.preventDefault();
      closeQuotaModal();
    });
    modal.addEventListener("click", (ev) => {
      if (ev.target === modal) closeQuotaModal();
    });
    try {
      window.__openQuotaModal = openQuotaModal;
    } catch (_) {}
    try {
      updateHint();
    } catch (_) {}
  };

  // === Sub-gaya visual ===
  const SUB_STYLE_OPTIONS = {
    sinematik: [
      { value: "blockbuster_heroic", label: "Blockbuster/heroic" },
      { value: "drama_intim", label: "Drama intim" },
      { value: "romance_soft_light", label: "Romance soft-light" },
      { value: "thriller_crime", label: "Thriller/Crime" },
      {
        value: "horror_found_footage",
        label: "Horror (found-footage/slow burn)",
      },
      { value: "war_epic", label: "War/epic" },
      { value: "documentary_natural", label: "Documentary natural" },
      { value: "music_video_stylized", label: "Music video stylized" },
      { value: "western_neo_western", label: "Western/neo-western" },
      { value: "art_house_minimal", label: "Art-house minimal" },
    ],
    realistik: [
      { value: "photoreal_daylight", label: "Photoreal daylight" },
      { value: "natural_window_light", label: "Natural window-light" },
      { value: "overcast_soft", label: "Overcast soft" },
      { value: "night_street_light", label: "Night street-light" },
      { value: "golden_hour", label: "Golden hour" },
      { value: "rainy_wet_streets", label: "Rainy/wet streets" },
      { value: "high_iso_grainy", label: "High-ISO/grainy" },
      { value: "studio_softbox", label: "Studio softbox" },
      { value: "macro_realism", label: "Macro realism" },
      { value: "aerial_drone_realism", label: "Aerial/drone realism" },
    ],
    anime: [
      { value: "shonen_action", label: "Shōnen action" },
      { value: "shojo_romance", label: "Shōjo romance" },
      { value: "slice_of_life", label: "Slice-of-life" },
      { value: "mecha", label: "Mecha" },
      { value: "isekai_fantasy", label: "Isekai fantasy" },
      { value: "cyber_anime", label: "Cyber anime" },
      { value: "cel_90s", label: "90s cel-anime" },
      { value: "ghibli_esque", label: "Ghibli-esque" },
      { value: "chibi_cute", label: "Chibi/cute" },
      { value: "dark_fantasy_anime", label: "Dark fantasy anime" },
    ],
    pixar3d: [
      { value: "stylized_cartoon_real", label: "Stylized cartoon-real" },
      { value: "toy_like_plasticity", label: "Toy-like plasticity" },
      { value: "soft_subsurface_skin", label: "Soft subsurface skin" },
      { value: "bright_pastel_world", label: "Bright pastel world" },
      { value: "fur_cloth_focus", label: "Fur/cloth focus" },
      { value: "expressive_eyes", label: "Expressive eyes" },
      {
        value: "family_friendly_adventure",
        label: "Family-friendly adventure",
      },
      { value: "miniature_props", label: "Miniature props" },
      { value: "clean_gi_lighting", label: "Clean GI lighting" },
      { value: "filmic_dof", label: "Filmic DOF" },
    ],
    cyberpunk: [
      { value: "neon_noir", label: "Neon-noir" },
      { value: "rainy_alley", label: "Rainy alley" },
      { value: "corporate_high_rise", label: "Corporate high-rise" },
      { value: "street_market_tech", label: "Street market tech" },
      { value: "augmented_humans", label: "Augmented humans" },
      { value: "retro_crt_ui", label: "Retro-CRT UI" },
      { value: "hologram_cityscape", label: "Hologram cityscape" },
      { value: "netrunner_lab", label: "Netrunner lab" },
      { value: "motorbike_chase", label: "Motorbike chase" },
      { value: "night_aerial_megacity", label: "Night aerial megacity" },
    ],
    retro80an: [
      { value: "vhs_crt_scanlines", label: "VHS/CRT scanlines" },
      { value: "synthwave_neon", label: "Synthwave neon" },
      { value: "arcade_miami_vice", label: "Arcade/miami vice" },
      { value: "analog_lens_flare", label: "Analog lens-flare" },
      { value: "warm_kodachrome", label: "Warm Kodachrome" },
      { value: "pixel_8bit_vibe", label: "8-bit/pixel vibe" },
      { value: "cassette_cyber_retro", label: "Cassette/cyber-retro" },
      { value: "aerobics_fitness_tv", label: "Aerobics/fitness TV" },
      { value: "polaroid_flash", label: "Polaroid flash" },
      { value: "mall_culture", label: "Mall culture" },
    ],
    claymation: [
      { value: "hand_made_fingerprints", label: "Hand-made fingerprints" },
      { value: "stop_motion_jitter", label: "Stop-motion jitter" },
      { value: "plasticine_texture", label: "Plasticine texture" },
      { value: "miniature_sets", label: "Miniature sets" },
      { value: "storybook_props", label: "Storybook props" },
      {
        value: "exaggerated_squash_stretch",
        label: "Exaggerated squash-and-stretch",
      },
      { value: "cozy_diorama", label: "Cozy diorama" },
      { value: "dark_clay_horror", label: "Dark clay horror" },
      { value: "kids_show_cheerful", label: "Kids show cheerful" },
      { value: "mixed_practical_cg", label: "Mixed practical+CG" },
    ],
    fantasi: [
      {
        value: "high_fantasy_elves_kingdoms",
        label: "High-fantasy (elves/kingdoms)",
      },
      { value: "dark_gothic", label: "Dark/gothic" },
      { value: "fairy_forest", label: "Fairy forest" },
      { value: "desert_magic_sand_mage", label: "Desert magic/sand mage" },
      { value: "sky_islands", label: "Sky islands" },
      { value: "elemental_spells", label: "Elemental spells" },
      { value: "medieval_castles", label: "Medieval castles" },
      { value: "dragon_griffin", label: "Dragon/griffin" },
      { value: "rune_ancient_ruins", label: "Rune/ancient ruins" },
      { value: "steampunk_fantasy_mashup", label: "Steampunk-fantasy mashup" },
    ],
    steampunk: [
      { value: "brass_gears", label: "Brass & gears" },
      { value: "airship_docks", label: "Airship docks" },
      { value: "goggles_corsets", label: "Goggles & corsets" },
      { value: "steam_factory", label: "Steam factory" },
      { value: "victorian_street", label: "Victorian street" },
      { value: "automatons", label: "Automatons" },
      { value: "retro_futuristic_lab", label: "Retro-futuristic lab" },
      { value: "coal_soot_atmosphere", label: "Coal/soot atmosphere" },
      { value: "monochrome_copper_grade", label: "Monochrome copper grade" },
      { value: "clockwork_interiors", label: "Clockwork interiors" },
    ],
    filmnoir: [
      { value: "classic_bw_hard_light", label: "Classic B&W hard-light" },
      { value: "venetian_blinds_shadows", label: "Venetian blinds shadows" },
      { value: "rainy_night_city", label: "Rainy night city" },
      { value: "detective_office", label: "Detective office" },
      { value: "femme_fatale_closeups", label: "Femme fatale close-ups" },
      { value: "cigarette_smoke_haze", label: "Cigarette smoke haze" },
      { value: "low_key_contrast", label: "Low-key contrast" },
      { value: "dutch_angles", label: "Dutch angles" },
      { value: "jazz_club", label: "Jazz club" },
      { value: "neo_noir_color", label: "Neo-noir color (teal-orange)" },
    ],
  };

  const getSubStyleLabel = (styleKey, value) => {
    const arr = SUB_STYLE_OPTIONS[styleKey] || [];
    const found = arr.find((o) => o.value === value);
    return found ? found.label : "";
  };

  const renderSubStyleOptions = () => {
    const subSelect = el("settingSubStyle");
    if (!subSelect) return;
    const styleKey = el("settingStyle")?.value || "";
    subSelect.innerHTML = '<option value="">(Tidak ada)</option>';
    const options = SUB_STYLE_OPTIONS[styleKey];
    if (!styleKey || !options || !options.length) {
      subSelect.disabled = true;
      return;
    }
    subSelect.disabled = false;
    options.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      subSelect.appendChild(opt);
    });
  };

  const setupVisualStyleSelectors = () => {
    renderSubStyleOptions();
    const styleSelect = el("settingStyle");
    if (styleSelect) {
      styleSelect.addEventListener("change", () => {
        const subSelect = el("settingSubStyle");
        if (subSelect) subSelect.value = ""; // reset pilihan sub-gaya
        renderSubStyleOptions();
      });
    }
  };

  // Mode switching
  const setPromptMode = (mode) => {
    promptMode = mode;
    // toggle active state
    const singleBtn = el("modeSingleBtn");
    const batchBtn = el("modeBatchBtn");
    const directorBtn = el("modeDirectorBtn");
    const frameBtn = el("modeFrameBtn");
    if (singleBtn) singleBtn.classList.toggle("active", mode === "single");
    if (batchBtn) batchBtn.classList.toggle("active", mode === "batch");
    if (directorBtn)
      directorBtn.classList.toggle("active", mode === "director");
    if (frameBtn) frameBtn.classList.toggle("active", mode === "frame");
    // show/hide containers
    const show = (id, on) => {
      const n = el(id);
      if (n) n.style.display = on ? "" : "none";
    };
    show("modeSingle", mode === "single");
    show("modeBatch", mode === "batch");
    show("modeDirector", mode === "director");
    show("modeFrame", mode === "frame");
    // Update badge dan render ulang image aspect bila perlu
    try {
      const aspectSel = el("settingAspect");
      if (aspectSel) {
        updateModelBadge();
        if (!singleImage.manualAspect) {
          const aspectValue =
            aspectSel.value ||
            CONFIG.defaultAspectRatio ||
            "VIDEO_ASPECT_RATIO_LANDSCAPE";
          singleImage.imageAspect = mapVideoAspectToImageAspect(aspectValue);
          renderSingleImage();
        }
        if (!batchImage.manualAspect) {
          const aspectValue =
            aspectSel.value ||
            CONFIG.defaultAspectRatio ||
            "VIDEO_ASPECT_RATIO_LANDSCAPE";
          batchImage.imageAspect = mapVideoAspectToImageAspect(aspectValue);
          renderBatchImage();
        }
        if (!frameStartImage.manualAspect) {
          const aspectValue =
            aspectSel.value ||
            CONFIG.defaultAspectRatio ||
            "VIDEO_ASPECT_RATIO_LANDSCAPE";
          frameStartImage.imageAspect =
            mapVideoAspectToImageAspect(aspectValue);
          renderFrameStartImage();
        }
        if (!frameEndImage.manualAspect) {
          const aspectValue =
            aspectSel.value ||
            CONFIG.defaultAspectRatio ||
            "VIDEO_ASPECT_RATIO_LANDSCAPE";
          frameEndImage.imageAspect = mapVideoAspectToImageAspect(aspectValue);
          renderFrameEndImage();
        }
      }
    } catch (_) {}
    try {
      updateQuotaUI();
    } catch (_) {}
  };
  el("modeSingleBtn")?.addEventListener("click", () => setPromptMode("single"));
  el("modeBatchBtn")?.addEventListener("click", () => setPromptMode("batch"));
  el("modeDirectorBtn")?.addEventListener("click", () =>
    setPromptMode("director")
  );
  el("modeFrameBtn")?.addEventListener("click", () => setPromptMode("frame"));
  el("settingAspect")?.addEventListener("change", () => {
    updateModelBadge();
    updateQuotaUI();
    if (!singleImage.manualAspect) {
      const aspectValue =
        el("settingAspect")?.value ||
        CONFIG.defaultAspectRatio ||
        "VIDEO_ASPECT_RATIO_LANDSCAPE";
      singleImage.imageAspect = mapVideoAspectToImageAspect(aspectValue);
    }
    renderSingleImage();
    if (!batchImage.manualAspect) {
      const aspectValue =
        el("settingAspect")?.value ||
        CONFIG.defaultAspectRatio ||
        "VIDEO_ASPECT_RATIO_LANDSCAPE";
      batchImage.imageAspect = mapVideoAspectToImageAspect(aspectValue);
    }
    renderBatchImage();
    if (!frameStartImage.manualAspect) {
      const aspectValue =
        el("settingAspect")?.value ||
        CONFIG.defaultAspectRatio ||
        "VIDEO_ASPECT_RATIO_LANDSCAPE";
      frameStartImage.imageAspect = mapVideoAspectToImageAspect(aspectValue);
    }
    renderFrameStartImage();
    if (!frameEndImage.manualAspect) {
      const aspectValue =
        el("settingAspect")?.value ||
        CONFIG.defaultAspectRatio ||
        "VIDEO_ASPECT_RATIO_LANDSCAPE";
      frameEndImage.imageAspect = mapVideoAspectToImageAspect(aspectValue);
    }
    renderFrameEndImage();
  });
  el("settingModelKey")?.addEventListener("change", () => {
    updateQuotaUI();
  });

  // ==== Karakter (foto referensi) UI ====
  const newCharId = () =>
    `char-${Date.now().toString(16)}-${Math.floor(Math.random() * 1000)}`;
  const addCharacter = () => {
    characters.push({
      id: newCharId(),
      name: "",
      imageUrl: "",
      mediaId: "",
      identity: "",
      identityLock: true,
    });
    renderCharacters();
    renderScenes();
  };
  const removeCharacter = (index) => {
    const removedId = characters[index]?.id;
    characters.splice(index, 1);
    // Hapus referensi karakter ini dari tiap adegan dan dialognya
    try {
      scenes = scenes.map((s) => {
        const nextChars = (s.characters || []).filter(
          (cid) => cid !== removedId
        );
        const dlg = s.dialogues || {};
        if (
          removedId &&
          dlg &&
          Object.prototype.hasOwnProperty.call(dlg, removedId)
        ) {
          const { [removedId]: _omit, ...rest } = dlg;
          const ord = s.dialogOrder || {};
          let restOrder = ord;
          if (Object.prototype.hasOwnProperty.call(ord, removedId)) {
            const { [removedId]: _omitOrder, ...ro } = ord;
            restOrder = ro;
          }
          return {
            ...s,
            characters: nextChars,
            dialogues: rest,
            dialogOrder: restOrder,
          };
        }
        const ord = s.dialogOrder || {};
        let restOrder = ord;
        if (Object.prototype.hasOwnProperty.call(ord, removedId)) {
          const { [removedId]: _omitOrder, ...ro } = ord;
          restOrder = ro;
        }
        return { ...s, characters: nextChars, dialogOrder: restOrder };
      });
    } catch (_) {}
    renderCharacters();
    renderScenes();
  };
  const uploadBase64 = async (dataUrl, fileName, mime) => {
    const resp = await fetch("/api/upload_base64", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, mime, dataUrl }),
    });
    const ct = resp.headers.get("content-type") || "";
    let data, text;
    if (ct.includes("application/json")) {
      data = await resp.json();
    } else {
      text = await resp.text();
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || `Upload gagal (${resp.status})`);
      }
    }
    if (!resp.ok) {
      throw new Error(data?.error || `Upload gagal (${resp.status})`);
    }
    if (!data?.url) {
      throw new Error("Upload gagal: URL tidak diterima");
    }
    return data.url;
  };
  // ==== Cropper (modal) ====
  let cropState = {
    img: null,
    scale: 1,
    minScale: 1,
    maxScale: 3,
    offsetX: 0,
    offsetY: 0,
    canvasW: 640,
    canvasH: 360,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    targetType: "character",
    targetIndex: 0,
    index: 0,
    fileName: "",
    mime: "image/png",
    targetAspect: "IMAGE_ASPECT_RATIO_LANDSCAPE",
  };
  const aspectToSize = (aspectKey) => {
    switch (aspectKey) {
      case "IMAGE_ASPECT_RATIO_PORTRAIT":
        return { w: 360, h: 640 };
      case "IMAGE_ASPECT_RATIO_SQUARE":
        return { w: 512, h: 512 };
      default:
        return { w: 640, h: 360 };
    }
  };
  const openCropperWithDataUrl = async (
    dataUrl,
    target,
    fileName = "image.png",
    mime = "image/png"
  ) => {
    const info =
      target && typeof target === "object" && !Array.isArray(target)
        ? target
        : { type: "character", index: Number.isFinite(target) ? target : 0 };
    const targetType =
      info.type === "single"
        ? "single"
        : info.type === "frame"
        ? "frame"
        : info.type === "batch"
        ? "batch"
        : "character";
    const targetIndex =
      typeof info.index === "number" && Number.isFinite(info.index)
        ? info.index
        : 0;
    const img = new Image();
    img.onload = () => {
      const currentVideoAspect =
        el("settingAspect")?.value ||
        CONFIG.defaultAspectRatio ||
        "VIDEO_ASPECT_RATIO_LANDSCAPE";
      const singleFallback =
        singleImage.imageAspect ||
        mapVideoAspectToImageAspect(currentVideoAspect);
      const batchFallback =
        batchImage.imageAspect ||
        mapVideoAspectToImageAspect(currentVideoAspect);
      const characterFallback =
        characters[targetIndex]?.imageAspect ||
        CONFIG.defaultImageAspect ||
        "IMAGE_ASPECT_RATIO_LANDSCAPE";
      const frameFallback = mapVideoAspectToImageAspect(currentVideoAspect);
      const aspectKey =
        info.aspect ||
        (targetType === "single"
          ? singleFallback
          : targetType === "frame"
          ? frameFallback
          : targetType === "batch"
          ? batchFallback
          : characterFallback);
      const { w, h } = aspectToSize(aspectKey);
      const canvas = el("cropCanvas");
      canvas.width = w;
      canvas.height = h;
      const baseScale = Math.max(w / img.width, h / img.height);
      cropState = {
        img,
        targetType,
        targetIndex,
        index: targetIndex,
        fileName,
        mime,
        targetAspect: aspectKey,
        canvasW: w,
        canvasH: h,
        // scale supaya menutupi viewport
        minScale: baseScale,
        maxScale: baseScale * 4,
        scale: baseScale,
        offsetX: (w - img.width * baseScale) / 2,
        offsetY: (h - img.height * baseScale) / 2,
        dragging: false,
        dragStartX: 0,
        dragStartY: 0,
        onSave: info.onSave,
      };
      renderCropper();
      // Sinkronkan slider zoom dengan batas dan nilai awal
      try {
        const zoomEl = el("cropZoom");
        if (zoomEl) {
          zoomEl.min = String(cropState.minScale);
          zoomEl.max = String(cropState.maxScale);
          zoomEl.step = "0.01";
          zoomEl.value = String(cropState.scale);
        }
      } catch (_) {}
      el("cropperModal").classList.add("show");
    };
    img.src = dataUrl;
  };
  const renderCropper = () => {
    const canvas = el("cropCanvas");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!cropState.img) return;
    const w = cropState.img.width * cropState.scale;
    const h = cropState.img.height * cropState.scale;
    ctx.drawImage(cropState.img, cropState.offsetX, cropState.offsetY, w, h);
    // frame border
    ctx.strokeStyle = "#84cc16";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  };
  const attachCropperEvents = () => {
    const canvas = el("cropCanvas");
    const zoom = el("cropZoom");
    canvas.addEventListener("mousedown", (e) => {
      cropState.dragging = true;
      cropState.dragStartX = e.clientX;
      cropState.dragStartY = e.clientY;
    });
    register(window, "mouseup", () => {
      cropState.dragging = false;
    });
    register(window, "mousemove", (e) => {
      if (!cropState.dragging) return;
      const dx = e.clientX - cropState.dragStartX;
      const dy = e.clientY - cropState.dragStartY;
      cropState.dragStartX = e.clientX;
      cropState.dragStartY = e.clientY;
      cropState.offsetX += dx;
      cropState.offsetY += dy;
      renderCropper();
    });
    zoom.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      const prev = cropState.scale;
      // zoom around center
      const cx = cropState.canvasW / 2;
      const cy = cropState.canvasH / 2;
      const imgCx = (cx - cropState.offsetX) / prev;
      const imgCy = (cy - cropState.offsetY) / prev;
      cropState.scale = val;
      cropState.offsetX = cx - imgCx * cropState.scale;
      cropState.offsetY = cy - imgCy * cropState.scale;
      renderCropper();
    });
    el("cropCancel").addEventListener("click", () => {
      el("cropperModal").classList.remove("show");
      cropState.img = null;
    });
    el("cropSave").addEventListener("click", async () => {
      const canvas = el("cropCanvas");
      const off = document.createElement("canvas");
      off.width = canvas.width;
      off.height = canvas.height;
      const ctx = off.getContext("2d");
      const w = cropState.img.width * cropState.scale;
      const h = cropState.img.height * cropState.scale;
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, off.width, off.height);
      ctx.drawImage(cropState.img, cropState.offsetX, cropState.offsetY, w, h);
      const outUrl = off.toDataURL("image/png");
      // Jika ada callback khusus (mis. untuk frame), gunakan itu dan selesai.
      if (typeof cropState.onSave === "function") {
        try {
          await cropState.onSave(outUrl, cropState.fileName, cropState.mime);
        } catch (_) {}
        try {
          el("cropperModal").classList.remove("show");
        } catch (_) {}
        cropState.img = null;
        return;
      }
      const targetType = cropState.targetType || "character";
      const targetIndex =
        typeof cropState.targetIndex === "number"
          ? cropState.targetIndex
          : cropState.index || 0;
      const defaultName =
        targetType === "single"
          ? "single-image.png"
          : targetType === "batch"
          ? "batch-image.png"
          : `character-${targetIndex + 1}.png`;
      const fileName = cropState.fileName || defaultName;
      try {
        if (targetType === "character" && characters[targetIndex]) {
          characters[targetIndex].dataUrl = outUrl;
        } else if (targetType === "single") {
          singleImage.dataUrl = outUrl;
        } else if (targetType === "batch") {
          batchImage.dataUrl = outUrl;
        }
      } catch (_) {}
      try {
        const url = await uploadBase64(outUrl, fileName, "image/png");
        if (targetType === "character" && characters[targetIndex]) {
          characters[targetIndex].imageUrl = url;
          renderCharacters();
        } else if (targetType === "single") {
          singleImage.imageUrl = url;
          singleImage.fileName = fileName;
          singleImage.uploadInfo = undefined;
          singleImage.mediaId = "";
          renderSingleImage();
          statusEl.textContent = "Gambar prompt tunggal siap digunakan.";
        } else if (targetType === "batch") {
          batchImage.imageUrl = url;
          batchImage.fileName = fileName;
          batchImage.uploadInfo = undefined;
          batchImage.mediaId = "";
          renderBatchImage();
          statusEl.textContent = "Gambar batch siap digunakan.";
        }
        el("cropperModal").classList.remove("show");
        cropState.img = null;
      } catch (e) {
        statusEl.textContent = `Upload gagal: ${String(e)}`;
      }
    });
  };
  const handleFileForIndex = async (file, idx) => {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onerror = reject;
      reader.onload = async () => {
        try {
          const dataUrl = reader.result;
          await openCropperWithDataUrl(
            String(dataUrl),
            { type: "character", index: idx },
            file.name,
            file.type
          );
          resolve(true);
        } catch (e) {
          statusEl.textContent = `Gagal membuka cropper: ${String(e)}`;
          reject(e);
        }
      };
      reader.readAsDataURL(file);
    });
  };
  const ensureSingleImageDataUrl = async () => {
    if (singleImage.dataUrl) return singleImage.dataUrl;
    if (!singleImage.imageUrl) return undefined;
    try {
      const resp = await fetch(singleImage.imageUrl);
      const blob = await resp.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onerror = reject;
        r.onload = () => resolve(r.result);
        r.readAsDataURL(blob);
      });
      singleImage.dataUrl = String(dataUrl);
      return singleImage.dataUrl;
    } catch (_) {
      return undefined;
    }
  };
  const renderSingleImage = () => {
    const currentVideoAspect =
      el("settingAspect")?.value ||
      CONFIG.defaultAspectRatio ||
      "VIDEO_ASPECT_RATIO_LANDSCAPE";
    const fallbackImageAspect =
      mapVideoAspectToImageAspect(currentVideoAspect) ||
      "IMAGE_ASPECT_RATIO_LANDSCAPE";
    if (
      !singleImage.manualAspect &&
      singleImage.imageAspect !== fallbackImageAspect
    ) {
      singleImage.imageAspect = fallbackImageAspect;
    }
    if (!singleImage.imageAspect) {
      singleImage.imageAspect = fallbackImageAspect;
    }
    const aspectValue = singleImage.imageAspect || fallbackImageAspect;
    const aspectSelect = el("singleImageAspect");
    if (aspectSelect && aspectSelect.value !== aspectValue) {
      aspectSelect.value = aspectValue;
    }
    const aspectLabelMap = {
      IMAGE_ASPECT_RATIO_LANDSCAPE: "Landscape",
      IMAGE_ASPECT_RATIO_PORTRAIT: "Portrait",
      IMAGE_ASPECT_RATIO_SQUARE: "Square",
    };
    const aspectLabel = aspectLabelMap[aspectValue] || "yang dipilih";

    const dropzone = el("singleImageDropzone");
    if (dropzone) {
      if (singleImage.imageUrl) {
        dropzone.innerHTML = `<img src="${singleImage.imageUrl}" alt="Gambar referensi prompt tunggal" />`;
      } else {
        dropzone.innerHTML = `<div style="text-align:center;">
              <div style="font-size:13px;">Klik atau seret gambar ke sini</div>
              <div style="font-size:12px; color:#6b7280;">PNG atau JPG, dicrop otomatis ke rasio ${aspectLabel}.</div>
            </div>`;
      }
    }
    const recropBtn = el("singleImageRecrop");
    if (recropBtn) {
      recropBtn.style.display = singleImage.imageUrl ? "" : "none";
      recropBtn.disabled = !singleImage.imageUrl;
    }
    const removeBtn = el("singleImageRemove");
    if (removeBtn) {
      const disabled = !singleImage.imageUrl && !singleImage.mediaId;
      removeBtn.disabled = disabled;
      removeBtn.classList.toggle("disabled", disabled);
    }
    const mediaInput = el("singleImageMediaId");
    if (mediaInput && mediaInput.value !== (singleImage.mediaId || "")) {
      mediaInput.value = singleImage.mediaId || "";
    }
    const infoEl = el("singleImageUploadInfo");
    if (infoEl) {
      // Jangan tampilkan detail teknis; cukup gunakan teks statis
      // "Jika Media ID diisi, generate akan memakai Start Image" di markup.
      infoEl.textContent = "";
    }
  };
  const ensureBatchImageDataUrl = async () => {
    if (batchImage.dataUrl) return batchImage.dataUrl;
    if (!batchImage.imageUrl) return undefined;
    try {
      const resp = await fetch(batchImage.imageUrl);
      const blob = await resp.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onerror = reject;
        r.onload = () => resolve(r.result);
        r.readAsDataURL(blob);
      });
      batchImage.dataUrl = String(dataUrl);
      return batchImage.dataUrl;
    } catch (_) {
      return undefined;
    }
  };
  const renderBatchImage = () => {
    const currentVideoAspect =
      el("settingAspect")?.value ||
      CONFIG.defaultAspectRatio ||
      "VIDEO_ASPECT_RATIO_LANDSCAPE";
    const fallbackImageAspect =
      mapVideoAspectToImageAspect(currentVideoAspect) ||
      "IMAGE_ASPECT_RATIO_LANDSCAPE";
    if (
      !batchImage.manualAspect &&
      batchImage.imageAspect !== fallbackImageAspect
    ) {
      batchImage.imageAspect = fallbackImageAspect;
    }
    if (!batchImage.imageAspect) {
      batchImage.imageAspect = fallbackImageAspect;
    }
    const aspectValue = batchImage.imageAspect || fallbackImageAspect;
    const aspectSelect = el("batchImageAspect");
    if (aspectSelect && aspectSelect.value !== aspectValue) {
      aspectSelect.value = aspectValue;
    }
    const aspectLabelMap = {
      IMAGE_ASPECT_RATIO_LANDSCAPE: "Landscape",
      IMAGE_ASPECT_RATIO_PORTRAIT: "Portrait",
      IMAGE_ASPECT_RATIO_SQUARE: "Square",
    };
    const aspectLabel = aspectLabelMap[aspectValue] || "yang dipilih";
    const dropzone = el("batchImageDropzone");
    if (dropzone) {
      if (batchImage.imageUrl) {
        dropzone.innerHTML = `<img src="${batchImage.imageUrl}" alt="Gambar referensi batch" />`;
      } else {
        dropzone.innerHTML = `<div style="text-align:center;">
              <div style="font-size:13px;">Klik atau seret gambar ke sini</div>
              <div style="font-size:12px; color:#6b7280;">PNG atau JPG, dicrop otomatis ke rasio ${aspectLabel}.</div>
            </div>`;
      }
    }
    const recropBtn = el("batchImageRecrop");
    if (recropBtn) {
      recropBtn.style.display = batchImage.imageUrl ? "" : "none";
      recropBtn.disabled = !batchImage.imageUrl;
    }
    const removeBtn = el("batchImageRemove");
    if (removeBtn) {
      const disabled = !batchImage.imageUrl && !batchImage.mediaId;
      removeBtn.disabled = disabled;
      removeBtn.classList.toggle("disabled", disabled);
    }
    const mediaInput = el("batchImageMediaId");
    if (mediaInput && mediaInput.value !== (batchImage.mediaId || "")) {
      mediaInput.value = batchImage.mediaId || "";
    }
    const infoEl = el("batchImageUploadInfo");
    if (infoEl) {
      const parts = [`Rasio gambar: ${aspectLabel}`];
      if (batchImage.mediaId) parts.push(`Media ID: ${batchImage.mediaId}`);
      if (batchImage.uploadInfo?.uploadToken)
        parts.push(`Upload Token: ${batchImage.uploadInfo.uploadToken}`);
      if (batchImage.uploadInfo?.mediaGenerationId)
        parts.push(`Media Gen ID: ${batchImage.uploadInfo.mediaGenerationId}`);
      if (
        Number.isFinite(batchImage.uploadInfo?.width) &&
        Number.isFinite(batchImage.uploadInfo?.height)
      ) {
        parts.push(
          `Resolusi upload: ${batchImage.uploadInfo.width}x${batchImage.uploadInfo.height}`
        );
      }
      infoEl.textContent = parts.join(" | ");
    }
  };
  const ensureFrameStartDataUrl = async () => {
    if (frameStartImage.dataUrl) return frameStartImage.dataUrl;
    if (!frameStartImage.imageUrl) return undefined;
    try {
      const resp = await fetch(frameStartImage.imageUrl);
      const blob = await resp.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onerror = reject;
        r.onload = () => resolve(r.result);
        r.readAsDataURL(blob);
      });
      frameStartImage.dataUrl = String(dataUrl);
      return frameStartImage.dataUrl;
    } catch (_) {
      return undefined;
    }
  };
  const ensureFrameEndDataUrl = async () => {
    if (frameEndImage.dataUrl) return frameEndImage.dataUrl;
    if (!frameEndImage.imageUrl) return undefined;
    try {
      const resp = await fetch(frameEndImage.imageUrl);
      const blob = await resp.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onerror = reject;
        r.onload = () => resolve(r.result);
        r.readAsDataURL(blob);
      });
      frameEndImage.dataUrl = String(dataUrl);
      return frameEndImage.dataUrl;
    } catch (_) {
      return undefined;
    }
  };
  const renderFrameStartImage = () => {
    const currentVideoAspect =
      el("settingAspect")?.value ||
      CONFIG.defaultAspectRatio ||
      "VIDEO_ASPECT_RATIO_LANDSCAPE";
    const fallbackImageAspect =
      mapVideoAspectToImageAspect(currentVideoAspect) ||
      "IMAGE_ASPECT_RATIO_LANDSCAPE";
    if (
      !frameStartImage.manualAspect &&
      frameStartImage.imageAspect !== fallbackImageAspect
    ) {
      frameStartImage.imageAspect = fallbackImageAspect;
    }
    if (!frameStartImage.imageAspect) {
      frameStartImage.imageAspect = fallbackImageAspect;
    }
    const aspectValue = frameStartImage.imageAspect || fallbackImageAspect;
    const aspectSelect = el("frameStartAspect");
    if (aspectSelect && aspectSelect.value !== aspectValue) {
      aspectSelect.value = aspectValue;
    }
    const aspectLabelMap = {
      IMAGE_ASPECT_RATIO_LANDSCAPE: "Landscape",
      IMAGE_ASPECT_RATIO_PORTRAIT: "Portrait",
      IMAGE_ASPECT_RATIO_SQUARE: "Square",
    };
    const aspectLabel = aspectLabelMap[aspectValue] || "yang dipilih";
    const dropzone = el("frameStartDropzone");
    if (dropzone) {
      if (frameStartImage.imageUrl) {
        dropzone.innerHTML = `<img src="${frameStartImage.imageUrl}" alt="Frame Pertama" />`;
      } else {
        dropzone.innerHTML = `<div style="text-align:center;"><div style="font-size:13px;">Klik atau seret gambar ke sini</div><div style="font-size:12px; color:#6b7280;">PNG atau JPG, dicrop otomatis ke rasio ${aspectLabel}.</div></div>`;
      }
    }
    const recropBtn = el("frameStartRecrop");
    if (recropBtn) {
      recropBtn.style.display = frameStartImage.imageUrl ? "" : "none";
      recropBtn.disabled = !frameStartImage.imageUrl;
    }
    const removeBtn = el("frameStartRemove");
    if (removeBtn) {
      const disabled = !frameStartImage.imageUrl && !frameStartImage.mediaId;
      removeBtn.disabled = disabled;
      removeBtn.classList.toggle("disabled", disabled);
    }
    const mediaInput = el("frameStartMediaId");
    if (mediaInput && mediaInput.value !== (frameStartImage.mediaId || "")) {
      mediaInput.value = frameStartImage.mediaId || "";
    }
    const infoEl = el("frameStartUploadInfo");
    if (infoEl) {
      // Tampilkan teks singkat saja supaya tidak memenuhi/lebar ke samping
      infoEl.textContent = frameStartImage.mediaId
        ? "Media ID sudah diisi untuk frame ini."
        : "";
      try {
        const destName = (() => {
          try {
            const u = String(frameStartImage.imageUrl || "");
            const idx = u.lastIndexOf("/uploads/");
            if (idx >= 0)
              return u.slice(idx + "/uploads/".length).split(/[?#]/)[0];
            return undefined;
          } catch (_) {
            return undefined;
          }
        })();
        if (
          destName &&
          frameStartImage.mediaId &&
          frameStartImage._persistedMediaId !== frameStartImage.mediaId
        ) {
          fetch(`/api/uploads/${encodeURIComponent(destName)}/media-id`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mediaId: frameStartImage.mediaId,
              aspect: frameStartImage.imageAspect || undefined,
              uploadInfo: frameStartImage.uploadInfo || undefined,
            }),
          })
            .then(() => {
              try {
                frameStartImage._persistedMediaId = frameStartImage.mediaId;
              } catch (_) {}
            })
            .catch(() => {});
        }
      } catch (_) {}
    }
  };
  const renderFrameEndImage = () => {
    const currentVideoAspect =
      el("settingAspect")?.value ||
      CONFIG.defaultAspectRatio ||
      "VIDEO_ASPECT_RATIO_LANDSCAPE";
    const fallbackImageAspect =
      mapVideoAspectToImageAspect(currentVideoAspect) ||
      "IMAGE_ASPECT_RATIO_LANDSCAPE";
    if (
      !frameEndImage.manualAspect &&
      frameEndImage.imageAspect !== fallbackImageAspect
    ) {
      frameEndImage.imageAspect = fallbackImageAspect;
    }
    if (!frameEndImage.imageAspect) {
      frameEndImage.imageAspect = fallbackImageAspect;
    }
    const aspectValue = frameEndImage.imageAspect || fallbackImageAspect;
    const aspectSelect = el("frameEndAspect");
    if (aspectSelect && aspectSelect.value !== aspectValue) {
      aspectSelect.value = aspectValue;
    }
    const aspectLabelMap = {
      IMAGE_ASPECT_RATIO_LANDSCAPE: "Landscape",
      IMAGE_ASPECT_RATIO_PORTRAIT: "Portrait",
      IMAGE_ASPECT_RATIO_SQUARE: "Square",
    };
    const aspectLabel = aspectLabelMap[aspectValue] || "yang dipilih";
    const dropzone = el("frameEndDropzone");
    if (dropzone) {
      if (frameEndImage.imageUrl) {
        dropzone.innerHTML = `<img src="${frameEndImage.imageUrl}" alt="Frame Terakhir" />`;
      } else {
        dropzone.innerHTML = `<div style=\"text-align:center;\"><div style=\"font-size:13px;\">Klik atau seret gambar ke sini</div><div style=\"font-size:12px; color:#6b7280;\">PNG atau JPG, dicrop otomatis ke rasio ${aspectLabel}.</div></div>`;
      }
    }
    const recropBtn = el("frameEndRecrop");
    if (recropBtn) {
      recropBtn.style.display = frameEndImage.imageUrl ? "" : "none";
      recropBtn.disabled = !frameEndImage.imageUrl;
    }
    const removeBtn = el("frameEndRemove");
    if (removeBtn) {
      const disabled = !frameEndImage.imageUrl && !frameEndImage.mediaId;
      removeBtn.disabled = disabled;
      removeBtn.classList.toggle("disabled", disabled);
    }
    const mediaInput = el("frameEndMediaId");
    if (mediaInput && mediaInput.value !== (frameEndImage.mediaId || "")) {
      mediaInput.value = frameEndImage.mediaId || "";
    }
    const infoEl = el("frameEndUploadInfo");
    if (infoEl) {
      // Hanya info singkat agar kotak tidak membesar
      infoEl.textContent = frameEndImage.mediaId
        ? "Media ID sudah diisi untuk frame ini."
        : "";
      try {
        const destName = (() => {
          try {
            const u = String(frameEndImage.imageUrl || "");
            const idx = u.lastIndexOf("/uploads/");
            if (idx >= 0)
              return u.slice(idx + "/uploads/".length).split(/[?#]/)[0];
            return undefined;
          } catch (_) {
            return undefined;
          }
        })();
        if (
          destName &&
          frameEndImage.mediaId &&
          frameEndImage._persistedMediaId !== frameEndImage.mediaId
        ) {
          fetch(`/api/uploads/${encodeURIComponent(destName)}/media-id`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mediaId: frameEndImage.mediaId,
              aspect: frameEndImage.imageAspect || undefined,
              uploadInfo: frameEndImage.uploadInfo || undefined,
            }),
          })
            .then(() => {
              try {
                frameEndImage._persistedMediaId = frameEndImage.mediaId;
              } catch (_) {}
            })
            .catch(() => {});
        }
      } catch (_) {}
    }
  };
  const setupFrameImageEvents = () => {
    if (frameImageEventsReady) return;
    const startDropzone = el("frameStartDropzone");
    const startFile = el("frameStartFile");
    const endDropzone = el("frameEndDropzone");
    const endFile = el("frameEndFile");
    if (!startDropzone || !startFile || !endDropzone || !endFile) return;
    const startPick = el("frameStartPick");
    const startPickGal = el("frameStartPickGallery");
    const startRecrop = el("frameStartRecrop");
    const startRemove = el("frameStartRemove");
    const startUpload = el("frameStartUploadLabs");
    const startMediaInput = el("frameStartMediaId");
    const startAspect = el("frameStartAspect");
    const endPick = el("frameEndPick");
    const endPickGal = el("frameEndPickGallery");
    const endRecrop = el("frameEndRecrop");
    const endRemove = el("frameEndRemove");
    const endUpload = el("frameEndUploadLabs");
    const endMediaInput = el("frameEndMediaId");
    const endAspect = el("frameEndAspect");
    const resetBorder = (dz) => {
      dz.style.borderColor = "#374151";
    };
    const openPicker = (input) => {
      input.value = "";
      input.click();
    };
    const handleFrameFile = async (file, which) => {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onerror = reject;
        reader.onload = async () => {
          try {
            const dataUrl = reader.result;
            const currentVideoAspect =
              el("settingAspect")?.value ||
              CONFIG.defaultAspectRatio ||
              "VIDEO_ASPECT_RATIO_LANDSCAPE";
            const aspectValue =
              (which === "start"
                ? frameStartImage.imageAspect
                : frameEndImage.imageAspect) ||
              mapVideoAspectToImageAspect(currentVideoAspect);
            await openCropperWithDataUrl(
              String(dataUrl),
              {
                type: "frame",
                aspect: aspectValue,
                onSave: async (outUrl, fileName, mime) => {
                  const url = await uploadBase64(
                    outUrl,
                    fileName ||
                      (which === "start" ? "frame-start.png" : "frame-end.png"),
                    mime || "image/png"
                  );
                  if (which === "start") {
                    frameStartImage.imageUrl = url;
                    frameStartImage.fileName = file.name;
                    frameStartImage.dataUrl = outUrl;
                    frameStartImage.mediaId = "";
                    frameStartImage.uploadInfo = undefined;
                    renderFrameStartImage();
                    statusEl.textContent = "Frame pertama siap digunakan.";
                  } else {
                    frameEndImage.imageUrl = url;
                    frameEndImage.fileName = file.name;
                    frameEndImage.dataUrl = outUrl;
                    frameEndImage.mediaId = "";
                    frameEndImage.uploadInfo = undefined;
                    renderFrameEndImage();
                    statusEl.textContent = "Frame terakhir siap digunakan.";
                  }
                },
              },
              file.name,
              file.type
            );
            resolve(true);
          } catch (e) {
            statusEl.textContent = `Gagal membuka cropper: ${String(e)}`;
            reject(e);
          }
        };
        reader.readAsDataURL(file);
      });
    };
    startDropzone.addEventListener("click", () => openPicker(startFile));
    startDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      startDropzone.style.borderColor = "#84cc16";
    });
    startDropzone.addEventListener("dragleave", () =>
      resetBorder(startDropzone)
    );
    startDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      resetBorder(startDropzone);
      const f = e.dataTransfer?.files?.[0];
      if (f) handleFrameFile(f, "start");
    });
    startFile.addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      if (f) handleFrameFile(f, "start");
    });
    startPick?.addEventListener("click", (e) => {
      e.preventDefault();
      openPicker(startFile);
    });
    const openGalleryPickerFrame = async (which) => {
      try {
        const modal = el("galleryPickerModal");
        const listEl = el("galleryPickerList");
        const stEl = el("galleryPickerStatus");
        if (!modal || !listEl || !stEl) return;
        stEl.textContent = "Memuat daftar galeri...";
        listEl.innerHTML = "";
        modal.classList.add("show");
        const resp = await fetch("/api/uploads");
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || "Gagal memuat galeri");
        const items = Array.isArray(data.items) ? data.items : [];
        if (items.length === 0) {
          stEl.textContent = "Belum ada foto di galeri.";
        } else {
          stEl.textContent = "Klik ‘Pilih’ untuk menggunakan gambar.";
        }
        listEl.innerHTML = items
          .map((it) => {
            const safeName = String(it.name || "");
            const mediaId = it.mediaId
              ? `<div class=\"settings-help\">Media ID: ${it.mediaId}</div>`
              : "";
            return `<div class=\"photo-card\"><img class=\"photo-thumb\" src=\"${
              it.url
            }\" alt=\"${safeName}\" /><div class=\"photo-meta\"><div class=\"photo-name\" title=\"${safeName}\">${safeName}</div><div style=\"display:flex; gap:8px; align-items:center;\"><button class=\"btn\" data-pick-name=\"${safeName}\" data-pick-url=\"${
              it.url
            }\" data-pick-mediaid=\"${
              it.mediaId || ""
            }\" data-pick-which=\"${which}\">Pilih</button></div></div>${mediaId}</div>`;
          })
          .join("");
        listEl.querySelectorAll("[data-pick-name]").forEach((btn) => {
          btn.addEventListener("click", (ev) => {
            ev.preventDefault();
            const name = btn.getAttribute("data-pick-name") || "";
            const url = btn.getAttribute("data-pick-url") || "";
            const mediaId = btn.getAttribute("data-pick-mediaid") || "";
            const target = btn.getAttribute("data-pick-which") || which;
            if (url) {
              if (target === "start") {
                frameStartImage.imageUrl = url;
                frameStartImage.fileName = name;
                frameStartImage.mediaId = mediaId || "";
                frameStartImage.uploadInfo = undefined;
                renderFrameStartImage();
                statusEl.textContent = mediaId
                  ? "Frame pertama dipilih dari galeri dan Media ID terisi."
                  : "Frame pertama dipilih dari galeri.";
              } else {
                frameEndImage.imageUrl = url;
                frameEndImage.fileName = name;
                frameEndImage.mediaId = mediaId || "";
                frameEndImage.uploadInfo = undefined;
                renderFrameEndImage();
                statusEl.textContent = mediaId
                  ? "Frame terakhir dipilih dari galeri dan Media ID terisi."
                  : "Frame terakhir dipilih dari galeri.";
              }
            }
            modal.classList.remove("show");
          });
        });
      } catch (e) {
        const stEl = el("galleryPickerStatus");
        if (stEl)
          stEl.textContent = `Gagal memuat galeri: ${String(e.message || e)}`;
      }
    };
    startPickGal?.addEventListener("click", (e) => {
      e.preventDefault();
      openGalleryPickerFrame("start");
    });
    startRecrop?.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!frameStartImage.imageUrl) return;
      try {
        const resp = await fetch(frameStartImage.imageUrl);
        const blob = await resp.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onerror = reject;
          r.onload = () => resolve(r.result);
          r.readAsDataURL(blob);
        });
        const currentVideoAspect =
          el("settingAspect")?.value ||
          CONFIG.defaultAspectRatio ||
          "VIDEO_ASPECT_RATIO_LANDSCAPE";
        const aspectValue =
          frameStartImage.imageAspect ||
          mapVideoAspectToImageAspect(currentVideoAspect);
        await openCropperWithDataUrl(
          String(dataUrl),
          {
            type: "frame",
            aspect: aspectValue,
            onSave: async (outUrl, fileName, mime) => {
              const url = await uploadBase64(
                outUrl,
                frameStartImage.fileName || "frame-start.png",
                mime || "image/png"
              );
              frameStartImage.imageUrl = url;
              frameStartImage.dataUrl = outUrl;
              renderFrameStartImage();
            },
          },
          frameStartImage.fileName || "frame-start.png",
          blob.type || "image/png"
        );
      } catch (_) {}
    });
    startRemove?.addEventListener("click", (e) => {
      e.preventDefault();
      frameStartImage.imageUrl = "";
      frameStartImage.dataUrl = "";
      frameStartImage.mediaId = "";
      frameStartImage.uploadInfo = undefined;
      frameStartImage.fileName = "";
      renderFrameStartImage();
      statusEl.textContent = "Frame pertama dihapus.";
    });
    startAspect?.addEventListener("change", (e) => {
      const val = e.target.value || "IMAGE_ASPECT_RATIO_LANDSCAPE";
      frameStartImage.imageAspect = val;
      frameStartImage.manualAspect = true;
      renderFrameStartImage();
      if (frameStartImage.imageUrl)
        statusEl.textContent = "Rasio gambar diubah. Gunakan Crop ulang.";
    });
    startUpload?.addEventListener("click", async (e) => {
      e.preventDefault();
      const dataUrl = await ensureFrameStartDataUrl();
      if (!dataUrl) {
        statusEl.textContent = "Pilih/unggah gambar dulu.";
        return;
      }
      const mimeMatch = String(dataUrl).match(/^data:(.*?);base64,/);
      const mime = mimeMatch ? mimeMatch[1] : "image/png";
      statusEl.textContent = "Mengunggah frame pertama ke Labs.";
      try {
        const imageAspectValue =
          frameStartImage.imageAspect ||
          mapVideoAspectToImageAspect(
            el("settingAspect")?.value ||
              CONFIG.defaultAspectRatio ||
              "VIDEO_ASPECT_RATIO_LANDSCAPE"
          );
        const resp = await fetch("/api/labs/upload_image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: frameStartImage.fileName || "frame-start.png",
            mime,
            dataUrl,
            imageAspectRatio: imageAspectValue,
          }),
        });
        const ct = resp.headers.get("content-type") || "";
        let data;
        if (ct.includes("application/json")) {
          data = await resp.json();
        } else {
          const text = await resp.text();
          try {
            data = JSON.parse(text);
          } catch {
            data = { raw: text };
          }
        }
        if (!resp.ok) {
          const detail =
            (data && data.error) || data?.raw || `HTTP ${resp.status}`;
          statusEl.textContent = `Upload Labs gagal: ${String(detail)}`;
          outputEl.textContent =
            typeof data === "string" ? data : JSON.stringify(data, null, 2);
          return;
        }
        if (data?.mediaId) {
          frameStartImage.mediaId = data.mediaId;
          statusEl.textContent = "Media ID frame pertama diisi otomatis.";
        } else {
          statusEl.textContent =
            "Upload berhasil, namun Media ID belum ditemukan.";
        }
        try {
          const mediaGenerationId =
            typeof data?.upload?.mediaGenerationId === "string"
              ? data.upload.mediaGenerationId
              : data?.upload?.mediaGenerationId?.mediaGenerationId || undefined;
          frameStartImage.uploadInfo = {
            uploadToken: data?.upload?.uploadToken || data?.uploadToken,
            mediaGenerationId,
            width: data?.upload?.width,
            height: data?.upload?.height,
          };
        } catch (_) {}
        renderFrameStartImage();
        outputEl.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        statusEl.textContent = `Upload Labs gagal: ${String(err)}`;
      }
    });
    startMediaInput?.addEventListener("input", (e) => {
      frameStartImage.mediaId = (e.target.value || "").trim();
      frameStartImage.uploadInfo = undefined;
      renderFrameStartImage();
    });

    endDropzone.addEventListener("click", () => openPicker(endFile));
    endDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      endDropzone.style.borderColor = "#84cc16";
    });
    endDropzone.addEventListener("dragleave", () => resetBorder(endDropzone));
    endDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      resetBorder(endDropzone);
      const f = e.dataTransfer?.files?.[0];
      if (f) handleFrameFile(f, "end");
    });
    endFile.addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      if (f) handleFrameFile(f, "end");
    });
    endPick?.addEventListener("click", (e) => {
      e.preventDefault();
      openPicker(endFile);
    });
    endPickGal?.addEventListener("click", (e) => {
      e.preventDefault();
      openGalleryPickerFrame("end");
    });
    endRecrop?.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!frameEndImage.imageUrl) return;
      try {
        const resp = await fetch(frameEndImage.imageUrl);
        const blob = await resp.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onerror = reject;
          r.onload = () => resolve(r.result);
          r.readAsDataURL(blob);
        });
        const currentVideoAspect =
          el("settingAspect")?.value ||
          CONFIG.defaultAspectRatio ||
          "VIDEO_ASPECT_RATIO_LANDSCAPE";
        const aspectValue =
          frameEndImage.imageAspect ||
          mapVideoAspectToImageAspect(currentVideoAspect);
        await openCropperWithDataUrl(
          String(dataUrl),
          {
            type: "frame",
            aspect: aspectValue,
            onSave: async (outUrl, fileName, mime) => {
              const url = await uploadBase64(
                outUrl,
                frameEndImage.fileName || "frame-end.png",
                mime || "image/png"
              );
              frameEndImage.imageUrl = url;
              frameEndImage.dataUrl = outUrl;
              renderFrameEndImage();
            },
          },
          frameEndImage.fileName || "frame-end.png",
          blob.type || "image/png"
        );
      } catch (_) {}
    });
    endRemove?.addEventListener("click", (e) => {
      e.preventDefault();
      frameEndImage.imageUrl = "";
      frameEndImage.dataUrl = "";
      frameEndImage.mediaId = "";
      frameEndImage.uploadInfo = undefined;
      frameEndImage.fileName = "";
      renderFrameEndImage();
      statusEl.textContent = "Frame terakhir dihapus.";
    });
    endAspect?.addEventListener("change", (e) => {
      const val = e.target.value || "IMAGE_ASPECT_RATIO_LANDSCAPE";
      frameEndImage.imageAspect = val;
      frameEndImage.manualAspect = true;
      renderFrameEndImage();
      if (frameEndImage.imageUrl)
        statusEl.textContent = "Rasio gambar diubah. Gunakan Crop ulang.";
    });
    endUpload?.addEventListener("click", async (e) => {
      e.preventDefault();
      const dataUrl = await ensureFrameEndDataUrl();
      if (!dataUrl) {
        statusEl.textContent = "Pilih/unggah gambar dulu.";
        return;
      }
      const mimeMatch = String(dataUrl).match(/^data:(.*?);base64,/);
      const mime = mimeMatch ? mimeMatch[1] : "image/png";
      statusEl.textContent = "Mengunggah frame terakhir ke Labs.";
      try {
        const imageAspectValue =
          frameEndImage.imageAspect ||
          mapVideoAspectToImageAspect(
            el("settingAspect")?.value ||
              CONFIG.defaultAspectRatio ||
              "VIDEO_ASPECT_RATIO_LANDSCAPE"
          );
        const resp = await fetch("/api/labs/upload_image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: frameEndImage.fileName || "frame-end.png",
            mime,
            dataUrl,
            imageAspectRatio: imageAspectValue,
          }),
        });
        const ct = resp.headers.get("content-type") || "";
        let data;
        if (ct.includes("application/json")) {
          data = await resp.json();
        } else {
          const text = await resp.text();
          try {
            data = JSON.parse(text);
          } catch {
            data = { raw: text };
          }
        }
        if (!resp.ok) {
          const detail =
            (data && data.error) || data?.raw || `HTTP ${resp.status}`;
          statusEl.textContent = `Upload Labs gagal: ${String(detail)}`;
          outputEl.textContent =
            typeof data === "string" ? data : JSON.stringify(data, null, 2);
          return;
        }
        if (data?.mediaId) {
          frameEndImage.mediaId = data.mediaId;
          statusEl.textContent = "Media ID frame terakhir diisi otomatis.";
        } else {
          statusEl.textContent =
            "Upload berhasil, namun Media ID belum ditemukan.";
        }
        try {
          const mediaGenerationId =
            typeof data?.upload?.mediaGenerationId === "string"
              ? data.upload.mediaGenerationId
              : data?.upload?.mediaGenerationId?.mediaGenerationId || undefined;
          frameEndImage.uploadInfo = {
            uploadToken: data?.upload?.uploadToken || data?.uploadToken,
            mediaGenerationId,
            width: data?.upload?.width,
            height: data?.upload?.height,
          };
        } catch (_) {}
        renderFrameEndImage();
        outputEl.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        statusEl.textContent = `Upload Labs gagal: ${String(err)}`;
      }
    });
    endMediaInput?.addEventListener("input", (e) => {
      frameEndImage.mediaId = (e.target.value || "").trim();
      frameEndImage.uploadInfo = undefined;
      renderFrameEndImage();
    });
    resetBorder(startDropzone);
    resetBorder(endDropzone);
    frameImageEventsReady = true;
  };
  const setupBatchImageEvents = () => {
    const dropzone = el("batchImageDropzone");
    const fileInput = el("batchImageFile");
    if (!dropzone || !fileInput) return;
    const pickBtn = el("batchImagePick");
    const pickGalBtn = el("batchImagePickGallery");
    const recropBtn = el("batchImageRecrop");
    const removeBtn = el("batchImageRemove");
    const uploadLabsBtn = el("batchImageUploadLabs");
    const mediaInput = el("batchImageMediaId");
    const aspectSelect = el("batchImageAspect");
    const resetBorder = () => {
      dropzone.style.borderColor = "#374151";
    };
    const openPicker = (ev) => {
      if (ev) ev.preventDefault();
      fileInput.value = "";
      fileInput.click();
    };
    dropzone.addEventListener("click", openPicker);
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "#84cc16";
    });
    dropzone.addEventListener("dragleave", resetBorder);
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      resetBorder();
      const f = e.dataTransfer?.files?.[0];
      if (f) handleBatchFile(f);
    });
    fileInput.addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      if (f) handleBatchFile(f);
    });
    pickBtn?.addEventListener("click", openPicker);
    recropBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!batchImage.imageUrl) return;
      try {
        const resp = await fetch(batchImage.imageUrl);
        const blob = await resp.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onerror = reject;
          r.onload = () => resolve(r.result);
          r.readAsDataURL(blob);
        });
        const currentVideoAspect =
          el("settingAspect")?.value ||
          CONFIG.defaultAspectRatio ||
          "VIDEO_ASPECT_RATIO_LANDSCAPE";
        const aspectValue =
          batchImage.imageAspect ||
          mapVideoAspectToImageAspect(currentVideoAspect);
        await openCropperWithDataUrl(
          String(dataUrl),
          { type: "batch", aspect: aspectValue },
          batchImage.fileName || "batch-image.png",
          blob.type || "image/png"
        );
      } catch (_) {}
    });
    removeBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      batchImage.imageUrl = "";
      batchImage.dataUrl = "";
      batchImage.mediaId = "";
      batchImage.uploadInfo = undefined;
      batchImage.fileName = "";
      renderBatchImage();
    });
    aspectSelect?.addEventListener("change", (e) => {
      const val = e.target.value || "IMAGE_ASPECT_RATIO_LANDSCAPE";
      batchImage.imageAspect = val;
      batchImage.manualAspect = true;
      renderBatchImage();
    });
    pickGalBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const modal = el("galleryPickerModal");
        const listEl = el("galleryPickerList");
        const stEl = el("galleryPickerStatus");
        if (!modal || !listEl || !stEl) return;
        stEl.textContent = "Memuat daftar galeri...";
        listEl.innerHTML = "";
        modal.classList.add("show");
        const resp = await fetch("/api/uploads");
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || "Gagal memuat galeri");
        const items = Array.isArray(data.items) ? data.items : [];
        stEl.textContent = items.length
          ? "Klik ‘Pilih’ untuk menggunakan gambar."
          : "Belum ada foto di galeri.";
        listEl.innerHTML = items
          .map((it) => {
            const safeName = String(it.name || "");
            const mediaId = it.mediaId
              ? `<div class=\"settings-help\">Media ID: ${it.mediaId}</div>`
              : "";
            return `<div class=\"photo-card\"><img class=\"photo-thumb\" src=\"${
              it.url
            }\" alt=\"${safeName}\" /><div class=\"photo-meta\"><div class=\"photo-name\" title=\"${safeName}\">${safeName}</div><div style=\"display:flex; gap:8px; align-items:center;\"><button class=\"btn\" data-pick-name=\"${safeName}\" data-pick-url=\"${
              it.url
            }\" data-pick-mediaid=\"${
              it.mediaId || ""
            }\">Pilih</button></div></div>${mediaId}</div>`;
          })
          .join("");
        listEl.querySelectorAll("[data-pick-name]").forEach((btn) => {
          btn.addEventListener("click", (ev) => {
            ev.preventDefault();
            const name = btn.getAttribute("data-pick-name") || "";
            const url = btn.getAttribute("data-pick-url") || "";
            const mediaId = btn.getAttribute("data-pick-mediaid") || "";
            if (url) {
              batchImage.imageUrl = url;
              batchImage.fileName = name;
              batchImage.mediaId = mediaId || "";
              batchImage.uploadInfo = undefined;
              renderBatchImage();
              statusEl.textContent = mediaId
                ? "Gambar galeri dipilih dan Media ID terisi."
                : "Gambar galeri dipilih. Jika perlu, Upload ke Labs dulu.";
            }
            modal.classList.remove("show");
          });
        });
      } catch (_) {}
    });
    uploadLabsBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      const dataUrl = await ensureBatchImageDataUrl();
      if (!dataUrl) {
        statusEl.textContent = "Pilih/unggah gambar dulu.";
        return;
      }
      const mimeMatch = String(dataUrl).match(/^data:(.*?);base64,/);
      const mime = mimeMatch ? mimeMatch[1] : "image/png";
      statusEl.textContent = "Mengunggah gambar batch ke Labs.";
      try {
        const imageAspectValue =
          batchImage.imageAspect ||
          mapVideoAspectToImageAspect(
            el("settingAspect")?.value ||
              CONFIG.defaultAspectRatio ||
              "VIDEO_ASPECT_RATIO_LANDSCAPE"
          );
        const resp = await fetch("/api/labs/upload_image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: batchImage.fileName || "batch-image.png",
            mime,
            dataUrl,
            imageAspectRatio: imageAspectValue,
          }),
        });
        const ct = resp.headers.get("content-type") || "";
        const data = ct.includes("application/json")
          ? await resp.json()
          : { raw: await resp.text() };
        if (!resp.ok) {
          statusEl.textContent = "Upload Labs gagal";
          outputEl.textContent =
            typeof data === "string" ? data : JSON.stringify(data, null, 2);
          return;
        }
        if (data?.mediaId) {
          batchImage.mediaId = data.mediaId;
          statusEl.textContent = "Media ID batch diisi otomatis.";
        } else {
          statusEl.textContent =
            "Upload berhasil, namun Media ID belum ditemukan.";
        }
        try {
          const mediaGenerationId =
            typeof data?.upload?.mediaGenerationId === "string"
              ? data.upload.mediaGenerationId
              : data?.upload?.mediaGenerationId?.mediaGenerationId || undefined;
          batchImage.uploadInfo = {
            uploadToken: data?.upload?.uploadToken || data?.uploadToken,
            mediaGenerationId,
            width: data?.upload?.width,
            height: data?.upload?.height,
          };
        } catch (_) {}
        try {
          const destName = (() => {
            try {
              const u = String(batchImage.imageUrl || "");
              const idx = u.lastIndexOf("/uploads/");
              if (idx >= 0)
                return u.slice(idx + "/uploads/".length).split(/[?#]/)[0];
              return undefined;
            } catch (_) {
              return undefined;
            }
          })();
          if (destName && batchImage.mediaId) {
            await fetch(
              `/api/uploads/${encodeURIComponent(destName)}/media-id`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  mediaId: batchImage.mediaId,
                  aspect: batchImage.imageAspect || undefined,
                  uploadInfo: batchImage.uploadInfo || undefined,
                }),
              }
            );
          }
        } catch (_) {}
        renderBatchImage();
        outputEl.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        statusEl.textContent = `Upload Labs gagal: ${String(err)}`;
      }
    });
    mediaInput?.addEventListener("input", (e) => {
      batchImage.mediaId = (e.target.value || "").trim();
      batchImage.uploadInfo = undefined;
      renderBatchImage();
    });
    resetBorder();
  };
  const handleBatchFile = async (file) => {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onerror = reject;
      reader.onload = async () => {
        try {
          const dataUrl = reader.result;
          const currentVideoAspect =
            el("settingAspect")?.value ||
            CONFIG.defaultAspectRatio ||
            "VIDEO_ASPECT_RATIO_LANDSCAPE";
          const aspectValue =
            batchImage.imageAspect ||
            mapVideoAspectToImageAspect(currentVideoAspect);
          await openCropperWithDataUrl(
            String(dataUrl),
            { type: "batch", aspect: aspectValue },
            file.name,
            file.type
          );
          resolve(true);
        } catch (e) {
          statusEl.textContent = `Gagal membuka cropper: ${String(e)}`;
          reject(e);
        }
      };
      reader.readAsDataURL(file);
    });
  };
  const handleSingleFile = async (file) => {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onerror = reject;
      reader.onload = async () => {
        try {
          const dataUrl = reader.result;
          const currentVideoAspect =
            el("settingAspect")?.value ||
            CONFIG.defaultAspectRatio ||
            "VIDEO_ASPECT_RATIO_LANDSCAPE";
          const aspectValue =
            singleImage.imageAspect ||
            mapVideoAspectToImageAspect(currentVideoAspect);
          await openCropperWithDataUrl(
            String(dataUrl),
            { type: "single", aspect: aspectValue },
            file.name,
            file.type
          );
          resolve(true);
        } catch (e) {
          statusEl.textContent = `Gagal membuka cropper: ${String(e)}`;
          reject(e);
        }
      };
      reader.readAsDataURL(file);
    });
  };
  const setupSingleImageEvents = () => {
    if (singleImageEventsReady) return;
    const dropzone = el("singleImageDropzone");
    const fileInput = el("singleImageFile");
    if (!dropzone || !fileInput) return;
    const pickBtn = el("singleImagePick");
    const pickGalBtn = el("singleImagePickGallery");
    const recropBtn = el("singleImageRecrop");
    const removeBtn = el("singleImageRemove");
    const uploadLabsBtn = el("singleImageUploadLabs");
    const mediaInput = el("singleImageMediaId");
    const aspectSelect = el("singleImageAspect");

    const resetBorder = () => {
      dropzone.style.borderColor = "#374151";
    };
    const openPicker = (ev) => {
      if (ev) ev.preventDefault();
      fileInput.value = "";
      fileInput.click();
    };

    dropzone.addEventListener("click", openPicker);
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "#84cc16";
    });
    dropzone.addEventListener("dragleave", resetBorder);
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      resetBorder();
      const f = e.dataTransfer?.files?.[0];
      if (f) handleSingleFile(f);
    });
    fileInput.addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      if (f) handleSingleFile(f);
    });
    pickBtn?.addEventListener("click", openPicker);
    recropBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!singleImage.imageUrl) return;
      try {
        const resp = await fetch(singleImage.imageUrl);
        const blob = await resp.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onerror = reject;
          r.onload = () => resolve(r.result);
          r.readAsDataURL(blob);
        });
        const currentVideoAspect =
          el("settingAspect")?.value ||
          CONFIG.defaultAspectRatio ||
          "VIDEO_ASPECT_RATIO_LANDSCAPE";
        const aspectValue =
          singleImage.imageAspect ||
          mapVideoAspectToImageAspect(currentVideoAspect);
        await openCropperWithDataUrl(
          String(dataUrl),
          { type: "single", aspect: aspectValue },
          singleImage.fileName || "single-image.png",
          blob.type || "image/png"
        );
      } catch (err) {
        statusEl.textContent = `Gagal membuka cropper: ${String(err)}`;
      }
    });
    removeBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      singleImage.imageUrl = "";
      singleImage.dataUrl = "";
      singleImage.mediaId = "";
      singleImage.uploadInfo = undefined;
      singleImage.fileName = "";
      renderSingleImage();
      statusEl.textContent = "Gambar prompt tunggal dihapus.";
    });
    aspectSelect?.addEventListener("change", (e) => {
      const val = e.target.value || "IMAGE_ASPECT_RATIO_LANDSCAPE";
      singleImage.imageAspect = val;
      singleImage.manualAspect = true;
      renderSingleImage();
      if (singleImage.imageUrl) {
        statusEl.textContent =
          "Rasio gambar diubah. Gunakan Crop ulang agar menyesuaikan rasio baru.";
      }
    });
    // --- Gallery Picker ---
    const openGalleryPicker = async () => {
      try {
        const modal = el("galleryPickerModal");
        const listEl = el("galleryPickerList");
        const stEl = el("galleryPickerStatus");
        if (!modal || !listEl || !stEl) return;
        stEl.textContent = "Memuat daftar galeri...";
        listEl.innerHTML = "";
        modal.classList.add("show");
        const resp = await fetch("/api/uploads");
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || "Gagal memuat galeri");
        const items = Array.isArray(data.items) ? data.items : [];
        if (items.length === 0) {
          stEl.textContent = "Belum ada foto di galeri.";
        } else {
          stEl.textContent = "Klik ‘Pilih’ untuk menggunakan gambar.";
        }
        listEl.innerHTML = items
          .map((it) => {
            const safeName = String(it.name || "");
            const mediaId = it.mediaId
              ? `<div class=\"settings-help\">Media ID: ${it.mediaId}</div>`
              : "";
            return `
              <div class="photo-card">
                <img class="photo-thumb" src="${it.url}" alt="${safeName}" />
                <div class="photo-meta">
                  <div class="photo-name" title="${safeName}">${safeName}</div>
                  <div style="display:flex; gap:8px; align-items:center;">
                    <button class="btn" data-pick-name="${safeName}" data-pick-url="${
              it.url
            }" data-pick-mediaid="${it.mediaId || ""}">Pilih</button>
                  </div>
                </div>
                ${mediaId}
              </div>`;
          })
          .join("");
        // Wire pick buttons
        listEl.querySelectorAll("[data-pick-name]").forEach((btn) => {
          btn.addEventListener("click", (ev) => {
            ev.preventDefault();
            const name = btn.getAttribute("data-pick-name") || "";
            const url = btn.getAttribute("data-pick-url") || "";
            const mediaId = btn.getAttribute("data-pick-mediaid") || "";
            if (url) {
              singleImage.imageUrl = url;
              singleImage.fileName = name;
              singleImage.mediaId = mediaId || "";
              singleImage.uploadInfo = undefined;
              renderSingleImage();
              statusEl.textContent = mediaId
                ? "Gambar dari galeri dipilih dan Media ID terisi."
                : "Gambar dari galeri dipilih. Jika perlu, Upload ke Labs dulu.";
            }
            modal.classList.remove("show");
          });
        });
      } catch (e) {
        const stEl = el("galleryPickerStatus");
        if (stEl)
          stEl.textContent = `Gagal memuat galeri: ${String(e.message || e)}`;
      }
    };
    pickGalBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      openGalleryPicker();
    });
    const closeGalleryPicker = () => {
      try {
        el("galleryPickerModal").classList.remove("show");
      } catch (_) {}
    };
    el("galleryPickerClose")?.addEventListener("click", (e) => {
      e.preventDefault();
      closeGalleryPicker();
    });
    el("galleryPickerCloseFooter")?.addEventListener("click", (e) => {
      e.preventDefault();
      closeGalleryPicker();
    });
    register(window, "keydown", (ev) => {
      const modalShown = el("galleryPickerModal")?.classList.contains("show");
      if (modalShown && ev.key === "Escape") closeGalleryPicker();
    });
    uploadLabsBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      const dataUrl = await ensureSingleImageDataUrl();
      if (!dataUrl) {
        statusEl.textContent = "Pilih/unggah gambar dulu.";
        return;
      }
      const mimeMatch = String(dataUrl).match(/^data:(.*?);base64,/);
      const mime = mimeMatch ? mimeMatch[1] : "image/png";
      statusEl.textContent = "Mengunggah gambar prompt ke Labs.";
      try {
        const imageAspectValue =
          singleImage.imageAspect ||
          mapVideoAspectToImageAspect(
            el("settingAspect")?.value ||
              CONFIG.defaultAspectRatio ||
              "VIDEO_ASPECT_RATIO_LANDSCAPE"
          );
        const resp = await fetch("/api/labs/upload_image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: singleImage.fileName || "single-image.png",
            mime,
            dataUrl,
            imageAspectRatio: imageAspectValue,
          }),
        });
        const ct = resp.headers.get("content-type") || "";
        let data;
        if (ct.includes("application/json")) {
          data = await resp.json();
        } else {
          const text = await resp.text();
          try {
            data = JSON.parse(text);
          } catch {
            data = { raw: text };
          }
        }
        if (!resp.ok) {
          const detail =
            (data && data.error) || data?.raw || `HTTP ${resp.status}`;
          if (resp.status === 401) {
            statusEl.textContent =
              "Bearer kadaluarsa, Minta bearer baru ke admin";
          } else {
            const printable =
              typeof detail === "string"
                ? detail
                : detail?.message ||
                  detail?.error ||
                  detail?.detail ||
                  (() => {
                    try {
                      return JSON.stringify(detail);
                    } catch {
                      return String(detail);
                    }
                  })();
            statusEl.textContent = `Upload Labs gagal: ${printable}`;
          }
          outputEl.textContent =
            typeof data === "string" ? data : JSON.stringify(data, null, 2);
          return;
        }
        if (data?.mediaId) {
          singleImage.mediaId = data.mediaId;
          statusEl.textContent =
            "Media ID prompt tunggal berhasil diisi otomatis.";
        } else {
          statusEl.textContent =
            "Upload berhasil, namun Media ID belum ditemukan.";
        }
        try {
          const mediaGenerationId =
            typeof data?.upload?.mediaGenerationId === "string"
              ? data.upload.mediaGenerationId
              : data?.upload?.mediaGenerationId?.mediaGenerationId || undefined;
          singleImage.uploadInfo = {
            uploadToken: data?.upload?.uploadToken || data?.uploadToken,
            mediaGenerationId,
            width: data?.upload?.width,
            height: data?.upload?.height,
          };
        } catch (_) {}
        // Persist mapping: current uploaded file (in /uploads) -> mediaId
        try {
          const destName = (() => {
            try {
              const u = String(singleImage.imageUrl || "");
              const idx = u.lastIndexOf("/uploads/");
              if (idx >= 0)
                return u.slice(idx + "/uploads/".length).split(/[?#]/)[0];
              return undefined;
            } catch (_) {
              return undefined;
            }
          })();
          if (destName && singleImage.mediaId) {
            await fetch(
              `/api/uploads/${encodeURIComponent(destName)}/media-id`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  mediaId: singleImage.mediaId,
                  aspect: singleImage.imageAspect || undefined,
                  uploadInfo: singleImage.uploadInfo || undefined,
                }),
              }
            );
          }
        } catch (_) {}
        renderSingleImage();
        outputEl.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        statusEl.textContent = `Upload Labs gagal: ${String(err)}`;
      }
    });
    mediaInput?.addEventListener("input", (e) => {
      singleImage.mediaId = (e.target.value || "").trim();
      singleImage.uploadInfo = undefined;
      renderSingleImage();
    });
    resetBorder();
    singleImageEventsReady = true;
  };
  const renderCharacters = () => {
    const html = characters
      .map((c, i) => {
        const preview = c.imageUrl
          ? `<img src="${c.imageUrl}" alt="Foto Karakter" />`
          : `<div style="text-align:center;">
                <div style="font-size:13px;">Klik atau seret file untuk mengunggah</div>
                <div style="font-size:12px; color:#6b7280;">PNG, JPG</div>
              </div>`;
        return `<div class="character-card">
              <div class="char-header">
                <input type="text" data-char-name="${i}" placeholder="Nama Karakter" value="${
          c.name || ""
        }" />
                <button class="char-delete" title="Hapus" data-char-del="${i}">🗑</button>
              </div>
              <div class="dropzone" data-drop="${i}">${preview}</div>
              <input type="file" accept="image/png,image/jpeg" data-file="${i}" style="display:none;" />
              <div style="margin-top:8px;">
                <label style="display:block; font-size:12px; color:#9ca3af; margin-bottom:4px;">Media ID (untuk Image→Video)</label>
                <input type="text" data-char-mediaid="${i}" placeholder="Tempel Media ID dari Labs" value="${
          c.mediaId || ""
        }" />
                <div class="settings-help">Isi jika ingin generate via StartImage. Jika kosong, akan pakai Text-to-Video.</div>
                <div style="margin-top:6px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                  <label style="font-size:12px; color:#9ca3af;">Image Aspect Ratio</label>
                  <select data-char-imgaspect="${i}" style="background:#111827; color:#e5e7eb; border:1px solid #1f2937; padding:4px 8px; border-radius:6px;">
                    <option value="IMAGE_ASPECT_RATIO_LANDSCAPE">Landscape</option>
                    <option value="IMAGE_ASPECT_RATIO_PORTRAIT">Portrait</option>
                    <option value="IMAGE_ASPECT_RATIO_SQUARE">Square</option>
                  </select>
                </div>
                <div style="margin-top:6px;">
                  <label style="display:block; font-size:12px; color:#9ca3af; margin-bottom:4px;">Deskripsi Identitas Karakter</label>
                  <textarea class="scene-textarea" rows="3" data-char-identity="${i}" placeholder="Contoh: rambut sebahu bergelombang, kacamata bulat, jaket denim biru, kaos putih, celana hitam, sepatu putih.">${
          c.identity || ""
        }</textarea>
                  <div class="settings-help">Deskripsi ini akan disuntikkan ke prompt di mode Sutradara untuk menjaga konsistensi karakter.</div>
                </div>
                <div class="settings-row" style="flex-direction:column; margin-top:6px;">
                  <div class="settings-toggle">
                    <span class="label-text">Kunci identitas kuat (hindari drift)</span>
                    <label class="toggle"><input type="checkbox" data-char-identitylock="${i}" ${
          c.identityLock !== false ? "checked" : ""
        } /><span class="slider"></span></label>
                  </div>
                  <div class="settings-help">Instruksi negatif agar wajah, rambut, pakaian, warna, proporsi karakter ini tidak berubah lintas adegan.</div>
                </div>
                <div style="margin-top:6px; display:flex; gap:8px; align-items:center;">
                  <button data-char-uploadlabs="${i}" title="Upload ke Labs dan isi Media ID" style="background:#111827; color:#e5e7eb; border:1px solid #1f2937; padding:4px 8px; border-radius:6px;">Upload ke Labs (Auto Media ID)</button>
                  <button class="btn" data-char-pickgal="${i}" title="Pilih gambar dari Galeri">Pilih dari Galeri</button>
                  <span style="font-size:12px; color:#6b7280;">Gunakan gambar yang diunggah di atas.</span>
                </div>
                <div style="margin-top:8px;">
                  <div style="font-size:12px; color:#9ca3af; margin-bottom:4px;">Hasil Upload</div>
                  <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <span style="font-size:12px;">Media ID: <code>${
                      c.mediaId || "-"
                    }</code></span>
                    <button data-copy-media="${i}" style="background:#111827; color:#e5e7eb; border:1px solid #1f2937; padding:2px 6px; border-radius:6px;">Copy Media ID</button>
                    ${
                      c.uploadInfo?.uploadToken
                        ? `<span style="font-size:12px;">Upload Token: <code>${c.uploadInfo.uploadToken}</code></span><button data-copy-upload="${i}" style="background:#111827; color:#e5e7eb; border:1px solid #1f2937; padding:2px 6px; border-radius:6px;">Copy Upload Token</button>`
                        : ""
                    }
                    ${
                      c.uploadInfo?.mediaGenerationId
                        ? `<span style="font-size:12px;">MediaGen ID: <code>${c.uploadInfo.mediaGenerationId}</code></span><button data-copy-mediagen="${i}" style="background:#111827; color:#e5e7eb; border:1px solid #1f2937; padding:2px 6px; border-radius:6px;">Copy MediaGen</button>`
                        : ""
                    }
                  </div>
                </div>
              </div>
            </div>`;
      })
      .join("");
    el("charactersContainer").innerHTML =
      html || "<em>Belum ada karakter. Tambahkan setidaknya satu.</em>";
    // Wire events
    el("charactersContainer")
      .querySelectorAll("input[data-char-name]")
      .forEach((inp) => {
        inp.addEventListener("input", (ev) => {
          const idx = parseInt(ev.target.getAttribute("data-char-name"), 10);
          characters[idx].name = ev.target.value;
        });
      });
    el("charactersContainer")
      .querySelectorAll("input[data-char-mediaid]")
      .forEach((inp) => {
        inp.addEventListener("input", (ev) => {
          const idx = parseInt(ev.target.getAttribute("data-char-mediaid"), 10);
          characters[idx].mediaId = ev.target.value.trim();
        });
      });
    el("charactersContainer")
      .querySelectorAll("textarea[data-char-identity]")
      .forEach((ta) => {
        ta.addEventListener("input", (ev) => {
          const idx = parseInt(
            ev.target.getAttribute("data-char-identity"),
            10
          );
          characters[idx].identity = ev.target.value;
        });
      });
    // Toggle kunci identitas per karakter
    el("charactersContainer")
      .querySelectorAll("input[data-char-identitylock]")
      .forEach((inp) => {
        inp.addEventListener("change", (ev) => {
          const idx = parseInt(
            ev.target.getAttribute("data-char-identitylock"),
            10
          );
          characters[idx].identityLock = !!ev.target.checked;
        });
      });
    // Set nilai default dan wire selector image aspect ratio
    el("charactersContainer")
      .querySelectorAll("select[data-char-imgaspect]")
      .forEach((sel) => {
        const idx = parseInt(sel.getAttribute("data-char-imgaspect"), 10);
        sel.value =
          characters[idx].imageAspect ||
          CONFIG.defaultImageAspect ||
          "IMAGE_ASPECT_RATIO_LANDSCAPE";
        sel.addEventListener("change", (ev) => {
          const i = parseInt(ev.target.getAttribute("data-char-imgaspect"), 10);
          characters[i].imageAspect = ev.target.value;
        });
      });
    el("charactersContainer")
      .querySelectorAll("button[data-char-del]")
      .forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          const idx = parseInt(ev.target.getAttribute("data-char-del"), 10);
          removeCharacter(idx);
        });
      });
    el("charactersContainer")
      .querySelectorAll("div[data-drop]")
      .forEach((dz) => {
        const idx = parseInt(dz.getAttribute("data-drop"), 10);
        const fileInput = el("charactersContainer").querySelector(
          `input[data-file="${idx}"]`
        );
        dz.addEventListener("click", () => fileInput?.click());
        dz.addEventListener("dragover", (e) => {
          e.preventDefault();
          dz.style.borderColor = "#84cc16";
        });
        dz.addEventListener("dragleave", () => {
          dz.style.borderColor = "#374151";
        });
        dz.addEventListener("drop", (e) => {
          e.preventDefault();
          dz.style.borderColor = "#374151";
          const f = e.dataTransfer?.files?.[0];
          if (f) handleFileForIndex(f, idx);
        });
        fileInput?.addEventListener("change", (e) => {
          const f = e.target.files?.[0];
          if (f) handleFileForIndex(f, idx);
        });
      });
    // Tombol pilih dari galeri per karakter
    const openCharacterGalleryPicker = async (idx) => {
      try {
        const modal = el("galleryPickerModal");
        const listEl = el("galleryPickerList");
        const stEl = el("galleryPickerStatus");
        if (!modal || !listEl || !stEl) return;
        stEl.textContent = "Memuat daftar galeri...";
        listEl.innerHTML = "";
        modal.classList.add("show");
        const resp = await fetch("/api/uploads");
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || "Gagal memuat galeri");
        const items = Array.isArray(data.items) ? data.items : [];
        if (items.length === 0) {
          stEl.textContent = "Belum ada foto di galeri.";
        } else {
          stEl.textContent = "Klik ‘Pilih’ untuk menggunakan gambar.";
        }
        listEl.innerHTML = items
          .map((it) => {
            const safeName = String(it.name || "");
            const mediaId = it.mediaId
              ? `<div class=\"settings-help\">Media ID: ${it.mediaId}</div>`
              : "";
            return `
              <div class=\"photo-card\">
                <img class=\"photo-thumb\" src=\"${
                  it.url
                }\" alt=\"${safeName}\" />
                <div class=\"photo-meta\">
                  <div class=\"photo-name\" title=\"${safeName}\">${safeName}</div>
                  <div style=\"display:flex; gap:8px; align-items:center;\">
                    <button class=\"btn\" data-pick-name=\"${safeName}\" data-pick-url=\"${
              it.url
            }\" data-pick-mediaid=\"${it.mediaId || ""}\">Pilih</button>
                  </div>
                </div>
                ${mediaId}
              </div>`;
          })
          .join("");
        // Wire pick buttons
        listEl.querySelectorAll("[data-pick-name]").forEach((btn) => {
          btn.addEventListener("click", (ev) => {
            ev.preventDefault();
            const name = btn.getAttribute("data-pick-name") || "";
            const url = btn.getAttribute("data-pick-url") || "";
            const mediaId = btn.getAttribute("data-pick-mediaid") || "";
            if (url) {
              const c = characters[idx] || {};
              c.imageUrl = url;
              c.fileName = name || c.fileName;
              c.mediaId = mediaId || "";
              c.dataUrl = undefined;
              c.uploadInfo = undefined;
              characters[idx] = c;
              renderCharacters();
              statusEl.textContent = mediaId
                ? `Karakter ${
                    idx + 1
                  }: gambar galeri dipilih dan Media ID terisi.`
                : `Karakter ${
                    idx + 1
                  }: gambar galeri dipilih. Jika perlu, Upload ke Labs dulu.`;
            }
            modal.classList.remove("show");
          });
        });
      } catch (e) {
        const stEl = el("galleryPickerStatus");
        if (stEl)
          stEl.textContent = `Gagal memuat galeri: ${String(e.message || e)}`;
      }
    };
    el("charactersContainer")
      .querySelectorAll("button[data-char-pickgal]")
      .forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          const idx = parseInt(ev.target.getAttribute("data-char-pickgal"), 10);
          openCharacterGalleryPicker(idx);
        });
      });
    // Tombol crop ulang (jika gambar sudah ada)
    el("charactersContainer")
      .querySelectorAll(".character-card")
      .forEach((card, i) => {
        const c = characters[i] || {};
        if (c.imageUrl) {
          const btn = document.createElement("button");
          btn.textContent = "Crop ulang";
          btn.className = "btn";
          btn.style.marginTop = "6px";
          btn.addEventListener("click", async () => {
            try {
              const resp = await fetch(c.imageUrl);
              const blob = await resp.blob();
              const dataUrl = await new Promise((resolve) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.readAsDataURL(blob);
              });
              await openCropperWithDataUrl(
                String(dataUrl),
                { type: "character", index: i },
                c.name ? `${c.name}.png` : `character-${i + 1}.png`,
                "image/png"
              );
            } catch (e) {
              statusEl.textContent = `Gagal membuka cropper: ${String(e)}`;
            }
          });
          card.appendChild(btn);
        }
      });
    // Wire tombol Upload ke Labs
    el("charactersContainer")
      .querySelectorAll("button[data-char-uploadlabs]")
      .forEach((btn) => {
        btn.addEventListener("click", async (ev) => {
          const idx = parseInt(
            ev.target.getAttribute("data-char-uploadlabs"),
            10
          );
          const c = characters[idx] || {};
          let dataUrl = c.dataUrl;
          try {
            // jika tidak ada dataUrl (mis. reload), ambil dari imageUrl local
            if (!dataUrl && c.imageUrl) {
              const resp = await fetch(c.imageUrl);
              const blob = await resp.blob();
              dataUrl = await new Promise((resolve) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.readAsDataURL(blob);
              });
            }
          } catch (_) {}
          if (!dataUrl) {
            statusEl.textContent = "Pilih/unggah gambar dulu.";
            return;
          }
          const mimeMatch = String(dataUrl).match(/^data:(.*?);base64,/);
          const mime = mimeMatch ? mimeMatch[1] : "image/png";
          statusEl.textContent = "Mengunggah ke Labs…";
          try {
            const resp = await fetch("/api/labs/upload_image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileName: c.name ? `${c.name}.png` : `character-${idx + 1}.png`,
                mime,
                dataUrl,
                imageAspectRatio:
                  c.imageAspect ||
                  CONFIG.defaultImageAspect ||
                  "IMAGE_ASPECT_RATIO_LANDSCAPE",
              }),
            });
            const ct = resp.headers.get("content-type") || "";
            let data;
            if (ct.includes("application/json")) {
              data = await resp.json();
            } else {
              const text = await resp.text();
              try {
                data = JSON.parse(text);
              } catch {
                data = { raw: text };
              }
            }
            if (!resp.ok) {
              const detail =
                (data && data.error) || data?.raw || `HTTP ${resp.status}`;
              if (resp.status === 401) {
                statusEl.textContent =
                  "Bearer kadaluarsa, Minta bearer baru ke admin";
              } else {
                const printable =
                  typeof detail === "string"
                    ? detail
                    : detail?.message ||
                      detail?.error ||
                      detail?.detail ||
                      (() => {
                        try {
                          return JSON.stringify(detail);
                        } catch {
                          return String(detail);
                        }
                      })();
                statusEl.textContent = `Upload Labs gagal: ${printable}`;
              }
              outputEl.textContent =
                typeof data === "string" ? data : JSON.stringify(data, null, 2);
              return;
            }
            // Isi Media ID jika tersedia
            if (data?.mediaId) {
              characters[idx].mediaId = data.mediaId;
              statusEl.textContent = "Media ID diisi otomatis dari Labs.";
            } else {
              statusEl.textContent =
                "Upload berhasil, namun Media ID belum ditemukan (coba generate lalu cek payload).";
            }
            // simpan upload info untuk ditampilkan dan copy
            try {
              const mediaGenerationId =
                typeof data?.upload?.mediaGenerationId === "string"
                  ? data.upload.mediaGenerationId
                  : data?.upload?.mediaGenerationId?.mediaGenerationId ||
                    undefined;
              characters[idx].uploadInfo = {
                uploadToken: data?.upload?.uploadToken || data?.uploadToken,
                mediaGenerationId,
                width: data?.upload?.width,
                height: data?.upload?.height,
              };
            } catch (_) {}
            // Persist mapping: current uploaded file (in /uploads) -> mediaId
            try {
              const destName = (() => {
                try {
                  const u = String((characters[idx] || {}).imageUrl || "");
                  const p = u.lastIndexOf("/uploads/");
                  if (p >= 0)
                    return u.slice(p + "/uploads/".length).split(/[?#]/)[0];
                  return undefined;
                } catch (_) {
                  return undefined;
                }
              })();
              if (destName && characters[idx].mediaId) {
                await fetch(
                  `/api/uploads/${encodeURIComponent(destName)}/media-id`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      mediaId: characters[idx].mediaId,
                      aspect: characters[idx].imageAspect || undefined,
                      uploadInfo: characters[idx].uploadInfo || undefined,
                    }),
                  }
                );
              }
            } catch (_) {}
            renderCharacters();
            // tampilkan detail di output
            outputEl.textContent = JSON.stringify(data, null, 2);
          } catch (e) {
            statusEl.textContent = `Upload Labs gagal: ${String(e)}`;
          }
        });
      });
    // Wire tombol copy hasil upload
    el("charactersContainer")
      .querySelectorAll("button[data-copy-media]")
      .forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          const idx = parseInt(ev.target.getAttribute("data-copy-media"), 10);
          const val = (characters[idx] || {}).mediaId || "";
          if (!val) {
            statusEl.textContent = "Media ID kosong.";
            return;
          }
          navigator.clipboard
            .writeText(val)
            .then(() => {
              statusEl.textContent = "Media ID disalin.";
            })
            .catch(() => {
              statusEl.textContent = "Gagal menyalin Media ID.";
            });
        });
      });
    el("charactersContainer")
      .querySelectorAll("button[data-copy-upload]")
      .forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          const idx = parseInt(ev.target.getAttribute("data-copy-upload"), 10);
          const val = (characters[idx] || {}).uploadInfo?.uploadToken || "";
          if (!val) {
            statusEl.textContent = "Upload Token tidak tersedia.";
            return;
          }
          navigator.clipboard
            .writeText(val)
            .then(() => {
              statusEl.textContent = "Upload Token disalin.";
            })
            .catch(() => {
              statusEl.textContent = "Gagal menyalin Upload Token.";
            });
        });
      });
    el("charactersContainer")
      .querySelectorAll("button[data-copy-mediagen]")
      .forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          const idx = parseInt(
            ev.target.getAttribute("data-copy-mediagen"),
            10
          );
          const val =
            (characters[idx] || {}).uploadInfo?.mediaGenerationId || "";
          if (!val) {
            statusEl.textContent = "MediaGen ID tidak tersedia.";
            return;
          }
          navigator.clipboard
            .writeText(val)
            .then(() => {
              statusEl.textContent = "MediaGen ID disalin.";
            })
            .catch(() => {
              statusEl.textContent = "Gagal menyalin MediaGen ID.";
            });
        });
      });
  };
  el("addCharacterBtn").addEventListener("click", () => addCharacter());

  const unique = (arr) => Array.from(new Set(arr));
  const collectUrlsFromObject = (obj) => {
    const urls = [];
    const walk = (val) => {
      if (!val) return;
      if (typeof val === "string") {
        const m = val.match(/https?:\/\/[^\s"']+/g);
        if (m) urls.push(...m);
      } else if (Array.isArray(val)) {
        val.forEach(walk);
      } else if (typeof val === "object") {
        Object.values(val).forEach(walk);
      }
    };
    try {
      walk(obj);
    } catch (_) {}
    return unique(urls);
  };

  const withConcurrency = async (items, limit, handler) => {
    const results = [];
    let idx = 0;
    const runners = new Array(Math.max(1, limit)).fill(0).map(async () => {
      while (idx < items.length) {
        const cur = items[idx++];
        try {
          results.push(await handler(cur));
        } catch (_) {
          results.push(undefined);
        }
      }
    });
    await Promise.all(runners);
    return results;
  };

    // Ambil fileUrl per operasi untuk merender satu video per adegan
    const cleanUrl = (u) =>
      typeof u === "string" ? u.replace(/[`]/g, "").trim() : u;
    const getOpVideoUrl = (op) => {
      try {
        const v = op?.operation?.metadata?.video || {};
        if (v?.fileUrl) return cleanUrl(v.fileUrl);
        if (v?.fifeUrl) return cleanUrl(v.fifeUrl); // sebagian respons menggunakan fifeUrl
      } catch (_) {}
      // Fallback: cari URL yang mengandung jalur /video/ dalam op
      const scanned = collectUrlsFromObject(op).filter(
        (u) => /\/video\//i.test(u) || /ai-sandbox-videofx\/video\//i.test(u)
      );
      return scanned[0] ? cleanUrl(scanned[0]) : undefined;
    };
    const dataHasAtLeastOneVideo = (data) => {
      try {
        const ops = Array.isArray(data?.operations) ? data.operations : [];
        for (const op of ops) {
          if (getOpVideoUrl(op)) return true;
        }
      } catch (_) {}
      return false;
    };

  // Ekstrak mediaId dari URL video jika metadata tidak menyediakan langsung
  const extractMediaIdFromUrl = (u) => {
    try {
      const s = String(u || "");
      const m = s.match(/\/video\/([^\/?#]+)/i);
      if (m && m[1]) return decodeURIComponent(m[1]);
    } catch (_) {}
    return undefined;
  };

  const getOpPosterUrl = (op) => {
    // Cari URL image sebagai poster sementara
    const urls = collectUrlsFromObject(op).map(cleanUrl);
    const img = urls.find((u) => /\/image\//i.test(u));
    return img;
  };

  // IntersectionObserver untuk video: lazy attach src, pause saat offscreen
  let videoIo;
  const ensureVideoObserver = () => {
    if (videoIo) return videoIo;
    try {
      videoIo = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const video = entry.target;
            if (!(video instanceof HTMLVideoElement)) return;
            if (entry.isIntersecting) {
              // attach src jika belum
              const ds = video.getAttribute("data-src");
              if (ds && !video.getAttribute("src")) {
                video.setAttribute("src", ds);
              }
            } else {
              // pause saat tidak terlihat untuk meringankan CPU/GPU
              try {
                video.pause();
              } catch (_) {}
            }
          });
        },
        { rootMargin: "200px" }
      );
    } catch (_) {}
    return videoIo;
  };
  const observeVideo = (videoEl) => {
    try {
      const io = ensureVideoObserver();
      if (io && videoEl) io.observe(videoEl);
    } catch (_) {}
  };

  // Jadwalkan render agar tidak menyaingi scroll/painters (rAF batching)
  let __renderPending = null;
  let __renderFrame = null;
  const scheduleRenderMedia = (data) => {
    __renderPending = data;
    if (__renderFrame) return;
    __renderFrame = requestAnimationFrame(() => {
      const d = __renderPending;
      __renderPending = null;
      __renderFrame = null;
      try {
        renderMediaFromData(d);
      } catch (_) {}
    });
  };

  // Simpan snapshot data status terakhir (untuk mengambil mediaGenerationId saat extend)
  let lastStatusData = null;

  const getOpVideoMediaId = (op) => {
    try {
      const v = op?.operation?.metadata?.video || {};
      if (v?.mediaId && typeof v.mediaId === "string") return v.mediaId.trim();
      // coba dari fileUrl/fifeUrl jika ada
      const urlFromMeta = v?.fileUrl || v?.fifeUrl;
      const idFromMetaUrl = extractMediaIdFromUrl(urlFromMeta);
      if (idFromMetaUrl) return idFromMetaUrl.trim();
    } catch (_) {}
    // Fallback: cari field bernama mediaId di objek
    try {
      const stack = [op];
      while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== "object") continue;
        // jika menemukan URL video di node ini, coba ekstrak id
        try {
          const maybeUrls = collectUrlsFromObject(cur);
          for (const u of maybeUrls) {
            const id = extractMediaIdFromUrl(u);
            if (id && id.trim().length) return id.trim();
          }
        } catch (_) {}
        if (Object.prototype.hasOwnProperty.call(cur, "mediaId")) {
          const val = cur.mediaId;
          if (typeof val === "string" && val.trim().length) return val.trim();
        }
        for (const k of Object.keys(cur)) {
          const v = cur[k];
          if (v && typeof v === "object") stack.push(v);
        }
      }
    } catch (_) {}
    return undefined;
  };

  // Ambil ID generasi video dari operasi (muncul saat status SUCCESS)
  const getOpVideoGenerationId = (op) => {
    try {
      const v = op?.operation?.metadata?.video || {};
      if (v?.mediaGenerationId && typeof v.mediaGenerationId === "string") {
        return v.mediaGenerationId.trim();
      }
    } catch (_) {}
    // Fallback: telusuri objek untuk field mediaGenerationId
    try {
      const stack = [op];
      while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== "object") continue;
        if (Object.prototype.hasOwnProperty.call(cur, "mediaGenerationId")) {
          const val = cur.mediaGenerationId;
          if (typeof val === "string" && val.trim().length) return val.trim();
        }
        for (const k of Object.keys(cur)) {
          const v = cur[k];
          if (v && typeof v === "object") stack.push(v);
        }
      }
    } catch (_) {}
    return undefined;
  };

  const extendLastVideo = async ({
    prompt,
    startFrameIndex,
    endFrameIndex,
    overrideGenerationId,
  }) => {
    try {
      // Siapkan append base sehingga hasil extend ditambahkan sebagai kartu baru
      try {
        window.__appendBase = mediaEl?.children?.length || 0;
      } catch (_) {
        window.__appendBase = 0;
      }
      const aspect =
        el("settingAspect")?.value ||
        CONFIG.defaultAspectRatio ||
        "VIDEO_ASPECT_RATIO_LANDSCAPE";
      const modelCfg = getModelConfig(aspect);
      const selectedModelKey = (el("settingModelKey")?.value || "").trim();
      const isRelaxed = selectedModelKey.endsWith("_ultra_relaxed");
      let videoModelKey;
      if (aspect === "VIDEO_ASPECT_RATIO_PORTRAIT") {
        videoModelKey = isRelaxed
          ? "veo_3_1_extend_fast_portrait_ultra_relaxed"
          : modelCfg?.extend || "veo_3_1_extend_fast_portrait_ultra";
      } else {
        videoModelKey = isRelaxed
          ? "veo_3_1_extend_fast_landscape_ultra_relaxed"
          : modelCfg?.extend || "veo_3_1_extend_fast_landscape_ultra";
      }

      // Selaraskan perilaku audio dengan quickGenerate
      const audioOn = !!el("settingAudio")?.checked;
      const voiceSel = el("settingVoiceLang")?.value || "";
      const voiceCus = (el("settingVoiceCustom")?.value || "").trim();
      const voiceLang =
        voiceSel === "__custom__"
          ? voiceCus || "Indonesia"
          : voiceSel || "Indonesia";
      const audioSuffix = audioOn ? `narasi suara berbahasa ${voiceLang}` : "";

      const ops = Array.isArray(lastStatusData?.operations)
        ? lastStatusData.operations
        : [];
      // Jika user memberi override, gunakan itu terlebih dahulu
      let generationId = (overrideGenerationId || "").trim();
      if (!generationId) {
        // Telusuri operasi dari belakang untuk menemukan mediaGenerationId terbaru
        for (let i = ops.length - 1; i >= 0; i--) {
          const gid = getOpVideoGenerationId(ops[i]);
          if (gid && gid.length) {
            generationId = gid;
            break;
          }
        }
      }
      if (!generationId) {
        statusEl.textContent =
          "Tidak menemukan mediaGenerationId video terakhir untuk extend.";
        return;
      }

      const basePrompt = String(prompt || "lanjutkan").slice(0, 4000);
      const finalPrompt = [basePrompt, audioSuffix].filter(Boolean).join(", ");

      const req = {
        videoModelKey,
        aspectRatio: aspect,
        seed: Math.floor(Math.random() * 1000000),
        textInput: { prompt: finalPrompt },
        videoInput: {
          // API extend mengharapkan field 'mediaId' berisi nilai mediaGenerationId
          mediaId: generationId,
          startFrameIndex: Number.isFinite(startFrameIndex)
            ? startFrameIndex
            : 0,
          endFrameIndex: Number.isFinite(endFrameIndex) ? endFrameIndex : 480,
        },
        metadata: { sceneId: `extend-${Date.now().toString(16)}` },
      };
      const plan = getPlan();
      const paid = isPaidPlan(plan);
      const isAdmin = isAdminPlan(plan);
      const isFastExtend = isVeoFastModelKey(videoModelKey);
      const isUnlimited = isUnlimitedModelKey(videoModelKey);
      if (paid && isFastExtend && !isAdmin && !isUnlimited) {
        const q = readQuota("single");
        const limit = quotaLimitForMode("single");
        if (q.count + 1 > limit) {
          const relaxed = relaxedModelForAspect(aspect);
          if (relaxed) {
            try {
              const sel = el("settingModelKey");
              if (sel) sel.value = relaxed;
            } catch (_) {}
            videoModelKey = relaxed;
            statusEl.textContent = "Kuota habis, dialihkan ke Ultra Relaxed.";
            quotaPendingIncrement = 0;
          } else {
            statusEl.textContent = `Kuota harian habis, ganti ke model yang lain.`;
            return;
          }
        } else {
          quotaPendingIncrement = 1;
        }
      } else {
        quotaPendingIncrement = 0;
      }

      const clientContext = CONFIG.clientContext || undefined;
      const payload = {
        ...(clientContext ? { clientContext } : {}),
        requests: [req],
      };
      const url =
        "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoExtendVideo";
      const method = "POST";
      const headers = CONFIG.defaultHeaders || {};

      // Buat job baru via backend agar SSE status di-stream
      const jobResp = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-credential": settingsState.appCredential || "",
        },
        body: JSON.stringify({ url, method, headers, payload }),
      });
      const jobJson = await jobResp.json().catch(() => ({}));
      if (!jobResp.ok || !jobJson?.jobId) {
        statusEl.textContent = `Gagal membuat job extend (${jobResp.status}).`;
        return;
      }
      const jobId = jobJson.jobId;
      statusEl.textContent = "Job extend dibuat. Menunggu server...";
      resetPolling();
      pollState.currentJobId = jobId;
      const es = new EventSource(`/api/jobs/${jobId}/stream`);
      pollState.stream = es;
      es.addEventListener("queued", () => {
        try {
          statusEl.textContent = "Extend masuk antrian...";
        } catch (_) {}
      });
      es.addEventListener("started", () => {
        try {
          statusEl.textContent = "Extend dimulai...";
        } catch (_) {}
      });
      es.addEventListener("initial", (ev) => {
        try {
          const payload = JSON.parse(ev.data || "{}");
          lastStatusData = payload?.data || {};
          scheduleRenderMedia(lastStatusData);
          try {
            statusEl.textContent = "Extend diterima server Google.";
          } catch (_) {}
        } catch (_) {}
      });
      es.addEventListener("polled", (ev) => {
        try {
          const payload = JSON.parse(ev.data || "{}");
          lastStatusData = payload?.data || {};
          scheduleRenderMedia(lastStatusData);
          try {
            statusEl.textContent = "Memeriksa status extend...";
          } catch (_) {}
        } catch (_) {}
      });
      es.addEventListener("backoff", (ev) => {
        try {
          const payload = JSON.parse(ev.data || "{}");
          const sec = Math.max(
            1,
            Math.round((payload?.delayMs || 30000) / 1000)
          );
          const atp = Number(payload?.attempts || 1);
          statusEl.textContent = `Server penuh (${
            payload?.reason || "HTTP 429"
          }). Retry dalam ${sec}s (percobaan ${atp}).`;
        } catch (_) {}
      });
      es.addEventListener("completed", (ev) => {
        let data = null;
        try {
          const payload = JSON.parse(ev.data || "{}");
          data = payload?.data || {};
          lastStatusData = data;
          scheduleRenderMedia(lastStatusData);
        } catch (_) {}
        try {
          es.close();
        } catch (_) {}
        pollState.stream = null;
        pollState.currentJobId = null;
        statusEl.textContent = "Extend selesai.";
        const hasVideo = dataHasAtLeastOneVideo(data || lastStatusData);
        if (quotaPendingIncrement > 0 && hasVideo) {
          const q = readQuota("single");
          writeQuota("single", q.count + quotaPendingIncrement);
          quotaPendingIncrement = 0;
          updateQuotaUI();
        }
      });
      es.addEventListener("failed", (ev) => {
        try {
          const payload = JSON.parse(ev.data || "{}");
          const statusCode = Number(payload?.status);
          if (statusCode === 401) {
            statusEl.textContent =
              "Bearer kadaluarsa, Minta bearer baru ke admin";
          } else {
            statusEl.textContent = "Job extend gagal";
          }
        } catch (_) {
          statusEl.textContent = "Job extend gagal";
        }
        try {
          es.close();
        } catch (_) {}
        pollState.stream = null;
        pollState.currentJobId = null;
      });
    } catch (err) {
      statusEl.textContent = `Gagal extend: ${String(err)}`;
    }
  };

  // Overlay tombol tambah adegan (lanjutan)
  const ADD_SCENE_BTN_ID = "add-scene-overlay-btn";
  const showAddSceneOverlay = () => {
    // Overlay dipojok kanan bawah dinonaktifkan dan dihapus jika ada.
    try {
      const btn = document.getElementById(ADD_SCENE_BTN_ID);
      if (btn) btn.remove();
    } catch (_) {}
  };
  const hideAddSceneOverlay = () => {
    try {
      const btn = document.getElementById(ADD_SCENE_BTN_ID);
      if (btn) btn.remove();
    } catch (_) {}
  };

  // Panel input untuk extend (menggantikan window.prompt)
  const EXTEND_PANEL_ID = "extend-input-panel";
  const showExtendPanel = (opts = {}) => {
    let panel = document.getElementById(EXTEND_PANEL_ID);
    const givenGenId = (opts.overrideGenerationId || "").trim();
    const givenPrompt = opts.suggestedPrompt || "lanjutkan";
    if (panel) {
      try {
        panel.style.display = "block";
        const promptEl = panel.querySelector("#extend-panel-prompt");
        if (promptEl && givenPrompt) promptEl.value = givenPrompt;
        // Simpan generationId yang dikirim dari adegan yang diklik
        panel.dataset.generationId =
          givenGenId || panel.dataset.generationId || "";
      } catch (_) {}
      return;
    }
    panel = document.createElement("div");
    panel.id = EXTEND_PANEL_ID;
    panel.style.position = "fixed";
    panel.style.left = "50%";
    panel.style.top = "50%";
    panel.style.transform = "translate(-50%, -50%)";
    panel.style.zIndex = "10000";
    panel.style.width = "560px";
    panel.style.maxWidth = "90vw";
    panel.style.background = "#0b1020";
    panel.style.border = "1px solid #374151";
    panel.style.borderRadius = "10px";
    panel.style.boxShadow = "0 8px 24px rgba(0,0,0,0.45)";
    panel.style.padding = "12px";
    // Isi panel disederhanakan: hanya prompt lanjutan + tombol
    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong style="color:#e5e7eb; font-weight:600;">Tambah adegan (lanjutan)</strong>
        <button id="extend-panel-close" title="Tutup" style="background:#111827; color:#e5e7eb; border:1px solid #374151; padding:4px 8px; border-radius:6px;">✕</button>
      </div>
      <label style="display:block; color:#9ca3af; font-size:12px; margin-bottom:4px;">Prompt lanjutan</label>
      <textarea id="extend-panel-prompt" rows="3" placeholder="lanjutkan" style="width:100%; background:#0b1020; color:#e5e7eb; border:1px solid #374151; border-radius:8px; padding:8px; resize:vertical;">${givenPrompt}</textarea>
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
        <button id="extend-panel-cancel" style="background:#111827; color:#e5e7eb; border:1px solid #374151; padding:6px 10px; border-radius:8px;">Batal</button>
        <button id="extend-panel-submit" style="background:#2563eb; color:#fff; border:1px solid #1e40af; padding:6px 10px; border-radius:8px;">Extend</button>
      </div>
    `;
    document.body.appendChild(panel);
    // simpan generationId dari adegan yang diklik (jika ada)
    panel.dataset.generationId = givenGenId || "";
    const close = () => {
      try {
        panel.style.display = "none";
      } catch (_) {}
    };
    panel
      .querySelector("#extend-panel-close")
      ?.addEventListener("click", close);
    panel
      .querySelector("#extend-panel-cancel")
      ?.addEventListener("click", close);
    panel
      .querySelector("#extend-panel-submit")
      ?.addEventListener("click", () => {
        try {
          const promptVal = (
            panel.querySelector("#extend-panel-prompt")?.value || "lanjutkan"
          ).trim();
          const overrideVal = (panel.dataset.generationId || "").trim();
          // start/end frame tidak ditampilkan: gunakan default di extendLastVideo
          extendLastVideo({
            prompt: promptVal,
            overrideGenerationId: overrideVal,
            // Veo Fast selalu menghasilkan video 8 detik (≈480 frame @60fps).
            // Pakai 1 detik terakhir sebagai konteks extend.
            startFrameIndex: 420,
            endFrameIndex: 480,
          });
          close();
        } catch (e) {
          try {
            statusEl.textContent = `Gagal submit extend: ${String(e)}`;
          } catch (_) {}
        }
      });
  };

  // Ringankan efek saat scroll aktif
  try {
    let scrollTimer = null;
    window.addEventListener(
      "scroll",
      () => {
        try {
          document.body.classList.add("scrolling");
        } catch (_) {}
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          try {
            document.body.classList.remove("scrolling");
          } catch (_) {}
        }, 200);
      },
      { passive: true }
    );
  } catch (_) {}

  const renderMediaFromData = (data) => {
    let ops = Array.isArray(data?.operations) ? data.operations : [];
    // Urutkan operasi mengikuti urutan trackedOps (agar mapping adegan konsisten)
    try {
      if (trackedOps && trackedOps.length) {
        const byName = Object.fromEntries(
          ops.map((o) => [o?.operation?.name, o])
        );
        const sorted = trackedOps.map((t) => byName[t.name]).filter(Boolean);
        if (sorted.length) ops = sorted;
      }
    } catch (_) {}
    const offset = window.__appendBase || 0;
    const count = Math.max(ops.length + offset, scenes.length);
    if (!count) {
      mediaEl.innerHTML = "<em>Belum ada video yang terdeteksi.</em>";
      return;
    }

    // Track adegan yang sudah selesai agar tidak di-refresh setiap attempt
    window.__sceneDone = window.__sceneDone || {};

    const ensureCard = (i) => {
      const existing = document.getElementById(`scene-card-${i}`);
      if (existing) return existing;
      const wrapper = document.createElement("div");
      wrapper.className = "scene-card";
      wrapper.id = `scene-card-${i}`;
      const label = `Adegan ${i + 1}`;
      wrapper.innerHTML = `<div class="scene-header"><div class="scene-label">${label}</div></div>
        <em>Sedang diproses, menunggu media untuk adegan ini.</em>`;
      mediaEl.appendChild(wrapper);
      return wrapper;
    };

    // If jumlah card kurang/lebih, sesuaikan minimal untuk indeks baru
    for (let i = 0; i < count; i++) ensureCard(i);
    // Hapus card berlebih jika scenes berkurang
    for (let i = count; i < mediaEl.children.length; i++) {
      const extra = document.getElementById(`scene-card-${i}`);
      if (extra) extra.remove();
    }

    for (let i = offset; i < count; i++) {
      const label = `Adegan ${i + 1}`;
      const opIndex = i - offset;
      const url = ops[opIndex] ? getOpVideoUrl(ops[opIndex]) : undefined;
      const poster = ops[opIndex] ? getOpPosterUrl(ops[opIndex]) : undefined;
      const aspect =
        lastRequestAspects[i] ||
        el("settingAspect")?.value ||
        CONFIG.defaultAspectRatio ||
        "VIDEO_ASPECT_RATIO_LANDSCAPE";
      const isPortrait = aspect === "VIDEO_ASPECT_RATIO_PORTRAIT";
      const videoStyle = isPortrait
        ? "width:100%; aspect-ratio:9/16; background:#0b1020; border:1px solid #1f2937; border-radius:12px;"
        : "width:100%; aspect-ratio:16/9; background:#0b1020; border:1px solid #1f2937; border-radius:12px;";

      const card = ensureCard(i);
      if (url) {
        // Jika sudah selesai sebelumnya, jangan refresh
        if (window.__sceneDone[i]) continue;
        const src = `/api/labsflow/download?url=${encodeURIComponent(url)}`;
        const downloadName = `${label.replace(/\s+/g, "_").toLowerCase()}.mp4`;
        const generationIdForScene = getOpVideoGenerationId(ops[opIndex]);
        const newEl = document.createElement("div");
        newEl.className = "scene-card";
        newEl.id = `scene-card-${i}`;
        newEl.style.marginTop = "8px";
        newEl.innerHTML = `<div class="scene-header">
            <div class="scene-label">${label}</div>
            <div class="scene-actions">
              <a class="btn ghost icon" href="${src}" download="${downloadName}" aria-label="Download" title="Download">
                <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <path d="M7 10l5 5 5-5"></path>
                  <path d="M12 15V3"></path>
                </svg>
              </a>
              <button type="button" class="btn icon edit-position" aria-label="Camera Position" title="Camera Position" data-icon="edit1">
                <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 21v-3l14-14 3 3-14 14H3z"></path>
                  <path d="M14 4l6 6"></path>
                </svg>
              </button>
              <button type="button" class="btn icon edit-video" aria-label="Sesuaikan kamera" title="Sesuaikan kamera" data-icon="edit2">
                <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M4 21h4l11-11-4-4L4 17v4z"></path>
                  <path d="M13 6l5 5"></path>
                </svg>
              </button>
              <button type="button" class="btn icon add-next" aria-label="Tambah adegan" title="Tambah adegan">
                <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 5v14"></path>
                  <path d="M5 12h14"></path>
                </svg>
              </button>
            </div>
          </div>
          <video controls preload="none" playsinline style="${videoStyle}" data-src="${src}" ${
          poster ? `poster="${poster}"` : ""
        }></video>`;
        card.replaceWith(newEl);
        try {
          observeVideo(newEl.querySelector("video"));
        } catch (_) {}
        try {
          const btn = newEl.querySelector(".add-next");
          if (btn) {
            btn.addEventListener("click", () => {
              const gid = (generationIdForScene || "").trim();
              showExtendPanel({
                overrideGenerationId: gid,
                suggestedPrompt: "lanjutkan",
              });
            });
          }
          const editAdvancedBtn = newEl.querySelector(".edit-video");
          if (editAdvancedBtn) {
            editAdvancedBtn.addEventListener("click", () => {
              const generationIdForScene = getOpVideoGenerationId(ops[opIndex]);
              const mediaIdFallback = getOpVideoMediaId(ops[opIndex]);
              const chosenId = (
                generationIdForScene ||
                mediaIdFallback ||
                ""
              ).trim();
              showReshootPanel({ mediaId: chosenId, poster, aspect });
            });
          }
          const editPositionBtn = newEl.querySelector(".edit-position");
          if (editPositionBtn) {
            editPositionBtn.addEventListener("click", () => {
              const generationIdForScene = getOpVideoGenerationId(ops[opIndex]);
              const mediaIdFallback = getOpVideoMediaId(ops[opIndex]);
              const chosenId = (
                generationIdForScene ||
                mediaIdFallback ||
                ""
              ).trim();
              showCameraPositionPanel({ mediaId: chosenId, poster, aspect });
            });
          }
        } catch (_) {}
        window.__sceneDone[i] = true;
        try {
          const k = "stat.veo.video.success";
          const v = parseInt(localStorage.getItem(k) || "0", 10) || 0;
          localStorage.setItem(k, String(v + 1));
        } catch (_) {}
      } else {
        // tetap tampilkan placeholder dan jangan ubah jika sudah video
        if (!window.__sceneDone[i]) {
          // card sudah placeholder; tidak perlu refresh tiap attempt
        }
      }
    }
  };

  // === Reshoot (Sesuaikan Kamera) ===
  const RESHOOT_PANEL_ID = "reshoot-panel";
  const RESHOOT_URL_DEFAULT =
    "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoReshootVideo";
  // Opsi baru sesuai contoh UI: Orbit & Dolly
  // Catatan: jika enum tidak cocok, gunakan field "Custom Motion Type" untuk override.
  const RESHOOT_OPTIONS = [
    { label: "Naikkan kamera", value: "RESHOOT_MOTION_TYPE_UP" },
    { label: "Turunkan kamera", value: "RESHOOT_MOTION_TYPE_DOWN" },
    {
      label: "Orbitkan dari kanan ke kiri",
      value: "RESHOOT_MOTION_TYPE_RIGHT_TO_LEFT",
    },
    {
      label: "Orbitkan dari kiri ke kanan",
      value: "RESHOOT_MOTION_TYPE_LEFT_TO_RIGHT",
    },
    { label: "Dolly In", value: "RESHOOT_MOTION_TYPE_FORWARD" },
    { label: "Dolly Out", value: "RESHOOT_MOTION_TYPE_BACKWARD" },
    {
      label: "Arahkan mendekat dan perkecil",
      value: "RESHOOT_MOTION_TYPE_DOLLY_IN_ZOOM_OUT",
    },
    {
      label: "Bergerak menjauh sambil perbesar",
      value: "RESHOOT_MOTION_TYPE_DOLLY_OUT_ZOOM_IN_LARGE",
    },
  ];

  // Panel khusus untuk opsi Camera Position (pertahankan posisi + arah gerak besar)
  const RESHOOT_POSITION_PANEL_ID = "reshoot-position-panel";
  const CAMERA_POSITION_OPTIONS = [
    {
      label: "Tinggikan dan pertahankan posisi",
      value: "RESHOOT_MOTION_TYPE_STATIONARY_UP",
    },
    {
      label: "Turunkan dan pertahankan posisi",
      value: "RESHOOT_MOTION_TYPE_STATIONARY_DOWN",
    },
    {
      label: "Geser ke kiri dan pertahankan posisi",
      value: "RESHOOT_MOTION_TYPE_STATIONARY_LEFT",
    },
    {
      label: "Geser ke kanan dan pertahankan posisi",
      value: "RESHOOT_MOTION_TYPE_STATIONARY_RIGHT",
    },
    {
      label: "Dekatkan dan pertahankan posisi",
      value: "RESHOOT_MOTION_TYPE_STATIONARY_FORWARD",
    },
    {
      label: "Jauhkan dan pertahankan posisi",
      value: "RESHOOT_MOTION_TYPE_STATIONARY_BACKWARD",
    },
    {
      label: "Pertahankan posisi",
      value: "RESHOOT_MOTION_TYPE_STATIONARY",
    },
  ];

  const showCameraPositionPanel = (opts = {}) => {
    let panel = document.getElementById(RESHOOT_POSITION_PANEL_ID);
    const givenMediaId = (opts.mediaId || "").trim();
    const givenAspect =
      opts.aspect ||
      el("settingAspect")?.value ||
      CONFIG.defaultAspectRatio ||
      "VIDEO_ASPECT_RATIO_LANDSCAPE";
    const givenPoster = (opts.poster || "").trim();
    if (panel) {
      try {
        panel.style.display = "block";
        panel
          .querySelector("#reshoot-pos-media-id")
          ?.setAttribute("value", givenMediaId);
        panel.querySelector("#reshoot-pos-media-id").value = givenMediaId;
        panel.dataset.aspect = givenAspect;
        panel.dataset.mediaId = givenMediaId;
        const img = panel.querySelector("#reshoot-pos-preview");
        if (img && givenPoster) img.src = givenPoster;
      } catch (_) {}
      return;
    }
    panel = document.createElement("div");
    panel.id = RESHOOT_POSITION_PANEL_ID;
    panel.style.position = "fixed";
    panel.style.left = "50%";
    panel.style.top = "50%";
    panel.style.transform = "translate(-50%, -50%)";
    panel.style.zIndex = "10000";
    panel.style.width = "980px";
    panel.style.maxWidth = "95vw";
    panel.style.background = "#0b1020";
    panel.style.border = "1px solid #374151";
    panel.style.borderRadius = "10px";
    panel.style.boxShadow = "0 8px 24px rgba(0,0,0,0.45)";
    panel.style.padding = "12px";
    const buttonsHtml = CAMERA_POSITION_OPTIONS.map(
      (o) => `
      <button class="reshoot-pos-opt" data-value="${o.value}" style="
        background:#111827; color:#e5e7eb; border:1px solid #374151; border-radius:10px;
        padding:12px; text-align:center; cursor:pointer; width:100%; white-space:normal;">${o.label}</button>
    `
    ).join("");
    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong style="color:#e5e7eb; font-weight:600;">Camera Position</strong>
        <button id="reshoot-pos-close" title="Tutup" style="background:#111827; color:#e5e7eb; border:1px solid #374151; padding:4px 8px; border-radius:6px;">✕</button>
      </div>
      <div style="display:flex; gap:12px; align-items:flex-start;">
        <img id="reshoot-pos-preview" src="${givenPoster}" alt="preview" style="width:300px; max-width:38%; border-radius:8px; background:#0b1020; border:1px solid #1f2937;" />
        <div style="flex:1;">
          <div id="reshoot-pos-grid" style="display:grid; grid-template-columns:repeat(3, minmax(180px, 1fr)); gap:10px; align-items:stretch; max-height:420px; overflow-y:auto; padding-right:4px;">${buttonsHtml}</div>
          <input id="reshoot-pos-motion" type="hidden" />
          <div style="margin-top:10px; display:flex; gap:10px;">
            <div style="flex:1;">
              <label style="display:block; color:#9ca3af; font-size:12px; margin-bottom:6px;">Media ID</label>
              <input id="reshoot-pos-media-id" type="text" placeholder="mediaGenerationId atau mediaId..." value="${givenMediaId}" style="width:100%; background:#0b1020; color:#e5e7eb; border:1px solid #374151; border-radius:8px; padding:8px;" />
            </div>
          </div>
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
        <button id="reshoot-pos-cancel" style="background:#111827; color:#e5e7eb; border:1px solid #374151; padding:6px 10px; border-radius:8px;">Batal</button>
        <button id="reshoot-pos-submit" style="background:#2563eb; color:#fff; border:1px solid #1e40af; padding:6px 10px; border-radius:8px;">Kirim Edit</button>
      </div>`;
    document.body.appendChild(panel);
    panel.dataset.aspect = givenAspect;
    panel.dataset.mediaId = givenMediaId;
    const close = () => {
      try {
        panel.style.display = "none";
      } catch (_) {}
    };
    panel.querySelector("#reshoot-pos-close")?.addEventListener("click", close);
    panel
      .querySelector("#reshoot-pos-cancel")
      ?.addEventListener("click", close);
    try {
      const grid = panel.querySelector("#reshoot-pos-grid");
      const hidden = panel.querySelector("#reshoot-pos-motion");
      if (grid && hidden) {
        grid.addEventListener("click", (ev) => {
          const btn = ev.target.closest(".reshoot-pos-opt");
          if (!btn) return;
          const val = btn.dataset.value || "";
          grid.querySelectorAll(".reshoot-pos-opt").forEach((b) => {
            b.style.background = "#111827";
            b.style.borderColor = "#374151";
          });
          btn.style.background = "#1f2937";
          btn.style.borderColor = "#2563eb";
          hidden.value = val;
        });
        const first = grid.querySelector(".reshoot-pos-opt");
        if (first) first.click();
      }
    } catch (_) {}
    panel
      .querySelector("#reshoot-pos-submit")
      ?.addEventListener("click", async () => {
        try {
          const mediaIdEl = panel.querySelector("#reshoot-pos-media-id");
          const hidden = panel.querySelector("#reshoot-pos-motion");
          const motionType = (hidden?.value || "").trim();
          const mediaId = (
            mediaIdEl?.value ||
            panel.dataset.mediaId ||
            ""
          ).trim();
          if (!mediaId) {
            statusEl.textContent = "Media ID kosong. Masukkan ID video sumber.";
            return;
          }
          if (!motionType) {
            statusEl.textContent = "Pilih motion type untuk Camera Position.";
            return;
          }
          await submitReshoot({
            mediaId,
            motionType,
            aspect: panel.dataset.aspect,
          });
          close();
        } catch (e) {
          statusEl.textContent = `Gagal submit edit: ${String(e)}`;
        }
      });
  };

  const showReshootPanel = (opts = {}) => {
    let panel = document.getElementById(RESHOOT_PANEL_ID);
    const givenMediaId = (opts.mediaId || "").trim();
    const givenAspect =
      opts.aspect ||
      el("settingAspect")?.value ||
      CONFIG.defaultAspectRatio ||
      "VIDEO_ASPECT_RATIO_LANDSCAPE";
    const givenPoster = (opts.poster || "").trim();
    if (panel) {
      try {
        panel.style.display = "block";
        panel
          .querySelector("#reshoot-media-id")
          ?.setAttribute("value", givenMediaId);
        panel.querySelector("#reshoot-media-id").value = givenMediaId;
        panel.dataset.aspect = givenAspect;
        panel.dataset.mediaId = givenMediaId;
        const img = panel.querySelector("#reshoot-preview");
        if (img && givenPoster) img.src = givenPoster;
      } catch (_) {}
      return;
    }
    panel = document.createElement("div");
    panel.id = RESHOOT_PANEL_ID;
    panel.style.position = "fixed";
    panel.style.left = "50%";
    panel.style.top = "50%";
    panel.style.transform = "translate(-50%, -50%)";
    panel.style.zIndex = "10000";
    panel.style.width = "640px";
    panel.style.maxWidth = "92vw";
    panel.style.background = "#0b1020";
    panel.style.border = "1px solid #374151";
    panel.style.borderRadius = "10px";
    panel.style.boxShadow = "0 8px 24px rgba(0,0,0,0.45)";
    panel.style.padding = "12px";
    const optionsHtml = RESHOOT_OPTIONS.map(
      (o) => `<option value="${o.value}">${o.label}</option>`
    ).join("");
    const buttonsHtml = RESHOOT_OPTIONS.map(
      (o) => `
      <button class="reshoot-opt" data-value="${o.value}" style="
        background:#111827; color:#e5e7eb; border:1px solid #374151; border-radius:10px;
        padding:10px; text-align:center; cursor:pointer; flex:1; min-width:140px;">${o.label}</button>
    `
    ).join("");
    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong style="color:#e5e7eb; font-weight:600;">Sesuaikan kamera</strong>
        <button id="reshoot-close" title="Tutup" style="background:#111827; color:#e5e7eb; border:1px solid #374151; padding:4px 8px; border-radius:6px;">✕</button>
      </div>
      <div style="display:flex; gap:12px; align-items:flex-start;">
        <img id="reshoot-preview" src="${givenPoster}" alt="preview" style="width:240px; max-width:40%; border-radius:8px; background:#0b1020; border:1px solid #1f2937;" />
        <div style="flex:1;">
          <label style="display:block; color:#9ca3af; font-size:12px; margin-bottom:6px;">Pilihan gerak kamera</label>
          <div id="reshoot-motion-grid" style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">${buttonsHtml}</div>
          <select id="reshoot-motion" style="display:none; width:100%; background:#0b1020; color:#e5e7eb; border:1px solid #374151; border-radius:8px; padding:8px;">${optionsHtml}</select>
          <div style="margin-top:10px; display:flex; gap:10px;">
            <div style="flex:1;">
              <label style="display:block; color:#9ca3af; font-size:12px; margin-bottom:6px;">Media ID</label>
      <input id="reshoot-media-id" type="text" placeholder="mediaGenerationId atau mediaId..." value="${givenMediaId}" style="width:100%; background:#0b1020; color:#e5e7eb; border:1px solid #374151; border-radius:8px; padding:8px;" />
            </div>
            <div style="flex:1;">
              <label style="display:block; color:#9ca3af; font-size:12px; margin-bottom:6px;">Custom Motion Type (opsional)</label>
              <input id="reshoot-motion-custom" type="text" placeholder="override enum..." style="width:100%; background:#0b1020; color:#e5e7eb; border:1px solid #374151; border-radius:8px; padding:8px;" />
            </div>
          </div>
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
        <button id="reshoot-cancel" style="background:#111827; color:#e5e7eb; border:1px solid #374151; padding:6px 10px; border-radius:8px;">Batal</button>
        <button id="reshoot-submit" style="background:#2563eb; color:#fff; border:1px solid #1e40af; padding:6px 10px; border-radius:8px;">Kirim Edit</button>
      </div>
    `;
    document.body.appendChild(panel);
    panel.dataset.aspect = givenAspect;
    panel.dataset.mediaId = givenMediaId;
    const close = () => {
      try {
        panel.style.display = "none";
      } catch (_) {}
    };
    panel.querySelector("#reshoot-close")?.addEventListener("click", close);
    panel.querySelector("#reshoot-cancel")?.addEventListener("click", close);
    // Interaksi tombol: set nilai motion type yang dipilih
    try {
      const grid = panel.querySelector("#reshoot-motion-grid");
      const motionSel = panel.querySelector("#reshoot-motion");
      if (grid && motionSel) {
        grid.addEventListener("click", (ev) => {
          const btn = ev.target.closest(".reshoot-opt");
          if (!btn) return;
          const val = btn.dataset.value || "";
          // Tandai aktif
          grid.querySelectorAll(".reshoot-opt").forEach((b) => {
            b.style.background = "#111827";
            b.style.borderColor = "#374151";
          });
          btn.style.background = "#1f2937";
          btn.style.borderColor = "#2563eb";
          motionSel.value = val;
        });
        // Preselect pertama
        const first = grid.querySelector(".reshoot-opt");
        if (first) first.click();
      }
    } catch (_) {}
    panel
      .querySelector("#reshoot-submit")
      ?.addEventListener("click", async () => {
        try {
          const motionSel = panel.querySelector("#reshoot-motion");
          const motionCustom = panel.querySelector("#reshoot-motion-custom");
          const mediaIdEl = panel.querySelector("#reshoot-media-id");
          const motionType = (
            motionCustom?.value?.trim() ||
            motionSel?.value ||
            ""
          ).trim();
          const mediaId = (
            mediaIdEl?.value ||
            panel.dataset.mediaId ||
            ""
          ).trim();
          if (!mediaId) {
            statusEl.textContent = "Media ID kosong. Masukkan ID video sumber.";
            return;
          }
          if (!motionType) {
            statusEl.textContent = "Pilih gerak kamera (motion type).";
            return;
          }
          await submitReshoot({
            mediaId,
            motionType,
            aspect: panel.dataset.aspect,
          });
          close();
        } catch (e) {
          statusEl.textContent = `Gagal submit edit: ${String(e)}`;
        }
      });
  };

  const submitReshoot = async ({ mediaId, motionType, aspect }) => {
    try {
      statusEl.textContent = "Mengirim edit (reshoot)...";
      // Pastikan hasil reshoot ditambahkan sebagai adegan baru (append),
      // meniru perilaku extend.
      try {
        window.__appendBase = mediaEl?.children?.length || 0;
      } catch (_) {
        window.__appendBase = 0;
      }
      const aspectVal =
        aspect ||
        el("settingAspect")?.value ||
        CONFIG.defaultAspectRatio ||
        "VIDEO_ASPECT_RATIO_LANDSCAPE";
      const modelCfg = getModelConfig(aspectVal);
      const videoModelKey = modelCfg?.reshoot || "veo_3_0_reshoot_landscape";
      const req = {
        seed: Math.floor(Math.random() * 40000) + 1,
        aspectRatio: aspectVal,
        videoInput: { mediaId },
        reshootMotionType: motionType,
        videoModelKey,
        metadata: { sceneId: `reshoot-${Date.now().toString(16)}` },
      };
      const clientContext = CONFIG.clientContext || undefined;
      const payload = {
        ...(clientContext ? { clientContext } : {}),
        requests: [req],
      };
      const url = RESHOOT_URL_DEFAULT;
      const method = "POST";
      const headers = {
        ...(CONFIG.defaultHeaders || {}),
        "Content-Type": "text/plain; charset=UTF-8",
      };
      const jobResp = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-credential": settingsState.appCredential || "",
        },
        body: JSON.stringify({ url, method, headers, payload }),
      });
      const jobJson = await jobResp.json().catch(() => ({}));
      if (!jobResp.ok || !jobJson?.jobId) {
        statusEl.textContent = `Gagal membuat job reshoot (${jobResp.status}).`;
        return;
      }
      const jobId = jobJson.jobId;
      statusEl.textContent = "Job reshoot dibuat. Menunggu server...";
      resetPolling();
      pollState.currentJobId = jobId;
      const es = new EventSource(`/api/jobs/${jobId}/stream`);
      pollState.stream = es;
      es.addEventListener("queued", () => {
        try {
          statusEl.textContent = "Reshoot masuk antrian...";
        } catch (_) {}
      });
      es.addEventListener("started", () => {
        try {
          statusEl.textContent = "Reshoot dimulai...";
        } catch (_) {}
      });
      es.addEventListener("initial", (ev) => {
        try {
          const payload = JSON.parse(ev.data || "{}");
          lastStatusData = payload?.data || {};
          scheduleRenderMedia(lastStatusData);
          try {
            statusEl.textContent = "Reshoot diterima server Google.";
          } catch (_) {}
        } catch (_) {}
      });
      es.addEventListener("polled", (ev) => {
        try {
          const payload = JSON.parse(ev.data || "{}");
          lastStatusData = payload?.data || {};
          scheduleRenderMedia(lastStatusData);
          try {
            statusEl.textContent = "Memeriksa status reshoot...";
          } catch (_) {}
        } catch (_) {}
      });
      es.addEventListener("backoff", (ev) => {
        try {
          const payload = JSON.parse(ev.data || "{}");
          const sec = Math.max(
            1,
            Math.round((payload?.delayMs || 30000) / 1000)
          );
          const atp = Number(payload?.attempts || 1);
          statusEl.textContent = `Server penuh (${
            payload?.reason || "HTTP 429"
          }). Retry dalam ${sec}s (percobaan ${atp}).`;
        } catch (_) {}
      });
      es.addEventListener("completed", (ev) => {
        try {
          const payload = JSON.parse(ev.data || "{}");
          lastStatusData = payload?.data || {};
          scheduleRenderMedia(lastStatusData);
        } catch (_) {}
        try {
          es.close();
        } catch (_) {}
        pollState.stream = null;
        pollState.currentJobId = null;
        statusEl.textContent = "Reshoot selesai.";
      });
      es.addEventListener("failed", (ev) => {
        try {
          const payload = JSON.parse(ev.data || "{}");
          const statusCode = Number(payload?.status);
          if (statusCode === 401) {
            statusEl.textContent =
              "Bearer kadaluarsa, Minta bearer baru ke admin";
          } else {
            statusEl.textContent = "Job reshoot gagal";
          }
        } catch (_) {
          statusEl.textContent = "Job reshoot gagal";
        }
        try {
          es.close();
        } catch (_) {}
        pollState.stream = null;
        pollState.currentJobId = null;
      });
    } catch (err) {
      statusEl.textContent = `Gagal reshoot: ${String(err)}`;
    }
  };

  // === Merge Videos UI ===
  const showMergeVideosModal = () => {
    try {
      const modal = document.getElementById("mergeVideosModal");
      const list = document.getElementById("mergeVideosList");
      const status = document.getElementById("mergeVideosStatus");
      if (!modal || !list) return;
      // Kumpulkan daftar video dari DOM
      const items = [];
      const cards = Array.from(mediaEl?.children || []);
      cards.forEach((c, idx) => {
        const v = c.querySelector("video");
        if (!(v instanceof HTMLVideoElement)) return;
        const ds = v.getAttribute("data-src") || "";
        if (!ds) return;
        // Ambil URL asli dari query param 'url'
        let originalUrl = "";
        try {
          const u = new URL(ds, window.location.origin);
          originalUrl = u.searchParams.get("url") || ds;
        } catch (_) {
          originalUrl = ds;
        }
        items.push({
          label: `Adegan ${idx + 1}`,
          proxied: ds,
          original: originalUrl,
        });
      });
      list.innerHTML = "";
      if (!items.length) {
        status.textContent = "Tidak ada video di pratinjau.";
      } else {
        status.textContent =
          "Pilih video yang ingin digabungkan (urut sesuai pilihan).";
        items.forEach((it, idx) => {
          const row = document.createElement("div");
          row.className = "merge-scene-item";
          row.innerHTML = `
            <label class="merge-scene-label">
              <input type="checkbox" class="merge-check-custom" data-url="${it.original}" data-label="${it.label}" />
              <div class="merge-scene-card">
                <div class="merge-scene-thumb">
                  <video src="${it.proxied}" muted loop></video>
                </div>
                <div class="merge-scene-info">
                  <div class="merge-scene-name">${it.label}</div>
                  <div class="merge-scene-desc">Video adegan ke-${idx + 1}</div>
                </div>
                <div class="merge-scene-indicator"></div>
              </div>
            </label>
          `;
          list.appendChild(row);

          // Auto-play thumbnail on hover
          const thumbVideo = row.querySelector("video");
          row.addEventListener("mouseenter", () => thumbVideo.play().catch(() => {}));
          row.addEventListener("mouseleave", () => {
            thumbVideo.pause();
            thumbVideo.currentTime = 0;
          });
        });
      }
      modal.classList.add("show");
    } catch (_) {}
  };

  const closeMergeVideosModal = () => {
    try {
      document.getElementById("mergeVideosModal").classList.remove("show");
    } catch (_) {}
  };

  const submitMergeVideos = async () => {
    try {
      const checks = Array.from(
        document.querySelectorAll("#mergeVideosList .merge-check-custom")
      );
      const selected = checks
        .filter((c) => c.checked)
        .map((c) => c.getAttribute("data-url"))
        .filter(Boolean);
      if (!selected.length) {
        statusEl.textContent = "Pilih minimal dua video untuk digabungkan.";
        return;
      }
      statusEl.textContent = "Menggabungkan video...";
      const resp = await fetch("/api/video/concat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: selected }),
      });
      const ct = resp.headers.get("content-type") || "";
      const data = ct.includes("application/json")
        ? await resp.json()
        : { raw: await resp.text() };
      if (!resp.ok) {
        const detail =
          (data && data.error) || data?.raw || `HTTP ${resp.status}`;
        statusEl.textContent = `Gagal gabungkan: ${String(detail)}`;
        return;
      }
      const url = data?.url || data?.path;
      if (!url) {
        statusEl.textContent = "Gabungan selesai, namun URL tidak tersedia.";
        return;
      }
      statusEl.textContent = "Gabungan selesai. Mengunduh hasil...";
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = `gabungan_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (_) {}
      closeMergeVideosModal();
    } catch (e) {
      statusEl.textContent = `Gagal gabungkan: ${String(e)}`;
    }
  };

  // Hook tombol dan modal
  try {
    el("mergeVideosBtn")?.addEventListener("click", showMergeVideosModal);
    el("mergeVideosClose")?.addEventListener("click", closeMergeVideosModal);
    el("mergeVideosCancel")?.addEventListener("click", closeMergeVideosModal);
    el("mergeVideosSubmit")?.addEventListener("click", submitMergeVideos);
  } catch (_) {}

  // Hapus mode manual; generate hanya lewat Prompt Saja

  // Apply Defaults dihapus; config dimuat otomatis saat halaman dibuka

  // Generate berdasarkan mode prompt
  el("quickGenerate").addEventListener("click", async () => {
    try {
      // Validasi sesuai mode
      if (promptMode === "single") {
        const sp = (el("singlePrompt")?.value || "").trim();
        if (!sp) {
          statusEl.textContent = "Isi prompt tunggal terlebih dahulu.";
          return;
        }
      } else if (promptMode === "batch") {
        const bp = (el("batchPrompts")?.value || "").trim();
        const lines = bp
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (!lines.length) {
          statusEl.textContent = "Isi prompt batch (satu per baris).";
          return;
        }
      } else if (promptMode === "director") {
        if (!scenes.length) {
          statusEl.textContent = "Tambah minimal satu adegan.";
          return;
        }
        if (scenes.every((s) => !s.prompt || !s.prompt.trim())) {
          statusEl.textContent = "Adegan kosong";
          return;
        }
      }

      // Immediate UI feedback and clear any previous polling
      resetPolling();
      trackedOps = [];
      // Clear previous render state so new generate replaces old results
      try {
        window.__sceneDone = {};
      } catch (_) {}
      try {
        if (mediaEl) mediaEl.innerHTML = "";
      } catch (_) {}
      // Reset append base offset agar penomoran adegan kembali mulai dari 1
      try {
        window.__appendBase = 0;
      } catch (_) {}
      // Saat memulai dari awal (single/batch), kosongkan daftar adegan supaya kartu lama hilang
      try {
        if (promptMode === "single" || promptMode === "batch") {
          scenes = [];
          try {
            renderScenes();
          } catch (_) {}
        }
      } catch (_) {}
      // Disable navigation while generating
      try {
        window.__isGenerating = true;
      } catch (_) {}
      const preventNav = (ev) => {
        try {
          ev.preventDefault();
          ev.stopImmediatePropagation();
        } catch (_) {}
        try {
          statusEl.textContent = "Sedang generate; navigasi dinonaktifkan.";
        } catch (_) {}
      };
      const setNavDisabled = (disabled) => {
        const ids = [
          "modeSingleBtn",
          "modeBatchBtn",
          "modeDirectorBtn",
          "galleryButton",
        ];
        ids.forEach((id) => {
          const n = el(id);
          if (!n) return;
          try {
            n.classList.toggle("disabled", !!disabled);
          } catch (_) {}
          try {
            n.setAttribute("aria-disabled", disabled ? "true" : "false");
          } catch (_) {}
        });
      };
      setNavDisabled(false);
      statusEl.textContent = "Mengirim generate...";
      const btn = el("quickGenerate");
      if (btn) btn.disabled = true;
      const stopBtn = el("stopGenerate");
      if (stopBtn) stopBtn.disabled = true; // will be enabled after job is created

      // Ambil pengaturan
      const aspect =
        el("settingAspect").value ||
        CONFIG.defaultAspectRatio ||
        "VIDEO_ASPECT_RATIO_LANDSCAPE";
      const modelConfig = getModelConfig(aspect);
      const selectedModelKey = (el("settingModelKey")?.value || "").trim();
      const singleMediaId = (singleImage.mediaId || "").trim();
      const useSingleStartImage = promptMode === "single" && !!singleMediaId;
      // Pilih model & endpoint berdasarkan ketersediaan Media ID dari karakter yang ditugaskan
      const assignedIdsUnion = Array.from(
        new Set((scenes || []).flatMap((s) => s.characters || []))
      );
      const primaryMediaId = (
        characters.find(
          (c) => assignedIdsUnion.includes(c.id) && (c.mediaId || "").length > 0
        )?.mediaId || ""
      ).trim();
      const useDirectorStartImage =
        promptMode === "director" && !!primaryMediaId;
      const useStartImage = useSingleStartImage || useDirectorStartImage;
      const textModelKey = modelConfig.text || fallbackModelConfig.text;
      const startImageModelKey =
        modelConfig.startImage ||
        fallbackModelConfig.startImage ||
        textModelKey;
      const videoModelKey = useStartImage
        ? startImageModelKey
        : selectedModelKey || textModelKey;
      const styleKey = el("settingStyle").value;
      const resolution = el("settingResolution").value;
      const audioOn = el("settingAudio").checked;
      const voiceSel = el("settingVoiceLang")?.value || "";
      const voiceCus = (el("settingVoiceCustom")?.value || "").trim();
      const voiceLang =
        voiceSel === "__custom__"
          ? voiceCus || "Indonesia"
          : voiceSel || "Indonesia";

      const styleMap = {
        sinematik: "gaya sinematik, dynamic camera, filmic lighting",
        realistik: "gaya realistik, natural lighting, handheld feel",
        anime: "gaya anime, cel-shaded, high contrast",
        dokumenter: "gaya dokumenter, handheld camera, natural color",
        pixar3d:
          "gaya Pixar 3D, karakter stylized, warna cerah, pencahayaan lembut",
        cyberpunk:
          "gaya cyberpunk, neon lighting, cityscape futuristik, kontras tinggi",
        retro80an:
          "gaya retro 80-an, tekstur VHS, color grading vintage, grain halus",
        claymation: "gaya claymation, nuansa stop-motion, tekstur tanah liat",
        fantasi: "gaya fantasi, epic scenery, atmosfer magis, warna kaya",
        steampunk:
          "gaya steampunk, mesin mekanik, brass dan uap, nuansa Victorian",
        filmnoir:
          "gaya film noir, hitam-putih, high contrast, bayangan dramatis",
      };
      const styleSuffix = styleMap[styleKey] || "";
      const subStyleValue = el("settingSubStyle")?.value || "";
      const subStyleLabel = getSubStyleLabel(styleKey, subStyleValue);
      const resSuffix = resolution ? `resolusi ${resolution}` : "";
      const audioSuffix = audioOn
        ? `narasi suara berbahasa ${voiceLang || "Indonesia"}`
        : "";
      let requests = [];
      if (promptMode === "director") {
        // Konsistensi identitas + seed terkontrol
        const useRandomSeed = !!el("randomSeed")?.checked;
        const seedInput = parseInt(el("identitySeed")?.value, 10);
        const globalSeed = useRandomSeed
          ? Math.floor(Math.random() * 40000) + 1
          : Number.isFinite(seedInput)
          ? seedInput
          : 29284;
        const identityConsistency =
          scenes.length > 1
            ? "pertahankan identitas karakter utama sama seperti adegan pertama (wajah, rambut, pakaian, warna, proporsi) agar konsisten di semua adegan"
            : "";
        requests = scenes.map((s, idx) => {
          // Kumpulkan karakter yang ditugaskan untuk adegan ini
          const sceneCharIds = Array.isArray(s.characters) ? s.characters : [];
          const sceneChars = characters.filter((c) =>
            sceneCharIds.includes(c.id)
          );
          // Referensi foto untuk konsistensi
          const charRefs = sceneChars
            .filter((c) => c.imageUrl)
            .map((c) => ({
              name: c.name || "karakter utama",
              url: c.imageUrl,
            }));
          const charPrompt =
            charRefs.length && !useStartImage
              ? `acu pada foto referensi ${charRefs
                  .map((r) => r.name)
                  .join(", ")} (${charRefs
                  .map((r) => r.url)
                  .join(
                    " "
                  )}) untuk menjaga kesamaan wajah, rambut, pakaian, warna, proporsi`
              : "";
          // Identitas per karakter
          const charIdentities = sceneChars
            .map((c) => ({
              name: c.name || "karakter utama",
              identity: (c.identity || "").trim(),
            }))
            .filter((ci) => ci.identity.length);
          const charIdentitySuffix = charIdentities.length
            ? `identitas karakter: ${charIdentities
                .map((ci) => `${ci.name} — ${ci.identity}`)
                .join("; ")}`
            : "";
          // Kunci identitas yang aktif
          const lockedNames = sceneChars
            .filter((c) => c.identityLock)
            .map((c) => c.name || "karakter utama");
          const charIdentityLockSuffix = lockedNames.length
            ? `jangan ubah identitas ${lockedNames.join(
                ", "
              )} (wajah, rambut, pakaian, warna, proporsi) di seluruh adegan`
            : "";
          // Dialog berurutan sesuai scenes[].dialogOrder
          const dialogOrderMap = s.dialogOrder || {};
          const charDialogues = sceneChars
            .map((c) => ({
              name: c.name || "karakter utama",
              text: ((s.dialogues || {})[c.id] || "").trim(),
              order: Number.isFinite(dialogOrderMap[c.id])
                ? dialogOrderMap[c.id]
                : Infinity,
            }))
            .filter((cd) => cd.text.length);
          charDialogues.sort(
            (a, b) => a.order - b.order || a.name.localeCompare(b.name)
          );
          const charDialogueSuffix = charDialogues.length
            ? `dialog karakter: ${charDialogues
                .map((cd) => `${cd.name}: "${cd.text.replace(/"/g, '"')}"`)
                .join("; ")}`
            : "";
          const seed = globalSeed;
          const continuitySuffix =
            s.linkPrev && idx > 0
              ? "lanjutan adegan sebelumnya, transisi halus"
              : "";
          const scenePrompt = (s.prompt || "").trim();
          const finalPrompt = [
            charIdentitySuffix,
            charPrompt,
            scenePrompt,
            charDialogueSuffix,
            styleSuffix,
            subStyleLabel,
            resSuffix,
            audioSuffix,
            continuitySuffix,
            identityConsistency,
            charIdentityLockSuffix,
          ]
            .filter(Boolean)
            .join(", ");
          const base = {
            videoModelKey,
            textInput: { prompt: finalPrompt },
            aspectRatio: aspect,
            seed,
            metadata: { sceneId: s.id || `scene-${idx + 1}-${Date.now()}` },
          };
          if (useStartImage) {
            // Jika tersedia, gunakan Media ID dari karakter yang ditugaskan untuk adegan ini; fallback ke primaryMediaId
            const sceneMediaId = (
              sceneChars.find((c) => (c.mediaId || "").length > 0)?.mediaId ||
              primaryMediaId
            ).trim();
            if (sceneMediaId) base.startImage = { mediaId: sceneMediaId };
          }
          return base;
        });
      } else if (promptMode === "batch") {
        const bp = (el("batchPrompts")?.value || "").trim();
        const lines = bp
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        let items = lines.map((p) => ({ prompt: p }));
        const batchMediaId = (batchImage.mediaId || "").trim();
        if (!items.length) {
          statusEl.textContent = "Isi prompt batch (satu per baris).";
          const btn0 = el("quickGenerate");
          if (btn0) btn0.disabled = false;
          const stop0 = el("stopGenerate");
          if (stop0) stop0.disabled = true;
          return;
        }
        if (items.length > 200) {
          items = items.slice(0, 200);
          statusEl.textContent = "Membatasi batch ke 200 item.";
        }
        const startImageModelKey =
          modelConfig.startImage ||
          fallbackModelConfig.startImage ||
          textModelKey;
        const textOnlyModelKey = textModelKey;
        const plan = getPlan();
        const paid = isPaidPlan(plan);
        const isAdmin = isAdminPlan(plan);
        const fastCandidate = startImageModelKey || textOnlyModelKey;
        const isFast = isVeoFastModelKey(fastCandidate);
        const isUnlimited = isUnlimitedModelKey(fastCandidate);
        if (paid && isFast && !isAdmin && !isUnlimited) {
          const need = items.length;
          const q = readQuota("batch");
          const limit = quotaLimitForMode("batch");
          if (q.count + need > limit) {
            const relaxed = relaxedModelForAspect(aspect);
            if (relaxed) {
              try {
                const sel = el("settingModelKey");
                if (sel) sel.value = relaxed;
              } catch (_) {}
              // Override both startImageModelKey and textOnlyModelKey to relaxed to ensure no quota
              // If start image is used, use relaxed start-image key; otherwise text-only relaxed key
              const relaxedKey = relaxed;
              // Recompute requests with relaxed key
              const makeRelaxed = (scenePrompt, extra) => ({
                videoModelKey: relaxedKey,
                textInput: { prompt: scenePrompt },
                aspectRatio: aspect,
                seed: Math.floor(Math.random() * 40000) + 1,
                ...(extra || {}),
              });
              const relaxedStartGlobal = batchMediaId
                ? items.map((it) =>
                    makeRelaxed(it.prompt || "", {
                      startImage: { mediaId: batchMediaId },
                    })
                  )
                : [];
              const relaxedMixedStart = items
                .filter((it) => String(it.mediaId || "").trim().length)
                .map((it) =>
                  makeRelaxed(it.prompt || "", {
                    startImage: { mediaId: String(it.mediaId).trim() },
                  })
                );
              const relaxedTextOnly = items
                .filter(
                  (it) =>
                    !String(it.mediaId || "").trim().length && !batchMediaId
                )
                .map((it) => makeRelaxed(it.prompt || ""));
              requests = relaxedStartGlobal.length
                ? relaxedStartGlobal
                : [...relaxedMixedStart, ...relaxedTextOnly];
              statusEl.textContent =
                "Kuota batch habis, dialihkan ke Ultra Relaxed.";
              quotaPendingIncrement = 0;
            } else {
              statusEl.textContent = `Kuota harian habis, ganti ke model yang lain.`;
              const btn2b = el("quickGenerate");
              if (btn2b) btn2b.disabled = false;
              const stopBtn2b = el("stopGenerate");
              if (stopBtn2b) stopBtn2b.disabled = true;
              return;
            }
          } else {
            quotaPendingIncrement = need;
          }
        } else {
          quotaPendingIncrement = 0;
        }

        const makeRequest = (scenePrompt, modelKey, extra) => {
          const seed = Math.floor(Math.random() * 40000) + 1;
          const finalPrompt = [
            scenePrompt,
            styleSuffix,
            subStyleLabel,
            resSuffix,
            audioSuffix,
          ]
            .filter(Boolean)
            .join(", ");
          return {
            videoModelKey: modelKey,
            textInput: { prompt: finalPrompt },
            aspectRatio: aspect,
            seed,
            ...(extra || {}),
          };
        };
        const requestsStartGlobal = batchMediaId
          ? items.map((it) =>
              makeRequest(it.prompt || "", startImageModelKey, {
                startImage: { mediaId: batchMediaId },
              })
            )
          : [];
        const requestsMixedStart = items
          .filter((it) => String(it.mediaId || "").trim().length)
          .map((it) =>
            makeRequest(it.prompt || "", startImageModelKey, {
              startImage: { mediaId: String(it.mediaId).trim() },
            })
          );
        const requestsTextOnly = items
          .filter(
            (it) => !String(it.mediaId || "").trim().length && !batchMediaId
          )
          .map((it) => makeRequest(it.prompt || "", textOnlyModelKey));
        requests = requestsStartGlobal.length
          ? requestsStartGlobal
          : [...requestsMixedStart, ...requestsTextOnly];

        const clientContext = CONFIG.clientContext || undefined;
        lastRequestAspects = requests.map((r) => r.aspectRatio || aspect);
        const payload = {
          ...(clientContext ? { clientContext } : {}),
          requests,
        };
        try {
          console.info("LabsFlow payload", {
            urlHint: hasStart ? "startImage" : "text",
            aspect,
            requests,
          });
        } catch (_) {}
        const url =
          requestsStartGlobal.length || requestsMixedStart.length
            ? "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoStartImage"
            : CONFIG.defaultGenerateUrl ||
              "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText";
        const method = "POST";
        const headers = CONFIG.defaultHeaders || {};
        const jobResp = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-app-credential": settingsState.appCredential || "",
          },
          body: JSON.stringify({ url, method, headers, payload }),
        });
        const jobJson = await jobResp.json().catch(() => ({}));
        if (!jobResp.ok || !jobJson?.jobId) {
          statusEl.textContent = `Gagal membuat job (${jobResp.status}).`;
          const btn2 = el("quickGenerate");
          if (btn2) btn2.disabled = false;
          const stopBtn2 = el("stopGenerate");
          if (stopBtn2) stopBtn2.disabled = true;
          return;
        }
        const jobId = jobJson.jobId;
        statusEl.textContent = `Job dibuat. Menunggu server...`;
        resetPolling();
        pollState.currentJobId = jobId;
        const stopBtnRef = el("stopGenerate");
        if (stopBtnRef) stopBtnRef.disabled = false;
        const es = new EventSource(`/api/jobs/${jobId}/stream`);
        pollState.stream = es;
        es.addEventListener("queued", () => {
          statusEl.textContent = "Job masuk antrian...";
          const g = el("quickGenerate");
          if (g) g.disabled = true;
          const s = el("stopGenerate");
          if (s) s.disabled = false;
        });
        es.addEventListener("started", () => {
          try {
            if (pollState.backoffTimer) clearInterval(pollState.backoffTimer);
          } catch (_) {}
          pollState.backoffTimer = null;
          statusEl.textContent = "Job mulai diproses di server...";
          const g = el("quickGenerate");
          if (g) g.disabled = true;
          const s = el("stopGenerate");
          if (s) s.disabled = false;
        });
        es.addEventListener("backoff", (ev) => {
          try {
            if (pollState.backoffTimer) clearInterval(pollState.backoffTimer);
          } catch (_) {}
          pollState.backoffTimer = null;
          let payload;
          try {
            payload = JSON.parse(ev.data || "{}");
          } catch {
            payload = {};
          }
          const delayMs = Number(payload?.delayMs) || 30000;
          const untilTs = Number(payload?.untilTs) || Date.now() + delayMs;
          const g = el("quickGenerate");
          if (g) g.disabled = true;
          const s = el("stopGenerate");
          if (s) s.disabled = false;
          const update = () => {
            const remainMs = Math.max(0, untilTs - Date.now());
            const secs = Math.ceil(remainMs / 1000);
            statusEl.textContent = `Menunggu kuota (otomatis retry ${secs}s)... Klik Hentikan untuk batal.`;
            if (remainMs <= 0) {
              try {
                if (pollState.backoffTimer)
                  clearInterval(pollState.backoffTimer);
              } catch (_) {}
              pollState.backoffTimer = null;
            }
          };
          update();
          pollState.backoffTimer = setInterval(update, 1000);
        });
        es.addEventListener("initial", (ev) => {
          try {
            const payload = JSON.parse(ev.data || "{}");
            const data = payload?.data || {};
            lastStatusData = data;
            outputEl.textContent = JSON.stringify(data, null, 2);
            try {
              const ops = (data?.operations || [])
                .map((op, i) => ({ name: op?.operation?.name, index: i }))
                .filter((o) => o.name);
              trackedOps = ops;
            } catch (_) {}
            scheduleRenderMedia(data);
            if (trackedOps?.length) {
              statusEl.textContent = `Generate terkirim (${trackedOps.length} adegan). Server memantau status...`;
            }
          } catch (_) {}
          hideAddSceneOverlay();
        });
        es.addEventListener("polled", (ev) => {
          try {
            const payload = JSON.parse(ev.data || "{}");
            const attempt = payload?.attempt || 0;
            const data = payload?.data || {};
            lastStatusData = data;
            outputEl.textContent = JSON.stringify(data, null, 2);
            scheduleRenderMedia(data);
            const statuses = (data?.operations || []).map(
              (o) => o?.status || "UNKNOWN"
            );
            const composite = statuses.join(", ");
            statusEl.textContent = `Status: ${composite} • Attempt ${attempt}`;
            const g = el("quickGenerate");
            if (g) g.disabled = true;
            const s = el("stopGenerate");
            if (s) s.disabled = false;
          } catch (_) {}
        });
        es.addEventListener("completed", async (ev) => {
          let data = null;
          try {
            if (pollState.backoffTimer) clearInterval(pollState.backoffTimer);
          } catch (_) {}
          pollState.backoffTimer = null;
          try {
            const payloadEv = JSON.parse(ev.data || "{}");
            data = payloadEv?.data || {};
            lastStatusData = data;
            outputEl.textContent = JSON.stringify(data, null, 2);
            scheduleRenderMedia(data);
            statusEl.textContent = "Selesai. Media siap atau telah dirangkum.";
          } catch (_) {}
          try {
            es.close();
          } catch (_) {}
          pollState.stream = null;
          pollState.currentJobId = null;
          try {
            setNavDisabled(false);
          } catch (_) {}
          const btn4 = el("quickGenerate");
          if (btn4) btn4.disabled = false;
          const stop4 = el("stopGenerate");
          if (stop4) stop4.disabled = true;
          pollState.currentJobId = null;
          try {
            window.__isGenerating = false;
          } catch (_) {}
          showAddSceneOverlay();
          const hasVideo = dataHasAtLeastOneVideo(data || lastStatusData);
          if (quotaPendingIncrement > 0 && hasVideo) {
            const q = readQuota("batch");
            writeQuota("batch", q.count + quotaPendingIncrement);
            quotaPendingIncrement = 0;
            updateQuotaUI();
          }
        });
        es.addEventListener("failed", (ev) => {
          try {
            if (pollState.backoffTimer) clearInterval(pollState.backoffTimer);
          } catch (_) {}
          pollState.backoffTimer = null;
          let msg = "Job gagal";
          try {
            const payload = JSON.parse(ev.data || "{}");
            const statusCode = Number(payload?.status);
            if (statusCode === 401) {
              msg = "Bearer kadaluarsa, Minta bearer baru ke admin";
            }
          } catch (_) {}
          statusEl.textContent = msg;
          try {
            es.close();
          } catch (_) {}
          pollState.stream = null;
          try {
            setNavDisabled(false);
          } catch (_) {}
          const btn5 = el("quickGenerate");
          if (btn5) btn5.disabled = false;
          const stop5 = el("stopGenerate");
          if (stop5) stop5.disabled = true;
          pollState.currentJobId = null;
          try {
            window.__isGenerating = false;
          } catch (_) {}
        });
        es.addEventListener("cancelled", () => {
          statusEl.textContent = "Dihentikan oleh pengguna.";
          try {
            es.close();
          } catch (_) {}
          pollState.stream = null;
          const g = el("quickGenerate");
          if (g) g.disabled = false;
          const s = el("stopGenerate");
          if (s) s.disabled = true;
          pollState.currentJobId = null;
          try {
            window.__isGenerating = false;
          } catch (_) {}
          try {
            setNavDisabled(false);
          } catch (_) {}
        });
        return;
      } else if (promptMode === "frame") {
        const fp = (el("framePrompt")?.value || "").trim();
        if (!fp) {
          statusEl.textContent = "Isi prompt untuk Frame → Video.";
          const btn0 = el("quickGenerate");
          if (btn0) btn0.disabled = false;
          const stop0 = el("stopGenerate");
          if (stop0) stop0.disabled = true;
          return;
        }
        const startId = (frameStartImage.mediaId || "").trim();
        const endId = (frameEndImage.mediaId || "").trim();
        if (!startId || !endId) {
          statusEl.textContent = "Isi Media ID untuk kedua frame.";
          const btn0 = el("quickGenerate");
          if (btn0) btn0.disabled = false;
          const stop0 = el("stopGenerate");
          if (stop0) stop0.disabled = true;
          return;
        }
        const finalPrompt = [
          fp,
          styleSuffix,
          subStyleLabel,
          resSuffix,
          audioSuffix,
        ]
          .filter(Boolean)
          .join(", ");
        let modelKey =
          getModelConfig(aspect)?.startImage ||
          fallbackModelConfig.startImage ||
          videoModelKey;
        const plan = getPlan();
        const paid = isPaidPlan(plan);
        const isAdmin = isAdminPlan(plan);
        const isFastFrame = isVeoFastModelKey(modelKey);
        const isUnlimited = isUnlimitedModelKey(modelKey);
        if (paid && isFastFrame && !isAdmin && !isUnlimited) {
          const q = readQuota("frame");
          const limit = quotaLimitForMode("frame");
          if (q.count + 1 > limit) {
            const relaxed = relaxedModelForAspect(aspect);
            if (relaxed) {
              try {
                const sel = el("settingModelKey");
                if (sel) sel.value = relaxed;
              } catch (_) {}
              // Override modelKey to relaxed
              const oldKey = modelKey;
              modelKey = relaxed;
              statusEl.textContent =
                "Kuota frame habis, dialihkan ke Ultra Relaxed.";
              quotaPendingIncrement = 0;
            } else {
              statusEl.textContent = `Kuota harian habis, ganti ke model yang lain.`;
              const btn0f = el("quickGenerate");
              if (btn0f) btn0f.disabled = false;
              const stop0f = el("stopGenerate");
              if (stop0f) stop0f.disabled = true;
              return;
            }
          } else {
            quotaPendingIncrement = 1;
          }
        } else {
          quotaPendingIncrement = 0;
        }
        const seed = Math.floor(Math.random() * 40000) + 1;
        requests = [
          {
            videoModelKey: modelKey,
            textInput: { prompt: finalPrompt },
            aspectRatio: aspect,
            seed,
            startImage: { mediaId: startId },
            endImage: { mediaId: endId },
            metadata: { sceneId: `frame-${Date.now().toString(16)}` },
          },
        ];
      } else {
        const sp = (el("singlePrompt")?.value || "").trim();
        const seed = Math.floor(Math.random() * 40000) + 1;
        const finalPrompt = [
          sp,
          styleSuffix,
          subStyleLabel,
          resSuffix,
          audioSuffix,
        ]
          .filter(Boolean)
          .join(", ");
        const baseRequest = {
          videoModelKey,
          textInput: { prompt: finalPrompt },
          aspectRatio: aspect,
          seed,
        };
        if (useSingleStartImage) {
          baseRequest.startImage = { mediaId: singleMediaId };
        }
        // Default: gunakan request sesuai pilihan model saat ini
        requests = [baseRequest];
        const plan = getPlan();
        const paid = isPaidPlan(plan);
        const isAdmin = isAdminPlan(plan);
        const effectiveKey = useSingleStartImage
          ? startImageModelKey
          : videoModelKey;
        const isFastSingle = isVeoFastModelKey(effectiveKey);
        const isUnlimited = isUnlimitedModelKey(effectiveKey);
        if (paid && isFastSingle && !isAdmin && !isUnlimited) {
          const q = readQuota("single");
          const limit = quotaLimitForMode("single");
          if (q.count + 1 > limit) {
            const relaxed = relaxedModelForAspect(aspect);
            if (relaxed) {
              try {
                const sel = el("settingModelKey");
                if (sel) sel.value = relaxed;
              } catch (_) {}
              const oldKey = effectiveKey;
              const newKey = relaxed;
              const basePrompt = finalPrompt;
              const newBase = {
                videoModelKey: newKey,
                textInput: { prompt: basePrompt },
                aspectRatio: aspect,
                seed,
              };
              if (useSingleStartImage)
                newBase.startImage = { mediaId: singleMediaId };
              // Jika kuota habis, alihkan ke Ultra Relaxed dan jangan hitung kuota Fast
              requests = [newBase];
              statusEl.textContent = "Kuota habis, dialihkan ke Ultra Relaxed.";
              quotaPendingIncrement = 0;
            } else {
              statusEl.textContent = `Kuota harian habis, ganti ke model yang lain.`;
              const btn1s = el("quickGenerate");
              if (btn1s) btn1s.disabled = false;
              const stop1s = el("stopGenerate");
              if (stop1s) stop1s.disabled = true;
              return;
            }
          } else {
            quotaPendingIncrement = 1;
          }
        } else {
          quotaPendingIncrement = 0;
        }
      }
      // Gunakan clientContext dari server dan tambahkan sessionId dinamis
      const clientContext = CONFIG.clientContext || undefined;
      lastRequestAspects = requests.map((r) => r.aspectRatio || aspect);
      const ccPayload = clientContext
        ? {
            clientContext: {
              ...clientContext,
              sessionId: `${String(
                clientContext.sessionId || ""
              )};${Date.now()}`,
            },
          }
        : {};
      const payload = { ...ccPayload, requests };
      try {
        console.info("LabsFlow payload", {
          urlHint: useStartImage ? "startImage" : "text",
          videoModelKey,
          aspect,
          singleStartImage: useSingleStartImage ? singleMediaId : undefined,
          singleImageAspect: useSingleStartImage
            ? singleImage.imageAspect
            : undefined,
          requests,
        });
      } catch (_) {}
      const useFrameEndpoint = promptMode === "frame";
      const url = useFrameEndpoint
        ? "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoStartAndEndImage"
        : useStartImage
        ? "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoStartImage"
        : CONFIG.defaultGenerateUrl ||
          "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText";
      const method = "POST";
      const headers = CONFIG.defaultHeaders || {};
      // Kirim ke backend job queue (SSE akan push status & hasil)
      const jobResp = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-credential": settingsState.appCredential || "",
        },
        body: JSON.stringify({ url, method, headers, payload }),
      });
      const jobJson = await jobResp.json().catch(() => ({}));
      if (!jobResp.ok || !jobJson?.jobId) {
        statusEl.textContent = `Gagal membuat job (${jobResp.status}).`;
        if (btn) btn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        return;
      }
      const jobId = jobJson.jobId;
      statusEl.textContent = `Job dibuat. Menunggu server...`;
      resetPolling();
      pollState.currentJobId = jobId;
      if (stopBtn) stopBtn.disabled = false; // segera aktifkan Hentikan
      const es = new EventSource(`/api/jobs/${jobId}/stream`);
      pollState.stream = es;
      es.addEventListener("queued", () => {
        statusEl.textContent = "Job masuk antrian...";
        const g = el("quickGenerate");
        if (g) g.disabled = true;
        const s = el("stopGenerate");
        if (s) s.disabled = false;
      });
      es.addEventListener("started", () => {
        try {
          if (pollState.backoffTimer) clearInterval(pollState.backoffTimer);
        } catch (_) {}
        pollState.backoffTimer = null;
        statusEl.textContent = "Job mulai diproses di server...";
        const g = el("quickGenerate");
        if (g) g.disabled = true;
        const s = el("stopGenerate");
        if (s) s.disabled = false;
      });
      es.addEventListener("backoff", (ev) => {
        try {
          if (pollState.backoffTimer) clearInterval(pollState.backoffTimer);
        } catch (_) {}
        pollState.backoffTimer = null;
        let payload;
        try {
          payload = JSON.parse(ev.data || "{}");
        } catch {
          payload = {};
        }
        const delayMs = Number(payload?.delayMs) || 30000;
        const untilTs = Number(payload?.untilTs) || Date.now() + delayMs;
        const g = el("quickGenerate");
        if (g) g.disabled = true;
        const s = el("stopGenerate");
        if (s) s.disabled = false;
        const update = () => {
          const remainMs = Math.max(0, untilTs - Date.now());
          const secs = Math.ceil(remainMs / 1000);
          statusEl.textContent = `Menunggu kuota (otomatis retry ${secs}s)... Klik Hentikan untuk batal.`;
          if (remainMs <= 0) {
            try {
              if (pollState.backoffTimer) clearInterval(pollState.backoffTimer);
            } catch (_) {}
            pollState.backoffTimer = null;
          }
        };
        update();
        pollState.backoffTimer = setInterval(update, 1000);
      });
      es.addEventListener("initial", (ev) => {
        try {
          const payload = JSON.parse(ev.data || "{}");
          const data = payload?.data || {};
          lastStatusData = data;
          outputEl.textContent = JSON.stringify(data, null, 2);
          try {
            const ops = (data?.operations || [])
              .map((op, i) => ({ name: op?.operation?.name, index: i }))
              .filter((o) => o.name);
            trackedOps = ops;
          } catch (_) {}
          scheduleRenderMedia(data);
          if (trackedOps?.length) {
            statusEl.textContent = `Generate terkirim (${trackedOps.length} adegan). Server memantau status...`;
          }
        } catch (_) {}
        hideAddSceneOverlay();
      });
      es.addEventListener("polled", (ev) => {
        try {
          const payload = JSON.parse(ev.data || "{}");
          const attempt = payload?.attempt || 0;
          const data = payload?.data || {};
          lastStatusData = data;
          outputEl.textContent = JSON.stringify(data, null, 2);
          scheduleRenderMedia(data);
          const statuses = (data?.operations || []).map(
            (o) => o?.status || "UNKNOWN"
          );
          const composite = statuses.join(", ");
          statusEl.textContent = `Status: ${composite} • Attempt ${attempt}`;
          const g = el("quickGenerate");
          if (g) g.disabled = true;
          const s = el("stopGenerate");
          if (s) s.disabled = false;
        } catch (_) {}
      });
      es.addEventListener("completed", (ev) => {
        let data = null;
        try {
          if (pollState.backoffTimer) clearInterval(pollState.backoffTimer);
        } catch (_) {}
        pollState.backoffTimer = null;
        try {
          const payload = JSON.parse(ev.data || "{}");
          data = payload?.data || {};
          lastStatusData = data;
          outputEl.textContent = JSON.stringify(data, null, 2);
          scheduleRenderMedia(data);
          statusEl.textContent = "Selesai. Media siap atau telah dirangkum.";
        } catch (_) {}
        try {
          es.close();
        } catch (_) {}
        pollState.stream = null;
        if (btn) btn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        pollState.currentJobId = null;
        try {
          window.__isGenerating = false;
        } catch (_) {}
        try {
          const ids = [
            "modeSingleBtn",
            "modeBatchBtn",
            "modeDirectorBtn",
            "galleryButton",
          ];
          ids.forEach((id) => {
            const n = el(id);
            if (!n) return;
            n.classList.remove("disabled");
            n.setAttribute("aria-disabled", "false");
            n.removeEventListener("click", preventNav, true);
          });
        } catch (_) {}
        showAddSceneOverlay();
        const hasVideo = dataHasAtLeastOneVideo(data || lastStatusData);
        if (quotaPendingIncrement > 0 && hasVideo) {
          const mode = quotaKeyForMode(promptMode);
          const q = readQuota(mode);
          writeQuota(mode, q.count + quotaPendingIncrement);
          quotaPendingIncrement = 0;
          updateQuotaUI();
        }
      });
      es.addEventListener("failed", (ev) => {
        try {
          if (pollState.backoffTimer) clearInterval(pollState.backoffTimer);
        } catch (_) {}
        pollState.backoffTimer = null;
        let msg = "Job gagal";
        try {
          const payload = JSON.parse(ev.data || "{}");
          const statusCode = Number(payload?.status);
          if (statusCode === 401) {
            msg = "Bearer kadaluarsa, Minta bearer baru ke admin";
          } else {
            const errVal = payload?.error;
            let printable = "unknown";
            if (typeof errVal === "string") {
              printable = errVal;
            } else if (errVal && typeof errVal === "object") {
              printable =
                errVal.message ||
                errVal.error ||
                errVal.detail ||
                (() => {
                  try {
                    return JSON.stringify(errVal);
                  } catch {
                    return String(errVal);
                  }
                })();
            } else if (errVal != null) {
              printable = String(errVal);
            }
            msg = `Job gagal: ${printable}`;
          }
        } catch (_) {}
        statusEl.textContent = msg;
        try {
          es.close();
        } catch (_) {}
        pollState.stream = null;
        if (btn) btn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        pollState.currentJobId = null;
        try {
          window.__isGenerating = false;
        } catch (_) {}
        try {
          const ids = [
            "modeSingleBtn",
            "modeBatchBtn",
            "modeDirectorBtn",
            "galleryButton",
          ];
          ids.forEach((id) => {
            const n = el(id);
            if (!n) return;
            n.classList.remove("disabled");
            n.setAttribute("aria-disabled", "false");
            n.removeEventListener("click", preventNav, true);
          });
        } catch (_) {}
      });
      es.addEventListener("cancelled", (ev) => {
        try {
          if (pollState.backoffTimer) clearInterval(pollState.backoffTimer);
        } catch (_) {}
        pollState.backoffTimer = null;
        statusEl.textContent = "Dihentikan oleh pengguna.";
        try {
          es.close();
        } catch (_) {}
        pollState.stream = null;
        const g = el("quickGenerate");
        if (g) g.disabled = false;
        const s = el("stopGenerate");
        if (s) s.disabled = true;
        pollState.currentJobId = null;
        try {
          window.__isGenerating = false;
        } catch (_) {}
        try {
          const ids = [
            "modeSingleBtn",
            "modeBatchBtn",
            "modeDirectorBtn",
            "galleryButton",
          ];
          ids.forEach((id) => {
            const n = el(id);
            if (!n) return;
            n.classList.remove("disabled");
            n.setAttribute("aria-disabled", "false");
            n.removeEventListener("click", preventNav, true);
          });
        } catch (_) {}
      });
    } catch (e) {
      statusEl.textContent = "Gagal quick generate";
      outputEl.textContent = String(e);
      const btn = el("quickGenerate");
      if (btn) btn.disabled = false;
      const stopBtn = el("stopGenerate");
      if (stopBtn) stopBtn.disabled = true;
    }
  });

  // Tombol Hentikan: batalkan job yang sedang berjalan
  const stopBtnInit = el("stopGenerate");
  if (stopBtnInit) {
    stopBtnInit.addEventListener("click", async () => {
      const stopBtn = el("stopGenerate");
      const genBtn = el("quickGenerate");
      const jobId = pollState.currentJobId;
      if (!jobId) {
        statusEl.textContent = "Tidak ada job yang berjalan.";
        return;
      }
      try {
        statusEl.textContent = "Menghentikan job...";
        if (stopBtn) stopBtn.disabled = true; // prevent double-click
        if (genBtn) genBtn.disabled = true; // tetap nonaktif saat proses stop
        const r = await fetch(`/api/jobs/${jobId}/cancel`, { method: "POST" });
        if (!r.ok) {
          statusEl.textContent = `Gagal menghentikan (status ${r.status}).`;
          if (stopBtn) stopBtn.disabled = false; // allow retry
          return;
        }
        // Tunggu event 'cancelled' dari SSE untuk menutup stream dan mengaktifkan Generate
      } catch (err) {
        statusEl.textContent = "Terjadi kesalahan saat menghentikan.";
        if (stopBtn) stopBtn.disabled = false;
      }
    });
  }

  // Hapus tombol isi payload status; gunakan Auto Poll saja

  // Auto poll status setiap 3 detik, maksimal 10000 kali
  const startAutoPoll = async (initialDelayMs = 10000) => {
    if (!trackedOps || !trackedOps.length) {
      statusEl.textContent =
        "Belum ada operasi terdeteksi. Jalankan generate dulu.";
      return;
    }
    // cancel any previous timers and start a new polling session
    resetPolling();
    const localSession = ++pollState.sessionId;
    const url =
      CONFIG.defaultCheckUrl ||
      "https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus";
    const headers = {};
    const method = "POST";
    let attempts = 0;
    statusEl.textContent = `Auto poll dimulai dalam ${Math.round(
      initialDelayMs / 1000
    )}s untuk ${trackedOps.length} adegan...`;
    const runOnce = async () => {
      if (pollState.sessionId !== localSession) return; // cancelled or superseded
      attempts++;
      const payload = {
        operations: trackedOps.map((t) => ({ operation: { name: t.name } })),
      };
      const resp = await fetch("/api/labsflow/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-credential": settingsState.appCredential || "",
        },
        body: JSON.stringify({ url, method, headers, payload }),
      });
      const ct = resp.headers.get("content-type") || "";
      let data;
      if (ct.includes("application/json")) {
        data = await resp.json();
        outputEl.textContent = JSON.stringify(data, null, 2);
        renderMediaFromData(data);
      } else {
        outputEl.textContent = await resp.text();
        data = {};
        renderMediaFromData({ text: outputEl.textContent });
      }
      const statuses = (data?.operations || []).map(
        (o) => o?.status || "UNKNOWN"
      );
      const composite = statuses.join(", ");
      if (resp.status === 401) {
        statusEl.textContent = "Bearer kadaluarsa, Minta bearer baru ke admin";
      } else {
        statusEl.textContent = `Status: ${resp.status} • Media: ${composite} • Attempt ${attempts}`;
      }
      if (pollState.sessionId !== localSession) return; // stop scheduling if new session started
      const somePending = statuses.some((s) =>
        /PENDING|IN_PROGRESS|ACTIVE/i.test(s)
      );
      if (somePending && attempts < 10000) {
        pollState.loopTimer = setTimeout(runOnce, 3000);
      }
    };
    pollState.initialTimer = setTimeout(runOnce, initialDelayMs);
  };
  // ==== Adegan (multi-scene) UI ====
  const newSceneId = (i) => `scene-${i + 1}-${Date.now().toString(16)}`;
  const addScene = (preset = {}) => {
    const i = scenes.length;
    const basePrompt =
      typeof preset.prompt === "string"
        ? preset.prompt
        : scenes.length
        ? scenes[scenes.length - 1]?.prompt || ""
        : "";
    scenes.push({
      id: newSceneId(i),
      prompt: basePrompt,
      linkPrev: i > 0,
      characters: [],
      dialogues: {},
      dialogOrder: {},
    });
    renderScenes();
  };
  const removeScene = (index) => {
    if (index <= 0) return; // Adegan 1 tidak dihapus untuk kesederhanaan
    scenes.splice(index, 1);
    // Reassign IDs to keep order meaningful
    scenes = scenes.map((s, i) => ({ ...s, id: newSceneId(i) }));
    renderScenes();
  };
  const renderScenes = () => {
    const html = scenes
      .map((s, i) => {
        const delBtn =
          i > 0
            ? `<button data-del="${i}" title="Hapus adegan" style="background:#111827; color:#e5e7eb; border:1px solid #1f2937; padding:4px 8px; border-radius:6px;">🗑</button>`
            : "";
        const rightControls =
          i > 0
            ? `<div style="display:flex; align-items:center; gap:8px;">
                <span>Gunakan adegan sebelumnya</span>
                <label class="toggle">
                  <input type="checkbox" data-linkprev="${i}" ${
                s.linkPrev ? "checked" : ""
              } />
                  <span class="slider"></span>
                </label>
              </div>`
            : '<span style="color:#6b7280;">&nbsp;</span>';
        const assignBlock = characters.length
          ? `<div style="margin-top:8px;">
                  <div style="font-size:12px; color:#9ca3af; margin-bottom:6px;">Tugaskan Karakter</div>
                  <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                    ${characters
                      .map((c) => {
                        const checked = (s.characters || []).includes(c.id)
                          ? "checked"
                          : "";
                        const label =
                          c.name && c.name.trim().length ? c.name.trim() : c.id;
                        return `<label style="display:flex; align-items:center; gap:6px; font-size:12px;">
                        <input type="checkbox" data-scene-char="${i}" data-charid="${c.id}" ${checked} />
                        <span>Character ${label}</span>
                      </label>`;
                      })
                      .join("")}
                  </div>
                </div>`
          : `<div style="margin-top:8px; font-size:12px; color:#6b7280;">Belum ada karakter. Tambah karakter untuk ditugaskan.</div>`;
        const sceneCharIds = Array.isArray(s.characters) ? s.characters : [];
        const sceneChars = characters.filter((c) =>
          sceneCharIds.includes(c.id)
        );
        const dialogBlock = sceneChars.length
          ? `<div style="margin-top:8px;">
                  <div style="font-size:12px; color:#9ca3af; margin-bottom:6px;">Character Dialogue</div>
                  ${sceneChars
                    .map((c) => {
                      const label =
                        c.name && c.name.trim().length ? c.name.trim() : c.id;
                      const val = (s.dialogues || {})[c.id] || "";
                      const orderVal = (s.dialogOrder || {})[c.id];
                      return `<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
                      <span style="font-size:12px; color:#9ca3af; min-width:160px;">Character ${label}:</span>
                      <input type="text" data-scene-dialog="${i}" data-charid="${
                        c.id
                      }" placeholder="Dialogue..." value="${val.replace(
                        /"/g,
                        "&quot;"
                      )}" style="flex:1; background:#0b1020; color:#e5e7eb; border:1px solid #374151; border-radius:8px; padding:6px 8px;" />
                      <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size:12px; color:#9ca3af;">Urutan</span>
                        <input type="number" min="1" step="1" data-scene-order="${i}" data-charid="${
                        c.id
                      }" value="${
                        Number.isFinite(orderVal) ? orderVal : ""
                      }" placeholder="1" style="width:80px; background:#0b1020; color:#e5e7eb; border:1px solid #374151; border-radius:8px; padding:6px 8px;" />
                      </div>
                    </div>`;
                    })
                    .join("")}
                </div>`
          : "";
        return `<div class="scene-card">
              <div class="scene-header">
                <div>Adegan ${i + 1}</div>
                ${delBtn}
              </div>
              <textarea class="scene-textarea" data-prompt="${i}" placeholder="Deskripsikan adegan...">${
          s.prompt || ""
        }</textarea>
              <div class="row-meta">
                ${rightControls}
              </div>
              ${assignBlock}
              ${dialogBlock}
            </div>`;
      })
      .join("");
    el("scenesContainer").innerHTML =
      html || "<em>Belum ada adegan. Tambahkan setidaknya satu.</em>";
    // Wire events
    el("scenesContainer")
      .querySelectorAll("textarea[data-prompt]")
      .forEach((ta) => {
        ta.addEventListener("input", (ev) => {
          const idx = parseInt(ev.target.getAttribute("data-prompt"), 10);
          scenes[idx].prompt = ev.target.value;
        });
      });
    el("scenesContainer")
      .querySelectorAll("input[data-linkprev]")
      .forEach((cb) => {
        cb.addEventListener("change", (ev) => {
          const idx = parseInt(ev.target.getAttribute("data-linkprev"), 10);
          scenes[idx].linkPrev = !!ev.target.checked;
        });
      });
    // Wire assignment checkbox per adegan
    el("scenesContainer")
      .querySelectorAll("input[data-scene-char]")
      .forEach((cb) => {
        cb.addEventListener("change", (ev) => {
          const sIdx = parseInt(ev.target.getAttribute("data-scene-char"), 10);
          const charId = ev.target.getAttribute("data-charid");
          const list = Array.isArray(scenes[sIdx].characters)
            ? scenes[sIdx].characters
            : [];
          if (ev.target.checked) {
            if (!list.includes(charId)) list.push(charId);
            // inisialisasi dialog kosong jika belum ada
            scenes[sIdx].dialogues = scenes[sIdx].dialogues || {};
            if (
              !Object.prototype.hasOwnProperty.call(
                scenes[sIdx].dialogues,
                charId
              )
            )
              scenes[sIdx].dialogues[charId] = "";
            // set urutan default di akhir
            scenes[sIdx].dialogOrder = scenes[sIdx].dialogOrder || {};
            const existingOrders = Object.values(
              scenes[sIdx].dialogOrder
            ).filter((n) => Number.isFinite(n));
            const next = existingOrders.length
              ? Math.max(...existingOrders) + 1
              : 1;
            if (
              !Object.prototype.hasOwnProperty.call(
                scenes[sIdx].dialogOrder,
                charId
              )
            )
              scenes[sIdx].dialogOrder[charId] = next;
          } else {
            scenes[sIdx].characters = list.filter((id) => id !== charId);
            // hapus dialog jika tidak lagi ditugaskan
            if (
              scenes[sIdx].dialogues &&
              Object.prototype.hasOwnProperty.call(
                scenes[sIdx].dialogues,
                charId
              )
            ) {
              const { [charId]: _omit, ...rest } = scenes[sIdx].dialogues;
              scenes[sIdx].dialogues = rest;
            }
            // hapus urutan dialog jika tidak lagi ditugaskan
            if (
              scenes[sIdx].dialogOrder &&
              Object.prototype.hasOwnProperty.call(
                scenes[sIdx].dialogOrder,
                charId
              )
            ) {
              const { [charId]: _omitOrder, ...restOrder } =
                scenes[sIdx].dialogOrder;
              scenes[sIdx].dialogOrder = restOrder;
            }
          }
          // re-render agar blok dialog muncul/hilang sesuai pilihan
          renderScenes();
        });
      });
    // Wire input urutan dialog
    el("scenesContainer")
      .querySelectorAll("input[data-scene-order]")
      .forEach((inp) => {
        inp.addEventListener("input", (ev) => {
          const sIdx = parseInt(ev.target.getAttribute("data-scene-order"), 10);
          const charId = ev.target.getAttribute("data-charid");
          const val = parseInt(ev.target.value, 10);
          scenes[sIdx].dialogOrder = scenes[sIdx].dialogOrder || {};
          if (Number.isFinite(val) && val > 0) {
            scenes[sIdx].dialogOrder[charId] = val;
          } else {
            // jika kosong/tidak valid, hapus saja untuk fallback
            if (
              Object.prototype.hasOwnProperty.call(
                scenes[sIdx].dialogOrder,
                charId
              )
            ) {
              const { [charId]: _omit, ...rest } = scenes[sIdx].dialogOrder;
              scenes[sIdx].dialogOrder = rest;
            }
          }
        });
      });
    // Wire input dialog per karakter per adegan
    el("scenesContainer")
      .querySelectorAll("input[data-scene-dialog]")
      .forEach((inp) => {
        inp.addEventListener("input", (ev) => {
          const sIdx = parseInt(
            ev.target.getAttribute("data-scene-dialog"),
            10
          );
          const charId = ev.target.getAttribute("data-charid");
          scenes[sIdx].dialogues = scenes[sIdx].dialogues || {};
          scenes[sIdx].dialogues[charId] = ev.target.value;
        });
      });
    el("scenesContainer")
      .querySelectorAll("button[data-del]")
      .forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          const idx = parseInt(ev.target.getAttribute("data-del"), 10);
          removeScene(idx);
        });
      });
  };
  setupUserMenu();
  setupLogoutModal();
  setupSettingsModal();
  setupQuotaModal();
  try {
    setAppLocked(false);
  } catch (_) {}
  // Muat pengaturan dari server dan perbarui status lock setelah respons
  try {
    ensureSettingsLoaded();
  } catch (_) {}
  try {
    // Expose opener for Settings modal so Next pages can trigger it via query.
    window.__legacyOpenSettings = openSettingsModal;
  } catch (_) {}
  setupCollapsibles();
  // Init state prompt tunggal
  renderSingleImage();
  setupSingleImageEvents();
  renderBatchImage();
  setupBatchImageEvents();
  renderFrameStartImage();
  renderFrameEndImage();
  setupFrameImageEvents();
  // Init adegan default satu
  addScene();
  // Pasang event cropper sekali
  attachCropperEvents();
  el("addSceneBtn").addEventListener("click", () => addScene());
  setPromptMode(promptMode);
  setupVisualStyleSelectors();
  updateModelBadge();

  try {
    const sel = el("settingVoiceLang");
    const inp = el("settingVoiceCustom");
    const update = () => {
      const v = sel?.value || "";
      if (inp) inp.style.display = v === "__custom__" ? "" : "none";
    };
    if (sel) {
      sel.addEventListener("change", update);
      update();
    }
  } catch (_) {}
}
// (moved: quota modal helpers are defined earlier inside the main app scope)
