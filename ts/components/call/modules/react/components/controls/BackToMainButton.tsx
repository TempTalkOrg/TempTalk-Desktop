import { useBackToMainButton } from '../../hooks/useBackToMainButton';
import React, { type ButtonHTMLAttributes, forwardRef } from 'react';

export type BackToMainButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const BackToMainButton = forwardRef<
  HTMLButtonElement,
  BackToMainButtonProps
>(function BackToMainButton(props: BackToMainButtonProps, ref) {
  const { buttonProps } = useBackToMainButton(props);

  return (
    <button ref={ref} {...buttonProps}>
      {props.children}
    </button>
  );
});
