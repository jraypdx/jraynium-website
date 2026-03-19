require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Upload rate limiting (per IP) ────────────────────────────
const HOUR_LIMIT = 10 * 1024 * 1024 * 1024; // 10 GB / hour
const DAY_LIMIT  = 20 * 1024 * 1024 * 1024; // 20 GB / day
const uploadTracker = new Map(); // ip -> { hourBytes, dayBytes, hourStart, dayStart }

function getIpUsage(ip) {
  const now = Date.now();
  const d = uploadTracker.get(ip) || { hourBytes: 0, dayBytes: 0, hourStart: now, dayStart: now };
  if (now - d.hourStart > 3_600_000) { d.hourBytes = 0; d.hourStart = now; }
  if (now - d.dayStart  > 86_400_000) { d.dayBytes  = 0; d.dayStart  = now; }
  uploadTracker.set(ip, d);
  return d;
}

function checkUploadQuota(req, res, next) {
  const ip = req.ip;
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  const usage = getIpUsage(ip);
  if (usage.hourBytes + contentLength > HOUR_LIMIT)
    return res.status(429).json({ error: 'Hourly upload limit (10 GB) exceeded. Try again later.' });
  if (usage.dayBytes + contentLength > DAY_LIMIT)
    return res.status(429).json({ error: 'Daily upload limit (20 GB) exceeded. Try again tomorrow.' });
  next();
}

// ── Multer storage ───────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${path.basename(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: HOUR_LIMIT } });

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ── Download tracking ─────────────────────────────────────────
const STATS_PATH = path.join(__dirname, 'download-stats.json');

function readStats() {
  if (!fs.existsSync(STATS_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(STATS_PATH, 'utf8')); }
  catch { return {}; }
}

function getGeoData(ip) {
  const clean = ip.replace(/^::ffff:/, '');
  // Skip lookup for local / private addresses
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$)/.test(clean) || clean === 'localhost') {
    return Promise.resolve({ city: 'Local', country: 'Local' });
  }
  return new Promise((resolve) => {
    const req = https.request(
      { hostname: 'ipapi.co', path: `/${clean}/json/`, headers: { 'User-Agent': 'jraynium-site/1.0' } },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const d = JSON.parse(body);
            resolve({ city: d.city || 'Unknown', country: d.country_name || 'Unknown' });
          } catch { resolve({ city: 'Unknown', country: 'Unknown' }); }
        });
      }
    );
    req.on('error', () => resolve({ city: 'Unknown', country: 'Unknown' }));
    req.end();
  });
}

async function recordDownload(fileKey, rawIp) {
  const ip  = rawIp.replace(/^::ffff:/, '');
  const geo = await getGeoData(rawIp);
  const stats = readStats();
  if (!stats[fileKey]) stats[fileKey] = { total: 0, downloads: [] };
  stats[fileKey].total += 1;
  stats[fileKey].downloads.push({ timestamp: new Date().toISOString(), ip, city: geo.city, country: geo.country });
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
}

// Rate limiter for contact form
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2,
  message: { error: 'Too many messages sent. Please try again later.' },
});

// Download music files (forces browser download instead of stream)
app.get('/api/download/music/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(__dirname, 'public', 'music', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  recordDownload(`music/${filename}`, req.ip).catch(err => console.error('Download tracking error:', err));
  res.download(filePath, filename);
});

// List files available in the downloads folder
app.get('/api/downloads', (req, res) => {
  const downloadsDir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadsDir)) return res.json([]);

  const files = fs.readdirSync(downloadsDir)
    .filter(f => !f.startsWith('.'))
    .map(f => {
      const stat = fs.statSync(path.join(downloadsDir, f));
      return { name: f, size: stat.size };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json(files);
});

// Download other files (stems, presets, etc. — stored outside public/)
app.get('/api/download/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(__dirname, 'downloads', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  recordDownload(`downloads/${filename}`, req.ip).catch(err => console.error('Download tracking error:', err));
  res.download(filePath, filename);
});

