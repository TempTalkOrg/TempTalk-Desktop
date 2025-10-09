/*
  window,
*/

window.setImmediate = window.nodeSetImmediate;

const FloatingBarView = window.getFloatingBarView();

window.ReactDOM.render(
  window.React.createElement(FloatingBarView, {
    backToCall: window.backToCall,
    setMuted: window.setMuted,
    hangup: window.hangup,
    registerFloatingBarUpdateHandler: window.registerFloatingBarUpdateHandler,
    i18n: window.i18n,
  }),
  document.querySelector('.floating-bar-view-container')
);
