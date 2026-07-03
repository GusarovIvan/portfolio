Set-Location $PSScriptRoot
Write-Host "Сайт: http://127.0.0.1:8888" -ForegroundColor Green
Write-Host "Остановить: Ctrl+C" -ForegroundColor Gray
python -m http.server 8777 --bind 127.0.0.1
