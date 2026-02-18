import React from 'react';
import { LocalizerType } from '../../types/Util';

type Props = {
  i18n: LocalizerType;
};

export const UnknowUserIndicator = (props: Props) => {
  const { i18n } = props;
  return (
    <div className="module-conversation-indicator">
      {i18n('unknowUserIndicator')}
    </div>
  );
};
