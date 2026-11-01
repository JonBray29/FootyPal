
# FootyPal - Android Frame Development Launcher
# Run from the FootyPal repository:
#   .\scripts\frame-dev.ps1

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$devUrl = "http://127.0.0.1:5173/"
$package = "com.footypal.kiosk"

Set-Location $repoRoot

Write-Host "=== FootyPal Frame Dev ===" -ForegroundColor Cyan

# Check required tools
foreach ($tool in @("adb", "pnpm")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "$tool is not installed or not available in PATH."
    }
}

# Confirm the frame is connected
Write-Host "Checking Android connection..."

$deviceState = (& adb -d get-state 2>&1 | Out-String).Trim()

if ($LASTEXITCODE -ne 0 -or $deviceState -ne "device") {
    throw "Frame not connected or ADB not authorised. Check USB and run 'adb devices -l'."
}

Write-Host "Frame connected." -ForegroundColor Green

# Start Vite if it isn't already running
$viteRunning = $false

try {
    $response = Invoke-WebRequest -Uri $devUrl `
        -UseBasicParsing -TimeoutSec 2

    $viteRunning = $response.StatusCode -eq 200
} catch {
    $viteRunning = $false
}

if (-not $viteRunning) {
    Write-Host "Starting Vite development server..."

    $command = "Set-Location '$repoRoot'; pnpm --filter @footypal/frontend dev"

    Start-Process powershell.exe -ArgumentList @(
        "-NoExit",
        "-Command",
        $command
    )

    # Wait for Vite to become available
    $ready = $false

    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1

        try {
            $response = Invoke-WebRequest -Uri $devUrl `
                -UseBasicParsing -TimeoutSec 2

            if ($response.StatusCode -eq 200) {
                $ready = $true
                break
            }
        } catch {
            # Vite isn't ready yet
        }
    }

    if (-not $ready) {
        throw "Vite did not start. Check the Vite PowerShell window."
    }
} else {
    Write-Host "Existing development server detected."
}

Write-Host "Vite ready at $devUrl" -ForegroundColor Green

# Forward Android localhost port to Windows
Write-Host "Configuring ADB reverse..."

& adb -d reverse tcp:5173 tcp:5173

if ($LASTEXITCODE -ne 0) {
    throw "ADB reverse failed."
}

# Restart the kiosk so it loads the development URL
Write-Host "Launching FootyPal..."

& adb -d shell am force-stop $package

& adb -d shell am start `
    -a android.intent.action.VIEW `
    -d $devUrl `
    -n "$package/.MainActivity"

if ($LASTEXITCODE -ne 0) {
    throw "Failed to launch FootyPal."
}

Write-Host ""
Write-Host "FootyPal development mode ready!" -ForegroundColor Green
Write-Host "Frontend: $devUrl"
Write-Host "Edit your React files in VS Code to see live updates."
Write-Host ""
Write-Host "Close the Vite PowerShell window when finished."
