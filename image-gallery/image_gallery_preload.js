/* global window */
const { contextBridge, ipcRenderer } = require('electron');
const url = require('url');
const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');
const i18n = require('../js/modules/i18n');
const { copyImageFile } = require('../js/modules/copy_image');
const fse = require('fs-extra');
const toArrayBuffer = require('to-arraybuffer');

require('../js/modules/theme_api');

// import logging for preload JS
window.getEnvironment = () => config.environment;
window.getVersion = () => config.version;
require('../js/logging');
let mediaFiles;
let selectedIndex;

ipcRenderer.on('receive-images', (_, info) => {
  mediaFiles = info.mediaFiles;
  selectedIndex = info.selectedIndex;
});

// 这行代码是为了让 copyImageFile 正确运行
window.readFileBuffer = async filePath => {
  const buffer = await fse.readFile(filePath);
  return toArrayBuffer(buffer);
};

const apis = {
  i18n: i18n.setup(locale, localeMessages),
  log: console.log,
  getEnvironment: () => config.environment,
  getVersion: () => config.version,
  mediaFiles: () => mediaFiles,
  selectedIndex: () => selectedIndex,
  React: require('react'),
  ReactDOM: require('react-dom'),
  copyImageFile: copyImageFile,
  openFileDefault: (absPath, fileName, contentType, attachmentId) => {
    ipcRenderer.send(
      'open-file-default',
      absPath,
      fileName,
      contentType,
      attachmentId
    );
  },
  readFileBuffer: window.readFileBuffer,
  getImageGalleryView: () => {
    const {
      ImageGallery,
    } = require('../ts/components/image-gallery/ImageGallery');
    return ImageGallery;
  },
};
contextBridge.exposeInMainWorld('ImageGalleryApis', apis);
