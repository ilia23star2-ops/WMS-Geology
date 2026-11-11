$ErrorActionPreference = "Stop"
$ProjectRoot   = "D:\Dev\projects\WMS-Geology"
$GradleCache   = "$env:USERPROFILE\.gradle\caches"
$PubCache      = "$env:LOCALAPPDATA\Pub\Cache"
$MavenLocal    = "D:\Dev\maven-local"
$JdkPath       = "D:\Dev\jdk-17"
$SourceFolder  = $PSScriptRoot

Write-Host "=== Разворачивание среды сборки ===" -ForegroundColor Cyan

Write-Host "[1/6] Убиваем зависшие процессы..." -ForegroundColor Yellow
taskkill /F /IM java.exe 2>$null
taskkill /F /IM dart.exe 2>$null
Start-Sleep -Seconds 2

Write-Host "[2/6] Gradle cache..." -ForegroundColor Yellow
if (Test-Path $GradleCache) { Remove-Item -Recurse -Force $GradleCache }
New-Item -ItemType Directory -Path $GradleCache -Force | Out-Null
robocopy "$SourceFolder\gradle-caches" $GradleCache /E /NFL /NDL /NJH /NJS

Write-Host "[3/6] Pub cache..." -ForegroundColor Yellow
if (Test-Path "$PubCache\hosted") { Remove-Item -Recurse -Force "$PubCache\hosted" }
New-Item -ItemType Directory -Path "$PubCache" -Force | Out-Null
robocopy "$SourceFolder\pub-cache\hosted" "$PubCache\hosted" /E /NFL /NDL /NJH /NJS

Write-Host "[4/6] Maven local..." -ForegroundColor Yellow
if (Test-Path "$SourceFolder\maven-local") {
    if (Test-Path $MavenLocal) { Remove-Item -Recurse -Force $MavenLocal }
    New-Item -ItemType Directory -Path $MavenLocal -Force | Out-Null
    robocopy "$SourceFolder\maven-local" $MavenLocal /E /NFL /NDL /NJH /NJS
}

Write-Host "[5/6] mobile..." -ForegroundColor Yellow
robocopy "$SourceFolder\mobile" "$ProjectRoot\mobile" /E /NFL /NDL /NJH /NJS

Write-Host "[6/6] Сертификаты..." -ForegroundColor Yellow
$keytool = Join-Path $JdkPath "bin\keytool.exe"
$certs = Get-ChildItem -Path $SourceFolder -Filter "cert*.pem"
if ($certs.Count -gt 0 -and (Test-Path $keytool)) {
    foreach ($cert in $certs) {
        $alias = "polymetal_" + $cert.BaseName
        & $keytool -importcert -noprompt -alias $alias -file $cert.FullName -cacerts -storepass changeit 2>&1 | Out-Null
        Write-Host "   [OK] $alias" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=== ✅ СРЕДА РАЗВЕРНУТА ===" -ForegroundColor Green
Write-Host "cd $ProjectRoot\mobile"
Write-Host "flutter pub get"
Write-Host "flutter build apk --debug --dart-define=API_HOST=127.0.0.1"