import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;

if (!version || typeof version !== 'string') {
  throw new Error('package.json version is missing');
}

const wailsConfigPath = 'desktop/wails.json';
const wailsConfig = JSON.parse(fs.readFileSync(wailsConfigPath, 'utf8'));
wailsConfig.info = wailsConfig.info || {};
wailsConfig.info.productVersion = version;
fs.writeFileSync(wailsConfigPath, `${JSON.stringify(wailsConfig, null, 2)}\n`);
