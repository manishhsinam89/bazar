# ============================================================
# Bazar AI — Ollama + ngrok Setup Script (Windows)
# ============================================================
# Run this on any Windows PC to set up local AI for mobile use.
# Usage:  Right-click → Run with PowerShell
#    or:  powershell -ExecutionPolicy Bypass -File setup-ollama-ngrok.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Bazar AI — Ollama + ngrok Setup" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# --------------------------------------------------
# 0. Create .env if missing
# --------------------------------------------------
$envFile = Join-Path $scriptDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "[0/5] Creating .env file..." -ForegroundColor Yellow
    Write-Host "  Enter your API keys (press Enter to skip any):" -ForegroundColor Gray
    $hf = Read-Host "  HF Token (hf_...)"
    $gemini = Read-Host "  Gemini API Key"
    $supaUrl = Read-Host "  Supabase URL [https://kfugatftdhkgirzkhuol.supabase.co]"
    $supaKey = Read-Host "  Supabase Anon Key"
    if (-not $supaUrl) { $supaUrl = "https://kfugatftdhkgirzkhuol.supabase.co" }
    @"
VITE_HF_TOKEN=$hf
VITE_GEMINI_API_KEY=$gemini
VITE_SUPABASE_URL=$supaUrl
VITE_SUPABASE_ANON_KEY=$supaKey
"@ | Set-Content $envFile -Encoding UTF8
    Write-Host "  ✅ .env created" -ForegroundColor Green
} else {
    Write-Host "[0/5] .env already exists — skipping" -ForegroundColor Green
}

# --------------------------------------------------
# 1. Check / Install Ollama
# --------------------------------------------------
Write-Host "[1/5] Checking Ollama..." -ForegroundColor Yellow
$ollamaExe = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
if (Test-Path $ollamaExe) {
    Write-Host "  ✅ Ollama found at $ollamaExe" -ForegroundColor Green
} else {
    Write-Host "  ❌ Ollama not found. Please install from https://ollama.com/download" -ForegroundColor Red
    Write-Host "     After installing, re-run this script." -ForegroundColor Red
    Start-Process "https://ollama.com/download"
    Read-Host "Press Enter after installing Ollama..."
}

# --------------------------------------------------
# 2. Set OLLAMA_ORIGINS=* (required for browser CORS)
# --------------------------------------------------
Write-Host "`n[2/5] Setting OLLAMA_ORIGINS=* ..." -ForegroundColor Yellow
[System.Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "*", "User")
$env:OLLAMA_ORIGINS = "*"
Write-Host "  ✅ OLLAMA_ORIGINS=* set (User env var)" -ForegroundColor Green

# --------------------------------------------------
# 3. Start Ollama & pull LLaVA model
# --------------------------------------------------
Write-Host "`n[3/5] Starting Ollama and pulling LLaVA model (~4.7 GB)..." -ForegroundColor Yellow

# Start Ollama app (tray) if not running
$ollamaRunning = Get-Process -Name "ollama*" -ErrorAction SilentlyContinue
if (-not $ollamaRunning) {
    $ollamaApp = "$env:LOCALAPPDATA\Programs\Ollama\ollama app.exe"
    if (Test-Path $ollamaApp) {
        Start-Process $ollamaApp
        Write-Host "  ⏳ Waiting for Ollama to start..." -ForegroundColor Gray
        Start-Sleep 8
    }
}

# Test connectivity
try {
    $r = Invoke-WebRequest -Uri "http://localhost:11434" -UseBasicParsing -TimeoutSec 5
    Write-Host "  ✅ Ollama is running" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  Cannot reach Ollama at localhost:11434" -ForegroundColor Red
    Write-Host "     Start Ollama from the system tray, then re-run this script." -ForegroundColor Red
}

# Pull LLaVA if not present
Write-Host "  Pulling LLaVA model (skip if already present)..." -ForegroundColor Gray
& $ollamaExe pull llava 2>&1 | Out-String | Write-Host
Write-Host "  ✅ LLaVA model ready" -ForegroundColor Green

# --------------------------------------------------
# 4. Locate ngrok
# --------------------------------------------------
Write-Host "`n[4/5] Checking ngrok..." -ForegroundColor Yellow
$ngrokExe = Join-Path $scriptDir "ngrok.exe"
if (-not (Test-Path $ngrokExe)) {
    # Check PATH
    $ngrokInPath = Get-Command ngrok -ErrorAction SilentlyContinue
    if ($ngrokInPath) {
        $ngrokExe = $ngrokInPath.Source
    } else {
        # Try to download ngrok automatically
        Write-Host "  ⬇️  ngrok not found — downloading..." -ForegroundColor Gray
        $zipPath = Join-Path $env:TEMP "ngrok.zip"
        try {
            Invoke-WebRequest -Uri "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip" `
                -OutFile $zipPath -UseBasicParsing
            Expand-Archive -Path $zipPath -DestinationPath $scriptDir -Force
            Remove-Item $zipPath -ErrorAction SilentlyContinue
        } catch {
            Write-Host "  ❌ Auto-download failed. Please download manually:" -ForegroundColor Red
            Write-Host "     https://ngrok.com/download" -ForegroundColor Red
            Write-Host "     Place ngrok.exe next to this script at: $scriptDir" -ForegroundColor Red
            Start-Process "https://ngrok.com/download"
            Read-Host "Press Enter after placing ngrok.exe..."
        }
        if (-not (Test-Path $ngrokExe)) { exit 1 }
    }
}
Write-Host "  ✅ ngrok found: $ngrokExe" -ForegroundColor Green

# Check auth token
try {
    & $ngrokExe config check 2>&1 | Out-Null
    Write-Host "  ✅ ngrok config OK" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  ngrok needs an auth token." -ForegroundColor Yellow
    Write-Host "     Sign up free at https://dashboard.ngrok.com/signup" -ForegroundColor Yellow
    $token = Read-Host "  Paste your ngrok authtoken"
    if ($token) {
        & $ngrokExe config add-authtoken $token
        Write-Host "  ✅ Token saved" -ForegroundColor Green
    }
}

# --------------------------------------------------
# 5. Start ngrok tunnel
# --------------------------------------------------
Write-Host "`n[5/5] Starting ngrok tunnel for Ollama (port 11434)..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  ┌──────────────────────────────────────────────────┐" -ForegroundColor Cyan
Write-Host "  │  ngrok will show a Forwarding URL like:          │" -ForegroundColor Cyan
Write-Host "  │  https://xxxx-xxxx.ngrok-free.app                │" -ForegroundColor Cyan
Write-Host "  │                                                  │" -ForegroundColor Cyan
Write-Host "  │  Copy that URL and paste it in the Bazar app:    │" -ForegroundColor Cyan
Write-Host "  │  Settings → Ollama Server URL → paste → Test     │" -ForegroundColor Cyan
Write-Host "  │                                                  │" -ForegroundColor Cyan
Write-Host "  │  Then your phone can use local AI!               │" -ForegroundColor Cyan
Write-Host "  └──────────────────────────────────────────────────┘" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Press Ctrl+C to stop the tunnel.`n" -ForegroundColor Gray

& $ngrokExe http 11434
