import path from 'path';
import type { AfterPackContext } from 'electron-builder';
import { notarize } from '@electron/notarize';

// @ts-ignore
import * as packageJson from '../../package.json';

export async function afterSign({
  appOutDir,
  packager,
  electronPlatformName,
}: AfterPackContext): Promise<void> {
  if (electronPlatformName !== 'darwin') {
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

  const teamId = process.env.APPLE_TEAM_ID;
  if (!teamId) {
    throw new Error(
      'teamId must be provided in environment variable APPLE_TEAM_ID'
    );
  }

  const { productFilename } = packager.appInfo;
  const appPath = path.join(appOutDir, `${productFilename}.app`);

  console.log('Notarizing with...');
  console.log(`  primaryBundleId: ${appBundleId}`);
  console.log(`  username: ${appleId}`);
  console.log(`  teamId: ${teamId}`);
  console.log(`  file: ${appPath}`);

  await notarize({
    tool: 'notarytool',
    appPath,
    appleId,
    appleIdPassword,
    teamId,
  });
}
