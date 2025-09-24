import os from 'os';
import { ProxyAgent } from 'proxy-agent';
import { StrictOptions as GotOptions } from 'got';

// @ts-ignore
import * as packageJson from '../../package.json';
import { isWindows } from '../OS';

const GOT_CONNECT_TIMEOUT = 2 * 60 * 1000;
const GOT_LOOKUP_TIMEOUT = 2 * 60 * 1000;
const GOT_SOCKET_TIMEOUT = 2 * 60 * 1000;

function getProxyUrl(): string | undefined {
  return process.env.HTTPS_PROXY || process.env.https_proxy;
}

const getGotUserAgent = (() => {
  const { productName, version } = packageJson;
  const productInfo = `${productName}/${version}`;

  // os.type(),
  // it returns 'Linux' on Linux, 'Darwin' on macOS, and 'Windows_NT' on Windows.
  // use 'Darwin' on Windows for compatible temporarily
  // should use os.type() in the future
  const osType = isWindows() ? 'Darwin' : os.type();
  const userAgent = `${productInfo} (Desktop; ${osType} ${os.release()})`;

  return () => userAgent;
})();

export function getGotOptions(): GotOptions {
  const proxyUrl = getProxyUrl();

  const agent = proxyUrl
    ? {
        http: new ProxyAgent({ getProxyForUrl: () => proxyUrl }),
        https: new ProxyAgent({ getProxyForUrl: () => proxyUrl }),
      }
    : undefined;

  return {
    agent,
    https: {
      rejectUnauthorized: true,
    },
    headers: {
      'Cache-Control': 'no-cache',
      'User-Agent': getGotUserAgent(),
    },
    timeout: {
      connect: GOT_CONNECT_TIMEOUT,
      lookup: GOT_LOOKUP_TIMEOUT,

      // This timeout is reset whenever we get new data on the socket
      socket: GOT_SOCKET_TIMEOUT,
    },
  };
}
