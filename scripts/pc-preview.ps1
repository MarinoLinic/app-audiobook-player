param([switch]$Stop, [switch]$Status, [switch]$NoBrowser, [ValidateRange(10,7200)][int]$LifetimeSeconds = 7200)
$ErrorActionPreference = 'Stop'
$previewRoot = Split-Path -Parent $PSScriptRoot
$previewPackage = Get-Content -LiteralPath (Join-Path $previewRoot 'package.json') -Raw | ConvertFrom-Json
$previewPort = [int]$previewPackage.pcPreview.port
$previewName = [string]$previewPackage.pcPreview.name
$previewUrl = "http://localhost:$previewPort/phone.html"
$previewDirectory = Join-Path $previewRoot '.local\pc-preview'
$previewStatePath = Join-Path $previewDirectory 'state.json'
$previewCli = Join-Path $previewRoot 'node_modules\expo\bin\cli'
New-Item -ItemType Directory -Path $previewDirectory -Force | Out-Null
$previewMutex = New-Object System.Threading.Mutex($false, "Local\Marino.PCPreview.$($previewPackage.name)")
$previewLocked = $false

function Get-PreviewState {
    if (Test-Path -LiteralPath $previewStatePath) {
        try { return Get-Content -LiteralPath $previewStatePath -Raw | ConvertFrom-Json } catch { }
    }
    return $null
}
function Save-PreviewState($previewState) {
    $previewTemporary = $previewStatePath + '.new'
    $previewState | ConvertTo-Json | Set-Content -LiteralPath $previewTemporary -Encoding UTF8
    Move-Item -LiteralPath $previewTemporary -Destination $previewStatePath -Force
}
function Get-OwnedPreview($previewState) {
    if (!$previewState -or !$previewState.processId -or $previewState.root -ne $previewRoot) { return $null }
    $previewProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$previewState.processId)" -ErrorAction SilentlyContinue
    if ($previewProcess -and $previewProcess.Name -eq 'node.exe' -and $previewProcess.CommandLine -and $previewProcess.CommandLine.Contains($previewCli)) {
        return $previewProcess
    }
    return $null
}
function Test-PreviewReady {
    try {
        $previewResponse = Invoke-WebRequest -Uri $previewUrl -UseBasicParsing -TimeoutSec 2
        return $previewResponse.StatusCode -eq 200 -and $previewResponse.Content.Contains("pc-preview:$($previewPackage.name)")
    } catch { return $false }
}
function Open-PreviewBrowser {
    $previewProfile = Join-Path $env:LOCALAPPDATA "Marino\PCAppPreviews\$($previewPackage.name)"
    $previewCandidates = @(
        (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
        (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'),
        (Join-Path $env:ProgramFiles 'BraveSoftware\Brave-Browser\Application\brave.exe')
    )
    $previewBrowser = $previewCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (!$previewBrowser) { throw 'Install Microsoft Edge, Chrome or Brave, then open this launcher again.' }
    $previewExisting = Get-CimInstance Win32_Process | Where-Object {
        $_.ExecutablePath -eq $previewBrowser -and $_.CommandLine -and $_.CommandLine.Contains($previewProfile) -and $_.CommandLine.Contains('--app=')
    } | Select-Object -First 1
    if ($previewExisting) {
        $previewShell = New-Object -ComObject WScript.Shell
        if ($previewShell.AppActivate([int]$previewExisting.ProcessId)) { return }
    }
    Start-Process -FilePath $previewBrowser -ArgumentList @(
        "--app=$previewUrl", "--user-data-dir=`"$previewProfile`"", '--window-size=470,920', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-sync'
    ) -WindowStyle Normal | Out-Null
}

try {
    try { $previewLocked = $previewMutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $previewLocked = $true }
    if (!$previewLocked) { Write-Output "$previewName is already starting or stopping."; exit 0 }
    if ($previewPort -lt 1024 -or $previewPort -gt 65535 -or !$previewName) { throw 'Missing pcPreview settings in package.json.' }
    $previewState = Get-PreviewState
    $previewOwned = Get-OwnedPreview $previewState
    if ($Status) {
        @{running=([bool]$previewOwned -and (Test-PreviewReady)); url=$previewUrl; processId=$previewState.processId; root=$previewRoot; expiresAt=$previewState.expiresAt} | ConvertTo-Json -Compress
        exit 0
    }
    if ($Stop) {
        if ($previewOwned) {
            & taskkill.exe /PID $previewOwned.ProcessId /T /F | Out-Null
            if ($LASTEXITCODE) { throw 'Could not stop the owned preview process.' }
        }
        Save-PreviewState @{root=$previewRoot; processId=$null; url=$previewUrl; stoppedAt=[DateTime]::UtcNow.ToString('o')}
        Write-Output "Stopped $previewName. Close its browser window when finished."
        exit 0
    }
    if (!$previewOwned) {
        if (!(Test-Path -LiteralPath $previewCli)) { throw 'Run Setup PC.cmd first to install this app''s pinned dependencies.' }
        $previewListener = Get-NetTCPConnection -State Listen -LocalPort $previewPort -ErrorAction SilentlyContinue
        if ($previewListener) { throw "Port $previewPort is already in use. Stop the other server; this app keeps a fixed port so its saved browser data stays in one place." }
        $previewNode = (Get-Command node -ErrorAction Stop).Source
        $env:CI = '1'
        $env:EXPO_OFFLINE = '1'
        $env:EXPO_NO_TELEMETRY = '1'
        $env:BROWSER = 'none'
        $previewProcess = Start-Process -FilePath $previewNode -ArgumentList ("`"$previewCli`" start --localhost --port $previewPort --max-workers 2") -WorkingDirectory $previewRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $previewDirectory 'server.log') -RedirectStandardError (Join-Path $previewDirectory 'server-error.log')
        Save-PreviewState @{root=$previewRoot; processId=$previewProcess.Id; url=$previewUrl; startedAt=[DateTime]::UtcNow.ToString('o')}
        $previewOwned = Get-OwnedPreview (Get-PreviewState)
    }
    $previewReady = $false
    for ($previewAttempt = 0; $previewAttempt -lt 120; $previewAttempt++) {
        if (Test-PreviewReady) { $previewReady = $true; break }
        if (!(Get-OwnedPreview (Get-PreviewState))) { break }
        Start-Sleep -Milliseconds 500
    }
    if (!$previewReady) { throw "The local preview did not start. See $previewDirectory\server-error.log" }
    $previewState = Get-PreviewState
    $previewState | Add-Member -NotePropertyName expiresAt -NotePropertyValue ([DateTime]::UtcNow.AddSeconds($LifetimeSeconds).ToString('o')) -Force
    $previewTimeoutScript = Join-Path $PSScriptRoot 'pc-preview-timeout.ps1'
    $previewWatchdog = if ($previewState.watchdogProcessId) { Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$previewState.watchdogProcessId)" -ErrorAction SilentlyContinue }
    if (!$previewWatchdog -or !$previewWatchdog.CommandLine -or !$previewWatchdog.CommandLine.Contains($previewTimeoutScript)) {
        $previewWatchdog = Start-Process -FilePath powershell.exe -ArgumentList ("-NoProfile -ExecutionPolicy Bypass -File `"$previewTimeoutScript`" -ServerProcessId $($previewState.processId)") -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $previewDirectory 'timeout.log') -RedirectStandardError (Join-Path $previewDirectory 'timeout-error.log')
        $previewState | Add-Member -NotePropertyName watchdogProcessId -NotePropertyValue $previewWatchdog.Id -Force
    }
    Save-PreviewState $previewState
    if (!$NoBrowser) { Open-PreviewBrowser }
    Write-Output "$previewName is ready: $previewUrl (server expires $($previewState.expiresAt))"
} catch {
    $_.Exception.Message | Set-Content -LiteralPath (Join-Path $previewDirectory 'launcher-error.log') -Encoding UTF8
    if (!$NoBrowser -and !$Status) {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, "$previewName PC preview") | Out-Null
    } else { Write-Error $_.Exception.Message }
    exit 1
} finally {
    if ($previewLocked) { $previewMutex.ReleaseMutex() }
    $previewMutex.Dispose()
}
