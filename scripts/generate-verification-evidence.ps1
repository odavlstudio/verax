#!/usr/bin/env pwsh
# ODAVL Guardian - CLI Verification Evidence Generator
# Captures actual CLI execution outputs for release audit trail

param(
    [string]$TarballDir = "C:\Users\sabou\odavlguardian\top-tier-verify",
    [string]$OutputFile = "C:\Users\sabou\odavlguardian\reports\release\top-tier-1-verification.txt"
)

$ErrorActionPreference = 'Continue'

# Ensure output directory exists
$outputDir = Split-Path $OutputFile
if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Initialize output
$evidence = @()
$evidence += "=" * 80
$evidence += "ODAVL Guardian v1.1.2 - CLI Verification Evidence"
$evidence += "=" * 80
$evidence += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')"
$evidence += "Environment: Windows, PowerShell $($PSVersionTable.PSVersion)"
$evidence += "Test Location: $TarballDir"
$evidence += "Method: npm pack tarball installation"
$evidence += "=" * 80
$evidence += ""

Push-Location $TarballDir

function Capture-Command {
    param(
        [string]$Title,
        [string]$Command,
        [scriptblock]$ScriptBlock
    )
    
    $evidence = @()
    $evidence += ""
    $evidence += "[TEST] $Title"
    $evidence += "-" * 80
    $evidence += "Command: $Command"
    $evidence += "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $evidence += ""
    
    try {
        $output = & $ScriptBlock 2>&1
        $exitCode = $LASTEXITCODE
        
        $evidence += "OUTPUT:"
        $evidence += $output | Out-String
        $evidence += ""
        $evidence += "EXIT CODE: $exitCode"
        
        if ($exitCode -eq 0) {
            $evidence += "STATUS: ✅ SUCCESS"
        } else {
            $evidence += "STATUS: ⚠️ NON-ZERO EXIT (may be expected)"
        }
    } catch {
        $evidence += "ERROR: $($_.Exception.Message)"
        $evidence += "STATUS: ❌ FAILED"
    }
    
    $evidence += ""
    return $evidence
}

# Test 1: Version
$evidence += Capture-Command -Title "Version Check" -Command "npx guardian --version" -ScriptBlock {
    npx guardian --version
}

# Test 2: Help Output
$evidence += Capture-Command -Title "Help Output" -Command "npx guardian --help" -ScriptBlock {
    npx guardian --help
}

# Test 3: Smoke Test (will fail with exit 2 - expected)
$evidence += Capture-Command -Title "Smoke Test (Fast CI Mode)" -Command "npx guardian smoke --url https://example.com" -ScriptBlock {
    npx guardian smoke --url https://example.com
}

Pop-Location

# Write to file
$evidence += ""
$evidence += "=" * 80
$evidence += "END OF VERIFICATION EVIDENCE"
$evidence += "Total Tests: 3"
$evidence += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$evidence += "=" * 80

$evidence -join "`n" | Out-File -FilePath $OutputFile -Encoding UTF8

Write-Host ""
Write-Host "✅ Verification evidence generated: $OutputFile" -ForegroundColor Green
Write-Host "   File size: $((Get-Item $OutputFile).Length) bytes"
Write-Host ""
