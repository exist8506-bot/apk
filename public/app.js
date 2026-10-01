const $ = (s) => document.querySelector(s);
let selectedFile = null;

function selectFile(file) {
  if (!file || !file.name.toLowerCase().endsWith('.apk')) {
    message('Vui lòng chọn đúng file .apk', 'error');
    return;
  }
  selectedFile = file;
  $('#fileInfo').classList.remove('hidden');
  $('#fileInfo').innerHTML = `<strong>${escapeHtml(file.name)}</strong><span>${formatSize(file.size)} • đã chọn</span>`;
  $('#openTester').disabled = false;
  message('Đã chọn APK. Bấm “Mở trình chạy APK”.', 'success');
}

function openTester() {
  if (!selectedFile) return;
  window.open('https://ramus.dev/products/test-apps-online', '_blank', 'noopener');
  message('Ramus đã được mở ở tab mới. Tại đó chọn lại file APK để bắt đầu phiên Android Cloud.', 'success');
}

function message(text, type = '') {
  const el = $('#message');
  el.textContent = text;
  el.className = `message ${type}`;
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
$('#openTester').addEventListener('click', openTester);

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
