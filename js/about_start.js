/* global $: false */

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

  const themeEl = $(`.${newThemeClass} .about-body`);
  const overlay = {
    color: themeEl.css('backgroundColor'),
    symbolColor: themeEl.css('color'),
  };

  window.changeTitleBarOverlay(overlay);
};

window.changeTheme(setTheme);

// initialize theme
const { theme, systemTheme } = window;
setTheme(theme === 'system' ? systemTheme : theme);

const appName = window.getAppName() || 'TempTalk';
$('.app-name').text(appName);

const version = window.getVersion();
const platform = window.getPlatform();
const arch = window.getArch();

let versionText = `${version}(${platform}.${arch})`;

// Add build number
const buildNumber = window.getBuildNumber();
if (buildNumber) {
  versionText += `(${buildNumber})`;
}

if (window.isInsiderUpdate()) {
  versionText += '(Insider)';
}

// Add version
$('.version').append(`<div>Version: ${versionText}</div>`);

const buildAt = window.getBuildAt();
if (buildAt) {
  const time = new Date(buildAt);
  const displayDate = `${time.toISOString()} (${moment(time).fromNow()})`;
  $('.version').append(`<div>Build At: ${displayDate}</div>`);
}

// Add commit sha
const commitSha = window.getCommitSha();
if (commitSha) {
  $('.version').append(`<div>Commit: ${commitSha}</div>`);
}

// Add commit time
const commitTime = window.getCommitTime();
if (commitTime) {
  const time = new Date(commitTime);
  const displayDate = `${time.toISOString()} (${moment(time).fromNow()})`;
  $('.version').append(`<div>Date: ${displayDate}</div>`);
}

// Add debugging metadata - environment if not production, app instance name
const states = [];

if (window.getEnvironment() !== 'production') {
  states.push(window.getEnvironment());
}
if (window.getAppInstance()) {
  states.push(window.getAppInstance());
}

$('.environment').text(states.join(' - '));

// Install the 'dismiss with escape key' handler
$(document).on('keyup', e => {
  'use strict';

  if (e.keyCode === 27) {
    window.closeAbout();
  }
});

// Localize the privacy string
$('.privacy').text(window.i18n('privacyPolicy'));

let becomeWeeeeeeeeeee = false;
let clickImageTimes = 0;
let lastClickImageTimestamp = 0;

$('.about-body').on('click', e => {
  // 1 = 鼠标左键 left; 2 = 鼠标中键; 3 = 鼠标右键
  if (e.which !== 1) {
    return;
  }
  if (becomeWeeeeeeeeeee) {
    return;
  }
  const now = Date.now();
  if (lastClickImageTimestamp < now - 3 * 1000) {
    clickImageTimes = 0;
    lastClickImageTimestamp = now;
    return;
  }

  clickImageTimes += 1;
  if (clickImageTimes >= 10) {
    becomeWeeeeeeeeeee = true;
    $('.app-name').text('Weeeeeeeeeeee');
  }
});

let clickTimes = 0;
let lastClickTimestamp = 0;
$('.app-name').on('mousedown', e => {
  // 1 = 鼠标左键 left; 2 = 鼠标中键; 3 = 鼠标右键
  if (e.which === 3) {
    e.preventDefault();
    if (!becomeWeeeeeeeeeee) {
      return;
    }

    const now = Date.now();
    if (lastClickTimestamp < now - 5 * 1000) {
      clickTimes = 0;
      lastClickTimestamp = now;
      return;
    }

    clickTimes += 1;
    if (clickTimes >= 3) {
      window.mainWindowOpenDevTools();
      window.closeAbout();
    }
  }
});

if (window.isInsiderUpdate()) {
  $('#check-for-update').text('Check for Updates (Insider)');
}

$('.check-for-update').on('click', e => {
  window.checkForUpdate();
});
