import { createDomainSelector, ServerConfigType } from './endpoint-selector';

let callServiceUrls: string[] = [];
let testCallServiceInterval: NodeJS.Timeout | null = null;

const testCallDomains = createDomainSelector();

async function refreshCallServiceUrls() {
  try {
    let serverUrls;

    if (!(window as any).callAPI) {
      console.log('callAPI not ready');
      return;
    }
    try {
      const response = await (window as any).callAPI.getServiceUrls();
      serverUrls = response.serviceUrls.map((url: string) => ({
        url,
        certType: 'self',
      }));
    } catch (e) {
      console.log('refresh call service urls from server failed', e);
    }

    const domains = (serverUrls || []).map((item: ServerConfigType) => ({
      domain: new URL(item.url).hostname,
    }));

    const callServiceDomains = await testCallDomains(domains);

    callServiceUrls = callServiceDomains.map(
      server => `https://${server.domain}`
    );
  } catch (e) {
    console.log('refresh call service urls failed', e);
  }
}

export const startTestCallServiceUrls = (initials: ServerConfigType[]) => {
  callServiceUrls = initials.map(item => item.url);

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
    try {
      const response = await (window as any).callAPI.getServiceUrls();
      callServiceUrls = response.serviceUrls;
    } catch (e) {
      console.log('get call service urls from server failed', e);
    }
    return callServiceUrls;
  }
};
