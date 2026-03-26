import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';

import { MainHeader } from '../../components/MainHeader';
import { StateType } from '../reducer';

import { getQuery } from '../selectors/search';
import { getIntl, getRegionCode, getUserNumber } from '../selectors/user';
import { getMe } from '../selectors/conversations';
import { getSidebarStatus } from '../selectors/sidebar';
import { getCurrentDockItem } from '../selectors/dock';

const mapStateToProps = (state: StateType) => {
  return {
    searchTerm: getQuery(state),
    regionCode: getRegionCode(state),
    ourNumber: getUserNumber(state),
    sidebarStatus: getSidebarStatus(state),
    ...getMe(state),
    i18n: getIntl(state),
    currentDockItem: getCurrentDockItem(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartMainHeader = smart(MainHeader);
