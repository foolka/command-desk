$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$version = (Get-Content -Raw -LiteralPath (Join-Path $root 'package.json') | ConvertFrom-Json).version
$folder = Join-Path $root 'release\CommandDesk-win32-x64'
if (!(Test-Path -LiteralPath (Join-Path $folder 'CommandDesk.exe'))) { throw 'Build the application first' }
$archive = Join-Path $root "release\command-desk-$version-windows-x64-portable.zip"
Compress-Archive -Path (Join-Path $folder '*') -DestinationPath $archive -CompressionLevel Optimal -Force
$stream = [IO.File]::OpenRead($archive)
$hasher = [Security.Cryptography.SHA256]::Create()
try { $sum = [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
finally { $stream.Dispose(); $hasher.Dispose() }
[IO.File]::WriteAllText($archive + '.sha256', $sum + '  ' + (Split-Path -Leaf $archive) + "`n", [Text.UTF8Encoding]::new($false))
Write-Output $archive
