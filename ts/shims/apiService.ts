const globalWindow = window as any;

export function getAccountManager() {
  return globalWindow.getAccountManager();
}

export function deleteAllData() {
  return globalWindow.deleteAllData();
}
