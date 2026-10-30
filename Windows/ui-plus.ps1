<#
  UI+ for Claude - Windows installer.

  Windows counterpart of App/ui-plus.sh. When the Claude desktop app starts
  with REACT_PROFILE=1 (a developer hook meant for React DevTools), it loads a
  local browser extension from its data folder. `install` copies Extension/
  there and sets REACT_PROFILE=1 as a user environment variable, so every app
  started afterwards sees it. On Windows a user environment variable persists
  by itself, so no login item is needed for that; a daily scheduled task only
  checks GitHub for a newer release.

  Claude for Windows comes in two flavours, and this handles both:
    - classic installer:  %APPDATA%\Claude
    - MSIX package:       %LOCALAPPDATA%\Packages\Claude_*\LocalCache\Roaming\Claude
                          (the package redirects %APPDATA% writes there)

  Usage:  powershell -ExecutionPolicy Bypass -File ui-plus.ps1 install|uninstall|restart|status|version|check-update
#>
param([Parameter(Position = 0)][string]$Command = '')

$ErrorActionPreference = 'Stop'

$Name         = 'UI+ for Claude'
$ExtensionId  = 'fmkadmapgofadopljbjfkapdkoienihi'
$Repo         = if ($env:UI_PLUS_REPO) { $env:UI_PLUS_REPO } else { 'LukasvanUden/ui-plus-for-claude' }
$Api          = if ($env:UI_PLUS_API) { $env:UI_PLUS_API } else { 'https://api.github.com' }
$ReleasesUrl  = "https://github.com/$Repo/releases/latest"
$InstallDir   = Join-Path $env:LOCALAPPDATA $Name          # where the installed copy lives
$StateDir     = if ($env:UI_PLUS_STATE) { $env:UI_PLUS_STATE } else { Join-Path $InstallDir 'state' }
$TaskName     = 'UI+ for Claude update check'

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path

function Get-SourceExtension {
  # Installed copy: Extension\ sits next to this script. Git checkout: ..\Extension.
  foreach ($p in @((Join-Path $Here 'Extension'), (Join-Path $Here '..\Extension'))) {
    if (Test-Path (Join-Path $p 'manifest.json')) { return (Resolve-Path $p).Path }
  }
  throw "Can't find the Extension folder next to $Here"
}

function Get-Version {
  $manifest = Join-Path (Get-SourceExtension) 'manifest.json'
  (Get-Content $manifest -Raw | ConvertFrom-Json).version
}

# Every Claude data folder that exists, classic and MSIX. If Claude has never
# run there is none yet, so fall back to the classic location.
function Get-ClaudeDataRoots {
  $roots = @()
  $classic = Join-Path $env:APPDATA 'Claude'
  if (Test-Path $classic) { $roots += $classic }
  $packages = Join-Path $env:LOCALAPPDATA 'Packages'
  if (Test-Path $packages) {
    Get-ChildItem $packages -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like 'Claude_*' -or $_.Name -like 'Anthropic.Claude*' } |
      ForEach-Object {
        $r = Join-Path $_.FullName 'LocalCache\Roaming\Claude'
        if (Test-Path $r) { $roots += $r }
      }
  }
  if ($roots.Count -eq 0) { $roots += $classic }
  return $roots
}

function Get-ExtensionDirs { Get-ClaudeDataRoots | ForEach-Object { Join-Path $_ "extensions\$ExtensionId" } }

# Tell Explorer the environment changed, so apps it starts from now on see
# REACT_PROFILE without signing out.
function Send-EnvironmentChange {
  if (-not ('UiPlus.Native' -as [type])) {
    Add-Type -Namespace UiPlus -Name Native -MemberDefinition @'
[DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
public static extern System.IntPtr SendMessageTimeout(System.IntPtr hWnd, uint Msg, System.UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out System.UIntPtr lpdwResult);
'@
  }
  $result = [UIntPtr]::Zero
  [void][UiPlus.Native]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$result)
}

function Show-Message([string]$text, [string]$buttons = 'OK') {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show($text, $Name, $buttons)
}

