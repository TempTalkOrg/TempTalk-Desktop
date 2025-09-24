import React from 'react';
import { Provider } from 'react-redux';
import { Store } from 'redux';
import { SmartContactNewPane } from '../smart/ContactPane';
import { SmartNavSidebar } from '../smart/SmartNavSidebar';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const AnyContactNewPane = SmartContactNewPane as any;
const FilteredNavSidebar = SmartNavSidebar as any;

export const createContactPane = (store: Store) => (
  <Provider store={store}>
    <FilteredNavSidebar>
      <AnyContactNewPane />
    </FilteredNavSidebar>
  </Provider>
);
