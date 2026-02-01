/**
 * Patches privacycash package.json to export ./dist/*
 * This allows importing from privacycash/dist/... paths
 * Run automatically via postinstall
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'node_modules', 'privacycash', 'package.json');

try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  if (!pkg.exports['./dist/*']) {
    pkg.exports['./dist/*'] = './dist/*';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log('✓ Patched privacycash exports');
  } else {
    console.log('✓ privacycash already patched');
  }
} catch (err) {
  console.error('Failed to patch privacycash:', err.message);
  process.exit(1);
}
