import { shell } from 'electron';
export function shellOpenExternal(url: string) {
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('x-apple.systempreferences:')
  ) {
    return shell.openExternal(url);
  }
  console.log('shellOpenExternal bad param:' + url);
  return;
}
