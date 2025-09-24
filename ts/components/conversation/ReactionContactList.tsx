import React from 'react';

import { LocalizerType } from '../../types/Util';
import { AutoSizer, List } from 'react-virtualized';
import { ContactListItem } from '../ContactListItem';

// from https://github.com/bvaughn/react-virtualized/blob/fb3484ed5dcc41bffae8eab029126c0fb8f7abc0/source/List/types.js#L5
type RowRendererParamsType = {
  index: number;
  isScrolling: boolean;
  isVisible: boolean;
  key: string;
  parent: Object;
  style: Object;
};

export interface Contact {
  id: string;
  name?: string;
  avatarPath?: string;
  color: string;
  // email?: string;
  isMe?: boolean;
}

interface Props {
  contacts: Array<Contact>;
  i18n: LocalizerType;
}

export class ReactionContactList extends React.Component<Props> {
  public renderRow = ({
    index,
    // key,
    style,
  }: RowRendererParamsType): JSX.Element => {
    const { contacts, i18n } = this.props;

    if (!contacts) {
      throw new Error('renderRow: Tried to render without contacts');
    }

    const contact = contacts[index];
    const { id, name, color, avatarPath } = contact;
    return (
      <ContactListItem
        key={id}
        id={id}
        style={style}
        phoneNumber={id}
        name={name}
        email={' '}
        color={color}
        avatarPath={avatarPath}
        i18n={i18n}
      />
    );
  };

  public renderContactList() {
    const { contacts } = this.props;

    if (!contacts || !contacts.length) {
      return null;
    }

    const height = (contacts.length > 5 ? 5 : contacts.length) * 44;

    return (
      <div
        className="module-reaction__list-container"
        style={{ height: `${height + 2}px` }}
      >
        <AutoSizer>
          {({ height, width }) => (
            <List
              className="module-left-pane__virtual-list"
              height={height}
              rowCount={contacts.length}
              rowHeight={44}
              rowRenderer={this.renderRow}
              width={width}
              contacts={contacts}
            />
          )}
        </AutoSizer>
      </div>
    );
  }

  public render() {
    return <div className="module-reaction">{this.renderContactList()}</div>;
  }
}
