'use strict';

const path = require('path');

let markedApi;

function loadMarked() {
  if (markedApi) return markedApi;

  const packageJsonPath = require.resolve('marked/package.json');
  const packageRoot = path.dirname(packageJsonPath);
  const markedEntry = path.join(packageRoot, 'lib/marked.umd.js');
  const markedModule = require(markedEntry);
  markedApi = markedModule.marked || markedModule;
  return markedApi;
}

module.exports = { loadMarked };
