import React from 'react';
import { FloatingMessage } from './hooks/useFloatingMessage';

interface FloatingMessageListProps {
  messages: FloatingMessage[];
}

export const FloatingMessageList: React.FC<FloatingMessageListProps> = ({
  messages,
}) => {
  return (
    <div className="floating-message-list">
      {messages.map(message => (
        <div key={message.id} className="floating-message-item">
          <span className="span-name">{message.name}</span>
          <span className="span-text">{message.text}</span>
        </div>
      ))}
    </div>
  );
};
