import path from 'path';
import { readdir as readdirCallback } from 'fs';

import pify from 'pify';

import { writeSignature } from './signature';

// @ts-ignore
import * as packageJson from '../../package.json';
import { isMacOS, isWindows } from '../OS';
import { getCliOptions } from './cliOptions';
import { toLogFormat } from '../types/errors';

const readdir = pify(readdirCallback);

const OPTIONS = [
  {
    names: ['help', 'h'],
    type: 'bool',
    help: 'Print this help and exit.',
  },
  {
    names: ['private', 'p'],
    type: 'string',
    help: 'Path to private key file (default: ./private.key)',
    default: 'private.key',
  },
  {
    names: ['update', 'u'],
    type: 'string',
    help: 'Path to the update package (default: the .exe or .zip in ./release)',
  },
  {
    names: ['version', 'v'],
    type: 'string',
    help: `Version number of this package (default: ${packageJson.version})`,
    default: packageJson.version,
  },
];

type OptionsType = {
  private: string;
  update: string;
  version: string;
};

const cliOptions = getCliOptions<OptionsType>(OPTIONS);
go(cliOptions).catch(error => {
  console.error('Something went wrong!', toLogFormat(error));
});

async function go(options: OptionsType) {
  const { private: privateKey, version } = options;

  let updatePaths: Array<string>;
  if (options.update) {
    updatePaths = [options.update];
  } else {
    updatePaths = await findUpdatePaths();
  }

  const keyFile = path.basename(privateKey);
  const keyFolder = path.dirname(privateKey);
  const privateKeyPath = path.join(keyFolder, `${packageJson.name}.${keyFile}`);

  await Promise.all(
    updatePaths.map(async updatePath => {
      console.log('Signing with...');
      console.log(`  version: ${version}`);
      console.log(`  update file: ${updatePath}`);
      console.log(`  private key file: ${privateKeyPath}`);

      await writeSignature(updatePath, version, privateKeyPath);
    })
  );
}

// const IS_EXE = /\.exe$/;
// const IS_ZIP = /\.zip$/;
async function findUpdatePaths(): Promise<Array<string>> {
  const releaseDir = path.resolve('release');
  const files: Array<string> = await readdir(releaseDir);
  const targets = [];

  if (isMacOS()) {
    const archs = ['x64', 'arm64'];
    archs.forEach(arch =>
      targets.push(`${packageJson.name}-mac-${arch}-latest.zip`)
    );
  } else if (isWindows()) {
    targets.push(`${packageJson.name}-win-latest.exe`);
  } else {
    throw new Error(`unsupported platform ${process.platform}`);
  }

  const max = files.length;
  const results = new Array<string>();

  for (let i = 0; i < max; i += 1) {
    const file = files[i];
    const fullPath = path.join(releaseDir, file);

    if (targets.includes(file)) {
      console.log('found file:', fullPath);
      results.push(fullPath);

      if (results.length === targets.length) {
        break;
      }
    }
  }

  if (results.length === 0) {
    throw new Error("No suitable file found in 'release' folder!");
  }

  return results;
}
