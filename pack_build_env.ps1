$ErrorActionPreference = "Stop"
$ProjectRoot   = "C:\Projert\WMS-Geology"
$GradleCache   = "$env:USERPROFILE\.gradle\caches"
$PubCache      = "$env:LOCALAPPDATA\Pub\Cache"
$MavenLocal    = "$env:USERPROFILE\.m2\repository"
$DestFolder    = "$ProjectRoot\WMS-Build-Pack"

Write-Host "=== Упаковка среды сборки ===" -ForegroundColor Cyan
if (Test-Path $DestFolder) { Remove-Item -Recurse -Force $DestFolder }
New-Item -ItemType Directory -Path $DestFolder -Force | Out-Null

Write-Host "[1/6] Gradle cache..." -ForegroundColor Yellow
robocopy $GradleCache "$DestFolder\gradle-caches" /E /NFL /NDL /NJH /NJS

Write-Host "[2/6] Pub cache..." -ForegroundColor Yellow
robocopy "$PubCache\hosted" "$DestFolder\pub-cache\hosted" /E /NFL /NDL /NJH /NJS

Write-Host "[3/6] Maven local..." -ForegroundColor Yellow
if (Test-Path $MavenLocal) {
    robocopy $MavenLocal "$DestFolder\maven-local" /E /NFL /NDL /NJH /NJS
} else {
    Write-Host "   [SKIP] $MavenLocal не найден" -ForegroundColor Gray
}

Write-Host "[4/6] mobile (без build/.gradle/.dart_tool)..." -ForegroundColor Yellow
robocopy "$ProjectRoot\mobile" "$DestFolder\mobile" /E /NFL /NDL /NJH /NJS /XD build .gradle .dart_tool .idea

Write-Host "[5/6] Сертификаты..." -ForegroundColor Yellow
$certsDir = "$ProjectRoot\work-pc-setup"
if (Test-Path $certsDir) {
    Get-ChildItem -Path $certsDir -Filter "cert*.pem" | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination "$DestFolder\$($_.Name)"
    }
}

Write-Host "[6/6] install_build_env.ps1..." -ForegroundColor Yellow
Copy-Item -Path "$ProjectRoot\install_build_env.ps1" -Destination "$DestFolder\install_build_env.ps1"

$size = (Get-ChildItem -Path $DestFolder -Recurse | Measure-Object -Property Length -Sum).Sum / 1GB
Write-Host "=== ✅ УПАКОВКА ЗАВЕРШЕНА ===" -ForegroundColor Green
Write-Host ("Размер: {0:N2} ГБ — $DestFolder" -f $size) -ForegroundColor Cyan