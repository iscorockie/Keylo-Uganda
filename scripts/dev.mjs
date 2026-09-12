import { rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
await rm('.next', { recursive: true, force: true });
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(command, ['next', 'dev', '-H', '0.0.0.0'], { stdio: 'inherit', env: process.env });
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
