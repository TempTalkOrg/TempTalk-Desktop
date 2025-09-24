import { useMemoizedFn } from 'ahooks';
import { ReactElement, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

type Props = {
  modelClassName?: string;
  children: ReactElement;
  onClose: () => void;
};

export default function ProfileModal(props: Props) {
  const [modalElement, setModalElement] = useState<HTMLElement>();

  const onKeyDown = useMemoizedFn((e: KeyboardEvent) => {
    if (e && e.key === 'Escape') {
      props?.onClose();
    }
  });

  useEffect(() => {
    const className = props.modelClassName || 'profile-modal';
    const modalEl = document.querySelector(`.${className}`) as HTMLElement;
    if (modalEl) {
      modalEl.onmousedown = (e: MouseEvent) => {
        // @ts-ignore
        if (e?.target?.className === className) {
          props?.onClose();
        }
      };
      modalEl.setAttribute('style', 'display: flex');
    }

    setModalElement(modalEl);

    window.addEventListener('keydown', onKeyDown);

    return () => {
      if (modalEl) {
        modalEl.setAttribute('style', 'display: none');
      }

      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  if (!modalElement) {
    return null;
  }

  return ReactDOM.createPortal(props.children, modalElement);
}
