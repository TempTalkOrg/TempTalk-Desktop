import React from 'react';

import { Avatar } from './Avatar';

import { LocalizerType } from '../types/Util';

export interface Props {
  i18n: LocalizerType;
  onClick: () => void;
}

export class StartHistorySearch extends React.PureComponent<Props> {
  public render() {
    const { i18n, onClick } = this.props;

    return (
      <div
        role="button"
        className="module-start-history-search"
        onMouseDown={onClick}
      >
        <Avatar
          color="grey"
          conversationType="direct"
          i18n={i18n}
          nonImageType="search"
          size={36}
        />
        <div className="module-start-history-search__content">
          <div className="module-start-history-search__number">
            {i18n('historySearchTitle')}
          </div>
        </div>
        <span className="forward-icon"></span>
      </div>
    );
  }
}
