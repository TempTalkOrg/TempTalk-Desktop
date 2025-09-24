import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';

import { MainMenu } from '../../components/MainMenu';
import { StateType } from '../reducer';

import { getIntl, getUserNumber } from '../selectors/user';
import { getMe } from '../selectors/conversations';
import { getLeftPaneWidth } from '../selectors/preferences';

const mapStateToProps = (state: StateType) => {
  return {
    ...getMe(state),
    ourNumber: getUserNumber(state),
    i18n: getIntl(state),
    leftPaneWidth: getLeftPaneWidth(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartMainMenu = smart(MainMenu);
