/*
  global
  window,
  document,
  Whisper,
  $,
  Sound,
*/

(() => {
  window.Whisper = window.Whisper || {};
  Whisper.MeetingView = new Whisper.ReactWrapperView({
    className: 'call-root',
    Component: window.getCallView(),
    props: {
      i18n: window.i18n,
    },
  });

  const $body = $(document.body);
  window.setImmediate = window.nodeSetImmediate;
  Whisper.MeetingView.$el.appendTo($body);
})();
