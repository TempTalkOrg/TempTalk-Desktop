import { Button, QRCode, Result, Spin } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LocalizerType } from '../../../types/Util';
import { useMemoizedFn } from 'ahooks';

interface IProps {
  i18n: LocalizerType;
}

interface ILinkError {
  name: string;
  message?: string;
  code?: number;
}

const CONNECTION_ERROR = -1;
const TOO_MANY_DEVICES = 411;

export const QRLogin = (props: IProps) => {
  const { i18n } = props;

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(true);
  const [error, setError] = useState<ILinkError | null>(null);

  const connect = useMemoizedFn(() => {
    setError(null);
    setSpinning(false);
    setUrl(null);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const setProvisioningUrl = (url: string) => {
      setUrl(url);
    };

    const confirmNumber = async () => {
      setSpinning(true);
      const deviceName = (
        window as any
      ).textsecure.storage.user.getDeviceName();
      // strip unicode null
      return deviceName?.replace(/\0/g, '') || (window as any).getHostName();
    };

    const accountManager = (window as any).getAccountManager();

    accountManager
      .registerSecondDevice(setProvisioningUrl, confirmNumber)
      .catch(handleDisconnect);
  });

  const reconnect = useMemoizedFn(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(connect, 10000);
  });

  const handleDisconnect = useMemoizedFn((error: any) => {
    (window as any).log.error(
      'provisioning failed',
      error && error.stack ? error.stack : error
    );

    setSpinning(false);
    setError(error);

    if (error.message === 'websocket closed') {
      reconnect();
    } else if (
      error.name !== 'HTTPError' ||
      (error.code !== CONNECTION_ERROR && error.code !== TOO_MANY_DEVICES)
    ) {
      (window as any).log.error(
        'provisioning failed with unknow error',
        error && error.stack ? error.stack : error
      );
      // throw error;
    }
  });

  const errorMessage = useMemo(() => {
    let message;
    if (error) {
      if (error.name === 'HTTPError' && error.code === TOO_MANY_DEVICES) {
        message = i18n('installTooManyDevices');
      } else if (
        error.name === 'HTTPError' &&
        error.code === CONNECTION_ERROR
      ) {
        message = i18n('installConnectionFailed');
      } else if (error.message === 'websocket closed') {
        // AccountManager.registerSecondDevice uses this specific
        //   'websocket closed' error message
        message = i18n('installConnectionFailed');
      }
    }
    return message;
  }, [error]);

  useEffect(() => {
    connect();
  }, []);

  return (
    <>
      <Spin
        spinning={spinning}
        fullscreen
        tip={i18n('initialSync')}
        rootClassName="syncing-data-spin"
      />
      {error ? (
        <Result
          className="qr-login-error"
          status="error"
          title="Something went wrong!"
          subTitle={errorMessage}
          extra={
            <Button type="primary" size="large" onClick={connect}>
              Try again
            </Button>
          }
        />
      ) : (
        <div className="qr-login-container">
          <QRCode
            value={url ?? 'placeholder'}
            status={url ? 'active' : 'loading'}
            errorLevel="H"
            size={200}
            type="canvas"
            icon="./images/icon_1024.png"
            iconSize={50}
            bgColor="white"
            color="black"
          />
          <div className="guide">
            <div className="guide-title">{i18n('scanQrcode')}</div>
            <div className="guide-steps">
              <div className="guide-step-item">{i18n('linkStep.step1')}</div>
              <div className="guide-step-item">
                {i18n('linkStep.step2')}
                <div className="scan-icon"></div>
              </div>
              <div className="guide-step-item">{i18n('linkStep.step3')}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
