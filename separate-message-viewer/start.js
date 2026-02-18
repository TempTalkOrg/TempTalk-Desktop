/*
  global
  window,
  document,
  Whisper,
  $,
*/

window.setImmediate = window.nodeSetImmediate;
window.ReactDOM.render(
  window.React.createElement(window.getSeparateMessageView(), {
    i18n: window.i18n,
  }),
  document.querySelector('.separate-message-viewer-root')
);

const setTheme = async theme => {
  let newTheme = theme;
  if (theme === 'system') {
    newTheme = await window.getNativeSystemTheme();
  }

  const newThemeClass = `${newTheme}-theme`;

  document.body.classList.remove('dark-theme', 'light-theme');
  document.body.classList.add(newThemeClass, 'ios-theme');
};

window.changeTheme(setTheme);

// initialize theme
const { theme, systemTheme } = window;
setTheme(theme === 'system' ? systemTheme : theme);
