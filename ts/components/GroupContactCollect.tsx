import React, { CSSProperties } from 'react';
import { ConversationListItem } from './ConversationListItem';
import { AutoSizer, List } from 'react-virtualized';
import { LocalizerType } from '../types/Util';
import { ConversationType } from '../state/ducks/conversations';
import { trigger } from '../shims/events';

type PropsType = {
  i18n: LocalizerType;
  contacts: Array<ConversationType>;
  setSearchText: (query: string) => void;
  clickItem?: (id: string) => void;
};

type StateType = {
  searchText: string;
};

export class GroupContactCollect extends React.Component<PropsType, StateType> {
  private readonly inputRef: React.RefObject<HTMLInputElement>;

  constructor(props: any) {
    super(props);
    this.inputRef = React.createRef();

    this.state = { searchText: '' };
  }

  public renderRow = ({ index, style }: any): JSX.Element => {
    const {
      contacts,
      // clickItem,
      i18n,
    } = this.props;

    const c = contacts[index];

    return (
      <ConversationListItem
        key={c.id}
        {...c}
        isStick={undefined}
        // lastUpdated={0}
        // unreadCount={0}
        // lastMessage={undefined}
        // atPersons={undefined}
        onClick={() => {
          trigger('showConversation', c.id);
          const myEvent = new Event('event-toggle-switch-chat');
          window.dispatchEvent(myEvent);
        }}
        style={{ ...style, maxWidth: '100%' }}
        i18n={i18n}
        isMyGroup={true}
      />
    );
  };

  public render() {
    const { searchText } = this.state;
    // @ts-ignore
    const { contacts, i18n } = this.props;

    const topStyle = { height: '100%' };
    const bodyStyle: CSSProperties = {
      height: 'calc(100% - 116px)',
      overflow: 'auto',
      overflowX: 'hidden',
    };

    return (
      <div style={topStyle}>
        <div className="module-common-header">
          <div className="module-common-header__search">
            <div role="button" className="module-common-header__search__icon" />
            <input
              style={{ width: '100%' }}
              type="text"
              ref={this.inputRef}
              className="module-common-header__search__input"
              placeholder={this.props.i18n('search')}
              dir="auto"
              value={searchText}
              onChange={this.handleChange}
              spellCheck={false}
            />
            {searchText ? (
              <div
                role="button"
                className="module-common-header__search__cancel-icon"
                onClick={this.clearSearch}
              />
            ) : null}
          </div>
        </div>
        {contacts && contacts.length ? (
          <div style={bodyStyle}>
            <AutoSizer>
              {({ height, width }) => (
                <List
                  className="module-left-pane__virtual-list"
                  height={height}
                  rowCount={contacts.length}
                  rowHeight={56}
                  rowRenderer={this.renderRow}
                  width={width}
                  rerenderWhenChanged={contacts}
                />
              )}
            </AutoSizer>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '5px' }}>
            {i18n('noSearchResults', [searchText])}
          </div>
        )}
      </div>
    );
  }

  private handleChange = (event: any) => {
    const { setSearchText } = this.props;
    const { value: search } = event.target;

    setSearchText(search);
    this.setState({ searchText: search });
  };

  private clearSearch = () => {
    const { setSearchText } = this.props;
    setSearchText('');
    this.setState({ searchText: '' });
    if (this.inputRef.current) {
      // @ts-ignore
      this.inputRef.current.focus();
    }
  };
}
