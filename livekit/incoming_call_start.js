window.setImmediate = window.nodeSetImmediate;

const IncomingCallView = window.getIncomingCallView();

window.ReactDOM.render(
  window.React.createElement(IncomingCallView, { i18n: window.i18n }),
  document.querySelector('.incoming-call-root')
);
