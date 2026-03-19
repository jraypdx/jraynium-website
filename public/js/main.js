/* ============================================================
   JRAYNIUM — Main JS
   ============================================================ */

// ──────────────────────────────────────────────────────────────
// SONGS — Edit this array to add your tracks.
// Put your .mp3/.wav/.flac files in /public/music/
// ──────────────────────────────────────────────────────────────
const songs = [
  {
    title: 'Feel Your Love',
    file: '/music/Jraynium - Feel Your Love.mp3',
    cover: '/assets/covers/FYL_CoverArt_1024_lighterLogo.jpg', // e.g. '/assets/covers/love-u-anyway.jpg'
  },
  {
    title: 'Love U Anyway',
    file: '/music/Jraynium - Love U Anyway.mp3',
    cover: '/assets/covers/LoveUAnywayCover_SMALL.jpg', // e.g. '/assets/covers/love-u-anyway.jpg'
  },
  {
    title: 'Missing You Missing Me',
    file: '/music/Jraynium - Missing You Missing Me.mp3',
    cover: '/assets/covers/mymm_cover.jpg',
  },
  {
    title: 'Cobra Starship - Good Girls Go Bad ft. Leighton Meester (Jraynium Remix)',
    file: '/music/Cobra Starship - Good Girls Go Bad ft. Leighton Meester (Jraynium Remix).mp3',
    cover: '/assets/covers/CobraStarshipBootlegCover.jpg',
  },
  {
    title: '50 Cent - In Da Club (Jraynium DnB Flip)',
    file: '/music/50 Cent - In Da Club (Jraynium DnB Flip).mp3',
    cover: '/assets/covers/50cent_jrayniumCoverEdit.jpg',
  },
  {
    title: 'Nothing To You (ft. Trevor Laake)',
    file: '/music/Jraynium - Nothing To You (ft. Trevor Laake).mp3',
    cover: '/assets/covers/jraynium_reignite_ep_cover_SMALL.jpg',
  },
  {
    title: 'Escape This Darkness',
    file: '/music/Jraynium - Escape This Darkness.mp3',
    cover: '/assets/covers/jraynium_reignite_ep_cover_SMALL.jpg',
  },
  {
    title: 'Lying Eyes',
    file: '/music/Jraynium - Lying Eyes.mp3',
    cover: '/assets/covers/jraynium_reignite_ep_cover_SMALL.jpg',
  },
  {
    title: 'Set Me Free',
    file: '/music/Jraynium - Set Me Free.mp3',
    cover: '/assets/covers/jraynium_reignite_ep_cover_SMALL.jpg',
  },
  {
    title: 'Avril Lavigne - Sk8er Boi (Jraynium Remix)',
    file: '/music/Avril Lavigne - Sk8er Boi (Jraynium Remix).mp3',
    cover: '/assets/covers/jraynium_nostalgic_icons_remix_ep.jpg',
  },
  {
    title: 'Lady Gaga - Poker Face (Jraynium Remix)',
    file: '/music/Lady Gaga - Poker Face (Jraynium Remix).mp3',
    cover: '/assets/covers/jraynium_nostalgic_icons_remix_ep.jpg',
  },
  {
    title: 'Kelly Clarkson - Since U Been Gone (Jraynium Remix)',
    file: '/music/Kelly Clarkson - Since U Been Gone (Jraynium Remix).mp3',
    cover: '/assets/covers/jraynium_nostalgic_icons_remix_ep.jpg',
  },
  // {
  //   title: '',
  //   file: '/music/track3.mp3',
  //   cover: '/assets/covers/',
  // },
  // {
  //   title: '',
  //   file: '/music/track3.mp3',
  //   cover: '/assets/covers/',
  // },
];

// ──────────────────────────────────────────────────────────────
// Player State
// ──────────────────────────────────────────────────────────────
let currentIndex = 0;
let howl = null;
let isPlaying = false;
let seekInterval = null;
let isDragging = false;

