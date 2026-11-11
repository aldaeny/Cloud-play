/**
 * Prisma Client generation with an offline fallback.
 *
 * Why this exists
 * ---------------
 * `prisma generate` downloads the schema/query engines from binaries.prisma.sh.
 * On restricted networks (locked-down CI, this deployment sandbox) that host is
 * unreachable, so generation fails and `@prisma/client` exports no model types.
 * The visible symptom is ~18 `TS2305/TS2694` errors across the API that look like
 * code defects but are purely missing generated output.
 *
 * Strategy
 *   1. Try the real `prisma generate`. This is the correct path: it produces a
 *      fully engine-backed client that can talk to PostgreSQL.
 *   2. If — and only if — it fails because the engine host is unreachable, fall
 *      back to generating TYPES from the schema using the WASM schema parser
 *      shipped on npm (`@prisma/internals`), driven through the official client
 *      generator over its JSON-RPC interface.
 *
 * IMPORTANT LIMITATION
 *   The fallback emits type declarations and the model-aware client surface but
 *   NO query engine. It is sufficient for `tsc`, `jest` and `nest build`. It is
 *   NOT sufficient to execute database queries at runtime. A deployment that
 *   needs live DB access must run a real `prisma generate` on a network that can
 *   reach the engine host (or pre-supply PRISMA_QUERY_ENGINE_LIBRARY).
 *   The script says so loudly instead of letting a broken runtime look healthy.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const apiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiRoot, '../..');
const schemaPath = path.join(apiRoot, 'prisma', 'schema.prisma');
const prismaBin = path.join(repoRoot, 'node_modules', '.bin', 'prisma');

function log(message) {
  process.stdout.write(`[prisma-gen] ${message}\n`);
}

/** Network-shaped failures are the only ones we are allowed to paper over. */
function isEngineDownloadFailure(text) {
  return /binaries\.prisma\.sh|ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT|socket disconnected|fetch failed/i.test(text);
}

function tryNativeGenerate() {
  try {
    execFileSync(prismaBin, ['generate', '--schema', schemaPath], {
      cwd: apiRoot,
      stdio: 'pipe',
      env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    });
    log('native `prisma generate` succeeded (engine-backed client).');
    return true;
  } catch (error) {
    const text = `${error.stdout ?? ''}${error.stderr ?? ''}${error.message ?? ''}`;
    if (!isEngineDownloadFailure(text)) {
      // A schema error or similar is a real defect: surface it, never mask it.
      process.stderr.write(text);
      throw new Error('`prisma generate` failed for a non-network reason.');
    }
    log('engine host unreachable — falling back to offline type generation.');
    return false;
  }
}

/** Read the datasource block without needing the native schema engine. */
function readDatasource(datamodel) {
  const block = /datasource\s+(\w+)\s*\{([^}]*)\}/.exec(datamodel);
  if (!block) throw new Error('No datasource block found in schema.prisma');
  const body = block[2];
  const provider = /provider\s*=\s*"([^"]+)"/.exec(body);
  const urlEnv = /url\s*=\s*env\("([^"]+)"\)/.exec(body);
  if (!provider) throw new Error('Datasource has no provider');
  return {
    name: block[1],
    provider: provider[1],
    activeProvider: provider[1],
    url: { fromEnvVar: urlEnv ? urlEnv[1] : null, value: null },
    sourceFilePath: schemaPath,
  };
}

async function generateTypesOffline() {
  const { getDMMF } = require('@prisma/internals');
  const { GeneratorProcess } = require('@prisma/generator-helper');

  const datamodel = fs.readFileSync(schemaPath, 'utf8');
  const dmmf = await getDMMF({ datamodel });
  const datasource = readDatasource(datamodel);

  const clientPkg = require('@prisma/client/package.json');
  const { enginesVersion } = require('@prisma/engines-version');
  const generatorPath = require.resolve('@prisma/client/generator-build/index.js');
  const outputDir = path.join(repoRoot, 'node_modules', '.prisma', 'client');

  // The generator consults this before reading generator.config.engineType.
  process.env.PRISMA_CLIENT_ENGINE_TYPE = 'library';

  const generator = new GeneratorProcess(generatorPath, { isNode: true });
  await generator.init();
  try {
    await generator.generate({
      generator: {
        name: 'client',
        provider: { value: 'prisma-client-js', fromEnvVar: null },
        output: { value: outputDir, fromEnvVar: null },
        config: { engineType: 'library' },
        binaryTargets: [],
        previewFeatures: [],
        isCustomOutput: false,
      },
      otherGenerators: [],
      schemaPath,
      datamodel,
      dmmf,
      datasources: [datasource],
      version: clientPkg.version,
      clientVersion: clientPkg.version,
      engineVersion: enginesVersion,
      // No engine is copied; these paths only feed generated metadata.
      binaryPaths: { libqueryEngine: {} },
      envPaths: { rootEnvPath: null, schemaEnvPath: null },
      activeProvider: datasource.activeProvider,
      postinstall: false,
      noEngine: true,
      noHints: true,
      allowNoModels: true,
      copyEngine: false,
    });
  } finally {
    generator.stop();
  }

  const indexTypes = path.join(outputDir, 'index.d.ts');
  if (!fs.existsSync(indexTypes) || fs.statSync(indexTypes).size === 0) {
    throw new Error('Offline generation produced no index.d.ts');
  }
  log(`offline types written: ${dmmf.datamodel.models.length} models, ${fs.statSync(indexTypes).size} bytes.`);
  log('WARNING: types only, NO query engine. tsc/jest/build will work; live DB');
  log('WARNING: queries will NOT. Run real `prisma generate` before deploying.');
}

(async () => {
  if (tryNativeGenerate()) return;
  if (process.env.PRISMA_REQUIRE_NATIVE === 'true') throw new Error('Native Prisma generation required; offline type-only fallback is forbidden for this build.');
  await generateTypesOffline();
})().catch((error) => {
  process.stderr.write(`[prisma-gen] FAILED: ${error.message}\n`);
  process.exit(1);
});
