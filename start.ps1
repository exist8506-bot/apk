$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Chưa tìm thấy Docker. Hãy cài Docker Desktop trước."
}

docker compose up -d --build
Write-Host ""
Write-Host "APK Runner: http://localhost:8080" -ForegroundColor Green
Write-Host "Android noVNC: http://localhost:6080" -ForegroundColor Green
