// @ts-ignore
import * as packageJson from '../../package.json';
import os from 'os';
import { getAppUserModelId } from '../util/appEnvironment';

let userAgent = '';

export const initWebApiUserAgent = (
  insider: boolean,
  flavorId: string
): void => {
  if (userAgent) {
    // already initialized
    return;
  }

  const { productName, version } = packageJson;
  const productInfo = `${productName}/${version}`;

  // os.type(),
  // it returns 'Linux' on Linux, 'Darwin' on macOS, and 'Windows_NT' on Windows.
  const systemInfo = `${os.type()} ${os.release()}`;
  const appId = getAppUserModelId();
  const finalFlavorId = flavorId ? flavorId.toLowerCase() : 'ffffffff';
  const appInfo = `AppId ${appId}; FlavorId ${finalFlavorId}`;

  let comment = `Desktop; ${systemInfo}; NodeFetch 2; ${appInfo}`;
  if (insider) {
    comment += '; Beta';
  }

  userAgent = `${productInfo} (${comment})`;

  return;
};

export const getWebApiUserAgent = () => {
  if (!userAgent) {
    throw new Error(
      'web api user-agent string must be initialized before used'
    );
  }
  return userAgent;
};
