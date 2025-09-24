/*
  global
  window,
  document,
  Whisper,
  $,
*/

(() => {
  window.Whisper = window.Whisper || {};
  Whisper.FloatingBarView = new Whisper.ReactWrapperView({
    Component: window.Signal.Components.FloatingBar,
    props: {
      backToCall: window.backToCall,
      setMuted: window.setMuted,
      hangup: window.hangup,
      registerFloatingBarUpdateHandler: window.registerFloatingBarUpdateHandler,
    },
  });

  const $body = $(document.body);
  window.setImmediate = window.nodeSetImmediate;
  Whisper.FloatingBarView.$el.appendTo($body);
})();

// 始终黑色主题
$(document.body)
  .removeClass('dark-theme')
  .removeClass('light-theme')
  .addClass('dark-theme');
