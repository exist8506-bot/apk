const $ = (s) => document.querySelector(s);
let selected = null;

function message(text, type = '') {
  const el = $('#message');
  el.textContent = text || '';
  el.className = `message ${type}`;
}

async function health() {
  try {
    const r = await fetch('/api/health', { cache: 'no-store' });
    const data = await r.json();
    const online = !!data.deviceReady;
    $('#status').className = `status ${online ? 'online' : 'offline'}`;
    $('#status').innerHTML = `<i></i>${online ? ' Emulator sẵn sàng' : ' Emulator chưa sẵn sàng'}`;
    $('#deviceState').textContent = online ? 'Online' : 'Đang khởi động…';
    if (online) {
      $('#boot').classList.add('hidden');
      if ($('#screen').src === 'about:blank') $('#screen').src = `http://${location.hostname}:6080/vnc.html?autoconnect=true&resize=scale&view_only=false`;
    }
    return online;
  } catch {
    $('#status').className = 'status offline';
    $('#status').innerHTML = '<i></i> Không kết nối được server';
    $('#deviceState').textContent = 'Offline';
    return false;
  }
}

async function upload(file) {
  message('Đang tải APK lên máy chủ…');
  const r = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/vnd.android.package-archive' },
    body: file
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Upload thất bại.');
  selected = data;
  $('#fileInfo').classList.remove('hidden');
  $('#fileInfo').innerHTML = `<strong>${escapeHtml(data.filename)}</strong><span>${formatSize(data.bytes)}${data.packageName ? ` • ${escapeHtml(data.packageName)}` : ''}</span>`;
  $('#install').disabled = false;
  message(data.packageName ? `Đã nhận APK • package: ${data.packageName}` : 'Đã nhận APK.');
}

async function install() {
  if (!selected) return;
  $('#install').disabled = true;
  message('Đang cài APK vào Android ảo…');
  try {
    const r = await fetch('/api/install', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: selected.id }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Cài đặt thất bại.');
    message(data.launched ? 'Cài đặt xong và ứng dụng đã được mở.' : 'Cài đặt xong. Bạn có thể mở ứng dụng từ màn hình Android.', 'success');
    $('#screen').src = `http://${location.hostname}:6080/vnc.html?autoconnect=true&resize=scale&view_only=false`;
  } catch (e) {
    message(e.message, 'error');
  } finally {
    $('#install').disabled = false;
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function formatSize(bytes) {
  const units = ['B','KB','MB','GB']; let n = bytes, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

$('#file').addEventListener('change', e => e.target.files[0] && upload(e.target.files[0]).catch(e => message(e.message, 'error')));
$('#install').addEventListener('click', install);
$('#reload').addEventListener('click', health);
document.querySelectorAll('.action').forEach(button => {
  button.addEventListener('click', async () => {
    const action = button.dataset.action;
    try {
      button.disabled = true;
      const r = await fetch(`/api/device/${action}`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Thao tác thất bại.');
      message(action === 'back' ? 'Đã quay lại.' : action === 'home' ? 'Đã về màn hình chính.' : action === 'recents' ? 'Đã mở ứng dụng gần đây.' : 'Đã gửi lệnh xoay màn hình.', 'success');
    } catch (e) {
      message(e.message, 'error');
    } finally {
      button.disabled = false;
    }
  });
});
const drop = $('#drop');
['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag'); }));
['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('drag'); }));
drop.addEventListener('drop', e => { const file = [...e.dataTransfer.files].find(f => f.name.toLowerCase().endsWith('.apk')); if (file) upload(file).catch(err => message(err.message, 'error')); });

health();
setInterval(health, 5000);