function Install-UiPlus {
  $src = Get-SourceExtension

  # 1. The extension, into every Claude data folder. A new version_name each
  #    install shows the add-on again after "Uninstall..." in Claude's popover.
  foreach ($dir in Get-ExtensionDirs) {
    if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    Copy-Item (Join-Path $src '*') $dir -Recurse -Force
    $mf = Join-Path $dir 'manifest.json'
    $json = Get-Content $mf -Raw | ConvertFrom-Json
    $json | Add-Member -NotePropertyName version_name -NotePropertyValue ("install-" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) -Force
    [IO.File]::WriteAllText($mf, ($json | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding $false))
    Write-Host "Extension installed: $dir"
  }

  # 2. A copy of this script and the extension under %LOCALAPPDATA%, so the
  #    scheduled task and "uninstall" keep working after the download is gone.
  if ((Resolve-Path $Here).Path -ne $InstallDir) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Copy-Item $PSCommandPath (Join-Path $InstallDir 'ui-plus.ps1') -Force
    # uninstall.cmd too, so it can be run from there after the download is gone.
    $cmd = Join-Path $Here 'uninstall.cmd'
    if (Test-Path $cmd) { Copy-Item $cmd $InstallDir -Force }
    $dst = Join-Path $InstallDir 'Extension'
    if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
    Copy-Item $src $dst -Recurse -Force
  }

  # 3. REACT_PROFILE=1 for this user, persistent.
  [Environment]::SetEnvironmentVariable('REACT_PROFILE', '1', 'User')
  Send-EnvironmentChange

  # 4. Daily update check.
  $script = Join-Path $InstallDir 'ui-plus.ps1'
  $action  = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`" check-update"
  $trigger = @((New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME), (New-ScheduledTaskTrigger -Daily -At 10am))
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
}

function Uninstall-UiPlus {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  [Environment]::SetEnvironmentVariable('REACT_PROFILE', $null, 'User')
  Send-EnvironmentChange
  foreach ($dir in Get-ExtensionDirs) { if (Test-Path $dir) { Remove-Item $dir -Recurse -Force } }
  if (Test-Path $StateDir) { Remove-Item $StateDir -Recurse -Force }
  # Leave the running script's own folder alone if we're running from it.
  if ((Test-Path $InstallDir) -and ((Resolve-Path $Here).Path -ne (Resolve-Path $InstallDir).Path)) {
    Remove-Item $InstallDir -Recurse -Force
  }
}

function Get-Status {
  $ext = @(Get-ExtensionDirs | Where-Object { Test-Path (Join-Path $_ 'manifest.json') })
  $flag = [Environment]::GetEnvironmentVariable('REACT_PROFILE', 'User')
  if ($ext.Count -gt 0 -and $flag -eq '1') { 'installed' } else { 'missing' }
}

# Announces each newer release once.
function Test-Update {
  try {
    # Windows PowerShell 5.1 may not offer TLS 1.2 by default, which GitHub needs.
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $release = Invoke-RestMethod -Uri "$Api/repos/$Repo/releases/latest" -TimeoutSec 10 -Headers @{ 'User-Agent' = 'ui-plus-for-claude' }
  } catch { return }
  $latest = "$($release.tag_name)".TrimStart('v')
  $current = Get-Version
  try { if ([version]$latest -le [version]$current) { return } } catch { if ($latest -eq $current) { return } }
  $announced = Join-Path $StateDir 'announced'
  if ((Test-Path $announced) -and ((Get-Content $announced -Raw).Trim() -eq $latest)) { return }
  New-Item -ItemType Directory -Path $StateDir -Force | Out-Null
  Set-Content $announced $latest
  if ($env:UI_PLUS_QUIET) { Write-Output "update-available $latest"; return }
  $choice = Show-Message "$Name $latest is available.`n`nDownload it and run install.cmd again." 'OKCancel'
  if ("$choice" -eq 'OK') { Start-Process $ReleasesUrl }
}

# Restarts a running Claude with REACT_PROFILE=1 in its environment, so the
# add-on shows right away. Apps started before the install (and anything
# Explorer starts before it picks up the new variable) don't have it yet;
# from the next Windows sign-in on, every start does.
#
# Only the desktop app is touched. Claude Code's CLI is also claude.exe, so
# processes are matched by where the desktop app lives: the classic installer
# puts it in an AnthropicClaude folder (per user under %LOCALAPPDATA%, or
# per machine under %ProgramData%\<user>), the MSIX package under
# WindowsApps\Claude_* or WindowsApps\Anthropic.Claude*.
function Test-DesktopClaude([string]$path) {
  $path -match '\\AnthropicClaude\\' -or $path -match '\\WindowsApps\\(Claude_|Anthropic\.Claude)'
}

function Restart-Claude {
  $running = @(Get-Process claude -ErrorAction SilentlyContinue | Where-Object { $_.Path -and (Test-DesktopClaude $_.Path) })
  if ($running.Count -eq 0) { return $false }
  $exe = $running[0].Path
  $running | Stop-Process -Force
  Start-Sleep -Seconds 2
  $env:REACT_PROFILE = '1'
  if ($exe -match '\\WindowsApps\\') {
    # A packaged app can't be started from its exe; activate it through the
    # shell instead. The shell starts it with the user environment, which
    # has REACT_PROFILE since the broadcast in Install-UiPlus.
    $pkg = Get-AppxPackage | Where-Object { $exe.StartsWith($_.InstallLocation + '\', [StringComparison]::OrdinalIgnoreCase) } | Select-Object -First 1
    if (-not $pkg) { return $false }
    $appId = @((Get-AppxPackageManifest $pkg).Package.Applications.Application)[0].Id
    Start-Process "shell:AppsFolder\$($pkg.PackageFamilyName)!$appId"
  } else {
    Start-Process $exe
  }
  return $true
}

switch ($Command) {
  'install'      {
    Install-UiPlus
    if (Restart-Claude) { Write-Host "`n$Name is installed. Claude restarted with it." }
    else { Write-Host "`n$Name is installed. Open Claude and it shows in the sidebar. (If it doesn't, sign out of Windows and back in once.)" }
  }
  'restart'      { if (-not (Restart-Claude)) { Write-Host 'Claude is not running.' } }
  'uninstall'    { Uninstall-UiPlus; Write-Host "`n$Name is removed. Quit Claude completely and open it again." }
  'status'       { Get-Status }
  'version'      { Get-Version }
  'check-update' { Test-Update }
  default        { Write-Error 'usage: ui-plus.ps1 install|uninstall|restart|status|version|check-update'; exit 64 }
}
