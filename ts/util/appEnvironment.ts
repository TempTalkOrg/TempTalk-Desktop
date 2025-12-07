import { app } from 'electron';
import path from 'node:path';
import { IConfig } from 'config';

// @ts-ignore
import * as packageJson from '../../package.json';

export const getAppUserModelId = (() => {
  const appId = `org.difft.${packageJson.name.replace('yelling', 'chative')}`;
  return () => appId;
})();

// keep use Chative folder for Yelling temporarily
function getUserDataPath(config: IConfig) {
  // do NOT call app.getPath('userData') here
  // cause it will try to create default userData folder
  const appDataPath = app.getPath('appData');
  const userDataName = app.getName().replace('Yelling', 'Chative');

  let userDataPath = path.join(appDataPath, userDataName);

  // Use separate data directory for development
  if (config.has('storageProfile')) {
    userDataPath = path.join(
      appDataPath,
      `${userDataName}-${config.get('storageProfile')}`
    );
  }

  console.log('userData path:', userDataPath);

  return userDataPath;
}

export function initAppEnv(config: IConfig) {
  // use new userData path
  app.setPath('userData', getUserDataPath(config));

  app.setAsDefaultProtocolClient('chative');
  app.setAsDefaultProtocolClient('temptalk');

  const appId = getAppUserModelId();
  app.setAppUserModelId(appId);
  console.log('Windows Application User Model ID (AUMID):', appId);
}
