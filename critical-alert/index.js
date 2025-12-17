window.setImmediate = window.nodeSetImmediate;

const CriticalAlertView = window.getCriticalAlertView();

window.ReactDOM.render(
  window.React.createElement(CriticalAlertView, {
    i18n: window.i18n,
    conversationId: window.getConversationId(),
    from: window.getFrom(),
    title: window.getTitle(),
    isPrivate: window.getIsPrivate(),
  }),
  document.querySelector('.critical-alert-root')
);
