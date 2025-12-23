export const legacyMarkup = String.raw`
    <div class="app-shell prompt-shell">
      <header class="page-header">
        <div class="page-brand">
          <img src="/images/fokusAI.png" alt="Logo FokusAI Studio" class="brand-logo" />
          <div class="brand-text">
            <span class="page-badge">FokusAI Studio</span>
            <h1 class="page-title">FokusAI Generator Video</h1>
            <p class="page-subtitle">video generator veo 3.1 & sora 2</p>
          </div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <a id="sora2Button" class="settings-btn" href="/sora2" title="Sora 2">
            <span aria-hidden="true">🎥</span>
            <span class="sr-only">Sora 2</span>
          </a>
          <a id="imageGenButton" class="settings-btn" href="/image-generator" title="Image Generator">
            <span aria-hidden="true">🎨</span>
            <span class="sr-only">Image Generator</span>
          </a>
          <span id="musicButton" class="settings-btn disabled" aria-disabled="true" title="Music (disabled)">
            <span aria-hidden="true">🎵</span>
            <span class="sr-only">Music (disabled)</span>
          </span>
      <div class="user-menu">
        <button id="userMenuButton" class="settings-btn user-btn" aria-haspopup="true" aria-expanded="false" title="User menu">
          <span aria-hidden="true">👤</span>
          <span class="sr-only">User menu</span>
        </button>
        <div id="userMenuDropdown" class="user-menu-dropdown" hidden>
          <button class="user-menu-item" type="button" data-action="dashboard">
            <span aria-hidden="true">🏠</span>
            <span>Dashboard</span>
          </button>
          <button class="user-menu-item" type="button" data-action="profile">
            <span aria-hidden="true">👤</span>
            <span>User Profile</span>
          </button>
              <button class="user-menu-item" type="button" data-action="credit">
                <span aria-hidden="true">💳</span>
                <span>Credit</span>
              </button>
              <button class="user-menu-item" type="button" data-action="settings">
                <span aria-hidden="true">⚙️</span>
                <span>Pengaturan</span>
              </button>
              <div class="user-menu-divider"></div>
              <button class="user-menu-item" type="button" data-action="logout">
                <span aria-hidden="true">🚪</span>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div class="card" data-initial-mode="single">
        <div class="generator-layout">
          <aside class="sidebar">
            <h2 class="section-title">Prompt & Pengaturan</h2>
            <p class="section-subtitle">Kelola prompt, karakter, dan adegan Anda sebelum mengirim ke server proxy.</p>

            <!-- Mode Prompt (sidebar) -->
            <button class="collapse-toggle" data-target="#modePromptSection" aria-expanded="true">
              <span>Mode Prompt</span>
            </button>
            <div id="modePromptSection" class="collapsible-body">
              <div class="mode-grid-new">
                <a id="modeSingleBtn" class="mode-card-new active" href="/prompt-tunggal">
                  <div class="mode-card-icon">📝</div>
                  <div class="mode-card-content">
                    <div class="mode-card-title">Prompt Tunggal</div>
                    <div class="mode-card-subtitle">Hasilkan satu video</div>
                  </div>
                </a>
                <a id="modeBatchBtn" class="mode-card-new" href="/prompt-batch">
                  <div class="mode-card-icon">📚</div>
                  <div class="mode-card-content">
                    <div class="mode-card-title">Prompt Batch</div>
                    <div class="mode-card-subtitle">Hasilkan video massal</div>
                  </div>
                </a>
                <a id="modeFrameBtn" class="mode-card-new" href="/frame-ke-video">
                  <div class="mode-card-icon">🎬</div>
                  <div class="mode-card-content">
                    <div class="mode-card-title">Frame → Video</div>
                    <div class="mode-card-subtitle">Gabungkan gambar awal & akhir</div>
                  </div>
                </a>
              </div>
            </div>

            <!-- Prompt Tunggal -->
            <div id="modeSingle" style="margin-top:14px;">
              <button class="collapse-toggle" data-target="#singlePromptSection" aria-expanded="true">Prompt Tunggal</button>
              <div id="singlePromptSection" class="collapsible-body">
                <textarea id="singlePrompt" class="scene-textarea" rows="3" placeholder="Deskripsikan video..."></textarea>
                <button class="collapse-toggle sub" data-target="#singleImageBlock" aria-expanded="true" style="margin-top:12px;">Gambar Awal (opsional)</button>
                <div id="singleImageBlock" class="single-image-block collapsible-body" style="margin-top:8px;">
                <div id="singleImageDropzone" class="dropzone single-image-dropzone">
                  <div style="text-align:center;">
                    <div style="font-size:13px;">Klik atau seret gambar ke sini</div>
                    <div style="font-size:12px; color:#6b7280;">PNG atau JPG, akan dicrop mengikuti rasio pilihan di bawah</div>
                  </div>
                </div>
                <input id="singleImageFile" type="file" accept="image/png,image/jpeg" style="display:none;" />
                <div style="margin-top:10px;">
                  <label for="singleImageAspect">Image Aspect Ratio</label>
      <select id="singleImageAspect" class="dropdown">
                    <option value="IMAGE_ASPECT_RATIO_LANDSCAPE">Landscape</option>
                    <option value="IMAGE_ASPECT_RATIO_PORTRAIT">Portrait</option>
                    <option value="IMAGE_ASPECT_RATIO_SQUARE">Square</option>
                  </select>
                </div>
                <div class="settings-help">Sesuaikan rasio cropping gambar sebelum generate Start Image.</div>
                <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
      <button id="singleImagePick" class="btn">Pilih / Unggah</button>
      <button id="singleImageRecrop" class="btn" style="display:none;">Crop ulang</button>
      <button id="singleImageUploadLabs" class="btn">Upload ke Labs (Auto Media ID)</button>
      <button id="singleImageRemove" class="btn ghost">Hapus</button>
                  <span class="settings-help" style="margin-left:auto;">Gunakan gambar berkualitas tinggi untuk hasil terbaik.</span>
                </div>
                <div style="margin-top:10px;">
                  <label for="singleImageMediaId">Media ID (opsional)</label>
                  <input id="singleImageMediaId" type="text" placeholder="Tempel Media ID dari Labs" />
                </div>
                <div class="settings-help">Jika Media ID diisi, generate akan memakai Start Image.</div>
              <div id="singleImageUploadInfo" class="settings-help"></div>
              </div>
              </div>
            </div>

            <!-- Prompt Batch -->
            <div id="modeBatch" style="display:none; margin-top:14px;">
              <button class="collapse-toggle" data-target="#batchPromptSection" aria-expanded="true">Prompt Batch</button>
              <div id="batchPromptSection" class="collapsible-body">
                <label for="batchPrompts">Prompt Batch (satu per baris)</label>
                <textarea id="batchPrompts" class="scene-textarea" rows="4" placeholder="Tulis satu prompt per baris..."></textarea>
                <div class="settings-help">Setiap baris menjadi satu video.</div>
                <div class="settings-help">Jika Media ID pada Prompt Tunggal terisi, batch akan memakai Start Image global.</div>
                
                <button class="collapse-toggle sub" data-target="#batchImageBlock" aria-expanded="false" style="margin-top:12px;">Gambar Batch (opsional)</button>
                <div id="batchImageBlock" class="single-image-block collapsible-body" style="margin-top:8px;">
                  <div id="batchImageDropzone" class="dropzone single-image-dropzone">
                    <div style="text-align:center;">
                      <div style="font-size:13px;">Klik atau seret gambar ke sini</div>
                      <div style="font-size:12px; color:#6b7280;">PNG atau JPG, dicrop otomatis ke rasio yang dipilih</div>
                    </div>
                  </div>
                  <input id="batchImageFile" type="file" accept="image/png,image/jpeg" style="display:none;" />
                  <div style="margin-top:10px;">
                    <label for="batchImageAspect">Image Aspect Ratio</label>
                    <select id="batchImageAspect" class="dropdown">
                      <option value="IMAGE_ASPECT_RATIO_LANDSCAPE">Landscape</option>
                      <option value="IMAGE_ASPECT_RATIO_PORTRAIT">Portrait</option>
                      <option value="IMAGE_ASPECT_RATIO_SQUARE">Square</option>
                    </select>
                  </div>
                  <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                    <button id="batchImagePick" class="btn">Pilih / Unggah</button>
                    <button id="batchImageRecrop" class="btn" style="display:none;">Crop ulang</button>
                    <button id="batchImageUploadLabs" class="btn">Upload ke Labs (Auto Media ID)</button>
                    <button id="batchImageRemove" class="btn ghost">Hapus</button>
                    <span class="settings-help" style="margin-left:auto;">Gunakan gambar berkualitas tinggi untuk hasil terbaik.</span>
                  </div>
                  <div style="margin-top:10px;">
                    <label for="batchImageMediaId">Media ID (opsional)</label>
                    <input id="batchImageMediaId" type="text" placeholder="Tempel Media ID dari Labs" />
                  </div>
                  <div class="settings-help">Jika Media ID diisi, generate batch akan memakai Start Image.</div>
                  <div id="batchImageUploadInfo" class="settings-help"></div>
                </div>
              </div>
            </div>

            <!-- Pengaturan -->
            <button class="collapse-toggle" data-target="#settingsSection" aria-expanded="true">Pengaturan</button>
            <div id="settingsSection" class="collapsible-body">
            <div class="row">
              <div style="flex:1 1 100%">
                <label>Model VEO</label>
                <select id="settingModelKey" class="dropdown">
                  <option value="veo_3_1_t2v_fast_ultra" data-aspect="VIDEO_ASPECT_RATIO_LANDSCAPE">Veo 3.1 Fast – Landscape</option>
                  <option value="veo_3_1_t2v_fast_ultra_relaxed" data-aspect="VIDEO_ASPECT_RATIO_LANDSCAPE">Veo 3.1 Fast – Landscape Ultra Relaxed</option>
                  <option value="veo_3_1_t2v_fast_portrait_ultra" data-aspect="VIDEO_ASPECT_RATIO_PORTRAIT">Veo 3.1 Fast – Portrait</option>
                  <option value="veo_3_1_t2v_fast_portrait_ultra_relaxed" data-aspect="VIDEO_ASPECT_RATIO_PORTRAIT">Veo 3.1 Fast – Portrait Ultra Relaxed</option>
                </select>
              <div class="settings-help">Pilih salah satu model yang tersedia.</div>
              <div id="quotaLabel" style="color:#f4d03f; font-weight:600; margin-top:6px;"></div>
              </div>
              <div style="flex:1">
                <label>Gaya Visual</label>
                <select id="settingStyle" class="dropdown">
                  <option value="">(Tidak ada)</option>
                  <option value="sinematik">Sinematik</option>
                  <option value="realistik">Realistik</option>
                  <option value="anime">Anime</option>
                  <option value="dokumenter">Dokumenter</option>
                  <option value="pixar3d">Pixar 3D</option>
                  <option value="cyberpunk">Cyberpunk</option>
                  <option value="retro80an">Retro 80-an</option>
                  <option value="claymation">Claymation</option>
                  <option value="fantasi">Fantasi</option>
                  <option value="steampunk">Steampunk</option>
                  <option value="filmnoir">Film Noir</option>
                </select>
              </div>
              <div style="flex:1">
                <label>Sub Gaya Visual</label>
                <select id="settingSubStyle" class="dropdown" disabled>
                  <option value="">(Tidak ada)</option>
                </select>
                <div class="settings-help">Pilih gaya terlebih dahulu untuk menampilkan sub-gaya.</div>
              </div>
            </div>
            <div class="row">
              <div style="flex:1">
                <label>Rasio Aspek</label>
                <select id="settingAspect" class="dropdown">
                  <option value="VIDEO_ASPECT_RATIO_LANDSCAPE">16:9</option>
                  <option value="VIDEO_ASPECT_RATIO_PORTRAIT">9:16</option>
                </select>
              </div>
              <div style="flex:1">
                <label>Resolusi</label>
                <select id="settingResolution" class="dropdown">
                  <option value="720p" selected>720p</option>
                </select>
              </div>
            </div>
            <div class="row">
              <div style="flex:1">
                <label style="display:flex; align-items:center; gap:8px;">Aktifkan Suara
                  <input id="settingAudio" type="checkbox" />
                </label>
              </div>
              <div style="flex:1">
                <label>Suara Karakter</label>
                <select id="settingVoiceLang" class="dropdown">
                  <option value="">(Tidak ada)</option>
                  <option value="Indonesia" selected>Indonesia</option>
                  <option value="English">English</option>
                  <option value="Japanese">Japanese</option>
                  <option value="__custom__">Custom…</option>
                </select>
                <input id="settingVoiceCustom" type="text" placeholder="mis. Indonesia pria bariton" style="display:none; margin-top:8px;" />
              </div>
            </div>
            </div>

            <!-- Sutradara (Profil Karakter + Adegan) -->
            <div id="modeDirector" style="display:none;">
              <button class="collapse-toggle" data-target="#directorProfileSection" aria-expanded="true" style="margin-top:18px;">Profil Karakter</button>
              <div id="directorProfileSection" class="collapsible-body">
                <div class="settings-row" style="flex-direction:column;">
                  <div style="flex:1">
                    <label for="identitySeed">Seed Global (opsional)</label>
                    <input id="identitySeed" type="number" placeholder="mis. 29284" />
                    <div class="settings-help">Gunakan angka tetap untuk hasil antar-adegan yang seragam. Biarkan kosong jika ingin acak.</div>
                  </div>
                  <div class="settings-toggle">
                    <span class="label-text">Acak seed tiap generate</span>
                    <label class="toggle"><input id="randomSeed" type="checkbox" checked /><span class="slider"></span></label>
                  </div>
                  <div class="settings-help">Jika dicentang, seed diacak tiap klik Generate.</div>
                </div>
              </div>
              <button class="collapse-toggle" data-target="#directorCharactersSection" aria-expanded="true" style="margin-top:18px;">Pemeran & Karakter</button>
              <div id="directorCharactersSection" class="collapsible-body">
                <div id="charactersContainer"></div>
                <div style="margin-top:10px;">
                  <button id="addCharacterBtn" class="btn-add-scene">Tambah Karakter</button>
                </div>
              </div>
              <!-- Adegan: multi-scene -->
              <button class="collapse-toggle" data-target="#directorScenesSection" aria-expanded="true" style="margin-top:18px;">Adegan</button>
              <div id="directorScenesSection" class="collapsible-body">
                <div id="scenesContainer"></div>
                <div style="margin-top:10px;">
                  <button id="addSceneBtn" class="btn-add-scene">Tambah Adegan</button>
                </div>
              </div>
            </div>

            <div id="modeFrame" style="display:none; margin-top:14px;">
              <button class="collapse-toggle" data-target="#framePromptSection" aria-expanded="true">Frame → Video</button>
              <div id="framePromptSection" class="collapsible-body">
                <textarea id="framePrompt" class="scene-textarea" rows="3" placeholder="Deskripsikan transisi dari frame awal ke frame akhir..."></textarea>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px;">
                  <div>
                    <div style="font-weight:600; margin-bottom:6px;">Frame Pertama</div>
                    <div id="frameStartDropzone" class="dropzone single-image-dropzone">
                      <div style="text-align:center;">
                        <div style="font-size:13px;">Klik atau seret gambar ke sini</div>
                        <div style="font-size:12px; color:#6b7280;">PNG atau JPG, dicrop otomatis mengikuti rasio</div>
                      </div>
                    </div>
                    <input id="frameStartFile" type="file" accept="image/png,image/jpeg" style="display:none;" />
                    <div style="margin-top:10px;">
                      <label for="frameStartAspect">Image Aspect Ratio</label>
                      <select id="frameStartAspect" class="dropdown">
                        <option value="IMAGE_ASPECT_RATIO_LANDSCAPE">Landscape</option>
                        <option value="IMAGE_ASPECT_RATIO_PORTRAIT">Portrait</option>
                        <option value="IMAGE_ASPECT_RATIO_SQUARE">Square</option>
                      </select>
                    </div>
                    <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                      <button id="frameStartPick" class="btn">Pilih / Unggah</button>
                      <button id="frameStartRecrop" class="btn" style="display:none;">Crop ulang</button>
                      <button id="frameStartUploadLabs" class="btn">Upload ke Labs (Auto Media ID)</button>
                      <button id="frameStartRemove" class="btn ghost">Hapus</button>
                    </div>
                    <div style="margin-top:10px;">
                      <label for="frameStartMediaId">Media ID</label>
                      <input id="frameStartMediaId" type="text" placeholder="Tempel Media ID dari Labs" />
                    </div>
                    <div id="frameStartUploadInfo" class="settings-help"></div>
                  </div>

                  <div>
                    <div style="font-weight:600; margin-bottom:6px;">Frame Terakhir</div>
                    <div id="frameEndDropzone" class="dropzone single-image-dropzone">
                      <div style="text-align:center;">
                        <div style="font-size:13px;">Klik atau seret gambar ke sini</div>
                        <div style="font-size:12px; color:#6b7280;">PNG atau JPG, dicrop otomatis mengikuti rasio</div>
                      </div>
                    </div>
                    <input id="frameEndFile" type="file" accept="image/png,image/jpeg" style="display:none;" />
                    <div style="margin-top:10px;">
                      <label for="frameEndAspect">Image Aspect Ratio</label>
                      <select id="frameEndAspect" class="dropdown">
                        <option value="IMAGE_ASPECT_RATIO_LANDSCAPE">Landscape</option>
                        <option value="IMAGE_ASPECT_RATIO_PORTRAIT">Portrait</option>
                        <option value="IMAGE_ASPECT_RATIO_SQUARE">Square</option>
                      </select>
                    </div>
                    <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                      <button id="frameEndPick" class="btn">Pilih / Unggah</button>
                      <button id="frameEndRecrop" class="btn" style="display:none;">Crop ulang</button>
                      <button id="frameEndUploadLabs" class="btn">Upload ke Labs (Auto Media ID)</button>
                      <button id="frameEndRemove" class="btn ghost">Hapus</button>
                    </div>
                    <div style="margin-top:10px;">
                      <label for="frameEndMediaId">Media ID</label>
                      <input id="frameEndMediaId" type="text" placeholder="Tempel Media ID dari Labs" />
                    </div>
                    <div id="frameEndUploadInfo" class="settings-help"></div>
                  </div>
                </div>
              </div>
            </div>


            <div style="margin-top:12px; display:flex; gap:10px; align-items:center;">
              <button id="quickGenerate" class="btn ghost"><span aria-hidden="true" style="margin-right:6px;">▶</span>Generate</button>
              <button id="stopGenerate" class="btn ghost" disabled><span aria-hidden="true" style="margin-right:6px;">⏹</span>Hentikan</button>
            </div>

            <div style="margin-top:12px; display:flex; gap:10px; align-items:center;">
              <span id="status"></span>
            </div>
          </aside>

          <section class="result-pane">
            <pre id="output" style="display:none;"></pre>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
              <h3>Pratinjau Video</h3>
              <button id="mergeVideosBtn" class="btn ghost" title="Gabungkan beberapa video">Gabungkan video</button>
            </div>
            <div id="media" class="preview-frame"></div>
          </section>
      </div>
    </div>

    <!-- Cropper Modal -->
    <div id="cropperModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <div style="font-weight:700;">Crop Gambar</div>
          <button id="cropCancel" class="btn">Tutup</button>
        </div>
        <div class="modal-body">
          <div class="crop-left">
            <canvas id="cropCanvas" width="720" height="405"></canvas>
          </div>
          <div class="crop-right">
            <label style="font-size:12px; color:#9ca3af;">Zoom</label>
            <input id="cropZoom" type="range" min="0.2" max="4" step="0.01" value="1" style="width:100%;" />
            <div class="settings-help">Seret gambar untuk posisi; geser slider untuk zoom.</div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="cropSave" class="btn primary">Simpan Crop</button>
        </div>
      </div>
    </div>

    <!-- Gallery Picker Modal -->
    <div id="galleryPickerModal" class="modal">
      <div class="modal-content" style="max-width:760px;">
        <div class="modal-header">
          <div style="font-weight:700;">Pilih Gambar dari Galeri</div>
          <button id="galleryPickerClose" class="btn">Tutup</button>
        </div>
        <div class="modal-body">
          <div id="galleryPickerStatus" class="settings-help"></div>
          <div id="galleryPickerList" class="gallery-grid"></div>
        </div>
        <div class="modal-footer" style="display:flex; gap:10px; justify-content:flex-end;">
          <button id="galleryPickerCloseFooter" class="btn">Tutup</button>
        </div>
      </div>
    </div>

    <!-- Merge Videos Modal -->
    <div id="mergeVideosModal" class="modal">
      <div class="modal-content" style="max-width:720px;">
        <div class="modal-header">
          <div style="font-weight:700;">Gabungkan Video</div>
          <button id="mergeVideosClose" class="btn">Tutup</button>
        </div>
        <div class="modal-body">
          <div id="mergeVideosStatus" class="settings-help"></div>
          <div id="mergeVideosList" class="gallery-grid" style="grid-template-columns:1fr; gap:8px;"></div>
        </div>
        <div class="modal-footer" style="display:flex; gap:10px; justify-content:flex-end;">
          <button id="mergeVideosCancel" class="btn">Batal</button>
          <button id="mergeVideosSubmit" class="btn primary">Gabungkan & Unduh</button>
        </div>
      </div>
    </div>

    <!-- Logout Modal -->
    <div id="logoutModal" class="modal">
      <div class="modal-content" style="max-width:420px;">
        <div class="modal-header">
          <div style="font-weight:700; color:#f4d03f;">Konfirmasi Logout</div>
          <button id="logoutClose" class="btn ghost">Tutup</button>
        </div>
        <div class="modal-body" style="flex-direction:column; gap:10px;">
          <div style="color:#e2e8f0; font-weight:600;">Apakah Anda yakin ingin logout?</div>
          <div style="color:#94a3b8; font-size:14px;">Sesi Anda akan diakhiri dan Anda akan kembali ke halaman login.</div>
        </div>
        <div class="modal-footer" style="justify-content:flex-end; gap:10px;">
          <button id="logoutCancel" class="btn ghost">Batal</button>
          <button id="logoutConfirm" class="btn primary">Ya, Logout</button>
        </div>
      </div>
    </div>

    </div>

    <!-- Lock Overlay saat Credential kosong (diletakkan di luar .app-shell agar bisa diklik) -->
    

      
    <div id="quotaModal" class="modal" style="display:none; backdrop-filter:blur(8px);">
      <div class="modal-card" style="width:min(560px, 95vw); border:1px solid rgba(244,208,63,.28); border-radius:16px; padding:16px; background: radial-gradient(1200px 600px at 20% -10%, rgba(244,208,63,.08), transparent 55%), radial-gradient(600px 600px at 120% 120%, rgba(10,16,32,.95), rgba(10,16,32,.88)); box-shadow: 0 0 0 1px rgba(244,208,63,.12), 0 18px 60px rgba(0,0,0,.55); position:relative;">
        <div class="modal-header" style="border-bottom:1px solid rgba(255,255,255,.06); padding-bottom:10px; margin-bottom:12px;">
          <div class="modal-title" style="font-weight:700; color:#f4d03f;">Pengaturan Kuota Harian</div>
          <button id="quotaClose" class="btn ghost" style="border-radius:50%; width:32px; height:32px;">✕</button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; gap:14px;">
          <div style="display:flex; gap:12px; align-items:center;">
            <span style="min-width:160px; color:#cbd5e1;">Prompt Tunggal</span>
            <input id="quotaSingleInput" type="number" min="0" step="1" style="flex:1; border-radius:10px; background:#111827; border:1px solid rgba(255,255,255,.08); color:#e5e7eb; padding:8px 10px;" />
          </div>
          <div style="display:flex; gap:12px; align-items:center;">
            <span style="min-width:160px; color:#cbd5e1;">Prompt Batch</span>
            <input id="quotaBatchInput" type="number" min="0" step="1" style="flex:1; border-radius:10px; background:#111827; border:1px solid rgba(255,255,255,.08); color:#e5e7eb; padding:8px 10px;" />
          </div>
          <div style="display:flex; gap:12px; align-items:center;">
            <span style="min-width:160px; color:#cbd5e1;">Frame → Video</span>
            <input id="quotaFrameInput" type="number" min="0" step="1" style="flex:1; border-radius:10px; background:#111827; border:1px solid rgba(255,255,255,.08); color:#e5e7eb; padding:8px 10px;" />
          </div>
          <div id="quotaHint" style="color:#b8a97a; font-size:12px;"></div>
        </div>
        <div class="modal-footer" style="justify-content:flex-end; gap:12px; margin-top:6px;">
          <button id="quotaReset" class="btn ghost" style="box-shadow:0 0 20px rgba(244,208,63,.18);">Reset Default</button>
          <button id="quotaSave" class="btn primary" style="box-shadow:0 0 24px rgba(59,130,246,.25)">Simpan</button>
        </div>
      </div>
    </div>
`;
