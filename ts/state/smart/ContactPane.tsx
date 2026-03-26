import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { ContactNewPane } from '../../components/ContactNewPane';
import { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { getMe, getSortedContacts } from '../selectors/conversations';
import { getSidebarStatus } from '../selectors/sidebar';
import { getCurrentDockItem } from '../selectors/dock';

const mapStateToProps = (state: StateType) => {
  return {
    i18n: getIntl(state),
    contacts: getSortedContacts(state),
    sidebarStatus: getSidebarStatus(state),
    currentDockItem: getCurrentDockItem(state),
    ...getMe(state),
  };
};

export const SmartContactNewPane = connect(
  mapStateToProps,
  mapDispatchToProps
)(ContactNewPane);
