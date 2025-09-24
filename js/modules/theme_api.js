const { contextBridge, ipcRenderer } = require('electron');
const url = require('url');

const config = url.parse(window.location.toString(), true).query;

function makeGetter(name) {
  return () =>
    new Promise((resolve, reject) => {
      ipcRenderer.once(`get-success-${name}`, (event, error, value) => {
        if (error) {
          return reject(error);
        }
        return resolve(value);
      });
      ipcRenderer.send(`get-${name}`);
    });
}

contextBridge.exposeInMainWorld('THEME_API', {
  theme: config.theme,
  systemTheme: config.systemTheme,
  changeTheme(fn) {
    ipcRenderer.on('set-theme-setting', (_, info) => {
      fn(info);
    });
  },
  getNativeSystemTheme: makeGetter('system-theme'),
});
