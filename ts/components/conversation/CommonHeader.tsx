import React from 'react';

import { LocalizerType } from '../../types/Util';

interface Props {
  name?: string;
  i18n: LocalizerType;
}

export class CommonHeader extends React.Component<Props> {
  public constructor(props: Props) {
    super(props);
  }

  public renderTitle() {
    const { name } = this.props;

    return (
      <div
        className="module-conversation-header__title"
        style={{
          maxWidth: '100%',
          fontSize: '16px',
          fontWeight: 510,
          fontStyle: 'normal',
          lineHeight: '24px',
        }}
      >
        {name ? name : null}
      </div>
    );
  }

  public render() {
    return (
      <div className="module-conversation-header" style={{ border: 'none' }}>
        <div className="module-conversation-header__title-container">
          <div className="module-conversation-header__title-flex">
            {this.renderTitle()}
          </div>
        </div>
      </div>
    );
  }
}
