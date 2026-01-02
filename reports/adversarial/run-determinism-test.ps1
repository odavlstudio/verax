# Determinism Test Script
# Runs guardian reality on the same URL 10 times and captures outputs

param(
    [string]$Url = "https://example.com",
    [string]$OutputDir = "reports\adversarial\runs"
)

Write-Host "🔬 Adversarial QA - Determinism Test" -ForegroundColor Cyan
Write-Host "URL: $Url" -ForegroundColor Yellow
Write-Host "Runs: 10" -ForegroundColor Yellow
Write-Host ""

# Create output directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$results = @()

for ($i = 1; $i -le 10; $i++) {
    Write-Host "Run $i/10..." -ForegroundColor Gray
    
    $runDir = Join-Path $OutputDir "run-$($i.ToString('00'))"
    if (-not (Test-Path $runDir)) {
        New-Item -ItemType Directory -Path $runDir -Force | Out-Null
    }
    
    # Run guardian with same flags each time
    $artifactsDir = Join-Path $runDir "artifacts"
    $logFile = Join-Path $runDir "run-log.txt"
    
    $process = Start-Process -FilePath "node" -ArgumentList @(
        "bin\guardian.js",
        "reality",
        "--url", $Url,
        "--fast",
        "--artifacts", $artifactsDir
    ) -NoNewWindow -Wait -PassThru -RedirectStandardOutput $logFile -RedirectStandardError (Join-Path $runDir "run-err.txt")
    
    # Find the run directory created by guardian
    $guardianRunDirs = Get-ChildItem -Path $artifactsDir -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne "latest" } | Sort-Object Name -Descending
    
    if ($guardianRunDirs.Count -gt 0) {
        $guardianRunDir = $guardianRunDirs[0].FullName
        
        # Copy decision.json and snapshot.json
        $decisionSrc = Join-Path $guardianRunDir "decision.json"
        $snapshotSrc = Join-Path $guardianRunDir "snapshot.json"
        $summarySrc = Join-Path $guardianRunDir "summary.md"
        
        if (Test-Path $decisionSrc) {
            Copy-Item $decisionSrc (Join-Path $runDir "decision.json") -Force
        }
        if (Test-Path $snapshotSrc) {
            Copy-Item $snapshotSrc (Join-Path $runDir "snapshot.json") -Force
        }
        if (Test-Path $summarySrc) {
            Copy-Item $summarySrc (Join-Path $runDir "summary.md") -Force
        }
        
        $runResult = @{
            Run = $i
            ExitCode = $process.ExitCode
            RunDir = $guardianRunDir
            HasDecision = (Test-Path $decisionSrc)
            HasSnapshot = (Test-Path $snapshotSrc)
            HasSummary = (Test-Path $summarySrc)
        }
        $results += $runResult
        
        Write-Host "  ✓ Exit code: $($process.ExitCode)" -ForegroundColor Green
    }
    else {
        Write-Host "  ✗ No artifacts directory found" -ForegroundColor Red
        $runResult = @{
            Run = $i
            ExitCode = $process.ExitCode
            RunDir = $null
            HasDecision = $false
            HasSnapshot = $false
            HasSummary = $false
        }
        $results += $runResult
    }
    
    # Small delay between runs
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "✅ All runs completed" -ForegroundColor Green
Write-Host ""

# Export results summary
$results | ConvertTo-Json -Depth 10 | Out-File (Join-Path $OutputDir "runs-summary.json") -Encoding UTF8

return $results
