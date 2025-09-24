import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { ContactNewPane } from '../../components/ContactNewPane';
import { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { getSortedContacts } from '../selectors/conversations';

const mapStateToProps = (state: StateType) => {
  return {
    i18n: getIntl(state),
    contacts: getSortedContacts(state),
    dock: state.dock,
  };
};

export const SmartContactNewPane = connect(
  mapStateToProps,
  mapDispatchToProps
)(ContactNewPane);
