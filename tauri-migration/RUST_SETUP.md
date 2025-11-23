# Rust Setup for Tauri

Tauri requires Rust to compile the backend. Follow these steps:

## Install Rust

1. **Download and install Rust:**
   - Visit: https://rustup.rs/
   - Download the installer for Windows
   - Run the installer and follow the prompts

2. **Verify installation:**
   ```powershell
   rustc --version
   cargo --version
   ```

3. **Restart your terminal** after installation

## After Rust Installation

Once Rust is installed, you can run:

```powershell
npm run tauri:dev
```

The first build will take several minutes as it compiles Rust dependencies. Subsequent builds are much faster.

## Troubleshooting

- If `cargo` is not recognized, restart your terminal/PowerShell
- If you see "linker not found" errors, you may need to install Visual Studio Build Tools
- For Windows, Tauri recommends installing "Desktop development with C++" workload in Visual Studio


