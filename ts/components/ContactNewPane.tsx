import React from 'react';
import { ContactCollect } from './ContactCollect';
import { ContactSearchChangedActionType } from '../state/ducks/contactSearch';
import { ConversationType } from '../state/ducks/conversations';
import { LocalizerType } from '../types/Util';
import { trigger } from '../shims/events';
import { DockType } from '../state/ducks/dock';
import { AddFriendModal } from './AddFriendModal';

type StateType = {
  addContactModalVisible: boolean;
};

type PropsType = {
  i18n: LocalizerType;
  contacts: Array<ConversationType>;
  contactSearchChanged: (query: string) => ContactSearchChangedActionType;
  openConversationInternal: (id: string, messageId?: string) => void;
  dock: DockType;
};

export class ContactNewPane extends React.Component<PropsType, StateType> {
  constructor(props: any) {
    super(props);
    this.state = {
      addContactModalVisible: false,
    };
  }

  public render() {
    const { dock, i18n, contacts } = this.props;

    const childProps = {
      i18n,
      contacts,
      setSearchText: this.setSearchText,
      clickItem: this.clickItem,
      isContactNewPane: true,
      isShown: dock.current === 'contact',
    };

    return (
      <>
        <ContactCollect {...childProps} />
        <AddFriendModal
          i18n={i18n}
          open={this.state.addContactModalVisible}
          onCancel={() => this.setState({ addContactModalVisible: false })}
          onComplete={() => this.setState({ addContactModalVisible: false })}
        />
      </>
    );
  }

  private setSearchText = (query: string) => {
    this.props.contactSearchChanged(query);
  };

  private clickItem = (id: string) => {
    if (id === 'group_chats') {
      trigger('showGroupChats');
    } else if (id === 'all_bots') {
      trigger('showAllBots');
    } else if (id === 'add_contact') {
      this.setState({
        addContactModalVisible: true,
      });
    } else {
      this.props.openConversationInternal(id);
      const myEvent = new Event('event-toggle-switch-chat');
      window.dispatchEvent(myEvent);
    }
  };
}
