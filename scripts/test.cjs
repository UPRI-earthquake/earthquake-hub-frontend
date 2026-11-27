const { spawnSync } = require('node:child_process');

// The GitHub check still passes Jest's flag for running test files serially.
const args = process.argv.slice(2).map((arg) =>
  arg === '--runInBand' ? '--no-file-parallelism' : arg,
);

const result = spawnSync(process.execPath, [require.resolve('vitest/vitest.mjs'), 'run', ...args], {
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
