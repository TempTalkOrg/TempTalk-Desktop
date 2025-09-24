import React, { CSSProperties } from 'react';
import { ContactListItem } from './ContactListItem';
import { AutoSizer, List, ScrollParams } from 'react-virtualized';
import { LocalizerType } from '../types/Util';
import { ConversationType } from '../state/ducks/conversations';

type PropsType = {
  i18n: LocalizerType;
  contacts: Array<ConversationType>;
  setSearchText: (query: string) => void;
  clickItem: (id: string) => void;
  isContactNewPane?: any;
  isShown: boolean;
};

type StateType = {
  searchText: string;
  selectedId: number;
  scrollTop: number;
};

export class ContactCollect extends React.Component<PropsType, StateType> {
  private readonly inputRef: React.RefObject<HTMLInputElement>;
  // private readonly showMenuBound: (
  //   event: React.MouseEvent<HTMLDivElement>
  // ) => void;
  // private readonly menuTriggerRef: React.RefObject<any>;
  private searching: boolean = false;
  private readonly externItems: number;
  private list: any;

  constructor(props: any) {
    super(props);
    this.inputRef = React.createRef();

    this.state = { searchText: '', selectedId: -1, scrollTop: 0 };

    this.externItems = 2;

    // this.menuTriggerRef = React.createRef();
    // this.showMenuBound = this.showMenu.bind(this);

    this.rowHeight = this.rowHeight.bind(this);
    this.renderRow = this.renderRow.bind(this);
    this.noRowsRender = this.noRowsRender.bind(this);
  }

  public componentDidUpdate() {
    if (this.list) {
      this.list.recomputeRowHeights(1);
    }
  }

  // public newGroup() {
  //   (window as any).showNewGroupWindow();
  // }

  // public showMenu(event: React.MouseEvent<HTMLDivElement>) {
  //   if (this.menuTriggerRef.current) {
  //     this.menuTriggerRef.current.handleContextClick(event);
  //   }
  // }

  public renderRow = ({ index, style }: any): JSX.Element => {
    const { contacts, clickItem, i18n, isContactNewPane } = this.props;
    const { selectedId } = this.state;
    if (!this.searching) {
      if (index === 0) {
        return (
          <ContactListItem
            key={'group_chats'}
            style={style}
            phoneNumber={''}
            name={i18n('groupChatsTitle')}
            color={'group-white'}
            avatarPath={''}
            i18n={i18n}
            onClick={() => {
              clickItem('group_chats');
              this.setState({
                selectedId: 0,
              });
            }}
            groupChats={true}
            isContactNewPane={isContactNewPane}
            isSelected={selectedId === 0}
          />
        );
      } else if (index === 1) {
        //   return (
        //     <ContactListItem
        //       key={'all_bots'}
        //       style={style}
        //       phoneNumber={''}
        //       name={i18n('allBotsTitle')}
        //       color={'group-white'}
        //
        //       avatarPath={''}
        //       i18n={i18n}
        //       onClick={() => {
        //         clickItem('all_bots');
        //         this.setState({ selectedId: 1 });
        //       }}
        //       groupChats={false}
        //       allBots={true}
        //       isContactNewPane={isContactNewPane}
        //       isSelected={selectedId === 1 ? true : false}
        //     />
        //   );
        // } else if (index === 2) {
        return (
          <div
            key={'contacts-title'}
            className="module-left-pane__contact-list-title"
            style={style}
          ></div>
        );
      } else {
        index = index - this.externItems;
      }
    }
    const c = contacts[index];

    return (
      <ContactListItem
        key={c.id}
        id={c.id}
        style={style}
        phoneNumber={c.id}
        isMe={false}
        name={c.name}
        color={(c as any).color}
        profileName={(c as any).profileName}
        avatarPath={(c as any).avatarPath}
        i18n={i18n}
        onClick={() => {
          clickItem(c.id);
          this.setState({
            selectedId: -1,
          });
        }}
        useDefaultAvatarClick={true}
        email={(c as any).email}
        signature={c.signature}
        protectedConfigs={c.protectedConfigs}
        firstMatch={c.firstMatch}
        showExtraInfo={this.searching}
        timeZone={c.timeZone}
        isContactNewPane={isContactNewPane}
        isSelected={false}
      />
    );
  };

  /**
   * https://github.com/bvaughn/react-virtualized/issues/1262
   * change list key to force rerender, fix dynamic height error
   */
  public rowHeight = ({ index }: any) => {
    if (!this.searching && index === 1) {
      return 2;
    } else {
      return this.searching ? 76 : 56;
    }
  };

  public bindListRef = (ref: any) => {
    this.list = ref;
  };

  public render() {
    if (!this.props.isShown) {
      return null;
    }

    const { searchText, scrollTop } = this.state;
    // @ts-ignore
    const { contacts, i18n } = this.props;

    const topStyle = { height: '100%' };
    const bodyStyle: CSSProperties = {
      height: 'calc(100% - 58px)',
      overflow: 'auto',
      overflowX: 'hidden',
    };

    this.searching = Boolean(searchText && searchText.length > 0);

    const externItems = 2;
    let contactLen = contacts ? contacts.length + externItems : externItems;
    if (this.searching) {
      contactLen = contactLen - externItems;
    }

    return (
      <div style={topStyle}>
        <div className="module-main-header">
          <div className="module-main-header__search">
            <div role="button" className="module-main-header__search__icon" />
            <input
              // style={ }
              type="text"
              ref={this.inputRef}
              className="module-main-header__search__input_contact"
              placeholder={this.props.i18n('search')}
              dir="auto"
              value={searchText}
              onChange={this.handleChange}
              onBlur={this.blurSearchInput}
              spellCheck={false}
            />
            {searchText ? (
              <div
                role="button"
                className="module-main-header__search__cancel-icon"
                onClick={this.clearSearch}
              />
            ) : null}
          </div>
          {/*
          <ContextMenuTrigger
            id={'contact-header-mutex-trigger-id'}
            ref={this.menuTriggerRef}
          >
            <div
              style={{ position: 'absolute', left: '340px', marginTop: '-9px' }}
            >
              <div
                role="button"
                onClick={this.showMenuBound}
                className="module-main-header__entry__plus-icon"
              />
            </div>
          </ContextMenuTrigger>
          {this.renderMenu('contact-header-mutex-trigger-id')} */}
        </div>
        <div style={bodyStyle}>
          <AutoSizer>
            {({ height, width }) => (
              <List
                ref={this.bindListRef}
                className="module-left-pane__virtual-list"
                height={height}
                rowCount={contactLen}
                rowHeight={this.rowHeight}
                rowRenderer={this.renderRow}
                width={width}
                noRowsRenderer={this.noRowsRender}
                rerenderWhenChanged={contacts}
                onScroll={({ scrollTop }: ScrollParams) =>
                  this.setState({ scrollTop })
                }
                scrollTop={scrollTop}
              />
            )}
          </AutoSizer>
        </div>
      </div>
    );
  }

  private noRowsRender() {
    const { searchText } = this.state;
    const { i18n } = this.props;
    return (
      <div style={{ textAlign: 'center', marginTop: '5px' }}>
        {i18n('noSearchResults', [searchText])}
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

  private blurSearchInput = () => {
    return;
    const { setSearchText } = this.props;
    // 不好看，但好用，后期优化
    setTimeout(() => {
      setSearchText('');
      this.setState({ searchText: '' });
    }, 10);
  };
}
