import React from 'react';
import { LocalizerType } from '../../../types/Util';

export interface ToolbarItemWrapperProps {
  visible: boolean;
  i18n: LocalizerType;
}

export const withToolbarItemVisible = <
  T extends { i18n?: LocalizerType; [key: string]: any },
>(
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
