import { useMemoizedFn } from 'ahooks';
import { useFeatureContext } from '../context/feature-context';

const EN_MAP = {
  micNoiseSuppression: 'Mic Noise Suppression',
};

const ZH_MAP = {
  micNoiseSuppression: '麦克风噪声抑制',
};

const localeTextMap: Record<string, Record<string, string>> = {
  en: EN_MAP,
  'zh-CN': ZH_MAP,
};

export function useLocaleText() {
  const { locale = 'en' } = useFeatureContext() ?? {};

  const getLocaleText = useMemoizedFn((key: string) => {
    return localeTextMap[locale]?.[key] ?? key;
  });

  return getLocaleText;
}
