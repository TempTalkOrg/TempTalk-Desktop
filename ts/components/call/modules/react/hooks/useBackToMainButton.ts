import * as React from 'react';
import { mergeProps } from '../utils';
import { BackToMainButtonProps } from '../components/controls/BackToMainButton';

export function useBackToMainButton(props: BackToMainButtonProps) {
  const buttonProps = React.useMemo(() => {
    const mergedProps = mergeProps(props, {
      className: 'back-to-main-button',
    });
    return mergedProps;
  }, [props]);

  return { buttonProps };
}
