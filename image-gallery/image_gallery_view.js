/*
  global
  window,
  document,
  Whisper,
  $,
  ImageGalleryApis
*/

if (window.console) {
  console._log = console.log;
  console.log = ImageGalleryApis.log;
}
console.log('image_gallery_view.js start.');

window.React = ImageGalleryApis.React;
window.ReactDOM = ImageGalleryApis.ReactDOM;
window.i18n = ImageGalleryApis.i18n;

(() => {
  window.Whisper = window.Whisper || {};
  Whisper.ImageGalleryView = new Whisper.ReactWrapperView({
    Component: ImageGalleryApis.getImageGalleryView(),
    props: {
      apis: { ...ImageGalleryApis, globalWindow: window },
    },
  });
  const $body = $(document.body);
  Whisper.ImageGalleryView.$el.appendTo($body);
})();
