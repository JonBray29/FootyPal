# FootyPal: native Windows production APK build
# Invoke from the repository root with: pnpm frame:build
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Run([string]$program, [string[]]$arguments) {
    & $program @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed (exit $LASTEXITCODE): $program"
    }
}

$repo = Split-Path -Parent $PSScriptRoot
$kiosk = Join-Path $repo 'frontend\kiosk'
$dist = Join-Path $repo 'frontend\dist'
$build = Join-Path $kiosk 'build'
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { 'C:\Android\Sdk' }
$jdk = if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin\javac.exe'))) {
    $env:JAVA_HOME
} else {
    'C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot'
}
$bt = Join-Path $sdk 'build-tools\34.0.0'
$jar = Join-Path $sdk 'platforms\android-34\android.jar'
$keystore = Join-Path $env:USERPROFILE '.android\debug.keystore'

foreach ($file in @(
    (Join-Path $jdk 'bin\javac.exe'),
    (Join-Path $jdk 'bin\java.exe'),
    (Join-Path $bt 'aapt2.exe'),
    (Join-Path $bt 'd8.bat'),
    (Join-Path $bt 'zipalign.exe'),
    (Join-Path $bt 'apksigner.bat'),
    $jar, $keystore,
    (Join-Path $kiosk 'AndroidManifest.xml')
)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Required file not found: $file" }
}

# Ensure SDK batch files invoke the correct Java, not any system Java 8.
$env:JAVA_HOME = $jdk
$env:ANDROID_HOME = $sdk
$env:Path = "$(Join-Path $jdk 'bin');$env:Path"

Push-Location $repo
try {
    Write-Host '=== Building React frontend ==='
    Run 'pnpm.cmd' @('--filter', '@footypal/frontend', 'build')
    if (-not (Test-Path (Join-Path $dist 'index.html'))) { throw 'Frontend dist/index.html not found' }

    Write-Host '=== Building Android kiosk ==='
    Push-Location $kiosk
    try {
        if (Test-Path $build) { Remove-Item $build -Recurse -Force }
        foreach ($dir in @('gen','classes','assets\site')) {
            New-Item -ItemType Directory -Path (Join-Path $build $dir) -Force | Out-Null
        }
        Copy-Item (Join-Path $dist '*') (Join-Path $build 'assets\site') -Recurse -Force

        $aapt = Join-Path $bt 'aapt2.exe'
        Run $aapt @('compile', '--dir', 'res', '-o', 'build\res.zip')
        Run $aapt @('link', '-o', 'build\base.apk', '-I', $jar,
            '--manifest', 'AndroidManifest.xml', '-A', 'build\assets',
            'build\res.zip', '--java', 'build\gen',
            '--min-sdk-version', '23', '--target-sdk-version', '23',
            '--version-code', '2', '--version-name', '1.1')

        # On Windows, aapt2 can store asset entries with backslashes.
        # Android AssetManager expects forward-slash ZIP entry paths.
        Add-Type -AssemblyName System.IO.Compression
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $base = Join-Path $build 'base.apk'
        $assetZip = [System.IO.Compression.ZipFile]::Open($base, [System.IO.Compression.ZipArchiveMode]::Update)
        try {
            $incorrect = @($assetZip.Entries | Where-Object { $_.FullName.Contains('\') })
            foreach ($entry in $incorrect) {
                $fixedName = $entry.FullName.Replace('\', '/')
                if ($null -ne $assetZip.GetEntry($fixedName)) {
                    throw "Duplicate APK entry after path normalization: $fixedName"
                }
                $fixed = $assetZip.CreateEntry($fixedName, [System.IO.Compression.CompressionLevel]::Optimal)
                $sourceStream = $entry.Open()
                $targetStream = $fixed.Open()
                try { $sourceStream.CopyTo($targetStream) }
                finally {
                    $targetStream.Dispose()
                    $sourceStream.Dispose()
                }
                $entry.Delete()
            }
        } finally {
            $assetZip.Dispose()
        }

        $javaSources = @(Get-ChildItem 'src\com\footypal\kiosk' -Filter '*.java' -File | ForEach-Object FullName)
        $javaSources += (Join-Path $build 'gen\com\footypal\kiosk\R.java')
        Run (Join-Path $jdk 'bin\javac.exe') (@('-nowarn','-source','8','-target','8',
            '-classpath', $jar, '-d', 'build\classes') + $javaSources)

        $classes = @(Get-ChildItem (Join-Path $build 'classes') -Recurse -File -Filter '*.class' | ForEach-Object FullName)
        if ($classes.Count -eq 0) { throw 'No Java classes produced' }
        Run (Join-Path $bt 'd8.bat') (@('--min-api', '23', '--lib', $jar,
            '--output', $build) + $classes)
        $dex = Join-Path $build 'classes.dex'
        if (-not (Test-Path $dex)) { throw 'D8 did not produce classes.dex' }

        # Add compiled dex to the resource APK, then align and sign it.
        Add-Type -AssemblyName System.IO.Compression
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $base = Join-Path $build 'base.apk'
        $archive = [System.IO.Compression.ZipFile]::Open($base, [System.IO.Compression.ZipArchiveMode]::Update)
        try {
            $existing = $archive.GetEntry('classes.dex')
            if ($null -ne $existing) { $existing.Delete() }
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive, $dex, 'classes.dex', [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
        } finally {
            $archive.Dispose()
        }

        Run (Join-Path $bt 'zipalign.exe') @('-f','4','build\base.apk','build\aligned.apk')
        $apk = Join-Path $build 'footypal.apk'
        Run (Join-Path $bt 'apksigner.bat') @('sign', '--ks', $keystore,
            '--ks-pass', 'pass:android', '--key-pass', 'pass:android',
            '--out', $apk, 'build\aligned.apk')
        Run (Join-Path $bt 'apksigner.bat') @('verify', '--verbose', $apk)

        $zip = [System.IO.Compression.ZipFile]::OpenRead($apk)
        try {
            foreach ($entry in @('classes.dex','assets/site/index.html')) {
                if (-not $zip.GetEntry($entry)) { throw "APK missing $entry" }
            }
            $js = @($zip.Entries | Where-Object FullName -Like 'assets/site/assets/*.js')
            if ($js.Count -eq 0) { throw 'APK missing bundled frontend JavaScript' }
        } finally {
            $zip.Dispose()
        }
        Write-Host "PASS: APK built and verified: $apk" -ForegroundColor Green
        Get-FileHash -LiteralPath $apk -Algorithm SHA256 | Format-List Hash,Path
    } finally {
        Pop-Location
    }
} finally {
    Pop-Location
}
