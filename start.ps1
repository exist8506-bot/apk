$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Chưa tìm thấy Docker. Hãy cài Docker Desktop trước."
}

docker compose up -d --build

Write-Host ""
Write-Host "Đang chờ APK Runner khởi động..." -ForegroundColor Cyan
$ready = $false
for ($i = 1; $i -le 60; $i++) {
  try {
    $health = Invoke-RestMethod -Uri "http://localhost:8080/api/health" -TimeoutSec 3
    if ($health.ok) {
      $ready = $true
      Write-Host "Web server: OK" -ForegroundColor Green
      if ($health.deviceReady) {
        Write-Host "Android emulator: ONLINE" -ForegroundColor Green
        break
      }
      Write-Host "Android emulator: đang boot ($i/60)" -ForegroundColor Yellow
    }
  } catch {
    Write-Host "Web server: đang khởi động ($i/60)" -ForegroundColor Yellow
  }
  Start-Sleep -Seconds 2
}

Write-Host ""
if ($ready) {
  Write-Host "APK Runner: http://localhost:8080" -ForegroundColor Green
  Write-Host "Android noVNC: http://localhost:6080" -ForegroundColor Green
} else {
  Write-Host "Chưa xác nhận được server. Chạy: docker compose logs --tail=200" -ForegroundColor Red
  exit 1
}
