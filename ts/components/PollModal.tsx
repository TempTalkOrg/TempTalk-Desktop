import React, { ReactElement, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

type Props = {
  children: ReactElement;
  onClose: () => void;
  escClose?: boolean;
};

export default function PollModal(props: Props) {
  const [el] = useState(
    document.querySelector('.conversation-modal') as HTMLElement
  );

  if (!el) {
    throw new Error('The element .modal was not found!');
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!props.escClose) {
      return;
    }
    if (e && e.key === 'Escape') {
      props?.onClose();
    }
  };

  useEffect(() => {
    el.setAttribute('style', 'display: block');
    window.addEventListener('keydown', onKeyDown);

    return () => {
      el.setAttribute('style', 'display: none');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [props.escClose]);

  return ReactDOM.createPortal(
    <div
      style={{
        margin: 'auto',
        float: 'right',
        height: '100%',
      }}
    >
      {props.children}
    </div>,
    el
  );
}
