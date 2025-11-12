const { spawn } = require('node:child_process');
const waitOn = require('wait-on');
const path = require('node:path');
const fs = require('node:fs');
const electronPath = require('electron');

async function main() {
  process.env.NODE_ENV = 'development';
  if (!process.env.VITE_DEV_SERVER_URL) {
    process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173';
  }
  if (!process.env.OB_DISABLE_HEAVY_SERVICES) {
    process.env.OB_DISABLE_HEAVY_SERVICES = '1';
  }
  process.env.ELECTRON_DISABLE_GPU_SANDBOX = process.env.ELECTRON_DISABLE_GPU_SANDBOX || '1';
  process.env.LIBANGLE_DISABLE_D3D11 = process.env.LIBANGLE_DISABLE_D3D11 || '1';
  process.env.ANGLE_DEFAULT_PLATFORM = process.env.ANGLE_DEFAULT_PLATFORM || 'swiftshader';
  process.env.ELECTRON_FORCE_USE_SWIFTSHADER = process.env.ELECTRON_FORCE_USE_SWIFTSHADER || '1';
  process.env.GPU_MEMORY_BUFFER_COMPOSITOR_RESOURCES = process.env.GPU_MEMORY_BUFFER_COMPOSITOR_RESOURCES || '0';

  console.log('[electron-dev] OB_DISABLE_HEAVY_SERVICES=', process.env.OB_DISABLE_HEAVY_SERVICES);

  const distDir = path.resolve(process.cwd(), 'dist-electron');
  try {
    fs.rmSync(distDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('[electron-dev] Failed to clear dist-electron before rebuild:', error);
  }

  await waitOn({
    resources: [
      'tcp:5173',
      'file:dist-electron/index.js',
      'file:dist-electron/main.js',
    ],
    timeout: 45000,
  });

  const child = spawn(
    electronPath,
    ['--inspect=9229', '--trace-warnings', '--enable-logging', '--v=1', '.'],
    {
      stdio: 'inherit',
      env: process.env,
    },
  );

  child.on('exit', (code, signal) => {
    console.error(`[electron-dev] Electron exited with code ${code} signal ${signal ?? 'none'}`);
    process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error('[electron-dev] Failed to start Electron:', error);
  process.exit(1);
});
