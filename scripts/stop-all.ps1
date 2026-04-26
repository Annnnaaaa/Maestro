$ErrorActionPreference = "SilentlyContinue"

$ports = @(3000, 3001, 3002, 3003, 3004, 3005, 5173, 8080)

foreach ($port in $ports) {
  $conns = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  if ($null -eq $conns) { continue }

  foreach ($c in @($conns)) {
    $pid = $c.OwningProcess
    if ($null -eq $pid -or $pid -le 0) { continue }
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Write-Output ("Stopped PID {0} on port {1}" -f $pid, $port)
  }
}