// ──────────────────────────────────────────────────────────────
// DOM Refs
// ──────────────────────────────────────────────────────────────
const tracklist     = document.getElementById('tracklist');
const playPauseBtn  = document.getElementById('playPauseBtn');
const playIcon      = document.getElementById('playIcon');
const prevBtn       = document.getElementById('prevBtn');
const nextBtn       = document.getElementById('nextBtn');
const nowPlayTitle  = document.getElementById('nowPlayingTitle');
const nowPlayingArt = document.getElementById('nowPlayingArt');
const nowPlayingImg = document.getElementById('nowPlayingImg');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl   = document.getElementById('totalTime');
const seekFill      = document.getElementById('seekFill');
const seekThumb     = document.getElementById('seekThumb');
const seekWrapper   = document.getElementById('seekBarWrapper');
const volumeSlider  = document.getElementById('volumeSlider');
const volIcon       = document.getElementById('volIcon');

// ──────────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────────
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function setSeekPosition(pct) {
  const clamped = Math.max(0, Math.min(100, pct));
  seekFill.style.width = `${clamped}%`;
  seekThumb.style.left  = `${clamped}%`;
}

function updateCoverArt(song) {
  if (song.cover) {
    nowPlayingImg.src = song.cover;
    nowPlayingImg.alt = song.title;
    nowPlayingImg.hidden = false;
    nowPlayingArt.querySelector('.now-playing-art-placeholder').hidden = true;
    nowPlayingArt.classList.add('has-art');
  } else {
    nowPlayingImg.hidden = true;
    nowPlayingImg.src = '';
    nowPlayingArt.querySelector('.now-playing-art-placeholder').hidden = false;
    nowPlayingArt.classList.remove('has-art');
  }
}

function updateVolumeIcon(vol) {
  volIcon.className = vol === 0
    ? 'fa-solid fa-volume-xmark'
    : vol < 0.5
    ? 'fa-solid fa-volume-low'
    : 'fa-solid fa-volume-high';
}

