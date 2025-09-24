import React from 'react';
import { Icon } from './Icon';

export const Undo = ({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) => {
  let classNames = 'toolbar-operation-button';

  if (disabled) {
    classNames += ' disabled';
  }

  return (
    <button className={classNames} onClick={onClick}>
      <Icon
        icon="undo"
        color={
          disabled
            ? 'rgba(183, 182, 183, .5)'
            : 'var(--dst-color-image-gallery-toolbar-icon)'
        }
      />
    </button>
  );
};
