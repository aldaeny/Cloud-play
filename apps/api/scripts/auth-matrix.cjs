// AST-based inventory, not proof that a guarded endpoint enforces ownership.
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const modules = path.join(root, 'apps/api/src/modules');
const rows = [];
function decorators(node, name) {
  return (ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : [])
    .map(d => d.expression).filter(e => ts.isCallExpression(e) && e.expression.getText() === name);
}
function args(node, name) { return decorators(node, name).flatMap(e => e.arguments.map(a => a.getText().replace(/^['"]|['"]$/g, ''))); }
for (const folder of fs.readdirSync(modules).sort()) {
  if (!fs.statSync(path.join(modules, folder)).isDirectory()) continue;
  for (const file of fs.readdirSync(path.join(modules, folder)).filter(n => n.endsWith('.controller.ts'))) {
    const sourcePath = path.join(modules, folder, file);
    const source = ts.createSourceFile(file, fs.readFileSync(sourcePath, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const cls of source.statements.filter(ts.isClassDeclaration)) {
      const base = args(cls, 'Controller')[0] || '';
      for (const member of cls.members) {
        for (const method of ['Get', 'Post', 'Put', 'Patch', 'Delete']) {
          const routes = decorators(member, method);
          for (const route of routes) {
            const suffix = route.arguments[0]?.text || '';
            const guards = [...args(cls, 'UseGuards'), ...args(member, 'UseGuards')].join(', ') || 'NONE (public)';
            const permissions = args(member, 'RequirePermissions');
            const required = (permissions.length ? permissions : args(cls, 'RequirePermissions')).join(', ') || 'not declared';
            const line = source.getLineAndCharacterOfPosition(member.getStart(source)).line + 1;
            const endpoint = '/' + [base, suffix].filter(Boolean).join('/');
            const auth = guards.includes('Supabase') ? 'Supabase /auth/v1/user' : guards.includes('Admin') ? 'legacy staff HS256' : guards.includes('Jwt') ? 'legacy user HS256' : 'public credential operation';
            const ownership = guards.includes('Admin') ? 'DB staff tenant/role; handler scope needs per-route verification' : guards.includes('Jwt') || guards.includes('Supabase') ? 'DB user/tenant; handler scope needs per-route verification' : 'N/A; inspect credential flow';
            const evidence = folder === 'profiles' && endpoint === '/hybrid/profiles' ? 'hybrid-profiles.http.spec.ts + real PG read' : 'module/service tests only; route-specific security NOT proven';
            rows.push(`| ${folder} | ${method.toUpperCase()} \`${endpoint}\` | ${auth} (${guards}) | ${required} | ${ownership} | main.ts global limiter* | ${evidence}; [source](../apps/api/src/modules/${folder}/${file}#L${line}) |`);
          }
        }
      }
    }
  }
}
const header = `# Authentication and authorization endpoint matrix\n\nGenerated from controller decorators by \`node apps/api/scripts/auth-matrix.cjs\`. **Inventory, not a security certification.** ${rows.length} declared routes.\n\nD1 cutover is IN PROGRESS: only the additive hybrid profiles endpoint uses SupabaseAuthGuard. Legacy user/staff credentials and JWT endpoints remain for compatibility. Rights and Entitlement are service modules without controllers. All 13 modules load in composition tests, not all are integrated into the frontend.\n\n*Global rate limiting is installed by production main.ts (100/min/IP, 10/min/IP auth). Test application bootstrap does not automatically install main.ts middleware. Verify deployed proxy topology before trusting forwarded headers. The Next.js profile bridge also uses the catalog bucket.\n\nReal JWT expiry/signature, token-class separation, malformed subject, disabled user, forged claims, staff-role tenant mismatch and missing permission checks: legacy-auth.security.spec.ts (database fixtures). Supabase invalid-token/unavailable/inactive/unprovisioned and forged ownership coverage: supabase-auth.*.spec.ts and hybrid-profiles.http.spec.ts. A valid bearer token can be replayed until expiry/revocation constraints; single-use access tokens are not implemented. StaffUser has no disable/status field, so disabled-staff enforcement is NOT implemented. Do not infer session revocation immediacy from calling Supabase getUser alone.\n\n| Module | Method / endpoint | Authentication | Required permission | Ownership / tenant | Rate limiting | Evidence / review gap |\n|---|---|---|---|---|---|---|\n`;
fs.writeFileSync(path.join(root, 'docs/AUTHENTICATION_MATRIX.md'), header + rows.join('\n') + '\n');
console.log(`${rows.length} routes inventoried`);
