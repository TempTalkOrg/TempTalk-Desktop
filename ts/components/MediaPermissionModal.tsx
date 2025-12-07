import { Modal } from 'antd';
import React from 'react';
import { LocalizerType } from '../types/Util';
import { Track } from '@cc-livekit/livekit-client';

type Props = {
  mediaType: Track.Source;
  dismiss: () => void;
  i18n: LocalizerType;
  open: boolean;
};

const mainWindow: any = window;

export const MediaPermissionModal = (props: Props) => {
  const { mediaType, dismiss, i18n, open } = props;

  if (mediaType === Track.Source.Microphone) {
    return (
      <Modal
        className={'permission-check-dialog-container'}
        maskClosable={false}
        destroyOnClose={true}
        title={i18n('microphone_permission_check_title')}
        open={open}
        cancelText={i18n('cancel')}
        okText={i18n('go_microphone_settings')}
        onOk={() => {
          mainWindow.sendBrowserOpenUrl(
            'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
          );
          dismiss();
        }}
        onCancel={dismiss}
      >
        <p>{i18n('microphone_permission_check_content')}</p>
      </Modal>
    );
  } else if (mediaType === Track.Source.Camera) {
    return (
      <Modal
        className={'permission-check-dialog-container'}
        maskClosable={false}
        destroyOnClose={true}
        title={i18n('camera_permission_check_title')}
        open={open}
        cancelText={i18n('cancel')}
        okText={i18n('go_microphone_settings')}
        onOk={() => {
          mainWindow.sendBrowserOpenUrl(
            'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera'
          );
          dismiss();
        }}
        onCancel={dismiss}
      >
        <p>{i18n('camera_permission_check_content')}</p>
      </Modal>
    );
  } else if (mediaType === Track.Source.ScreenShare) {
    return (
      <Modal
        className={'permission-check-dialog-container'}
        maskClosable={false}
        destroyOnClose={true}
        title={i18n('screen_permission_check_title')}
        open={open}
        cancelText={i18n('cancel')}
        okText={i18n('go_screen_settings')}
        onOk={() => {
          mainWindow.sendBrowserOpenUrl(
            'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
          );
          dismiss();
        }}
        onCancel={dismiss}
      >
        <p>{i18n('screen_permission_check_content')}</p>
      </Modal>
    );
  } else {
    return null;
  }
};
