# =========================================================================
#  مِرسم — verify-photoshop.ps1
#  Proof, not a claim: opens a generated .psd in the REAL installed
#  Photoshop through COM, reads back the document size and every layer
#  name (top-down, exactly what the Layers panel shows), then closes the
#  document without saving and quits only if this script started the app.
#
#  USAGE
#    powershell -ExecutionPolicy Bypass -File bridge/verify-photoshop.ps1 `
#        -Path bridge/out/mirsam-1080x1350.psd `
#        -ExpectWidth 1080 -ExpectHeight 1350 `
#        -ExpectLayers "14 subhead,13 headline,...,01 accent-band,Background"
#
#  -ExpectLayers is comma-separated in LAYERS-PANEL ORDER (topmost first).
#  Photoshop's own convention: a fully opaque bottom layer is shown as the
#  localized "Background" whatever name the file stores, so pass "Background"
#  for that entry (the PSD itself still carries its manifest name).
#
#  Exit code 0 = opened and matched. 1 = opened but mismatched. 2 = no
#  Photoshop / open failed (reported, never faked).
# =========================================================================
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Path,
  [int]$ExpectWidth = 0,
  [int]$ExpectHeight = 0,
  [string]$ExpectLayers = ''   # comma-separated, top-down (Layers panel order)
)

$ErrorActionPreference = 'Stop'

function Get-Num($v) {
  if ($null -eq $v) { return $null }
  if ($v -is [double] -or $v -is [int] -or $v -is [long] -or $v -is [decimal]) { return [double]$v }
  try { $p = $v.Value; if ($null -ne $p) { return [double]$p } } catch { }
  try { return [double]$v } catch { return $null }
}

$full = if ([System.IO.Path]::IsPathRooted($Path)) { [System.IO.Path]::GetFullPath($Path) }
        else { [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $Path)) }
if (-not (Test-Path -LiteralPath $full)) {
  @{ ok = $false; error = "file not found: $full" } | ConvertTo-Json -Compress
  exit 2
}

$expectList = @($ExpectLayers.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })

$alreadyRunning = [bool](Get-Process -Name Photoshop -ErrorAction SilentlyContinue)
$app = $null
$doc = $null

try {
  $app = New-Object -ComObject Photoshop.Application
  # 1 = psPixels, so Width/Height read back in the units the PSD was written in
  try { $app.Preferences.RulerUnits = 1 } catch { }
  $doc = $app.Open($full)

  $w = Get-Num $doc.Width
  $h = Get-Num $doc.Height
  $names = @()
  $count = 0
  try { $count = [int]$doc.Layers.Count } catch { $count = 0 }
  for ($i = 1; $i -le $count; $i++) {
    try { $names += [string]$doc.Layers.Item($i).Name } catch { }
  }

  $mismatch = @()
  if ($ExpectWidth -gt 0 -and [math]::Round($w) -ne $ExpectWidth) { $mismatch += "width $([math]::Round($w)) != $ExpectWidth" }
  if ($ExpectHeight -gt 0 -and [math]::Round($h) -ne $ExpectHeight) { $mismatch += "height $([math]::Round($h)) != $ExpectHeight" }
  if ($expectList.Count -gt 0) {
    if ($names.Count -ne $expectList.Count) {
      $mismatch += "layer count $($names.Count) != $($expectList.Count)"
    } else {
      for ($i = 0; $i -lt $expectList.Count; $i++) {
        if ($names[$i] -ne $expectList[$i]) { $mismatch += "layer $($i + 1) '$($names[$i])' != '$($expectList[$i])'" }
      }
    }
  }

  $result = [ordered]@{
    ok        = ($mismatch.Count -eq 0)
    app       = 'Photoshop'
    version   = [string]$app.Version
    file      = $full
    width     = [math]::Round($w)
    height    = [math]::Round($h)
    count     = $names.Count
    layers    = $names
    mismatch  = $mismatch
  }
  $result | ConvertTo-Json -Depth 4
  $code = if ($mismatch.Count -eq 0) { 0 } else { 1 }
}
catch {
  @{ ok = $false; error = $_.Exception.Message; file = $full } | ConvertTo-Json -Compress
  $code = 2
}
finally {
  if ($doc) { try { $doc.Close(2) } catch { } }   # 2 = psDoNotSaveChanges
  if ($app) {
    if (-not $alreadyRunning) { try { $app.Quit() } catch { } }
    try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) } catch { }
  }
  [GC]::Collect()
}

exit $code
