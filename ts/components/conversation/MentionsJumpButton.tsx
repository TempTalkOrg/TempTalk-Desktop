import React from 'react';

export const MentionsJumpButton = ({ count }: { count: number }) => {
  return (
    <button className="text module-mentions-jump__button module-scroll-down__button--new-messages">
      <div className="module-conversation-list-item__unread-count module-mentions-jump__count">
        {count > 99 ? '99+' : count}
      </div>
      <div className="module-mentions-jump__text">@</div>
    </button>
  );
};
