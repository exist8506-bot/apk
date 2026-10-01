import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || '/data';
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const ANDROID_HOST = process.env.ANDROID_HOST || 'android';
const ANDROID_PORT = process.env.ANDROID_PORT || '5555';
const MAX_APK_BYTES = Number(process.env.MAX_APK_BYTES || 512 * 1024 * 1024);
const PUBLIC_DIR = path.join(process.cwd(), 'public');

await fsp.mkdir(UPLOAD_DIR, { recursive: true });

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(payload);
}

function safeFilename(name) {
  return (name || 'app.apk').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'app.apk';
}

async function run(cmd, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => stdout += d);
    child.stderr.on('data', d => stderr += d);
    child.on('error', error => resolve({ code: -1, stdout, stderr: String(error) }));
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

async function adb(args) {
  return run('adb', ['-s', `${ANDROID_HOST}:${ANDROID_PORT}`, ...args]);
}

async function ensureAdb() {
  const target = `${ANDROID_HOST}:${ANDROID_PORT}`;
  const connect = await run('adb', ['connect', target]);
  if (connect.code !== 0 && !/connected to|already connected/i.test(connect.stdout + connect.stderr)) {
    throw new Error(`ADB connect failed: ${connect.stderr || connect.stdout}`);
  }
  const devices = await run('adb', ['devices']);
  const ready = devices.stdout.split(/\r?\n/).some(line => line.trim() === `${target}\tdevice`);
  if (!ready) {
    throw new Error(`Android emulator not ready. ADB reports: ${devices.stdout || devices.stderr}`);
  }
  const boot = await run('adb', ['-s', target, 'shell', 'getprop', 'sys.boot_completed']);
  if (boot.code !== 0 || boot.stdout.trim() !== '1') {
    throw new Error('Android emulator is connected but still booting.');
  }
}

async function getPackageMeta(filePath) {
  const analyzed = await run('apkanalyzer', ['manifest', 'application-id', filePath]);
  if (analyzed.code !== 0) {
    return { packageName: null, activity: null, warning: 'Không đọc được application ID của APK.' };
  }
  const pkg = analyzed.stdout.trim() || null;
  return { packageName: pkg, activity: null, warning: null };
}

async function uploadToRamus(req, res) {
  const contentLength = Number(req.headers['content-length'] || 0);
  const RAMUS_MAX = 150 * 1024 * 1024;
  if (contentLength > RAMUS_MAX) {
    return json(res, 413, { error: 'Ramus trial giới hạn APK 150 MB.' });
  }

  const id = crypto.randomUUID();
  const filename = safeFilename(req.headers['x-apk-filename'] ? decodeURIComponent(req.headers['x-apk-filename']) : 'app.apk');
  const filePath = path.join(UPLOAD_DIR, `${id}.apk`);
  let bytes = 0;
  const out = fs.createWriteStream(filePath, { flags: 'wx' });

  try {
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > RAMUS_MAX) throw new Error('Ramus trial giới hạn APK 150 MB.');
      out.write(chunk);
    }
    out.end();
    await new Promise((resolve, reject) => { out.on('finish', resolve); out.on('error', reject); });

    const fd = await fsp.open(filePath, 'r');
    const header = Buffer.alloc(4);
    await fd.read(header, 0, 4, 0);
    await fd.close();
    if (header.toString('hex') !== '504b0304') throw new Error('File không phải APK hợp lệ.');

    const trial = await run('npx', ['--yes', 'ramus-cli@0.1.12', 'trial'], { cwd: DATA_DIR });
    if (trial.code !== 0) {
      throw new Error(trial.stderr || trial.stdout || 'Không kích hoạt được Ramus trial.');
    }

    const start = await run(
      'npx',
      ['--yes', 'ramus-cli@0.1.12', 'session', 'start', '--apk', filePath, '--wait'],
      { cwd: DATA_DIR, env: { ...process.env, NO_COLOR: '1' } }
    );
    if (start.code !== 0) {
      throw new Error(start.stderr || start.stdout || 'Không tạo được phiên Android cloud.');
    }

    const lines = start.stdout.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    let payload = null;
    for (const line of lines.reverse()) {
      try { payload = JSON.parse(line); break; } catch {}
    }

    const watchUrl = payload?.watchUrl || payload?.watchURL || payload?.url;
    const session = payload?.session || payload?.id;
    if (!watchUrl) throw new Error('Ramus không trả về watchUrl.\n' + start.stdout);

    return json(res, 200, {
      ok: true,
      provider: 'ramus',
      session,
      filename,
      bytes,
      watchUrl
    });
  } catch (error) {
    await fsp.rm(filePath, { force: true });
    return json(res, 502, { error: error.message || 'Không thể chạy APK trên cloud.' });
  }
}

