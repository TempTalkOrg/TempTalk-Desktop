import { createDomainSelector, ServerConfigType } from './endpoint-selector';

let callServiceUrls: string[] = [];
let testCallServiceInterval: NodeJS.Timeout | null = null;

const testCallDomains = createDomainSelector();

async function refreshCallServiceUrls() {
  try {
    let serverUrls = [];

    if (!(window as any).callAPI) {
      console.log('callAPI not ready');
      return [];
    }
    try {
      const response = await (window as any).callAPI.getServiceUrls();
      callServiceUrls = response.serviceUrls;
      serverUrls = response.serviceUrls.map((url: string) => ({
        url,
        certType: 'authority',
      }));
    } catch (e) {
      console.log('refresh call service urls from server failed', e);
    }

    const domains = serverUrls.map((item: ServerConfigType) => ({
      domain: new URL(item.url).hostname,
    }));

    // update tested result in thenable
    testCallDomains(domains).then(callServiceDomains => {
      callServiceUrls = callServiceDomains.map(
        server => `https://${server.domain}`
      );
      console.log('test call service urls done:', serverUrls);
    });

    return serverUrls.map((item: ServerConfigType) => item.url);
  } catch (e) {
    console.log('refresh call service urls failed', e);
  }
}

export const startTestCallServiceUrls = () => {
  if (testCallServiceInterval) {
    clearInterval(testCallServiceInterval);
  }

  testCallServiceInterval = setInterval(
    () => {
      refreshCallServiceUrls();
    },
    1000 * 60 * 30
  );
  refreshCallServiceUrls();
};

export const getCallServiceUrls = async () => {
  // check urls before start/join call
  if (callServiceUrls.length) {
    return callServiceUrls;
  } else {
    return await refreshCallServiceUrls();
  }
};
