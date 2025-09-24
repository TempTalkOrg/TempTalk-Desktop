import * as React from 'react';
import { mergeProps } from '../utils';
import { RaiseHandButtonProps } from '../components/controls/RaiseHandButton';
import { setupRaiseHandButton } from '../../core';

export function useRaiseHandButton(props: RaiseHandButtonProps) {
  const buttonProps = React.useMemo(() => {
    const { className } = setupRaiseHandButton();

    const mergedProps = mergeProps(props, {
      className,
    });
    return mergedProps;
  }, [props]);

  return { buttonProps };
}
