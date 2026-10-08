# Menjalankan AI House untuk pemakaian sehari-hari: 9router, OpenCode khusus House, lalu API + dashboard.
# Pakai:  powershell -ExecutionPolicy Bypass -File scripts\start-house.ps1 [-Port 3000] [-NoBrowser]
param(
  [int]$Port = 3000,
  [switch]$NoBrowser
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Api = Join-Path $Root "apps\api"
$Logs = Join-Path $Root "data\logs"
New-Item -ItemType Directory -Force $Logs | Out-Null

# Muat .env ke proses ini; diwarisi oleh 9router, OpenCode, dan API.
Get-Content (Join-Path $Root ".env") | ForEach-Object {
  if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim(), "Process") }
}
$env:PORT = "$Port"
$env:NODE_ENV = "production"

function Test-Port([int]$p) {
  $c = New-Object Net.Sockets.TcpClient
  try { $c.Connect("127.0.0.1", $p); $true } catch { $false } finally { $c.Dispose() }
}

function Start-Hidden([string]$Name, [string]$Command, [string]$Dir) {
  # cmd /c agar perintah npm (.cmd) seperti 9router dan opencode bisa dijalankan
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c $Command" -WorkingDirectory $Dir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $Logs "$Name.log") -RedirectStandardError (Join-Path $Logs "$Name.err.log") | Out-Null
}

function Wait-Port([int]$p, [string]$Name, [int]$Seconds = 40) {
  for ($i = 0; $i -lt $Seconds; $i++) { if (Test-Port $p) { return } ; Start-Sleep -Seconds 1 }
  throw "$Name tidak menyala di port $p. Lihat data\logs\$Name.err.log"
}

if (Test-Port $Port) { throw "Port $Port sudah dipakai (mungkin server dev masih jalan). Hentikan dulu atau pakai -Port lain." }
if (-not $env:OPENCODE_SERVER_PASSWORD) { throw "OPENCODE_SERVER_PASSWORD di .env masih kosong." }

# 1. 9router (dipakai juga oleh alat lain, jadi tidak dimatikan oleh stop-house)
if (Test-Port 20128) { Write-Host "9router sudah berjalan." }
else { Write-Host "Menyalakan 9router..."; Start-Hidden "9router" "9router -n --skip-update" $Root; Wait-Port 20128 "9router" }

# 2. OpenCode khusus House, memakai konfigurasi House sendiri (agen "house" yang ramping) dan tanpa
#    tambahan dari konfigurasi global/Claude Code (MCP, skill, instruksi) agar token per langkah kecil.
$env:OPENCODE_CONFIG_DIR = Join-Path $Root "house\opencode"
$env:OPENCODE_DISABLE_CLAUDE_CODE = "1"
$env:OPENCODE_DISABLE_CLAUDE_CODE_PROMPT = "1"
$env:OPENCODE_DISABLE_CLAUDE_CODE_SKILLS = "1"
$env:OPENCODE_DISABLE_EXTERNAL_SKILLS = "1"
$env:OPENCODE_DISABLE_DEFAULT_PLUGINS = "1"
$env:OPENCODE_DISABLE_AUTOUPDATE = "1"
if (-not $env:NINEROUTER_BASE_URL) { $env:NINEROUTER_BASE_URL = "http://127.0.0.1:20128/v1" }
$ocPort = ([Uri]$env:OPENCODE_SERVER_URL).Port
$workspaces = Join-Path $Api "workspaces"
New-Item -ItemType Directory -Force $workspaces | Out-Null
if (Test-Port $ocPort) { Write-Host "OpenCode House sudah berjalan di port $ocPort." }
else { Write-Host "Menyalakan OpenCode di port $ocPort..."; Start-Hidden "opencode" "opencode serve --port $ocPort" $workspaces; Wait-Port $ocPort "opencode" }

# 3. Build bila belum ada, lalu API + dashboard
if (-not (Test-Path (Join-Path $Api "dist\main.js")) -or -not (Test-Path (Join-Path $Root "apps\web\dist\index.html"))) {
  Write-Host "Build pertama kali (sekitar 1 menit)..."
  Push-Location $Root; try { pnpm build | Out-Null } finally { Pop-Location }
}
Write-Host "Menyalakan AI House di port $Port..."
Start-Hidden "api" "node dist\main.js" $Api
Wait-Port $Port "api"

$url = "http://127.0.0.1:$Port"
Write-Host "AI House siap: $url  (log: data\logs)"
if (-not $NoBrowser) { Start-Process $url }
