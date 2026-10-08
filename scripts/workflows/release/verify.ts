import { execFile, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

type ExportTarget = string | { [condition: string]: ExportTarget };

interface InstalledPackage {
  name: string;
  version: string;
  exports: Record<string, ExportTarget>;
}

interface ExportEntry {
  subpath: string;
  typesPaths: string[];
}

const executeFile = promisify(execFile);

const loaderArguments = {
  require: [
    '--input-type=commonjs',
    '--eval',
    'process.stdout.write(JSON.stringify(Object.keys(require(process.argv[1]))))',
  ],
  import: [
    '--input-type=module',
    '--eval',
    'process.stdout.write(JSON.stringify(Object.keys(await import(process.argv[1]))))',
  ],
};

const [tarballPath] = process.argv.slice(2);
const npmPath = process.env.npm_execpath;

if (!tarballPath || !npmPath) {
  console.error(
    'Usage: npm run node:ts ./scripts/workflows/release/verify.ts <tarball>',
  );
  process.exit(1);
}

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'solidis-release-'));

process.on('exit', () => {
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

writeFileSync(join(temporaryDirectory, 'package.json'), '{ "private": true }');

const installation = spawnSync(
  process.execPath,
  [
    npmPath,
    'install',
    resolve(tarballPath),
    '--no-audit',
    '--no-fund',
    '--ignore-scripts',
    '--offline',
    '--loglevel=error',
  ],
  { cwd: temporaryDirectory, stdio: 'inherit' },
);

if (installation.status !== 0) {
  console.error(`Could not install ${tarballPath}`);
  process.exit(1);
}

const { dependencies } = JSON.parse(
  readFileSync(join(temporaryDirectory, 'package.json'), 'utf8'),
) as { dependencies: Record<string, string> };
const packageDirectory = join(
  temporaryDirectory,
  'node_modules',
  Object.keys(dependencies)[0],
);
const installedPackage = JSON.parse(
  readFileSync(join(packageDirectory, 'package.json'), 'utf8'),
) as InstalledPackage;
const packageFiles = readdirSync(packageDirectory, {
  recursive: true,
  encoding: 'utf8',
}).map((file) => `./${file.split(sep).join('/')}`);
const problems: string[] = [];

function collectTargets(
  target: ExportTarget,
  condition = 'default',
): [string, string][] {
  if (typeof target === 'string') {
    return [[condition, target]];
  }

  return Object.entries(target).flatMap(([nestedCondition, nestedTarget]) =>
    collectTargets(nestedTarget, nestedCondition),
  );
}

function expandEntries(subpath: string, target: ExportTarget): ExportEntry[] {
  const targets = collectTargets(target);
  const typesPaths = targets
    .filter(([condition]) => condition === 'types')
    .map(([, path]) => path);

  if (!subpath.includes('*')) {
    return [{ subpath, typesPaths }];
  }

  const substitutions = new Set(
    targets.flatMap(([, path]) => {
      const [prefix, suffix] = path.split('*');

      return packageFiles
        .filter((file) => file.startsWith(prefix) && file.endsWith(suffix))
        .map((file) => file.slice(prefix.length, file.length - suffix.length));
    }),
  );

  return [...substitutions].sort().map((substitution) => ({
    subpath: subpath.replace('*', substitution),
    typesPaths: typesPaths.map((path) => path.replace('*', substitution)),
  }));
}

async function loadExportNames(
  loader: keyof typeof loaderArguments,
  specifier: string,
) {
  try {
    const { stdout } = await executeFile(
      process.execPath,
      [...loaderArguments[loader], specifier],
      { cwd: temporaryDirectory },
    );
    const exportNames = (JSON.parse(stdout) as string[]).sort();

    if (exportNames.length === 0) {
      problems.push(`${specifier}: ${loader}() exposes no exports`);
    }

    return exportNames;
  } catch (error) {
    const { message, stderr } = error as { message: string; stderr?: string };
    const lines = (stderr || message).split('\n');
    const reason = lines.find((line) => /^\w*Error\b/.test(line)) ?? lines[0];

    problems.push(
      `${specifier}: ${loader}() failed with ${reason.trim().replaceAll(temporaryDirectory, '.')}`,
    );

    return undefined;
  }
}

async function verifyEntry({ subpath, typesPaths }: ExportEntry) {
  const specifier = `${installedPackage.name}${subpath.slice(1)}`;

  for (const typesPath of new Set(typesPaths)) {
    if (!existsSync(join(packageDirectory, typesPath))) {
      problems.push(`${specifier}: types target ${typesPath} is missing`);
    }
  }

  const requiredNames = await loadExportNames('require', specifier);
  const importedNames = await loadExportNames('import', specifier);

  if (!requiredNames || !importedNames) {
    return;
  }

  const onlyRequired = requiredNames.filter(
    (name) => !importedNames.includes(name),
  );
  const onlyImported = importedNames.filter(
    (name) => !requiredNames.includes(name),
  );

  if (onlyRequired.length > 0 || onlyImported.length > 0) {
    problems.push(
      `${specifier}: export names differ (require() only: ${onlyRequired.join(', ') || 'none'}; import() only: ${onlyImported.join(', ') || 'none'})`,
    );
  }
}

const entries = Object.entries(installedPackage.exports).flatMap(
  ([subpath, target]) => expandEntries(subpath, target),
);
const typesCount = new Set(entries.flatMap((entry) => entry.typesPaths)).size;
const batchSize = availableParallelism();

for (let index = 0; index < entries.length; index += batchSize) {
  await Promise.all(entries.slice(index, index + batchSize).map(verifyEntry));
}

const label = `${installedPackage.name}@${installedPackage.version} (${basename(tarballPath)})`;

if (problems.length > 0) {
  console.error(problems.sort().join('\n'));
  console.error(
    `${label}: ${problems.length} problems across ${entries.length} export subpaths`,
  );
  process.exit(1);
}

console.log(
  `${label}: ${entries.length} export subpaths load through require() and import() with matching export names, ${typesCount} types targets exist`,
);
