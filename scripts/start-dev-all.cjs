/* eslint-env node */

const { spawn } = require('node:child_process');
const process = require('node:process');
const path = require('node:path');

const processes = [];
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

function spawnCommand(name, cmd, args, env) {
  const options = {
    env: { ...process.env, ...env },
    stdio: ['inherit', 'inherit', 'inherit'],
    shell: false, // Don't use shell by default (more reliable)
    cwd: process.cwd(),
  };
  
  // Special handling for npm on Windows (needs shell)
  if (cmd === npmCmd && isWin) {
    options.shell = true;
  }
  
  const child = spawn(cmd, args, options);
  child.on('exit', (code) => {
    console.log(`[${name}] exited with code ${code}`);
    if (code !== 0) {
      shutdown();
    }
  });
  child.on('error', (err) => {
    console.error(`[${name}] spawn error:`, err);
    shutdown();
  });
  processes.push(child);
}

function shutdown() {
  processes.forEach((proc) => {
    if (!proc.killed) {
      proc.kill();
    }
  });
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
console.log(`[dev:all] using Redis at ${redisUrl}`);

// Use process.execPath to get the current node executable (more reliable on Windows)
const nodeExe = process.execPath;

spawnCommand('redix-server', nodeExe, [path.resolve('server/redix-server.js')], { REDIS_URL: redisUrl });
spawnCommand('redix-worker', nodeExe, [path.resolve('server/redix-worker.js')], { REDIS_URL: redisUrl });
spawnCommand('renderer', npmCmd, ['run', 'dev'], {});


