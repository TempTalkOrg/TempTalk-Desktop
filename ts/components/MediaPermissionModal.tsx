import { Modal } from 'antd';
import React, { useMemo } from 'react';
import { LocalizerType } from '../types/Util';

type Props = {
  mediaType: 'microphone' | 'camera' | 'screen';
  dismiss: () => void;
  i18n: LocalizerType;
  open: boolean;
};

const mainWindow: any = window;

export const MediaPermissionModal = (props: Props) => {
  const { mediaType, dismiss, i18n, open } = props;

  const { showMicrophone, showCamera, showScreen } = useMemo(() => {
    const showMicrophone = mediaType === 'microphone';
    const showCamera = mediaType === 'camera';
    const showScreen = mediaType === 'screen';
    return { showMicrophone, showCamera, showScreen };
  }, [mediaType]);

  if (showMicrophone) {
    return (
      <Modal
        className={'permission-check-dialog-container'}
        maskClosable={false}
        destroyOnClose={true}
        title={i18n('microphone_permission_check_title')}
        open={open}
        cancelText={i18n('cancel')}
        okText={i18n('go_microphone_settings')}
        zIndex={'var(--dsw-zindex-dialog)' as any}
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
  }
  if (showCamera) {
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
  }
  if (showScreen) {
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
  }
  return null;
};
