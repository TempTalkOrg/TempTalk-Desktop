export type CertType = 'self' | 'authority';

export type ServerConfigType = {
  url: string;
  certType: CertType;
  ms?: number;
};

const testUrlGet = async (url: string, certType: CertType) => {
  let ms = -1;
  const reqStart = Date.now();
  try {
    await (window as any)
      .getOuterRequest()
      .pingURL(`${url}?t=${Date.now()}`, certType === 'self');
    ms = Date.now() - reqStart;
  } catch (err: any) {
    if (err && err.code >= 100 && err.code <= 499) {
      ms = Date.now() - reqStart;
    }
  }
  return ms;
};

export async function testDomainSpeed(domainList: DomainConfigType[]) {
  if (domainList.length === 1) {
    return [{ ...domainList[0], ms: 1 }];
  }

  const reqs = [];
  for (let i = 0; i < domainList.length; i += 1) {
    reqs.push(
      testUrlGet(`https://${domainList[i].domain}`, domainList[i].certType)
    );
  }
  const result = await Promise.allSettled(reqs);
  const ms = [];
  for (let i = 0; i < reqs.length; i += 1) {
    if (result[i].status === 'fulfilled') {
      ms.push({
        ...domainList[i],
        ms: (result[i] as PromiseFulfilledResult<number>).value,
      });
    }
  }

  ms.sort((a, b) => {
    if (a.ms === -1) {
      return 1;
    }
    if (b.ms === -1) {
      return -1;
    }
    return a.ms - b.ms;
  });
  return ms;
}

export type DomainConfigType = {
  domain: string;
  certType: CertType;
  label: string;
};

export type SpeedTestResult = {
  ms: number;
};

export const createDomainSelector = (threshold: number = 1 * 60 * 1000) => {
  let lastSelectTimestamp = 0;
  let lastTestedDomains: Array<DomainConfigType & SpeedTestResult> = [];

  const selectBestDomain = async (
    domains: DomainConfigType[]
  ): Promise<Array<DomainConfigType & SpeedTestResult>> => {
    if (lastSelectTimestamp && Date.now() - lastSelectTimestamp < threshold) {
      return lastTestedDomains;
    }
    lastSelectTimestamp = Date.now();

    lastTestedDomains = await testDomainSpeed(domains);

    return lastTestedDomains;
  };

  return selectBestDomain;
};
