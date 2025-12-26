const mainWindow = window as any;

const GRAY_RULES_STORAGE_KEY = 'grayRules';
let grayRules: Record<string, boolean> = {};

async function refreshGrayRules() {
  try {
    const response = await mainWindow.textsecure.messaging.checkGrayRules();
    for (const { source, isInGray } of response) {
      grayRules[source] = isInGray;
    }
    await mainWindow.storage.put(GRAY_RULES_STORAGE_KEY, grayRules);
  } catch (e) {
    console.log('get gray rules failed', e);
  }
}

let grayRulesInterval: NodeJS.Timeout | null = null;

export async function startGrayRulesSync() {
  grayRules = mainWindow.storage.get(GRAY_RULES_STORAGE_KEY) ?? {};
  if (grayRulesInterval) {
    clearInterval(grayRulesInterval);
  }
  grayRulesInterval = setInterval(
    refreshGrayRules,
    1000 * 60 * 60 * 3 // 3 hours
  );
  refreshGrayRules();
}

export function isInGray(key: string) {
  return grayRules[key] === true;
}
