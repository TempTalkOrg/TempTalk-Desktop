import React from 'react';
import { LocalizerType } from '../../../types/Util';
import { QRLogin } from './QRCodeLogin';

interface IProps {
  i18n: LocalizerType;
}

export const Login = (props: IProps) => {
  return (
    <div className="login-page-root">
      <QRLogin {...props} />
    </div>
  );
};
