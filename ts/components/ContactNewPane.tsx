import React from 'react';
import { ContactCollect } from './ContactCollect';
import { ContactSearchChangedActionType } from '../state/ducks/contactSearch';
import { ConversationType } from '../state/ducks/conversations';
import { LocalizerType } from '../types/Util';
import { trigger } from '../shims/events';
import { DockType } from '../state/ducks/dock';

type PropsType = {
  i18n: LocalizerType;
  contacts: Array<ConversationType>;
  contactSearchChanged: (query: string) => ContactSearchChangedActionType;
  openConversationInternal: (id: string, messageId?: string) => void;
  dock: DockType;
};

export class ContactNewPane extends React.Component<PropsType> {
  constructor(props: any) {
    super(props);
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

    return <ContactCollect {...childProps} />;
  }

  private setSearchText = (query: string) => {
    this.props.contactSearchChanged(query);
  };

  private clickItem = (id: string) => {
    if (id === 'group_chats') {
      trigger('showGroupChats');
    } else if (id === 'all_bots') {
      trigger('showAllBots');
    } else {
      this.props.openConversationInternal(id);
      const myEvent = new Event('event-toggle-switch-chat');
      window.dispatchEvent(myEvent);
    }
  };
}
