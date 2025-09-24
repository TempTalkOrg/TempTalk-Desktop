import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { NavSidebar } from '../../components/NavSidebar';
import { StateType } from '../reducer';

import { getIntl } from '../selectors/user';
import { getLeftPaneWidth } from '../selectors/preferences';

const mapStateToProps = (state: StateType) => {
  return {
    i18n: getIntl(state),
    leftPaneWidth: getLeftPaneWidth(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartNavSidebar = smart(NavSidebar);
