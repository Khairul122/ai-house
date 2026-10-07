# Menghentikan AI House (API dan OpenCode khusus House). 9router dibiarkan karena dipakai alat lain;
# tambahkan -All untuk ikut mematikannya.
# Pakai:  powershell -ExecutionPolicy Bypass -File scripts\stop-house.ps1 [-Port 3000] [-All]
param(
  [int]$Port = 3000,
  [switch]$All
)
$Root = Split-Path -Parent $PSScriptRoot
$ocPort = 4097
Get-Content (Join-Path $Root ".env") | ForEach-Object {
  if ($_ -match '^\s*OPENCODE_SERVER_URL=(.*)$') { $ocPort = ([Uri]$Matches[1].Trim()).Port }
}

$ports = @($Port, $ocPort)
if ($All) { $ports += 20128 }

foreach ($p in $ports) {
  $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
  if (-not $conns) { Write-Host "Port $p sudah tidak dipakai."; continue }
  foreach ($c in $conns) {
    $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    if ($proc) {
      Stop-Process -Id $proc.Id -Force -Confirm:$false
      Write-Host "Dihentikan: $($proc.ProcessName) (port $p)"
    }
  }
}
