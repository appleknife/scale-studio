# Tiny static server for Scale Studio.
#
# The microphone is only available to a "secure" page, which in practice means
# http://localhost. That is why the app is opened through this server rather
# than by double-clicking index.html.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File server.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File server.ps1 -Port 9000
#
# Stop it with Ctrl+C in the window it was started from.

param(
  [int]$Port = 8777,
  [string]$Root = $PSScriptRoot,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$rootFull = [System.IO.Path]::GetFullPath($Root)

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
  '.wav'  = 'audio/wav'
}

$listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback), $Port
$listener.Start()
Write-Host ""
Write-Host "  Scale Studio is running at http://localhost:$Port/"
Write-Host "  Leave this window open while you practise. Ctrl+C to stop."
Write-Host ""

if (-not $NoBrowser) {
  Start-Process "http://localhost:$Port/"
}

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $stream.ReadTimeout = 5000
    $buf = New-Object byte[] 8192
    $n = $stream.Read($buf, 0, $buf.Length)
    if ($n -le 0) { continue }

    $request = [System.Text.Encoding]::ASCII.GetString($buf, 0, $n)
    $line = ($request -split "`r`n")[0]
    $parts = $line.Split(' ')
    $path = if ($parts.Length -ge 2) { $parts[1] } else { '/' }
    $path = $path.Split('?')[0]
    if ($path -eq '/') { $path = '/index.html' }

    $relative = $path.TrimStart('/')
    $full = [System.IO.Path]::GetFullPath((Join-Path $rootFull $relative))

    if (-not $full.StartsWith($rootFull)) {
      $body = [System.Text.Encoding]::UTF8.GetBytes('403')
      $ct = 'text/plain'
      $status = 'HTTP/1.1 403 Forbidden'
    }
    elseif (Test-Path -LiteralPath $full -PathType Leaf) {
      $body = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
      $ct = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $status = 'HTTP/1.1 200 OK'
    }
    else {
      $body = [System.Text.Encoding]::UTF8.GetBytes("Not found: $path")
      $ct = 'text/plain; charset=utf-8'
      $status = 'HTTP/1.1 404 Not Found'
    }

    $header = "$status`r`nContent-Type: $ct`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
    $stream.Flush()
  }
  catch {
    # A dropped connection is not interesting.
  }
  finally {
    $client.Close()
  }
}
