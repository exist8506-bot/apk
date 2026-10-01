$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Chưa tìm thấy Docker."
}

docker compose down
Write-Host "APK Runner đã dừng." -ForegroundColor Yellow