// ──────────────────────────────────────────────────────────────
// Build Track List
// ──────────────────────────────────────────────────────────────
function buildTracklist() {
  tracklist.innerHTML = '';
  songs.forEach((song, i) => {
    const item = document.createElement('div');
    item.className = 'track-item';
    item.dataset.index = i;

    item.innerHTML = `
      <div class="track-cover">
        ${song.cover
          ? `<img src="${song.cover}" alt="${song.title}" />`
          : `<i class="fa-solid fa-music"></i>`}
      </div>
      <span class="track-title">${song.title}</span>
      <span class="track-duration">—</span>
      <a class="track-download" href="/api/download/music/${encodeURIComponent(song.file.split('/').pop())}"
         title="Download ${song.title}" download>
        <i class="fa-solid fa-download"></i>
      </a>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.track-download')) return;
      selectTrack(i, true);
    });

    tracklist.appendChild(item);
  });
}

function updateTracklistUI() {
  document.querySelectorAll('.track-item').forEach((el, i) => {
    el.classList.toggle('active', i === currentIndex);
    el.classList.toggle('playing', i === currentIndex && isPlaying);
  });
}

// ──────────────────────────────────────────────────────────────
// Player Core
// ──────────────────────────────────────────────────────────────
function selectTrack(index, autoplay = false) {
  if (howl) {
    howl.stop();
    howl.unload();
    howl = null;
  }
  clearInterval(seekInterval);
  isPlaying = false;

  currentIndex = index;
  const song = songs[currentIndex];
  nowPlayTitle.textContent = song.title;
  updateCoverArt(song);
  setSeekPosition(0);
  currentTimeEl.textContent = '0:00';
  totalTimeEl.textContent = '0:00';
  updatePlayIcon();
  updateTracklistUI();

  howl = new Howl({
    src: [song.file],
    html5: true,
    volume: parseFloat(volumeSlider.value),

    onload() {
      totalTimeEl.textContent = formatTime(howl.duration());
      // Update duration in tracklist
      const durationEl = tracklist.children[currentIndex]?.querySelector('.track-duration');
      if (durationEl) durationEl.textContent = formatTime(howl.duration());
    },
    onplay() {
      isPlaying = true;
      updatePlayIcon();
      updateTracklistUI();
      clearInterval(seekInterval);
      seekInterval = setInterval(() => {
        if (!isDragging && howl && howl.playing()) {
          const seek = howl.seek() || 0;
          const dur  = howl.duration() || 1;
          currentTimeEl.textContent = formatTime(seek);
          setSeekPosition((seek / dur) * 100);
        }
      }, 250);
    },
    onpause() {
      isPlaying = false;
      updatePlayIcon();
      updateTracklistUI();
      clearInterval(seekInterval);
    },
    onstop() {
      isPlaying = false;
      updatePlayIcon();
      updateTracklistUI();
      clearInterval(seekInterval);
    },
    onend() {
      nextTrack();
    },
    onloaderror(id, err) {
      console.warn(`Could not load "${song.title}":`, err);
      nowPlayTitle.textContent = `${song.title} (file not found)`;
    },
  });

  if (autoplay) howl.play();
}

function togglePlay() {
  if (!howl) {
    selectTrack(currentIndex, true);
    return;
  }
  if (isPlaying) {
    howl.pause();
  } else {
    howl.play();
  }
}

function nextTrack() {
  selectTrack((currentIndex + 1) % songs.length, true);
}

function prevTrack() {
  // If >3s into track, restart; otherwise go to previous
  if (howl && howl.seek() > 3) {
    howl.seek(0);
    setSeekPosition(0);
    currentTimeEl.textContent = '0:00';
  } else {
    selectTrack((currentIndex - 1 + songs.length) % songs.length, isPlaying);
  }
}

function updatePlayIcon() {
  playIcon.className = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
}

// ──────────────────────────────────────────────────────────────
// Seek Bar
// ──────────────────────────────────────────────────────────────
function seekToPercent(pct) {
  if (!howl) return;
  const dur = howl.duration() || 0;
  howl.seek((pct / 100) * dur);
  setSeekPosition(pct);
  currentTimeEl.textContent = formatTime((pct / 100) * dur);
}

function getSeekPercent(e) {
  const rect = seekWrapper.getBoundingClientRect();
  return Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
}

seekWrapper.addEventListener('mousedown', (e) => {
  isDragging = true;
  seekToPercent(getSeekPercent(e));
});
document.addEventListener('mousemove', (e) => {
  if (isDragging) seekToPercent(getSeekPercent(e));
});
document.addEventListener('mouseup', () => { isDragging = false; });

// Touch support
seekWrapper.addEventListener('touchstart', (e) => {
  isDragging = true;
  seekToPercent(getSeekPercent(e.touches[0]));
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (isDragging) seekToPercent(getSeekPercent(e.touches[0]));
}, { passive: true });
document.addEventListener('touchend', () => { isDragging = false; });

// ──────────────────────────────────────────────────────────────
// Volume
// ──────────────────────────────────────────────────────────────
volumeSlider.addEventListener('input', () => {
  const vol = parseFloat(volumeSlider.value);
  if (howl) howl.volume(vol);
  updateVolumeIcon(vol);
});
volIcon.addEventListener('click', () => {
  if (parseFloat(volumeSlider.value) > 0) {
    volumeSlider._prev = volumeSlider.value;
    volumeSlider.value = 0;
  } else {
    volumeSlider.value = volumeSlider._prev || 0.8;
  }
  volumeSlider.dispatchEvent(new Event('input'));
});

// ──────────────────────────────────────────────────────────────
// Player Button Events
// ──────────────────────────────────────────────────────────────
playPauseBtn.addEventListener('click', togglePlay);
nextBtn.addEventListener('click', nextTrack);
prevBtn.addEventListener('click', prevTrack);

// Keyboard shortcuts (space = play/pause, arrows = skip)
document.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  if (e.code === 'ArrowRight') nextTrack();
  if (e.code === 'ArrowLeft') prevTrack();
});

// ──────────────────────────────────────────────────────────────
// Side Navigation
// ──────────────────────────────────────────────────────────────
const sidenav    = document.getElementById('sidenav');
const navOverlay = document.getElementById('navOverlay');
const navToggle  = document.getElementById('navToggle');
const navClose   = document.getElementById('navClose');

function openNav() {
  sidenav.classList.add('open');
  navOverlay.classList.add('active');
  navToggle.classList.add('active');
  navToggle.setAttribute('aria-expanded', 'true');
  sidenav.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeNav() {
  sidenav.classList.remove('open');
  navOverlay.classList.remove('active');
  navToggle.classList.remove('active');
  navToggle.setAttribute('aria-expanded', 'false');
  sidenav.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

navToggle.addEventListener('click', () => {
  sidenav.classList.contains('open') ? closeNav() : openNav();
});
navClose.addEventListener('click', closeNav);
navOverlay.addEventListener('click', closeNav);

// Close nav on link click
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', closeNav);
});

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeNav();
});

// ──────────────────────────────────────────────────────────────
// Contact Form
// ──────────────────────────────────────────────────────────────
const contactForm = document.getElementById('contactForm');
const formStatus  = document.getElementById('formStatus');
const submitBtn   = document.getElementById('submitBtn');
const submitText  = document.getElementById('submitText');
const submitIcon  = document.getElementById('submitIcon');

contactForm.addEventListener('submit', (e) => {
  e.preventDefault();
  formStatus.textContent = '';
  formStatus.className = 'form-status';

  const name    = contactForm.name.value.trim();
  const email   = contactForm.email.value.trim();
  const message = contactForm.message.value.trim();

  if (!name || !email || !message) {
    formStatus.textContent = 'Please fill in all fields.';
    formStatus.className = 'form-status error';
    return;
  }

  showCaptcha('Verify to send your message', submitContact);
});

async function submitContact(recaptchaToken) {
  const name    = contactForm.name.value.trim();
  const email   = contactForm.email.value.trim();
  const message = contactForm.message.value.trim();

  submitBtn.disabled = true;
  submitText.textContent = 'Sending…';
  submitIcon.className = 'fa-solid fa-spinner fa-spin';

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, message, recaptchaToken }),
    });
    const data = await res.json();

    if (res.ok && data.success) {
      formStatus.textContent = 'Message sent! I\'ll get back to you soon.';
      formStatus.className = 'form-status success';
      contactForm.reset();
    } else {
      formStatus.textContent = data.error || 'Something went wrong. Please try again.';
      formStatus.className = 'form-status error';
    }
  } catch {
    formStatus.textContent = 'Network error. Please try again.';
    formStatus.className = 'form-status error';
  } finally {
    submitBtn.disabled = false;
    submitText.textContent = 'Send Message';
    submitIcon.className = 'fa-solid fa-paper-plane';
  }
}

// ──────────────────────────────────────────────────────────────
// Shared reCAPTCHA Flyout
// ──────────────────────────────────────────────────────────────
let captchaWidgetId = null;
let captchaCallback = null;

function showCaptcha(title, callback) {
  captchaCallback = callback;
  document.getElementById('captchaTitle').textContent = title;
  if (captchaWidgetId !== null) grecaptcha.reset(captchaWidgetId);
  document.getElementById('captchaFlyout').hidden = false;
}

function hideCaptcha() {
  document.getElementById('captchaFlyout').hidden = true;
  captchaCallback = null;
}

function onCaptchaVerified(token) {
  const cb = captchaCallback;
  hideCaptcha();
  if (cb) cb(token);
}

// ──────────────────────────────────────────────────────────────
// Downloads Section
// ──────────────────────────────────────────────────────────────
const downloadsGrid  = document.getElementById('downloadsGrid');
const downloadsEmpty = document.getElementById('downloadsEmpty');

const FILE_ICONS = {
  mp3:  'fa-solid fa-music',
  wav:  'fa-solid fa-music',
  flac: 'fa-solid fa-music',
  aiff: 'fa-solid fa-music',
  zip:  'fa-solid fa-file-zipper',
  rar:  'fa-solid fa-file-zipper',
  '7z': 'fa-solid fa-file-zipper',
  pdf:  'fa-solid fa-file-pdf',
  txt:  'fa-solid fa-file-lines',
  png:  'fa-solid fa-image',
  jpg:  'fa-solid fa-image',
  jpeg: 'fa-solid fa-image',
};

function fileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return FILE_ICONS[ext] || 'fa-solid fa-file';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function loadDownloads() {
  try {
    const res = await fetch('/api/downloads');
    const files = await res.json();

    if (!files.length) {
      downloadsEmpty.hidden = false;
    } else {
      files.forEach(file => {
        const a = document.createElement('a');
        a.className = 'download-card';
        a.href = `/api/download/${encodeURIComponent(file.name)}`;
        a.download = file.name;

        a.innerHTML = `
          <div class="download-card-icon"><i class="${fileIcon(file.name)}"></i></div>
          <div class="download-card-info">
            <div class="download-card-name">${file.name}</div>
            <div class="download-card-size">${formatBytes(file.size)}</div>
          </div>
          <i class="fa-solid fa-download download-card-arrow"></i>
        `;

        downloadsGrid.appendChild(a);
      });
    }
  } catch (err) {
    console.error('Could not load downloads:', err);
    downloadsEmpty.hidden = false;
  }

  buildUploadCard();
}

// Module-level refs so the captcha callback can reach the upload card
let uploadCard, uploadInput, uploadStatus;
let pendingUploadToken = null;

function buildUploadCard() {
  const card = document.createElement('div');
  card.className = 'upload-card';
  card.innerHTML = `
    <div class="upload-card-icon"><i class="fa-solid fa-upload"></i></div>
    <div class="upload-card-info">
      <div class="upload-card-name">Send me a file</div>
      <div class="upload-card-status" id="uploadStatus">Click to select a file</div>
    </div>
    <input type="file" id="uploadInput" style="display:none" />
  `;
  downloadsGrid.appendChild(card);

  uploadCard   = card;
  uploadInput  = card.querySelector('#uploadInput');
  uploadStatus = card.querySelector('#uploadStatus');

  // Click card → reCAPTCHA flyout first (unless already uploading)
  card.addEventListener('click', () => {
    if (!uploadCard.classList.contains('upload-uploading')) {
      showCaptcha('Verify to send your file', (token) => {
        pendingUploadToken = token;
        uploadInput.value  = '';
        uploadInput.click();
      });
    }
  });

  // After captcha passes, file picker opens; selecting a file auto-uploads
  uploadInput.addEventListener('change', () => {
    const file = uploadInput.files[0];
    if (!file || !pendingUploadToken) return;
    uploadStatus.textContent = `${file.name} (${formatBytes(file.size)})`;
    uploadCard.classList.remove('upload-success', 'upload-error');
    performUpload(pendingUploadToken);
    pendingUploadToken = null;
  });

}

function performUpload(token) {
  const file = uploadInput.files[0];
  if (!file) return;

  uploadCard.classList.add('upload-uploading');
  uploadCard.classList.remove('upload-success', 'upload-error');
  uploadStatus.textContent = 'Uploading...';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('recaptchaToken', token);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload');

  xhr.upload.addEventListener('progress', (ev) => {
    if (ev.lengthComputable) {
      const pct = Math.round((ev.loaded / ev.total) * 100);
      uploadStatus.textContent = `Uploading… ${pct}%`;
    }
  });

  xhr.addEventListener('load', () => {
    uploadCard.classList.remove('upload-uploading');
    let data = {};
    try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }

    if (xhr.status >= 200 && xhr.status < 300) {
      uploadCard.classList.add('upload-success');
      uploadStatus.textContent = 'Sent!';
      setTimeout(() => {
        uploadInput.value = '';
        uploadStatus.textContent = 'Click to select a file';
        uploadCard.classList.remove('upload-success');
      }, 3000);
    } else {
      uploadCard.classList.add('upload-error');
      uploadStatus.textContent = data.error || 'Upload failed';
      setTimeout(() => uploadCard.classList.remove('upload-error'), 4000);
    }
  });

  xhr.addEventListener('error', () => {
    uploadCard.classList.remove('upload-uploading');
    uploadCard.classList.add('upload-error');
    uploadStatus.textContent = 'Upload failed';
    setTimeout(() => uploadCard.classList.remove('upload-error'), 4000);
  });

  xhr.send(formData);
}

// ──────────────────────────────────────────────────────────────
// Footer Year
// ──────────────────────────────────────────────────────────────
document.getElementById('footerYear').textContent = new Date().getFullYear();

// ──────────────────────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────────────────────
buildTracklist();
selectTrack(0, false); // Load first track without autoplaying
updateVolumeIcon(parseFloat(volumeSlider.value));
loadDownloads();

document.getElementById('captchaCancel').addEventListener('click', hideCaptcha);
grecaptcha.ready(() => {
  captchaWidgetId = grecaptcha.render('captchaWidget', {
    sitekey: '6Lc-UJAsAAAAABymD0YmXWKkuQVswzcOl0Iiwlxe',
    callback: onCaptchaVerified,
  });
});
