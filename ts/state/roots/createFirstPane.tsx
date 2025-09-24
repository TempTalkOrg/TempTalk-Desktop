import React from 'react';
import { Provider } from 'react-redux';
import { Store } from 'redux';
import { SmartMainMenu } from '../smart/MainMenu';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const FilteredFirstPane = SmartMainMenu as any;

export const createFirstPane = (store: Store) => (
  <Provider store={store}>
    <FilteredFirstPane />
  </Provider>
);
