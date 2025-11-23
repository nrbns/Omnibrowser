# Tauri Startup Script with Rust PATH
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
$env:CARGO_HOME = "$env:USERPROFILE\.cargo"
$env:RUSTUP_HOME = "$env:USERPROFILE\.rustup"

Write-Host "Checking Rust..." -ForegroundColor Cyan
try {
    $cargoVersion = cargo --version 2>&1
    Write-Host " Rust found: $cargoVersion" -ForegroundColor Green
} catch {
    Write-Host " Rust not found. Please install Rust from https://rustup.rs/" -ForegroundColor Red
    exit 1
}

Write-Host "
Starting backend server..." -ForegroundColor Cyan
$serverPath = Join-Path $PSScriptRoot "server"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$serverPath'; node redix-server.js" -WindowStyle Normal
Start-Sleep -Seconds 3

Write-Host "
Starting Tauri app..." -ForegroundColor Cyan
$tauriPath = Join-Path $PSScriptRoot "tauri-migration"
cd $tauriPath
npm run tauri:dev
