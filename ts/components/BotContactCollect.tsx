import React from 'react';
import { BotListItem } from './BotListItem';
import { AutoSizer, List } from 'react-virtualized';
import { LocalizerType } from '../types/Util';
import { ConversationType } from '../state/ducks/conversations';
import { trigger } from '../shims/events';

interface Props {
  i18n: LocalizerType;
  contacts: Array<ConversationType>;
  clickItem?: (id: string) => void;
}

interface State {
  searchText: string;
  filterBotContacts: Array<any>;
}

export class BotContactCollect extends React.Component<Props, State> {
  private readonly inputRef: React.RefObject<HTMLInputElement>;

  constructor(props: Readonly<Props>) {
    super(props);
    this.inputRef = React.createRef();
    this.state = {
      searchText: '',
      filterBotContacts: this.props.contacts,
    };
  }

  public componentDidMount() {
    const { contacts } = this.props;
    const { searchText } = this.state;
    if (!searchText) {
      this.setState({
        filterBotContacts: contacts,
      });
    }
  }
  public componentWillUnmount() {
    //
  }

  public isSearchMatch = (
    c: any,
    searchTerm: string,
    isName: boolean,
    isSignature: boolean,
    isId: boolean
  ) => {
    const search = searchTerm.toLowerCase();
    let name = c.name;
    if (name && name.toLowerCase().includes(search) && isName) {
      return true;
    }

    name = c.signature;
    if (name && name.toLowerCase().includes(search) && isSignature) {
      return true;
    }

    //有可能存在不同组的情况，这里要处理一下
    name = c.id;
    if (name && name.toLowerCase().includes(search) && isId && c.name) {
      return true;
    }

    return false;
  };

  public renderRow = ({ index, style }: any): JSX.Element => {
    const { i18n } = this.props;
    const { filterBotContacts, searchText } = this.state;
    const c = filterBotContacts[index];

    return (
      <BotListItem
        key={c.id}
        {...c}
        isStick={undefined}
        onClick={() => {
          trigger('showConversation', c.id);
          const myEvent = new Event('event-toggle-switch-chat');
          window.dispatchEvent(myEvent);
        }}
        style={style}
        i18n={i18n}
        searchValue={searchText}
      />
    );
  };

  public getFilterBotContacts = (contacts: any) => {
    let result = [];
    for (let i = 0; i < contacts.length; i++) {
      result.push(contacts[i]);
    }

    this.setState({
      filterBotContacts: result,
    });
  };

  public renderSearchBlankPage() {
    return (
      <div className={'search-blank'}>
        <img
          style={{ width: '110px', height: '110px' }}
          src="images/search-blank.svg"
        />
        <h3>No results</h3>
      </div>
    );
  }

  public render() {
    const { searchText, filterBotContacts } = this.state;
    // @ts-ignore
    const { i18n } = this.props;

    const topStyle = { height: '100%' };
    const bodyStyle = { height: 'calc(100% - 116px)', overflow: 'auto' };

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
        {filterBotContacts && filterBotContacts.length ? (
          <div style={bodyStyle}>
            <AutoSizer>
              {({ height, width }) => (
                <List
                  className="module-left-pane__virtual-list"
                  height={height}
                  rowCount={filterBotContacts.length}
                  rowHeight={56}
                  rowRenderer={this.renderRow}
                  width={width}
                  rerenderWhenChanged={filterBotContacts}
                />
              )}
            </AutoSizer>
          </div>
        ) : (
          this.renderSearchBlankPage()
        )}
      </div>
    );
  }

  private handleChange = (event: any) => {
    const { contacts } = this.props;
    const { value: search } = event.target;

    if (search === '') {
      this.getFilterBotContacts(contacts);
    } else {
      let f = [];
      let filteredNameArr = [];
      let filteredSignatureArr = [];
      let keyPosition;
      let sortNameArr = [];
      let sortSignatureArr = [];
      let sortIdArr = [];
      //优先匹配名字
      for (let i = 0; i < contacts.length; i++) {
        if (this.isSearchMatch(contacts[i], search, true, false, false)) {
          keyPosition = contacts[i].name
            ?.toLowerCase()
            .indexOf(search.toLowerCase());
          contacts[i].keyPosition = keyPosition;
          sortNameArr.push(contacts[i]);
        } else {
          filteredNameArr.push(contacts[i]);
        }
      }
      // 先对匹配到名字的进行一次排序
      sortNameArr = sortNameArr.sort((a, b) => {
        // @ts-ignore
        return a.keyPosition - b.keyPosition;
      });

      //匹配签名
      for (let i = 0; i < filteredNameArr.length; i++) {
        if (
          this.isSearchMatch(filteredNameArr[i], search, false, true, false)
        ) {
          keyPosition = filteredNameArr[i].signature
            ?.toLowerCase()
            .indexOf(search.toLowerCase());
          filteredNameArr[i].keyPosition = keyPosition;
          sortSignatureArr.push(filteredNameArr[i]);
        } else {
          filteredSignatureArr.push(filteredNameArr[i]);
        }
      }
      //对匹配签名的进行排序
      sortSignatureArr = sortSignatureArr.sort((a, b) => {
        // @ts-ignore
        return a.keyPosition - b.keyPosition;
      });

      //匹配id
      for (let i = 0; i < filteredSignatureArr.length; i++) {
        if (
          this.isSearchMatch(
            filteredSignatureArr[i],
            search,
            false,
            false,
            true
          )
        ) {
          keyPosition = filteredSignatureArr[i].id
            ?.toLowerCase()
            .indexOf(search.toLowerCase());
          filteredSignatureArr[i].keyPosition = keyPosition;
          sortIdArr.push(filteredSignatureArr[i]);
        }
      }
      //对匹配id的进行排序
      sortIdArr = sortIdArr.sort((a, b) => {
        // @ts-ignore
        return a.keyPosition - b.keyPosition;
      });

      f = sortNameArr.concat(sortSignatureArr, sortIdArr);
      this.getFilterBotContacts(f);
    }

    this.setState({ searchText: search });
  };

  private clearSearch = () => {
    const { contacts } = this.props;
    this.getFilterBotContacts(contacts);
    this.setState({ searchText: '' });
    if (this.inputRef.current) {
      // @ts-ignore
      this.inputRef.current.focus();
    }
  };
}
