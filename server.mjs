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
  const connect = await run('adb', ['connect', `${ANDROID_HOST}:${ANDROID_PORT}`]);
  if (connect.code !== 0 && !/connected to/i.test(connect.stdout)) {
    throw new Error(`ADB connect failed: ${connect.stderr || connect.stdout}`);
  }
  const devices = await run('adb', ['devices']);
  if (!devices.stdout.includes(`${ANDROID_HOST}:${ANDROID_PORT}\tdevice`)) {
    throw new Error(`Android emulator not ready. ADB reports: ${devices.stdout || devices.stderr}`);
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
    if (meta.packageName) {
      const launch = await adb(['shell', 'monkey', '-p', meta.packageName, '1']);
      launched = launch.code === 0 && /Events injected/i.test(launch.stdout + launch.stderr);
    }
    return json(res, 200, {
      ok: true,
      packageName: meta.packageName,
      activity: meta.activity,
      launched,
      output: installed.stdout.trim(),
      launchOutput: launched ? 'Ứng dụng đã được mở.' : 'Đã cài đặt nhưng chưa tự mở được.'
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
    if (req.method === 'POST' && url.pathname === '/api/install') return install(req, res);
    if (req.method === 'GET') return serveStatic(req, res, url);
    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    json(res, 500, { error: error.message || 'Internal server error' });
  }
});

server.listen(PORT, () => console.log(`APK Runner listening on :${PORT}`));
