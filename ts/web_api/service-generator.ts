import { startTestCallServiceUrls } from './call-service';
import {
  CertType,
  createDomainSelector,
  DomainConfigType,
  SpeedTestResult,
} from './endpoint-selector';

type ServerConfigType = {
  url: string;
  ms?: number;
  certType: CertType;
};

type ServiceConfigType = {
  name: string;
  path: string;
  domains: string[];
};

type GlobalConfigType = {
  domains: DomainConfigType[];
  services: ServiceConfigType[];
};

const GLOBAL_CONFIG_STORAGE_KEY = 'key-global-config';
const SERVICE_CONFIG_STORAGE_KEY = 'key-tested-server-config';

const mainWindow = window as any;

function getLocalStorageItem(k: string) {
  const v = localStorage.getItem(k);
  try {
    return v ? JSON.parse(v) : null;
  } catch (e) {
    console.log(`getLocalStorageItem ${k} failed`, e);
  }
  return null;
}

function setLocalStorageItem(k: string, v: any) {
  if (k && v) {
    localStorage.setItem(k, JSON.stringify(v));
  }
}

const fetchGlobalConfig = async (globalConfigURLs: string[]) => {
  let config = null;
  for (let i = 0; i < globalConfigURLs.length; i += 1) {
    const url = globalConfigURLs[i];
    try {
      const response = await mainWindow.getOuterRequest().getGlobalConfig(url);
      if (response.code === 0 && response.data) {
        config = response.data;
        break;
      }
    } catch (e) {
      mainWindow.log.error(`load global config failed: ${url}, e=`, e);
    }
  }

  if (!config) {
    mainWindow.log.error('load global config ALL failed');
  }

  return config;
};

function freshWebApiUrlCache(config: Record<string, ServerConfigType[]>) {
  mainWindow.freshWebApiUrlCache(config);
  mainWindow.ipcFreshWebApiUrlCache(config);
}

const useGlobalConfigCache = () => {
  let config = getLocalStorageItem(GLOBAL_CONFIG_STORAGE_KEY);

  const isNewVersionConfig = config && config.domains;

  if (isNewVersionConfig) {
    mainWindow.globalConfig = config;
  }

  mainWindow.log.info('globalConfig cache get:', mainWindow.globalConfig);
};

const useServiceConfigCache = () => {
  let config = getLocalStorageItem(SERVICE_CONFIG_STORAGE_KEY);

  if (config) {
    mainWindow.log.info('serviceConfig cache get:', config);

    freshWebApiUrlCache(config);
  }
};

function combineServiceConfig(
  domains: Array<(DomainConfigType & SpeedTestResult) | DomainConfigType>,
  services: ServiceConfigType[]
) {
  const config: Record<string, ServerConfigType[]> = {};

  for (const service of mainWindow.DYN_SERVICE_LIST) {
    const targetService: ServiceConfigType | undefined = services?.find(
      (serviceConfig: ServiceConfigType) => serviceConfig.name === service
    );
    if (!targetService) {
      continue;
    }
    const usedDomains = domains.filter(domain =>
      targetService.domains.includes(domain.label)
    );
    config[service] = usedDomains.map(domain => ({
      url: `https://${domain.domain}${targetService.path}`,
      ms: (domain as SpeedTestResult).ms ?? 0,
      certType: domain.certType,
    }));
  }

  return config;
}

export const generateServiceConfig = () => {
  useGlobalConfigCache();
  useServiceConfigCache();

  const selectBestDomain = createDomainSelector();

  const regenerateServiceConfig = async (
    config: GlobalConfigType,
    testSpeed: boolean = true
  ) => {
    const domainList = testSpeed
      ? await selectBestDomain(config.domains ?? [])
      : (config.domains ?? []);
    const serviceConfig = combineServiceConfig(domainList, config.services);

    setLocalStorageItem(SERVICE_CONFIG_STORAGE_KEY, serviceConfig);
    mainWindow.log.info('put serviceConfig', serviceConfig);
    freshWebApiUrlCache(serviceConfig);
    // start call service url test interval
    startTestCallServiceUrls(serviceConfig.livekit);
  };

  const generateLatestServiceConfig = async () => {
    try {
      const config =
        (await fetchGlobalConfig(mainWindow.globalConfigURLs)) ||
        mainWindow.globalConfig;

      mainWindow.globalConfig = config;
      setLocalStorageItem(GLOBAL_CONFIG_STORAGE_KEY, config);
      mainWindow.log.info('put globalConfig', config);

      await regenerateServiceConfig(config);
    } catch (e) {
      console.error('fetch global config and select best domain failed', e);
    }
  };

  generateLatestServiceConfig();

  // 每6小时拉一次全局配置，并测速
  setInterval(
    () => {
      generateLatestServiceConfig();
    },
    6 * 60 * 60 * 1000
  );

  return regenerateServiceConfig;
};
