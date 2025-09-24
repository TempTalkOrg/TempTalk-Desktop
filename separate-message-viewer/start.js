/*
  global
  window,
  document,
  Whisper,
  $,
  Sound,
*/

window.Whisper = window.Whisper || {};
Whisper.SeparateMessageViewer = new Whisper.ReactWrapperView({
  className: 'separate-message-viewer-root',
  Component: window.getSeparateMessageView(),
  props: {
    i18n: window.i18n,
  },
});

const $body = $(document.body);
window.setImmediate = window.nodeSetImmediate;
Whisper.SeparateMessageViewer.$el.appendTo($body);

const setTheme = async theme => {
  let newTheme = theme;
  if (theme === 'system') {
    newTheme = await window.getNativeSystemTheme();
  }

  const newThemeClass = `${newTheme}-theme`;

  $(document.body)
    .removeClass('dark-theme')
    .removeClass('light-theme')
    .addClass(newThemeClass)
    .addClass('ios-theme');
};

window.changeTheme(setTheme);

// initialize theme
const { theme, systemTheme } = window;
setTheme(theme === 'system' ? systemTheme : theme);
