import { bindActionCreators, Dispatch } from 'redux';

import { actions as search } from './ducks/search';
import { actions as conversations } from './ducks/conversations';
import { actions as user } from './ducks/user';
import { actions as contactSearch } from './ducks/contactSearch';
import { actions as dock } from './ducks/dock';
import { actions as preferences } from './ducks/preferences';

const actions = {
  ...search,
  ...conversations,
  ...user,
  ...contactSearch,
  ...dock,
  ...preferences,
};

export function mapDispatchToProps(dispatch: Dispatch): Object {
  return bindActionCreators(actions, dispatch);
}
