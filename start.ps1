$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Chưa tìm thấy Docker. Hãy cài Docker Desktop trước."
}

docker compose up -d --build

Write-Host ""
Write-Host "Đang chờ APK Runner khởi động..." -ForegroundColor Cyan
$serverReady = $false
$emulatorReady = $false

for ($i = 1; $i -le 90; $i++) {
  try {
    $health = Invoke-RestMethod -Uri "http://localhost:8080/api/health" -TimeoutSec 3
    $serverReady = $true
    $emulatorReady = [bool]$health.deviceReady

    if ($emulatorReady) {
      Write-Host "Web server: OK" -ForegroundColor Green
      Write-Host "Android emulator: ONLINE" -ForegroundColor Green
      break
    }

    Write-Host "Android emulator: đang boot ($i/90)" -ForegroundColor Yellow
  } catch {
    Write-Host "Web server: đang khởi động ($i/90)" -ForegroundColor Yellow
  }
  Start-Sleep -Seconds 2
}

Write-Host ""
if ($serverReady -and $emulatorReady) {
  Write-Host "APK Runner: http://localhost:8080" -ForegroundColor Green
  Write-Host "Android noVNC: http://localhost:6080" -ForegroundColor Green
} elseif ($serverReady) {
  Write-Host "Web đã chạy nhưng emulator chưa ONLINE." -ForegroundColor Red
  Write-Host "Kiểm tra KVM/virtualization và chạy: docker compose logs --tail=200 android" -ForegroundColor Yellow
  exit 1
} else {
  Write-Host "Không khởi động được server." -ForegroundColor Red
  Write-Host "Chạy: docker compose logs --tail=200" -ForegroundColor Yellow
  exit 1
}
