/**
 * Tiny TypeScript loader for the scripts/ acceptance tests.
 *
 * The acceptance scripts run with plain `node`, no test framework and no build
 * step, so they need a way to `require()` the server modules directly. This
 * loader compiles a module and its local relative imports on demand and caches
 * the result, the same way ts-node would, without adding a dependency.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const cache = new Map();

function resolveLocal(fromFile, request) {
  const base = path.resolve(path.dirname(fromFile), request);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function loadTs(file) {
  const resolved = path.resolve(file);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const source = fs.readFileSync(resolved, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    fileName: resolved,
  }).outputText;

  const mod = new Module(resolved, module);
  mod.filename = resolved;
  mod.paths = Module._nodeModulePaths(path.dirname(resolved));
  cache.set(resolved, mod);

  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function patched(request, parent, ...rest) {
    if (parent && parent.filename === resolved && (request.startsWith('./') || request.startsWith('../'))) {
      const local = resolveLocal(resolved, request);
      if (local) return local;
    }
    return originalResolve.call(this, request, parent, ...rest);
  };
  const originalExtension = Module._extensions['.ts'];
  // Node creates its own Module for `.ts` requires; hand it the exports our
  // loader produced so `require()` of a local .ts file resolves correctly.
  Module._extensions['.ts'] = (target, filename) => {
    target.exports = loadTs(filename);
  };
  try {
    mod._compile(transpiled, resolved);
  } finally {
    Module._resolveFilename = originalResolve;
    if (originalExtension === undefined) delete Module._extensions['.ts'];
    else Module._extensions['.ts'] = originalExtension;
  }
  return mod.exports;
}

module.exports = { loadTs };
