const path = require('path');

// Must run before Metro/workers touch the filesystem (Windows drive-letter bug).
const windowsPathPatch = path.join(__dirname, 'scripts/metro-windows-path-patch.js');
require(windowsPathPatch);
// Propagate to Metro worker child processes. Use forward slashes so NODE_OPTIONS
// does not strip Windows backslashes.
if (
  process.platform === 'win32' &&
  !(process.env.NODE_OPTIONS || '').includes('metro-windows-path-patch')
) {
  const preload = windowsPathPatch.replace(/\\/g, '/');
  process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, `--require ${preload}`]
    .filter(Boolean)
    .join(' ');
}

const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');

/**
 * Windows + Git Bash: cwd/projectRoot often use `E:\...` while Node module
 * resolution returns `e:\...`. Metro's RootPathUtils compares drive letters
 * case-sensitively, then builds invalid paths like `E:\e:\...`.
 */
function getNodeDrive() {
  try {
    return fs.realpathSync.native(__filename).slice(0, 1);
  } catch {
    return path.resolve(__dirname).slice(0, 1);
  }
}

const NODE_DRIVE = getNodeDrive();

function normalize(p) {
  const resolved = path.resolve(p);
  if (process.platform !== 'win32') {
    return resolved;
  }
  return resolved.replace(/^[a-zA-Z]:/, `${NODE_DRIVE}:`);
}

function patchMetroRootPathUtils() {
  if (process.platform !== 'win32') {
    return;
  }

  const rootPathUtilsFile = path.join(
    normalize(path.join(__dirname, '../..')),
    'node_modules/metro-file-map/src/lib/RootPathUtils.js'
  );

  // eslint-disable-next-line import/no-dynamic-require
  const mod = require(rootPathUtilsFile);
  if (mod.__teleconsultDrivePatchApplied) {
    return;
  }

  const Original = mod.RootPathUtils;

  class DriveSafeRootPathUtils extends Original {
    constructor(rootDir) {
      super(normalize(rootDir));
    }

    absoluteToNormal(absolutePath) {
      return super.absoluteToNormal(normalize(absolutePath));
    }

    normalToAbsolute(normalPath) {
      const absolutePath = super.normalToAbsolute(normalPath);
      const repaired = absolutePath.replace(/^[a-zA-Z]:[\\/](?=[a-zA-Z]:)/, '');
      return normalize(repaired);
    }
  }

  mod.RootPathUtils = DriveSafeRootPathUtils;
  mod.__teleconsultDrivePatchApplied = true;

  // Windows may cache the same file under E:\ and e:\ keys — patch both.
  for (const key of Object.keys(require.cache)) {
    if (key.replace(/\\/g, '/').endsWith('/metro-file-map/src/lib/RootPathUtils.js')) {
      require.cache[key].exports = mod;
    }
  }
}

patchMetroRootPathUtils();

const projectRoot = normalize(__dirname);
const monorepoRoot = normalize(path.join(projectRoot, '../..'));

try {
  if (process.platform === 'win32') {
    process.chdir(projectRoot);
  }
} catch {
  // ignore
}

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;
config.watchFolders = [monorepoRoot];
config.server = {
  ...config.server,
  unstable_serverRoot: monorepoRoot,
};
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, 'node_modules'),
  path.join(monorepoRoot, 'node_modules'),
].map(normalize);
config.resolver.extraNodeModules = {
  '@teleconsult/shared-types': normalize(
    path.join(monorepoRoot, 'packages/shared-types')
  ),
};

module.exports = config;
