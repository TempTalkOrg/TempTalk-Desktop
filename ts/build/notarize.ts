import { join, resolve } from 'path';
import { readdir as readdirCallback } from 'fs';

import pify from 'pify';

import { notarize } from '@electron/notarize';

// @ts-ignore
import * as packageJson from '../../package.json';

const readdir = pify(readdirCallback);

/* eslint-disable no-console */

go().catch(error => {
  console.error(error.stack);

  process.exit(1);
});

async function go() {
  if (process.platform !== 'darwin') {
    console.log('notarize: Skipping, not on macOS');

    return;
  }

  const appName = packageJson.name;
  if (!appName) {
    throw new Error('appName must be provided in package.json: name');
  }

  const appBundleId = packageJson.build.appId;
  if (!appBundleId) {
    throw new Error(
      'appBundleId must be provided in package.json: build.appId'
    );
  }

  const appleId = process.env.APPLE_USERNAME;
  if (!appleId) {
    throw new Error(
      'appleId must be provided in environment variable APPLE_USERNAME'
    );
  }

  const appleIdPassword = process.env.APPLE_PASSWORD;
  if (!appleIdPassword) {
    throw new Error(
      'appleIdPassword must be provided in environment variable APPLE_PASSWORD'
    );
  }

  const teamId = process.env.TEAM_ID;
  if (!teamId) {
    throw new Error('teamId must be provided in environment variable TEAM_ID');
  }

  // const ascProvider = process.env.ASC_PROVIDER;
  // if (!ascProvider) {
  //   throw new Error(
  //     'ascProvider must be provided in environment variable ASC_PROVIDER'
  //   );
  // }

  const appPaths = await findDMGs();

  console.log('Notarizing with...');
  console.log(`  primaryBundleId: ${appBundleId}`);
  console.log(`  username: ${appleId}`);
  console.log(`  teamId: ${teamId}`);
  // console.log(`  ascProvider: ${ascProvider}`);

  await Promise.all(
    appPaths.map(appPath => {
      console.log(`  file: ${appPath}`);

      return notarize({
        tool: 'notarytool',
        // tool: 'legacy',
        // appBundleId,
        appPath,
        appleId,
        appleIdPassword,
        teamId,
        // ascProvider,
      });
    })
  );
}

// const IS_DMG = /\.dmg$/;
async function findDMGs(): Promise<Array<string>> {
  const releaseDir = resolve('release');
  const files: Array<string> = await readdir(releaseDir);

  const archs = ['x64', 'arm64'];
  const dmgs = archs.map(arch => `${packageJson.name}-mac-${arch}-latest.dmg`);

  const results = new Array<string>();

  const max = files.length;
  for (let i = 0; i < max; i += 1) {
    const file = files[i];
    const fullPath = join(releaseDir, file);

    if (dmgs.includes(file)) {
      console.log('Found app dmg package: ', fullPath);
      results.push(fullPath);

      if (results.length === dmgs.length) {
        break;
      }
    }
  }

  if (results.length === 0) {
    throw new Error("No suitable file found in 'release' folder!");
  }

  return results;
}
