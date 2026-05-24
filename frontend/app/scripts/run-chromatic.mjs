import { spawnSync } from 'node:child_process';

const token = process.env.CHROMATIC_PROJECT_TOKEN;

if (!token) {
  console.error('Missing CHROMATIC_PROJECT_TOKEN.');
  console.error('Create a Chromatic project and set CHROMATIC_PROJECT_TOKEN in your environment.');
  process.exit(1);
}

const result = spawnSync('chromatic', ['--project-token', token], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
