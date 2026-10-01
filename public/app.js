const $ = (s) => document.querySelector(s);
let selectedFile = null;
let localSelection = null;
let cloudSession = null;

function message(text, type = '') {
  const el = $('#message');
  el.textContent = text || '';
  el.className = `message ${type}`;
}

function setButtons() {
  const hasFile = !!selectedFile;
  $('#runWeb').disabled = !hasFile;
  $('#runLocal').disabled = !hasFile;
}

async function localHealth() {
  try {
    const r = await fetch('/api/health', { cache: 'no-store' });
    const data = await r.json();
    $('#status').className = `status ${data.deviceReady ? 'online' : 'offline'}`;
    $('#status').innerHTML = `<i></i>${data.deviceReady ? ' Android cục bộ sẵn sàng' : ' Android cục bộ chưa sẵn sàng'}`;
    return !!data.deviceReady;
  } catch {
    $('#status').className = 'status offline';
    $('#status').innerHTML = '<i></i> Android cục bộ không kết nối';
    return false;
  }
}

function showCloudFrame(url) {
  cloudSession = url;
  $('#screen').src = url;
  $('#boot').classList.add('hidden');
  $('#deviceState').textContent = 'Web Cloud • đang chạy';
}

async function runWeb() {
  if (!selectedFile) return;
  $('#runWeb').disabled = true;
  message('Đang đưa APK lên Android Cloud…');
  try {
    const r = await fetch('/api/cloud-upload', {
      method: 'POST',
      headers: {
        'content-type': 'application/vnd.android.package-archive',
        'x-apk-filename': encodeURIComponent(selectedFile.name)
      },
      body: selectedFile
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Không thể tạo phiên Web Cloud.');
    showCloudFrame(data.embedUrl);
    $('#status').className = 'status online';
    $('#status').innerHTML = '<i></i> Web Cloud sẵn sàng';
    message('APK đã được mở trên trình duyệt.', 'success');
  } catch (e) {
    message(e.message, 'error');
  } finally {
    setButtons();
  }
}

async function prepareLocal() {
  if (!selectedFile) return;
  $('#runLocal').disabled = true;
  message('Đang tải APK vào server cục bộ…');
  try {
    const r = await fetch(`/api/upload?name=${encodeURIComponent(selectedFile.name)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/vnd.android.package-archive' },
      body: selectedFile
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Upload thất bại.');
    localSelection = data;

    const ready = await localHealth();
    if (!ready) throw new Error('Emulator cục bộ chưa sẵn sàng. Với chế độ Web Cloud, không cần bước này.');
    
    message('Đã tải APK. Đang cài vào emulator cục bộ…');
    const install = await fetch('/api/install', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: data.id })
    });
    const result = await install.json();
    if (!install.ok) throw new Error(result.error || 'Cài đặt thất bại.');
    $('#screen').src = `http://${location.hostname}:6080/vnc.html?autoconnect=true&resize=scale&view_only=false`;
    $('#boot').classList.add('hidden');
    $('#deviceState').textContent = 'Emulator cục bộ • đang chạy';
    message(result.launched ? 'APK đã cài và mở trong emulator cục bộ.' : 'APK đã cài. Có thể mở từ Android.', 'success');
  } catch (e) {
    message(e.message, 'error');
  } finally {
    setButtons();
  }
}

function selectFile(file) {
  if (!file || !file.name.toLowerCase().endsWith('.apk')) {
    message('Vui lòng chọn đúng file .apk', 'error');
    return;
  }
  selectedFile = file;
  localSelection = null;
  $('#fileInfo').classList.remove('hidden');
  $('#fileInfo').innerHTML = `<strong>${escapeHtml(file.name)}</strong><span>${formatSize(file.size)} • sẵn sàng chạy trên web</span>`;
  $('#deviceState').textContent = 'Đã chọn APK';
  message('Đã chọn APK. Bấm “Chạy APK trên web”.');
  setButtons();
}

function escapeHtml(s) {
  return s.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function formatSize(bytes) {
  const units = ['B','KB','MB','GB'];
  let n = bytes, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

$('#file').addEventListener('change', e => selectFile(e.target.files[0]));
$('#runWeb').addEventListener('click', runWeb);
$('#runLocal').addEventListener('click', prepareLocal);

document.querySelectorAll('.action').forEach(button => {
  button.addEventListener('click', async () => {
    const action = button.dataset.action;
    try {
      button.disabled = true;
      const r = await fetch(`/api/device/${action}`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Thao tác thất bại.');
      message(
        action === 'back' ? 'Đã quay lại.' :
        action === 'home' ? 'Đã về màn hình chính.' :
        action === 'recents' ? 'Đã mở ứng dụng gần đây.' :
        'Đã gửi lệnh xoay màn hình.',
        'success'
      );
    } catch (e) {
      message('Nút điều khiển này chỉ hoạt động ở chế độ emulator cục bộ.', 'error');
    } finally {
      button.disabled = false;
    }
  });
});

$('#reload').addEventListener('click', localHealth);

const drop = $('#drop');
['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => {
  e.preventDefault();
  drop.classList.add('drag');
}));
['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => {
  e.preventDefault();
  drop.classList.remove('drag');
}));
drop.addEventListener('drop', e => {
  const file = [...e.dataTransfer.files].find(f => f.name.toLowerCase().endsWith('.apk'));
  if (file) selectFile(file);
});

setButtons();
