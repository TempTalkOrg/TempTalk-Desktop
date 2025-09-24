import React from 'react';
import { LocalizerType } from '../../types/Util';
import { ConversationType } from '../../state/ducks/conversations';
import { AutoSizer, List } from 'react-virtualized';
import { ContactListItem } from '../ContactListItem';

type PropsType = {
  i18n: LocalizerType;
  contacts: Array<ConversationType>;
  allContacts: Array<ConversationType>;
  privateUsers?: Array<string>;
  onClose: (esc?: boolean) => void;
  onCloseAndEnter: () => void;
  doSelect: (id: string) => void;
};

type StateType = {
  selectedIndex: number;
};

export class AtPersonSelect extends React.Component<PropsType, StateType> {
  public wrapperRef: React.RefObject<HTMLDivElement>;

  constructor(props: PropsType) {
    super(props);

    this.wrapperRef = React.createRef();
    this.handleClickOutside = this.handleClickOutside.bind(this);

    this.state = { selectedIndex: 1 };
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside);
    document.addEventListener('keydown', this.handleKeyBoardEvent);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside);
    document.removeEventListener('keydown', this.handleKeyBoardEvent);
  }

  componentDidUpdate(prevProps: Readonly<PropsType>) {
    const { contacts } = this.props;
    const prevContacts = prevProps.contacts;
    if (contacts.length !== prevContacts.length) {
      this.setState({ selectedIndex: contacts.length > 1 ? 1 : 0 });
    }
  }

  handleClickOutside(event: MouseEvent) {
    if (
      event &&
      this.wrapperRef?.current &&
      !this.wrapperRef.current.contains(event.target as Node)
    ) {
      this.props?.onClose();
    }
  }

  public handleKeyBoardEvent = (event: KeyboardEvent) => {
    const { contacts, allContacts, onClose, onCloseAndEnter } = this.props;
    if (event.key === 'Escape') {
      this.props?.onClose(true);
      return;
    }

    let rowCount = 0;
    if (contacts.length) {
      rowCount += contacts.length + 1;
    }
    if (allContacts.length) {
      rowCount += allContacts.length + 1;
    }

    let secondTitleIndex;
    if (contacts.length && allContacts.length) {
      secondTitleIndex = contacts.length + 1;
    }

    if (event.key === 'ArrowUp') {
      const currentIsSecondTitle =
        this.state.selectedIndex - 1 === secondTitleIndex;
      const x = this.state.selectedIndex - (currentIsSecondTitle ? 2 : 1);
      if (x <= 0) {
        this.setState({ selectedIndex: rowCount - 1 });
      } else {
        this.setState({ selectedIndex: x });
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      const currentIsSecondTitle =
        this.state.selectedIndex + 1 === secondTitleIndex;
      const x = this.state.selectedIndex + (currentIsSecondTitle ? 2 : 1);
      if (x >= rowCount) {
        this.setState({ selectedIndex: 1 });
      } else {
        this.setState({ selectedIndex: x });
      }
      return;
    }

    const x = this.state.selectedIndex;
    if (event.key === 'Enter') {
      // shift + enter 关闭弹出框即可
      if (event.shiftKey) {
        onCloseAndEnter();
        return;
      }
      if (x !== 0 && x !== secondTitleIndex) {
        let userId;
        if (contacts.length) {
          if (x <= contacts.length) {
            userId = contacts[x - 1].id;
          } else {
            userId = allContacts[x - contacts.length - 2].id;
          }
        } else {
          userId = allContacts[x - 1].id;
        }

        if (!userId) {
          throw new Error(
            'AtPersonSelect.tsx bad id, handleKeyBoardEvent Enter!'
          );
        }
        this.props.doSelect(userId);
        return;
      }
      onClose();
    }
  };

  public renderRowTitle = (
    isGroupMembers: boolean,
    key: number,
    style: any
  ) => {
    const { i18n } = this.props;
    if (isGroupMembers) {
      return (
        <div style={style} key={key}>
          <div style={{ fontSize: 12, padding: '15px 15px 12px 15px' }}>
            <span>{i18n('atGroupMembers')}</span>
            <span style={{ color: '#848e9c' }}>
              {i18n('atGroupMembersBeNotified')}
            </span>
          </div>
        </div>
      );
    }
    return (
      <div style={style} key={key}>
        <div style={{ fontSize: 12, padding: '15px 15px 12px 15px' }}>
          <span>{i18n('atOtherContacts')}</span>
          <span style={{ color: '#848e9c' }}>
            {i18n('atOtherContactsNotBeNotified')}
          </span>
        </div>
      </div>
    );
  };

  public renderRow = ({ index, style }: any): JSX.Element => {
    const { i18n, doSelect, contacts, allContacts, privateUsers } = this.props;
    const { selectedIndex } = this.state;

    let willTakeStar = false;
    let isShowTopicFlag = false;
    let c: any;
    if (contacts.length) {
      if (index === 0) {
        return this.renderRowTitle(true, index, style);
      }
      if (index <= contacts.length) {
        c = contacts[index - 1];
        isShowTopicFlag = true;
      }
    }

    if (!c && allContacts.length) {
      if (contacts.length === 0) {
        if (index === 0) {
          return this.renderRowTitle(false, index, style);
        }
        if (index <= allContacts.length) {
          c = allContacts[index - 1];
          willTakeStar = true;
        }
      } else {
        if (index === contacts.length + 1) {
          return this.renderRowTitle(false, index, style);
        }
        c = allContacts[index - contacts.length - 2];
        willTakeStar = true;
      }
    }

    if (privateUsers?.includes(c.id)) {
      willTakeStar = false;
    }

    if (!c) {
      throw new Error('AtPersonSelect.tsx renderRow bad param.');
    }

    return (
      <ContactListItem
        key={index}
        id={c.id}
        style={style}
        phoneNumber={c.id === 'MENTIONS_ALL' ? '' : c.id}
        isMe={false}
        name={
          (c.id === 'MENTIONS_ALL'
            ? i18n('mentionsAllTitle')
            : c.name || c.id) + (willTakeStar ? '*' : '')
        }
        color={(c as any).color}
        profileName={(c as any).profileName}
        avatarPath={(c as any).avatarPath}
        email={' '}
        i18n={i18n}
        notShowStatus={true}
        onClick={() => {
          // 黑魔法临时解决问题（问题：点击item框消失的BUG）
          setTimeout(() => {
            doSelect(c.id);
          }, 0);
        }}
        isSelected={index === selectedIndex}
        isShowTopicFlag={isShowTopicFlag}
        smallAvatar={true}
      />
    );
  };

  public render() {
    const { contacts, allContacts } = this.props;
    // https://stackoverflow.com/questions/41122140/how-to-scroll-to-index-in-infinite-list-with-react-virtualized

    if (contacts.length === 0 && allContacts.length === 0) {
      throw new Error(
        'AtPersonSelect.tsx bad props both contacts and allContacts EMPTY!'
      );
    }

    let rowCount = 0;
    if (contacts.length) {
      rowCount += contacts.length + 1;
    }
    if (allContacts.length) {
      rowCount += allContacts.length + 1;
    }
    return (
      <div
        ref={this.wrapperRef}
        className={'at-person-choose'}
        style={{
          position: 'absolute',
          width: 384,
          maxHeight: 400,
          height: 40 * rowCount + 12,
          bottom: -4,
          left: 4,
          borderRadius: 8,
          padding: 5,
        }}
      >
        <AutoSizer>
          {({ height, width }) => (
            <List
              className="module-left-pane__virtual-list"
              height={height}
              rowCount={rowCount}
              rowRenderer={this.renderRow}
              rowHeight={40}
              width={width}
              rerenderWhenChanged={contacts.concat(allContacts)}
              scrollToIndex={this.state.selectedIndex}
            />
          )}
        </AutoSizer>
      </div>
    );
  }
}
