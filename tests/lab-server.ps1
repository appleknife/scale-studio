# Test-only static server that also accepts POSTed results, so a headless
# browser can report what it computed.
param(
  [int]$Port = 8780,
  [string]$Root = (Split-Path $PSScriptRoot -Parent),
  [string]$OutFile = (Join-Path $PSScriptRoot 'last-result.json')
)

$ErrorActionPreference = 'Stop'
$rootFull = [System.IO.Path]::GetFullPath($Root)
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "lab server on http://localhost:$Port (root $rootFull)"

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg' = 'image/svg+xml'
  '.png' = 'image/png'
  '.wav' = 'audio/wav'
}

while ($true) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $res.Headers.Add('Access-Control-Allow-Origin', '*')
    if ($req.HttpMethod -eq 'POST') {
      $reader = New-Object System.IO.StreamReader($req.InputStream)
      $body = $reader.ReadToEnd()
      [System.IO.File]::WriteAllText($OutFile, $body)
      $res.StatusCode = 204
    }
    elseif ($req.HttpMethod -eq 'OPTIONS') {
      $res.StatusCode = 204
    }
    else {
      $rel = $req.Url.LocalPath.TrimStart('/')
      $full = [System.IO.Path]::GetFullPath((Join-Path $rootFull $rel))
      if (-not $full.StartsWith($rootFull)) { $res.StatusCode = 403 }
      elseif (Test-Path -LiteralPath $full -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($full)
        $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
        $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      }
      else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 $rel")
        $res.OutputStream.Write($msg, 0, $msg.Length)
      }
    }
  }
  catch {
    Write-Host "error: $_"
  }
  finally {
    $res.Close()
  }
}
