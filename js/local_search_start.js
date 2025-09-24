/* global $, Whisper */

const $body = $(document.body);
$body.addClass(`${window.theme}-theme`);

async function updateGlobalConfig() {
  try {
    const globalConfig = await window.ipcGetGlobalConfig();
    window.getGlobalConfig = () => globalConfig;
  } catch (error) {
    window.log.error('getGlobalConfig failed', error);
  }
}

// eslint-disable-next-line strict
const getInitialData = async () => {
  await window.storage.fetch();

  await updateGlobalConfig();
  setInterval(updateGlobalConfig, 5 * 60 * 1000);
};

window.initialRequest = getInitialData();

// eslint-disable-next-line more/no-then
window.initialRequest.then(
  () => {
    'use strict';

    Whisper.LocalSearchView = new Whisper.ReactWrapperView({
      className: 'local-search-body',
      Component: window.Signal.Components.LocalSearch,
      props: {
        i18n: window.i18n,
      },
    });

    const $wrapper = $('.local-search-wrapper');
    window.setImmediate = window.nodeSetImmediate;
    Whisper.LocalSearchView.$el.appendTo($wrapper);
  },
  error => {
    'use strict';

    window.log.error(
      'settings.initialRequest error:',
      error && error.stack ? error.stack : error
    );
    // window.closeGroupEditor();
  }
);

// 动态设置主题
// eslint-disable-next-line strict
const setTheme = async theme => {
  let newTheme = theme;
  if (theme === 'system') {
    newTheme = await window.getNativeSystemTheme();
  }

  const newThemeClass = `${newTheme}-theme`;

  $(document.body)
    .removeClass('dark-theme')
    .removeClass('light-theme')
    .addClass(newThemeClass);

  const themeEl = $(`.${newThemeClass} .local-search-wrapper`);
  const overlay = {
    color: themeEl.css('backgroundColor'),
    symbolColor: themeEl.css('color'),
  };

  window.changeTitleBarOverlay(overlay);
};

window.changeTheme(setTheme);

// initialize theme
setTheme(window.theme === 'system' ? window.systemTheme : window.theme);
