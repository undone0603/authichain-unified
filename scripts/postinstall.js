if (process.platform === 'win32') {
  require('child_process').execSync('pnpm run patch:workerd', { stdio: 'inherit' });
}