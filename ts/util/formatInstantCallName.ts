type CallerObject = {
  name?: string;
  getName?: () => string;
};

export function formatInstantCallName(caller?: CallerObject): string {
  const name = caller?.name || caller?.getName?.();
  return `${name ? `${name}'s ` : ''}instant call`;
}
