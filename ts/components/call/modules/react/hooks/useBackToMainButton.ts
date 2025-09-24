import * as React from 'react';
import { mergeProps } from '../utils';
import { setupBackToMainButton } from '../../core';
import { BackToMainButtonProps } from '../components/controls/BackToMainButton';

export function useBackToMainButton(props: BackToMainButtonProps) {
  const buttonProps = React.useMemo(() => {
    const { className } = setupBackToMainButton();

    const mergedProps = mergeProps(props, {
      className,
    });
    return mergedProps;
  }, [props]);

  return { buttonProps };
}
