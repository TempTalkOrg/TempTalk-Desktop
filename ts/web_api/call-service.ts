import { createDomainSelector, ServerConfigType } from './endpoint-selector';

const mainWindow = window as any;

let callServiceUrls: string[] = [];
let testCallServiceInterval: NodeJS.Timeout | null = null;

const testCallDomains = createDomainSelector();

async function refreshCallServiceUrls() {
  try {
    let serverUrls;

    try {
      const response = await (window as any).callAPI.getServiceUrls();
      serverUrls = response.serviceUrls.map((url: string) => ({
        url,
        certType: 'self',
      }));
    } catch (e) {
      console.log('get call service urls from server failed', e);
    }

    const domains = (
      serverUrls?.length
        ? serverUrls
        : mainWindow.getGlobalWebApiUrls().livekit || []
    ).map((item: ServerConfigType) => ({
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

export const getCallServiceUrls = () => {
  return callServiceUrls;
};
