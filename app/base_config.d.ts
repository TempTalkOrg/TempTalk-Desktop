export type ConfigType = {
  set: (keyPath: string, value: unknown) => void;
  get: (keyPath: string) => unknown;
  pickBy: (predict: (value: unknown, key: string) => boolean) => unknown;
  remove: () => void;
};

export function start(
  name: string,
  targetPath: string,
  options: { allowMalformedOnStartup?: boolean } = {}
): ConfigType;
