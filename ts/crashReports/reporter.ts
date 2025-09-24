import { app, crashReporter } from 'electron';
import path from 'node:path';
import { moveSync, pathExistsSync, readdirSync, removeSync } from 'fs-extra';

function migrateCrashpad() {
  const defaultPath = path.join(app.getPath('appData'), app.getName());
  if (!pathExistsSync(defaultPath)) {
    return;
  }

  const dirents = readdirSync(defaultPath, { withFileTypes: true });
  if (!dirents.length) {
    //empty default folder, just remove it
    removeSync(defaultPath);
    return;
  }

  if (dirents.length > 1) {
    // multiple files/folders in defaultPath
    return;
  }

  const crashpad = 'Crashpad';

  const found = dirents[0];
  if (!found.isDirectory() || found.name !== crashpad) {
    return;
  }

  const currentCrashPad = path.join(app.getPath('userData'), crashpad);
  if (pathExistsSync(currentCrashPad)) {
    return;
  }

  moveSync(path.join(defaultPath, crashpad), currentCrashPad);
  removeSync(defaultPath);
}

export function setup(): void {
  try {
    migrateCrashpad();
  } catch (error) {
    //
  }

  crashReporter.start({ uploadToServer: false });
}
