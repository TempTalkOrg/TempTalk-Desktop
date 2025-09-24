import chokidar from 'chokidar';

export function watchFileChange(
  exePath: string,
  onChange: (path: string) => void
) {
  const watcher = chokidar.watch(exePath, {
    ignored: /[\/\\]\./,
    persistent: true,
    alwaysStat: true,
    awaitWriteFinish: true,
    ignoreInitial: true,
  });

  watcher.on('change', onChange);

  return watcher;
}
