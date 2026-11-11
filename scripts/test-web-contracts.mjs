// Every current offline Web contract suite. Fail-fast and propagate exit code.
// Browser/UI/layout/popup execution belongs in the separate actual-browser phase.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const scripts = JSON.parse(readFileSync(new URL('../apps/web/package.json', import.meta.url))).scripts;
for (const name of Object.keys(scripts)) {
  if (!name.startsWith('test:') || /browser|layout|popup/.test(name)) continue;
  execFileSync('npm', ['run', name, '--workspace', 'aether-web'], { stdio: 'inherit' });
}
