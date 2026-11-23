import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';

const directories: string[] = [];

afterEach(() => {
  directories.splice(0).forEach(directory => rmSync(directory, { recursive: true }));
});

test.each([
  ['0.2.0-beta.0', 1],
  ['0.2.0-rc.1', 1],
  ['0.2.0', 0],
  ['0.2.0+build.1', 0],
  ['0.2.0+build-1', 0],
] as const)('checks version %s before stable publishing', (version, status) => {
  const directory = mkdtempSync(join(tmpdir(), 'rhf-stable-publishing-'));
  directories.push(directory);
  mkdirSync(join(directory, 'scripts'));
  const script = join(directory, 'scripts/check-stable-version.mjs');
  copyFileSync('scripts/check-stable-version.mjs', script);
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ version }));
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(status);
  if (status === 1) {
    expect(result.stderr).toContain(`Refusing to publish prerelease ${version}`);
    expect(result.stderr).toContain('npm run pub:beta');
  } else {
    expect(result.stderr).toBe('');
  }
});
