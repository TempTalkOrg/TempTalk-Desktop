import React, { useMemo } from 'react';
import { ConfigProvider as AntdConfigProvider, ThemeConfig } from 'antd';

export const ConfigProvider = (
  props: React.PropsWithChildren<{ theme: ThemeConfig }>
) => {
  const theme = useMemo(() => {
    return {
      components: {
        Button: {
          defaultHoverBg: 'var(--dst-color-background-secondary)',
          defaultHoverBorderColor: 'var(--dst-color-line)',
          defaultHoverColor: 'var(--dst-color-text-primary)',
          defaultActiveBg: 'var(--dst-color-background-third)',
          defaultActiveBorderColor: 'var(--dst-color-line)',
          defaultActiveColor: 'var(--dst-color-text-primary)',
        },
      },
    };
  }, []);

  return (
    <AntdConfigProvider theme={theme}>{props.children}</AntdConfigProvider>
  );
};
