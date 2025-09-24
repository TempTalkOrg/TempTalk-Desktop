import * as React from 'react';
import { useBackToMainButton } from '../../hooks/useBackToMainButton';
export interface BackToMainButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const BackToMainButton = /* @__PURE__ */ React.forwardRef<
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
