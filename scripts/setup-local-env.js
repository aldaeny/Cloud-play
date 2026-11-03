// Local development only: creates secrets without overwriting an existing .env.
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const root = path.resolve(__dirname, '..');
const target = path.join(root, '.env');
const secret = () => randomBytes(32).toString('hex');
const password = secret();
let contents = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const values = {
  DATABASE_URL: `postgresql://aether:${password}@postgres:5432/aether?schema=public`,
  POSTGRES_USER: 'aether', POSTGRES_PASSWORD: password, POSTGRES_DB: 'aether',
  JWT_ACCESS_SECRET: secret(), JWT_REFRESH_SECRET: secret(), ADMIN_JWT_SECRET: secret(),
  STORAGE_ACCESS_KEY: `local${randomBytes(8).toString('hex')}`,
  STORAGE_SECRET_KEY: secret(), STORAGE_PUBLIC_ENDPOINT: 'http://localhost:9000',
};
for (const [key, value] of Object.entries(values)) {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (!pattern.test(contents)) throw new Error(`Missing ${key} in .env.example`);
  contents = contents.replace(pattern, `${key}="${value}"`);
}
try {
  fs.writeFileSync(target, contents, { flag: 'wx', mode: 0o600 });
  console.log('Created .env with fresh local-only secrets. Never share this file.');
} catch (error) {
  if (error.code === 'EEXIST') {
    console.error('.env already exists; left unchanged. Back it up or move it before creating a new local environment.');
    process.exitCode = 1;
  } else throw error;
}
