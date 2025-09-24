import React from 'react';
import { ContactListItem } from './ContactListItem';
import { AutoSizer, List } from 'react-virtualized';
import { LocalizerType } from '../types/Util';
import { ConversationType } from '../state/ducks/conversations';

type PropsType = {
  i18n: LocalizerType;
  contacts: Array<ConversationType>;
  setSearchText: (query: string) => void;
  clickItem: (id: string) => void;
  forSelect?: boolean;
};

type StateType = {
  searchText: string;
};

export class SelectContactUser extends React.Component<PropsType, StateType> {
  private readonly inputRef: React.RefObject<HTMLInputElement>;

  constructor(props: any) {
    super(props);
    this.inputRef = React.createRef();

    this.state = { searchText: '' };
  }

  public renderRow = ({ index, style }: any): JSX.Element => {
    const { contacts, clickItem } = this.props;
    const c = contacts[index];

    return (
      <ContactListItem
        key={c.id}
        id={c.id}
        style={style}
        phoneNumber={c.id}
        isMe={c.isMe}
        name={c.name}
        color={(c as any).color}
        profileName={(c as any).profileName}
        avatarPath={(c as any).avatarPath}
        email={(c as any).email}
        i18n={this.props.i18n}
        onClick={() => clickItem(c.id)}
      />
    );
  };

  public render() {
    const { searchText } = this.state;
    const { contacts, i18n, forSelect } = this.props;

    const topStyle = { height: '100%' };
    const bodyStyle = { height: 'calc(100% - 58px)', overflow: 'auto' };
    if (forSelect) {
      // @ts-ignore
      delete topStyle.height;
      bodyStyle.height = '442px';
    }

    return (
      <div style={topStyle}>
        <div className="module-main-header">
          <div className="module-main-header__search">
            <div role="button" className="module-main-header__search__icon" />
            <input
              style={{ width: '270px' }}
              type="text"
              ref={this.inputRef}
              className="module-main-header__search__input"
              placeholder={this.props.i18n('search')}
              dir="auto"
              value={searchText}
              onChange={this.handleChange}
              // onBlur={this.blurSearchInput}
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

  // private blurSearchInput = () => {
  //   const {setSearchText} = this.props;
  //
  //   // 不好看，但好用，后期优化
  //   setTimeout(() => {
  //     setSearchText('');
  //     this.setState({searchText: ''});
  //   }, 10);
  // };
}
