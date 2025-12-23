import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";

const VideoClient = dynamic(() => import("./VideoClient"), {
  ssr: false,
  loading: () => (
    <Image
      src="/images/fokusAI.png"
      alt="Preview"
      width={640}
      height={360}
      className="hero-preview-video"
    />
  ),
});

export const metadata = {
  title: "FokusAI Studio",
  description: "Landing untuk generator video, gambar, musik, dan galeri.",
};

export default function LandingPage() {
  return (
    <div className="app-shell landing-mode">
      <nav className="navbar">
        <div className="nav-left">
          <label
            htmlFor="main-nav-toggle"
            className="nav-menu-toggle"
            aria-label="Menu utama"
          >
            <span />
            <span />
            <span />
          </label>
          <div className="brand-logo-wrap">
            <Image
              src="/images/fokusAI.png"
              alt="FokusAI"
              width={40}
              height={40}
              className="brand-logo-small"
              priority
            />
          </div>
          <span className="brand-title">FokusAI Studio</span>
        </div>
        <input
          type="checkbox"
          id="main-nav-toggle"
          className="nav-toggle"
          aria-hidden="true"
        />
        <div className="nav-center nav-center-scroll">
          <a href="#fitur" className="nav-link">
            Fitur
          </a>
          <a href="#showcase" className="nav-link">
            Video
          </a>
          <a href="#pricing" className="nav-link">
            Pricing
          </a>
        </div>
        <div className="nav-right">
          <Link href="/login" className="btn ghost">
            Masuk
          </Link>
          <Link href="/register" className="btn primary">
            Daftar
          </Link>
        </div>
      </nav>

      <section className="landing-gold-hero">
        <div className="hero-circuit-bg" />
        <div className="hero-video-overlay" />
        <div className="landing-gold-bg" />
        <div className="landing-gold-stars" />
        <div className="landing-gold-wrap">
          <div className="landing-gold-text">
            <span className="hero-badge">FokusAI Generator Video</span>
            <h1 className="hero-title">
              <span className="hero-brand">FokusAI</span>{" "}
              <span className="hero-title-rest">Generator Video</span>
            </h1>
            <p className="hero-sub">
              Ciptakan Video Menakjubkan dengan AI dalam Hitungan Detik.
            </p>
            <div className="hero-cta">
              <Link href="/prompt-tunggal" className="btn gold">
                Coba Sekarang
              </Link>
            </div>
            <a href="#fitur" className="hero-learn">
              Pelajari Lebih Lanjut
            </a>
          </div>
          <div className="landing-gold-visual">
            <div className="hero-preview">
              <VideoClient
                className="hero-preview-video"
                src="/video/landingpage.mp4"
                autoPlay
                loop
                muted
                poster="/images/fokusAI.png"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="fitur" className="features-section">
        <div className="features-grid">
          <a className="feature-card" href="/prompt-tunggal">
            <div className="feature-title">Mode Prompt Fleksibel</div>
            <div className="feature-sub">
              Single, batch, dan frame start/end.
            </div>
          </a>
          <a className="feature-card" href="/image-generator">
            <div className="feature-title">Gambar Awal & Referensi</div>
            <div className="feature-sub">
              Gunakan gambar awal, referensi, dan crop.
            </div>
          </a>
          <a className="feature-card" href="/prompt-tunggal?openSettings=1">
            <div className="feature-title">
              Pengaturan Lanjutan & Resolusi Tinggi
            </div>
            <div className="feature-sub">
              Kontrol model, aspek, durasi, dan kualitas.
            </div>
          </a>
        </div>
      </section>

      <section className="features-pro">
        <h2 className="features-pro-title">
          Powerful Features for{" "}
          <span className="features-pro-accent">Everyone</span>
        </h2>
        <p className="features-pro-sub">
          Everything you need to create professional AI videos without any
          technical skills
        </p>
        <div className="features-pro-grid">
          <div className="feature-pro-card">
            <div className="feature-pro-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient
                    id="grad-lightning"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#ffd700" />
                    <stop offset="100%" stopColor="#a8ff7a" />
                  </linearGradient>
                </defs>
                <path
                  d="M13 2 5 14h6l-2 8 10-14h-6l2-6z"
                  fill="none"
                  stroke="url(#grad-lightning)"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="feature-pro-name">Lightning Fast</div>
            <div className="feature-pro-desc">
              Generate professional videos in seconds with our AI-powered engine
            </div>
          </div>
          <div className="feature-pro-card">
            <div className="feature-pro-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="grad-target" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#a8ff7a" />
                    <stop offset="100%" stopColor="#7cff4d" />
                  </linearGradient>
                </defs>
                <circle
                  cx="12"
                  cy="12"
                  r="8"
                  fill="none"
                  stroke="url(#grad-target)"
                  strokeWidth="1.6"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="4"
                  fill="none"
                  stroke="url(#grad-target)"
                  strokeWidth="1.6"
                />
                <path
                  d="M12 2v3M12 19v3M2 12h3M19 12h3"
                  stroke="url(#grad-target)"
                  strokeWidth="1.4"
                />
              </svg>
            </div>
            <div className="feature-pro-name">Easy to Use</div>
            <div className="feature-pro-desc">
              No video editing experience needed. Just describe your vision
            </div>
          </div>
          <div className="feature-pro-card">
            <div className="feature-pro-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="grad-palette" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffd700" />
                    <stop offset="100%" stopColor="#ffef9a" />
                  </linearGradient>
                </defs>
                <path
                  d="M12 3c5 0 9 3.5 9 7.5 0 2-1.6 2.5-3 2.5h-2a2 2 0 0 0-2 2v2c0 .8-.7 1.5-1.5 1.5C7 18.5 3 15 3 10.5 3 6.5 7 3 12 3z"
                  fill="none"
                  stroke="url(#grad-palette)"
                  strokeWidth="1.6"
                />
                <circle cx="8" cy="9" r="1.2" fill="#ffd700" />
                <circle cx="11" cy="7" r="1.2" fill="#a8ff7a" />
                <circle cx="14" cy="9" r="1.2" fill="#7ae0ff" />
              </svg>
            </div>
            <div className="feature-pro-name">Multiple Styles</div>
            <div className="feature-pro-desc">
              Choose from Cinematic, Anime, Cyberpunk, and more visual styles
            </div>
          </div>
          <div className="feature-pro-card">
            <div className="feature-pro-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="grad-clap" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffd700" />
                    <stop offset="100%" stopColor="#a8ff7a" />
                  </linearGradient>
                </defs>
                <rect
                  x="3"
                  y="8"
                  width="18"
                  height="12"
                  rx="2"
                  fill="none"
                  stroke="url(#grad-clap)"
                  strokeWidth="1.6"
                />
                <path
                  d="M3 8l4-4 4 4 4-4 4 4"
                  stroke="url(#grad-clap)"
                  strokeWidth="1.6"
                  fill="none"
                />
              </svg>
            </div>
            <div className="feature-pro-name">Multi‑Scene Support</div>
            <div className="feature-pro-desc">
              Create complex videos with multiple scenes and transitions
            </div>
          </div>
          <div className="feature-pro-card">
            <div className="feature-pro-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="grad-audio" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#a8ff7a" />
                    <stop offset="100%" stopColor="#7cff4d" />
                  </linearGradient>
                </defs>
                <rect
                  x="8"
                  y="3"
                  width="8"
                  height="10"
                  rx="4"
                  fill="none"
                  stroke="url(#grad-audio)"
                  strokeWidth="1.6"
                />
                <path
                  d="M12 13v4M7 12c0 3 2.5 5 5 5s5-2 5-5"
                  fill="none"
                  stroke="url(#grad-audio)"
                  strokeWidth="1.6"
                />
              </svg>
            </div>
            <div className="feature-pro-name">Audio Support</div>
            <div className="feature-pro-desc">
              Add voice narration with character voices in multiple languages
            </div>
          </div>
          <div className="feature-pro-card">
            <div className="feature-pro-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="grad-format" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffd700" />
                    <stop offset="100%" stopColor="#a8ff7a" />
                  </linearGradient>
                </defs>
                <rect
                  x="4"
                  y="6"
                  width="16"
                  height="12"
                  rx="2"
                  fill="none"
                  stroke="url(#grad-format)"
                  strokeWidth="1.6"
                />
                <path
                  d="M9 12h6M7 10v4M17 10v4"
                  stroke="url(#grad-format)"
                  strokeWidth="1.6"
                />
              </svg>
            </div>
            <div className="feature-pro-name">Any Format</div>
            <div className="feature-pro-desc">
              Export in 16:9 or 9:16 aspect ratio with up to 1080p resolution
            </div>
          </div>
        </div>
      </section>

      <section className="how-it-works-section">
        <h2 className="section-title center">Cara Kerja Ajaib</h2>
        <p className="section-subtitle center">
          Ubah ide menjadi video hanya dalam 3 langkah mudah
        </p>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">01</div>
            <div className="step-content">
              <h3>Tulis Ide Anda</h3>
              <p>
                Deskripsikan video yang ingin Anda buat dengan teks detail, atau
                mulai dengan mengunggah gambar referensi.
              </p>
            </div>
          </div>
          <div className="step-connector"></div>
          <div className="step-card">
            <div className="step-number">02</div>
            <div className="step-content">
              <h3>Kustomisasi</h3>
              <p>
                Pilih gaya visual (Cinematic, Anime, 3D), atur durasi, dan
                tentukan aspek rasio sesuai kebutuhan platform Anda.
              </p>
            </div>
          </div>
          <div className="step-connector"></div>
          <div className="step-card">
            <div className="step-number">03</div>
            <div className="step-content">
              <h3>Generate</h3>
              <p>
                Saksikan keajaiban AI bekerja. Dalam hitungan detik, video
                profesional Anda siap diunduh dan dibagikan.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="showcase" className="showcase-section">
        <h2 className="section-title center">Showcase Hasil Karya</h2>
        <p className="section-subtitle center">
          Lihat apa yang bisa dibuat dengan FokusAI
        </p>
        <div className="showcase-container">
          <div className="showcase-grid">
            <div className="showcase-item">
              <h3 className="showcase-item-title">Veo 3.1</h3>
              <div className="showcase-frame">
                <VideoClient
                  className="showcase-video"
                  src="/video/13.mp4"
                  controls
                  playsInline
                  poster="/images/fokusAI.png"
                />
              </div>
            </div>
            <div className="showcase-item">
              <h3 className="showcase-item-title">Sora 2</h3>
              <div className="showcase-frame">
                <VideoClient
                  className="showcase-video"
                  src="/video/sora2.mp4"
                  controls
                  playsInline
                  poster="/images/fokusAI.png"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="faq-section">
        <h2 className="section-title center">Pertanyaan Umum</h2>
        <div className="faq-grid">
          <div className="faq-item">
            <h3>Apakah saya perlu keahlian editing?</h3>
            <p>
              Sama sekali tidak! FokusAI dirancang untuk semua orang. Cukup
              ketik perintah teks, dan AI kami akan melakukan sisanya.
            </p>
          </div>
          <div className="faq-item">
            <h3>Berapa lama proses generate video?</h3>
            <p>
              Rata-rata video pendek selesai dalam waktu kurang dari 60 detik,
              tergantung pada kompleksitas dan antrian server.
            </p>
          </div>
          <div className="faq-item">
            <h3>Apakah saya memiliki hak cipta video?</h3>
            <p>
              Ya, Anda memiliki hak komersial penuh atas video yang Anda buat
              dengan paket berbayar kami.
            </p>
          </div>
          <div className="faq-item">
            <h3>Bisakah saya membatalkan langganan?</h3>
            <p>
              Tentu saja. Anda dapat membatalkan langganan kapan saja melalui
              halaman pengaturan akun Anda.
            </p>
          </div>
        </div>
      </section>

      <section id="pricing" className="pricing-section">
        <h2 className="section-title">Pricing</h2>
        <div className="pricing-grid">
          <div className="pricing-card free">
            <div className="pricing-name">Gratis</div>
            <div className="pricing-value">0k</div>
            <div className="pricing-sub">
              Akses terbatas, hanya intip dashboard.
            </div>
            <ul className="pricing-list">
              <li className="pricing-item">
                <span className="pricing-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 12l3 3 7-7"
                      fill="none"
                      stroke="#a8ff7a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Akses Masuk ke Dashboard</span>
              </li>
              <li className="pricing-item exclude">
                <span className="pricing-icon cross">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M9 9l6 6M15 9l-6 6"
                      fill="none"
                      stroke="#d47b7b"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Generate Video</span>
              </li>
              <li className="pricing-item exclude">
                <span className="pricing-icon cross">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M9 9l6 6M15 9l-6 6"
                      fill="none"
                      stroke="#d47b7b"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Generate Image</span>
              </li>
              <li className="pricing-item exclude">
                <span className="pricing-icon cross">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M9 9l6 6M15 9l-6 6"
                      fill="none"
                      stroke="#d47b7b"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Generate Music</span>
              </li>
              <li className="pricing-item exclude">
                <span className="pricing-icon cross">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M9 9l6 6M15 9l-6 6"
                      fill="none"
                      stroke="#d47b7b"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Fitur Veo 3.1 & Sora 2</span>
              </li>
            </ul>
            <Link href="/prompt-tunggal?plan=free" className="btn ghost">
              Coba Sekarang
            </Link>
          </div>
          <div className="pricing-card">
            <div className="pricing-name">Veo 3.1 — Lifetime</div>
            <div className="pricing-value">300k</div>
            <div className="pricing-sub">Bayar sekali, akses selamanya.</div>
            <ul className="pricing-list">
              <li className="pricing-item">
                <span className="pricing-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 12l3 3 7-7"
                      fill="none"
                      stroke="#a8ff7a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Akses Penuh Dashboard</span>
              </li>
              <li className="pricing-item">
                <span className="pricing-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 12l3 3 7-7"
                      fill="none"
                      stroke="#a8ff7a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Generate Video (Unlimited)</span>
              </li>
              <li className="pricing-item">
                <span className="pricing-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 12l3 3 7-7"
                      fill="none"
                      stroke="#a8ff7a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Generate Image (Unlimited)</span>
              </li>
              <li className="pricing-item">
                <span className="pricing-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 12l3 3 7-7"
                      fill="none"
                      stroke="#a8ff7a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Generate Music (Unlimited)</span>
              </li>
              <li className="pricing-item">
                <span className="pricing-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 12l3 3 7-7"
                      fill="none"
                      stroke="#a8ff7a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Teknologi Veo 3.1</span>
              </li>
              <li className="pricing-item exclude">
                <span className="pricing-icon cross">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M9 9l6 6M15 9l-6 6"
                      fill="none"
                      stroke="#d47b7b"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Teknologi Sora 2</span>
              </li>
            </ul>
            <Link href="/prompt-tunggal?plan=veo_lifetime" className="btn gold">
              Coba Sekarang
            </Link>
          </div>
          <div className="pricing-card">
            <div className="pricing-name">Veo 3.1 + Sora 2 — Unlimited</div>
            <div className="pricing-value">370k</div>
            <div className="pricing-sub">
              Paket terlengkap, bayar sekali aktif selamanya.
            </div>
            <ul className="pricing-list">
              <li className="pricing-item">
                <span className="pricing-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 12l3 3 7-7"
                      fill="none"
                      stroke="#a8ff7a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Akses Penuh Dashboard</span>
              </li>
              <li className="pricing-item">
                <span className="pricing-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 12l3 3 7-7"
                      fill="none"
                      stroke="#a8ff7a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Generate Video (Unlimited)</span>
              </li>
              <li className="pricing-item">
                <span className="pricing-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 12l3 3 7-7"
                      fill="none"
                      stroke="#a8ff7a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Generate Image (Unlimited)</span>
              </li>
              <li className="pricing-item">
                <span className="pricing-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 12l3 3 7-7"
                      fill="none"
                      stroke="#a8ff7a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Generate Music (Unlimited)</span>
              </li>
              <li className="pricing-item">
                <span className="pricing-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 12l3 3 7-7"
                      fill="none"
                      stroke="#a8ff7a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Teknologi Veo 3.1</span>
              </li>
              <li className="pricing-item">
                <span className="pricing-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 12l3 3 7-7"
                      fill="none"
                      stroke="#a8ff7a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Teknologi Sora 2</span>
              </li>
            </ul>
            <Link
              href="/prompt-tunggal?plan=veo_sora_unlimited"
              className="btn gold"
            >
              Coba Sekarang
            </Link>
          </div>

          <div className="pricing-card highlight">
            <div className="pricing-name">Perbulan</div>
            <div className="pricing-value">70k</div>
            <div className="pricing-sub">
              Berlangganan fleksibel dengan fitur penuh.
            </div>
            <ul className="pricing-list">
              <li className="pricing-item">
                <span className="pricing-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 12l3 3 7-7"
                      fill="none"
                      stroke="#a8ff7a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Akses Penuh Dashboard</span>
              </li>
              <li className="pricing-item">
                <span className="pricing-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 12l3 3 7-7"
                      fill="none"
                      stroke="#a8ff7a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Generate Video</span>
              </li>
              <li className="pricing-item">
                <span className="pricing-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 12l3 3 7-7"
                      fill="none"
                      stroke="#a8ff7a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Generate Image</span>
              </li>
              <li className="pricing-item">
                <span className="pricing-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 12l3 3 7-7"
                      fill="none"
                      stroke="#a8ff7a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Generate Music</span>
              </li>
              <li className="pricing-item">
                <span className="pricing-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 12l3 3 7-7"
                      fill="none"
                      stroke="#a8ff7a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Teknologi Veo 3.1</span>
              </li>
              <li className="pricing-item">
                <span className="pricing-icon">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4d03f"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 12l3 3 7-7"
                      fill="none"
                      stroke="#a8ff7a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Teknologi Sora 2</span>
              </li>
            </ul>
            <Link
              href="/prompt-tunggal?plan=monthly&days=28"
              className="btn primary"
            >
              Coba Sekarang
            </Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-grid">
          <div className="footer-col">
            <div className="footer-title">Kembangnya</div>
            <div className="footer-link">Prompt Builder</div>
            <div className="footer-link">Media</div>
          </div>
          <div className="footer-col">
            <div className="footer-title">Repositor</div>
            <div className="footer-link">Prompt & Pengaturan</div>
            <div className="footer-link">Sora 2</div>
          </div>
          <div className="footer-col">
            <div className="footer-title">Social</div>
            <div className="footer-link">Site</div>
          </div>
        </div>
        <div className="footer-meta">© 2025 FokusAI Studio</div>
      </footer>
    </div>
  );
}