async function upload(req, res, url) {
  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > MAX_APK_BYTES) return json(res, 413, { error: 'APK quá lớn.' });

  const id = crypto.randomUUID();
  const filename = safeFilename(url.searchParams.get('name'));
  const filePath = path.join(UPLOAD_DIR, `${id}.apk`);
  let bytes = 0;
  const out = fs.createWriteStream(filePath, { flags: 'wx' });
  try {
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > MAX_APK_BYTES) {
        req.destroy();
        throw new Error('APK quá lớn.');
      }
      out.write(chunk);
    }
    out.end();
    await new Promise((resolve, reject) => { out.on('finish', resolve); out.on('error', reject); });
    const fd = await fsp.open(filePath, 'r');
    const header = Buffer.alloc(4);
    await fd.read(header, 0, 4, 0);
    await fd.close();
    if (header.toString('hex') !== '504b0304') throw new Error('File không phải ZIP/APK hợp lệ.');
    const meta = await getPackageMeta(filePath);
    return json(res, 200, { id, filename, bytes, ...meta });
  } catch (error) {
    await fsp.rm(filePath, { force: true });
    return json(res, 400, { error: error.message || 'Upload thất bại.' });
  }
}

async function deviceAction(req, res, action) {
  const actions = {
    home: 'KEYCODE_HOME',
    back: 'KEYCODE_BACK',
    recents: 'KEYCODE_APP_SWITCH',
    rotate: 'KEYCODE_ROTATE'
  };
  const key = actions[action];
  if (!key) return json(res, 400, { error: 'Thao tác không hợp lệ.' });
  try {
    await ensureAdb();
    const result = await adb(['shell', 'input', 'keyevent', key]);
    if (result.code !== 0) return json(res, 502, { error: result.stderr || result.stdout || 'Không gửi được thao tác.' });
    return json(res, 200, { ok: true, action });
  } catch (error) {
    return json(res, 503, { error: error.message || 'Emulator chưa sẵn sàng.' });
  }
}

async function install(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  let input;
  try { input = JSON.parse(body || '{}'); } catch { return json(res, 400, { error: 'JSON không hợp lệ.' }); }
  const id = String(input.id || '').replace(/[^a-zA-Z0-9-]/g, '');
  if (!id) return json(res, 400, { error: 'Thiếu mã APK.' });
  const filePath = path.join(UPLOAD_DIR, `${id}.apk`);
  try { await fsp.access(filePath); } catch { return json(res, 404, { error: 'Không tìm thấy APK.' }); }

  try {
    await ensureAdb();
    const meta = await getPackageMeta(filePath);
    const installed = await adb(['install', '-r', '-d', filePath]);
    if (installed.code !== 0) {
      return json(res, 422, { error: `Cài APK thất bại: ${installed.stderr || installed.stdout}` });
    }
    let launched = false;
    let activity = null;
    let launchOutput = '';
    if (meta.packageName) {
      const resolved = await adb([
        'shell', 'cmd', 'package', 'resolve-activity', '--brief',
        '-a', 'android.intent.action.MAIN',
        '-c', 'android.intent.category.LAUNCHER',
        meta.packageName
      ]);
      const line = resolved.stdout.split(/\r?\n/).map(x => x.trim()).filter(Boolean).pop();
      if (resolved.code === 0 && line && line.includes('/')) {
        activity = line;
        const start = await adb(['shell', 'am', 'start', '-n', activity]);
        launched = start.code === 0 && /Starting: Intent/i.test(start.stdout + start.stderr);
        launchOutput = start.stdout.trim() || start.stderr.trim();
      } else {
        const fallback = await adb(['shell', 'monkey', '-p', meta.packageName, '1']);
        launched = fallback.code === 0 && /Events injected/i.test(fallback.stdout + fallback.stderr);
        launchOutput = fallback.stdout.trim() || fallback.stderr.trim();
      }
    }
    return json(res, 200, {
      ok: true,
      packageName: meta.packageName,
      activity,
      launched,
      output: installed.stdout.trim(),
      launchOutput: launched ? 'Ứng dụng đã được mở.' : (launchOutput || 'Đã cài đặt nhưng chưa tự mở được.')
    });
  } catch (error) {
    return json(res, 503, { error: error.message || 'Emulator chưa sẵn sàng.' });
  }
}

async function health(res) {
  const adbVersion = await run('adb', ['version']);
  let device = false;
  let emulator = 'offline';
  try {
    await ensureAdb();
    device = true;
    emulator = 'online';
  } catch (error) {
    emulator = error.message;
  }
  json(res, 200, {
    ok: adbVersion.code === 0,
    emulator,
    deviceReady: device,
    novncUrl: '/novnc/'
  });
}

function serveStatic(req, res, url) {
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!file.startsWith(PUBLIC_DIR)) return json(res, 403, { error: 'Forbidden' });
  const ext = path.extname(file);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
  fs.createReadStream(file)
    .on('error', () => json(res, 404, { error: 'Not found' }))
    .on('open', () => res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' }))
    .pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return health(res);
    if (req.method === 'POST' && url.pathname === '/api/upload') return upload(req, res, url);
    if (req.method === 'POST' && url.pathname === '/api/cloud-upload') return uploadToRamus(req, res);
    if (req.method === 'POST' && url.pathname === '/api/install') return install(req, res);
    if (req.method === 'POST' && url.pathname.startsWith('/api/device/')) {
      return deviceAction(req, res, url.pathname.slice('/api/device/'.length));
    }
    if (req.method === 'GET') return serveStatic(req, res, url);
    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    json(res, 500, { error: error.message || 'Internal server error' });
  }
});

server.listen(PORT, () => console.log(`APK Runner listening on :${PORT}`));
