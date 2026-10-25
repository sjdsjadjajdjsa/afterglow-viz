# installs or updates afterglow-viz for spicetify
#   iwr -useb https://raw.githubusercontent.com/sjdsjadjajdjsa/afterglow-viz/main/install.ps1 | iex
# runs in its own scope so nothing is left behind in the user's session
& {
  $ErrorActionPreference = "Stop"
  # older windows powershell needs tls 1.2 turned on for github, and its
  # progress bar makes downloads very slow
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  $ProgressPreference = "SilentlyContinue"
  $app = "afterglow-viz"
  $url = "https://github.com/sjdsjadjajdjsa/afterglow-viz/releases/latest/download/afterglow-viz.zip"

  $spicetify = (Get-Command spicetify -ErrorAction SilentlyContinue).Source
  if (-not $spicetify) {
    $guess = Join-Path $env:LOCALAPPDATA "spicetify\spicetify.exe"
    if (Test-Path $guess) { $spicetify = $guess }
  }
  if (-not $spicetify) {
    Write-Host "Spicetify isn't installed yet. Get it from https://spicetify.app, then run this again."
    return
  }

  # CustomApps sits next to spicetify's config file
  $config = ((& $spicetify -c 2>$null) | Select-Object -Last 1) -replace "\x1b\[[0-9;]*m", ""
  if ($config -and (Test-Path $config)) {
    $dir = Join-Path (Split-Path $config) "CustomApps"
  } else {
    $dir = Join-Path $env:APPDATA "spicetify\CustomApps"
  }

  $zip = Join-Path ([IO.Path]::GetTempPath()) "afterglow-viz.zip"
  Write-Host "Downloading afterglow-viz..."
  Invoke-WebRequest -UseBasicParsing $url -OutFile $zip
  New-Item -ItemType Directory -Force $dir | Out-Null
  $target = Join-Path $dir $app
  if (Test-Path $target) { Remove-Item -Recurse -Force $target }
  Expand-Archive -Force $zip $dir
  Remove-Item $zip
  Write-Host "Installed to $target"

  $current = ((& $spicetify config custom_apps 2>$null) -join " ") -split "[\s|]+"
  if ($current -notcontains $app) { & $spicetify config custom_apps $app }
  & $spicetify apply
  Write-Host "Done. Open afterglow-viz from Spotify's sidebar."
}
