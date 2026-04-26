$ErrorActionPreference = "SilentlyContinue"

$ports = @(3000, 3001, 3002, 3003, 3004, 3005, 5173, 8080)

foreach ($port in $ports) {
  # Primary: Get-NetTCPConnection
  $conns = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  $pids = @()
  if ($null -ne $conns) {
    $pids = @($conns | Select-Object -ExpandProperty OwningProcess)
  }

  # Fallback: netstat -ano parsing (more reliable on some Windows setups)
  if ($pids.Count -eq 0) {
    $lines = netstat -ano | findstr /R (":$port\\s")
    foreach ($line in @($lines)) {
      $parts = ($line -replace "\\s+", " ").Trim().Split(" ")
      if ($parts.Length -ge 5) {
        $pidStr = $parts[$parts.Length - 1]
        [int]$pidVal = 0
        if ([int]::TryParse($pidStr, [ref]$pidVal) -and $pidVal -gt 0) {
          $pids += $pidVal
        }
      }
    }
  }

  $pids = @($pids | Sort-Object -Unique)
  foreach ($pid in $pids) {
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Write-Output ("Stopped PID {0} on port {1}" -f $pid, $port)
  }
}

