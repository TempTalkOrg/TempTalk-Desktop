import React from 'react';
import { debounce } from 'lodash';

import { LocalizerType } from '../types/Util';

export interface Props {
  i18n: LocalizerType;
  search: (searchTerm: string) => void;
  clearSearch: () => void;
}

type StateType = {
  searchTerm: string;
};

export class SearchInput extends React.Component<Props, StateType> {
  private readonly updateSearchBound: (
    event: React.FormEvent<HTMLInputElement>
  ) => void;
  private readonly clearSearchBound: () => void;
  private readonly setFocusBound: () => void;
  private readonly inputRef: React.RefObject<HTMLInputElement>;
  private readonly debouncedSearch: (searchTerm: string) => void;

  constructor(props: Props) {
    super(props);

    this.updateSearchBound = this.updateSearch.bind(this);
    this.clearSearchBound = this.clearSearch.bind(this);
    this.setFocusBound = this.setFocus.bind(this);
    this.inputRef = React.createRef();

    this.state = { searchTerm: '' };

    this.debouncedSearch = debounce(this.search.bind(this), 20);
  }

  public search(searchTerm: string) {
    const { search } = this.props;
    if (search) {
      search(searchTerm);
    }
  }

  public updateSearch(event: React.FormEvent<HTMLInputElement>) {
    const { clearSearch } = this.props;
    const searchTerm = event.currentTarget.value;

    this.setState({ searchTerm });

    if (!searchTerm) {
      clearSearch();
      return;
    }

    if (searchTerm.length < 1) {
      return;
    }

    this.debouncedSearch(searchTerm);
  }

  public clearSearch() {
    const { clearSearch } = this.props;

    clearSearch();
    if (this.inputRef.current) {
      // @ts-ignore
      this.inputRef.current.value = '';
    }

    this.setState({ searchTerm: '' });
    this.setFocus();
  }

  public setFocus() {
    if (this.inputRef.current) {
      // @ts-ignore
      this.inputRef.current.focus();
    }
  }

  public render() {
    const { i18n } = this.props;
    const searchTerm = this.state.searchTerm;

    return (
      <div className="search-input-header">
        <div className="search-input-header__search">
          <div
            role="button"
            className="search-input-header__search__icon"
            onClick={this.setFocusBound}
          />
          <input
            type="text"
            ref={this.inputRef}
            className="search-input-header__search__input"
            placeholder={i18n('search')}
            dir="auto"
            value={searchTerm}
            onChange={this.updateSearchBound}
            spellCheck={false}
          />
          {searchTerm.length > 0 ? (
            <div
              role="button"
              className="search-input-header__search__cancel-icon"
              onClick={this.clearSearchBound}
            />
          ) : null}
        </div>
      </div>
    );
  }
}
