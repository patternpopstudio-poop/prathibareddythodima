/**
 * Windows/Git Bash: Metro can build invalid paths like `E:\e:\...\file.js`
 * when drive-letter casing mixes. Repair those paths at the fs boundary so
 * both the Metro main process and worker processes can read files.
 */
'use strict';

function repairPath(filePath) {
  if (typeof filePath !== 'string') {
    return filePath;
  }
  // E:\e:\foo -> e:\foo  (drop the first drive when a second drive follows)
  if (/^[a-zA-Z]:[\\/][a-zA-Z]:/.test(filePath)) {
    return filePath.replace(/^[a-zA-Z]:[\\/](?=[a-zA-Z]:)/, '');
  }
  return filePath;
}

function patchFs(fsMod) {
  if (!fsMod || fsMod.__teleconsultPathPatch) {
    return fsMod;
  }

  for (const method of [
    'readFileSync',
    'readFile',
    'openSync',
    'open',
    'statSync',
    'stat',
    'lstatSync',
    'lstat',
    'realpathSync',
    'realpath',
    'accessSync',
    'access',
  ]) {
    const orig = fsMod[method];
    if (typeof orig !== 'function') {
      continue;
    }
    fsMod[method] = function patched(filePath, ...args) {
      return orig.call(this, repairPath(filePath), ...args);
    };
  }

  if (fsMod.promises) {
    patchFs(fsMod.promises);
  }

  fsMod.__teleconsultPathPatch = true;
  return fsMod;
}

patchFs(require('fs'));

const Module = require('module');
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  const exported = originalLoad.apply(this, arguments);
  if (
    request === 'graceful-fs' ||
    (typeof request === 'string' && request.replace(/\\/g, '/').endsWith('graceful-fs'))
  ) {
    return patchFs(exported);
  }
  return exported;
};