function verifyRecaptcha(token) {
  return new Promise((resolve, reject) => {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    const postData = `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`;
    const options = {
      hostname: 'www.google.com',
      path: '/recaptcha/api/siteverify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error('Invalid response from reCAPTCHA')); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Contact form
app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, message, recaptchaToken } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (!recaptchaToken) {
    return res.status(400).json({ error: 'reCAPTCHA token missing.' });
  }

  try {
    const captchaResult = await verifyRecaptcha(recaptchaToken);
    if (!captchaResult.success) {
      return res.status(400).json({ error: 'reCAPTCHA verification failed. Please try again.' });
    }
  } catch {
    return res.status(500).json({ error: 'Could not verify reCAPTCHA. Please try again.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  // Always save to contacts.json
  const contact = { name, email, message, date: new Date().toISOString() };
  const contactsPath = path.join(__dirname, 'contacts.json');
  let contacts = [];
  if (fs.existsSync(contactsPath)) {
    try {
      contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
    } catch {
      contacts = [];
    }
  }
  contacts.push(contact);
  fs.writeFileSync(contactsPath, JSON.stringify(contacts, null, 2));

  // Send email notification if configured
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_TO || process.env.EMAIL_USER,
        replyTo: email,
        subject: `[JRAYNIUM FORM MESSAGE] New message from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
        html: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Message:</strong></p><p>${message.replace(/\n/g, '<br>')}</p>`,
      });
    } catch (err) {
      console.error('Email send error:', err.message);
      // Still return success — message was saved
    }
  }

  res.json({ success: true });
});

// File upload (stored in /uploads/, email notification sent)
app.post('/api/upload', checkUploadQuota, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE')
        return res.status(413).json({ error: 'File too large (max 10 GB).' });
      return res.status(500).json({ error: 'Upload error.' });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received.' });

  // Verify reCAPTCHA before accepting the file
  const recaptchaToken = req.body.recaptchaToken;
  if (!recaptchaToken) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'reCAPTCHA token missing.' });
  }
  try {
    const captchaResult = await verifyRecaptcha(recaptchaToken);
    if (!captchaResult.success) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'reCAPTCHA verification failed. Please try again.' });
    }
  } catch {
    fs.unlinkSync(req.file.path);
    return res.status(500).json({ error: 'Could not verify reCAPTCHA. Please try again.' });
  }

  // Update per-IP usage with actual bytes
  const ip = req.ip;
  const usage = getIpUsage(ip);
  usage.hourBytes += req.file.size;
  usage.dayBytes  += req.file.size;

  // Email notification
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_TO || process.env.EMAIL_USER,
        subject: `[JRAYNIUM] File uploaded: ${req.file.originalname}`,
        text: `A file was uploaded to your site.\n\nFilename: ${req.file.originalname}\nSaved as: ${req.file.filename}\nSize: ${formatBytes(req.file.size)}\nIP: ${ip}\nTime: ${new Date().toISOString()}`,
        html: `<p>A file was uploaded to your site.</p>
<table cellpadding="6">
  <tr><td><strong>Filename:</strong></td><td>${req.file.originalname}</td></tr>
  <tr><td><strong>Saved as:</strong></td><td>${req.file.filename}</td></tr>
  <tr><td><strong>Size:</strong></td><td>${formatBytes(req.file.size)}</td></tr>
  <tr><td><strong>IP:</strong></td><td>${ip}</td></tr>
  <tr><td><strong>Time:</strong></td><td>${new Date().toISOString()}</td></tr>
</table>`,
      });
    } catch (err) {
      console.error('Upload email error:', err.message);
    }
  }

  res.json({ success: true, filename: req.file.originalname, size: req.file.size });
});

app.listen(PORT, () => {
  console.log(`JRAYNIUM site running at http://localhost:${PORT}`);
});
