import { readFileSync } from 'node:fs';

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

if (version.split('+')[0].includes('-')) {
  console.error(
    `Refusing to publish prerelease ${version} as latest. Use "npm run pub:beta", or set a stable version before running "npm run pub".`
  );
  process.exitCode = 1;
}
