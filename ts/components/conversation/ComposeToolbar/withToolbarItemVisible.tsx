import React from 'react';
import { LocalizerType } from '../../../types/Util';

export type ToolbarItemWrapperProps<T> = Omit<T, 'visible'> & {
  visible: boolean;
};

export const withToolbarItemVisible = <T extends { i18n?: LocalizerType }>(
  Component: React.ComponentType<T>
) => {
  return (
    props: T & {
      visible?: boolean;
    }
  ) => {
    const { visible = true, ...extraProps } = props as {
      visible?: boolean;
    } & T;
    if (!visible) {
      return null;
    }
    return <Component {...(extraProps as T)} />;
  };
};
