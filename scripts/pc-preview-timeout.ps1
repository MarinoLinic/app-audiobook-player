param([Parameter(Mandatory=$true)][int]$ServerProcessId)
$ErrorActionPreference = 'Stop'
$previewRoot = Split-Path -Parent $PSScriptRoot
$previewStatePath = Join-Path $previewRoot '.local\pc-preview\state.json'
$previewCli = Join-Path $previewRoot 'node_modules\expo\bin\cli'
$previewPackage = Get-Content -LiteralPath (Join-Path $previewRoot 'package.json') -Raw | ConvertFrom-Json
$previewOriginal = Get-Process -Id $ServerProcessId -ErrorAction SilentlyContinue
if (!$previewOriginal) { exit 0 }
$previewStarted = $previewOriginal.StartTime
$previewDeadline = [DateTime]::UtcNow.AddHours(2)
while ($true) {
    Start-Sleep -Seconds 5
    $previewProcess = Get-Process -Id $ServerProcessId -ErrorAction SilentlyContinue
    if (!$previewProcess -or $previewProcess.StartTime -ne $previewStarted) { exit 0 }
    try {
        $previewState = Get-Content -LiteralPath $previewStatePath -Raw | ConvertFrom-Json
        if ($previewState.root -ne $previewRoot -or $previewState.processId -ne $ServerProcessId) { exit 0 }
        if ($previewState.expiresAt) { $previewDeadline = [DateTime]::Parse($previewState.expiresAt).ToUniversalTime() }
    } catch { }
    if ([DateTime]::UtcNow -lt $previewDeadline) { continue }
    $previewMutex = New-Object System.Threading.Mutex($false, "Local\Marino.PCPreview.$($previewPackage.name)")
    $previewLocked = $false
    try {
        try { $previewLocked = $previewMutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $previewLocked = $true }
        if (!$previewLocked) { continue }
        $previewState = Get-Content -LiteralPath $previewStatePath -Raw | ConvertFrom-Json
        if ($previewState.root -ne $previewRoot -or $previewState.processId -ne $ServerProcessId) { exit 0 }
        if ($previewState.expiresAt -and [DateTime]::Parse($previewState.expiresAt).ToUniversalTime() -gt [DateTime]::UtcNow) { continue }
        $previewOwned = Get-CimInstance Win32_Process -Filter "ProcessId = $ServerProcessId" -ErrorAction SilentlyContinue
        $previewCurrent = Get-Process -Id $ServerProcessId -ErrorAction SilentlyContinue
        if (!$previewCurrent -or $previewCurrent.StartTime -ne $previewStarted -or !$previewOwned -or $previewOwned.Name -ne 'node.exe' -or !$previewOwned.CommandLine -or !$previewOwned.CommandLine.Contains($previewCli)) { exit 0 }
        & taskkill.exe /PID $ServerProcessId /T /F | Out-Null
        if ($LASTEXITCODE) { throw 'The preview lifetime expired, but its owned process could not stop.' }
        @{root=$previewRoot; processId=$null; url=$previewState.url; stoppedAt=[DateTime]::UtcNow.ToString('o'); reason='preview lifetime expired'} | ConvertTo-Json | Set-Content -LiteralPath $previewStatePath -Encoding UTF8
        Write-Output 'Stopped the owned PC preview after its finite lifetime.'
        exit 0
    } finally {
        if ($previewLocked) { $previewMutex.ReleaseMutex() }
        $previewMutex.Dispose()
    }
}
