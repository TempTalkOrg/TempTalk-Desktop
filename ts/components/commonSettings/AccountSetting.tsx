import React, { useState } from 'react';

import { LocalizerType } from '../../types/Util';
import { isArray, isFunction } from 'lodash';
import { Button, FormRule } from 'antd';

import { useMemoizedFn } from 'ahooks';
import { deleteAllData, getAccountManager } from '../../shims/apiService';
import LinkModal from './LinkModal';
import { normalize } from '../../types/PhoneNumber';

interface SettingProps {
  i18n: LocalizerType;
  id: string;
  deviceName?: string;
  email?: string;
  phoneNumber?: string;
  onClose: () => void;
  onRefreshProfile: () => Promise<void>;
  profileLoading: boolean;
}

type SettingField = 'id' | 'deviceName' | 'email' | 'phoneNumber';

interface ItemProps {
  i18n: LocalizerType;
  field: SettingField;
  fieldRules?: FormRule[];
  value?: string;
  placeholder?: string;
  onRequestCode?: (newValue: string, nonce?: string) => Promise<void>;
  onUpdate?: (
    newValue: string,
    verifyCode: string,
    nonce?: string
  ) => Promise<void>;
  onRefreshProfile?: () => Promise<void>;
  profileLoading?: boolean;
}

function SettingItem(props: ItemProps) {
  const [showLinkModal, setShowLinkModal] = useState(false);

  const {
    i18n,
    field,
    fieldRules,
    value,
    placeholder,
    onUpdate,
    onRequestCode,
    profileLoading,
    onRefreshProfile,
  } = props;

  const modifiable =
    isFunction(onUpdate) &&
    isFunction(onRequestCode) &&
    isArray<FormRule>(fieldRules);

  return (
    <div className="setting-account-item">
      <div className="setting-account-item-title">
        {i18n(`setting.account.${field}`)}
      </div>
      <div className="setting-account-item-value">
        {profileLoading ? (
          <Button
            className="setting-account-item-loading"
            loading={true}
            disabled={true}
          ></Button>
        ) : (
          <div>{value || placeholder}</div>
        )}
        {modifiable ? (
          <>
            <Button
              className="setting-account-button"
              onClick={() => setShowLinkModal(true)}
              disabled={profileLoading}
              loading={profileLoading}
            >
              {profileLoading
                ? ''
                : i18n(`setting.account.button.${value ? 'edit' : 'link'}`)}
            </Button>
            <LinkModal
              i18n={i18n}
              field={field}
              fieldRules={fieldRules}
              flow={value ? 'change' : 'link'}
              openModal={showLinkModal}
              onCancel={() => setShowLinkModal(false)}
              onRequestCode={onRequestCode}
              onUpdate={onUpdate}
              onRefreshProfile={onRefreshProfile}
            ></LinkModal>
          </>
        ) : null}
      </div>
    </div>
  );
}

function getRequiredTips(i18n: LocalizerType, field: string) {
  const fieldText = i18n(`setting.account.${field}`);
  return i18n('setting.account.linkModal.input.requiredTips', [fieldText]);
}

function getInvalidTips(i18n: LocalizerType, field: string) {
  const fieldText = i18n(`setting.account.${field}`);
  return i18n('setting.account.linkModal.input.invalidTips', [fieldText]);
}

export default function AccountSetting(props: SettingProps) {
  const {
    i18n,
    id,
    deviceName,
    email,
    phoneNumber,
    onClose,
    onRefreshProfile,
    profileLoading,
  } = props;

  const logout = useMemoizedFn(() => deleteAllData());
  const onUpdateEmail = useMemoizedFn(
    async (newEmail: string, verifyCode: string, nonce?: string) => {
      try {
        await getAccountManager().bindEmail(newEmail, verifyCode, nonce);
      } catch (error) {
        throw error;
      }
    }
  );

  const onUpdatePhoneNumber = useMemoizedFn(
    async (newPhoneNumber: string, verifyCode: string, nonce?: string) => {
      try {
        await getAccountManager().bindPhone(newPhoneNumber, verifyCode, nonce);
      } catch (error) {
        throw error;
      }
    }
  );

  const onRequestEmailCode = useMemoizedFn(
    async (newEmail: string, nonce?: string) => {
      try {
        await getAccountManager().requestBindVerificationEmail(newEmail, nonce);
      } catch (error) {
        throw error;
      }
    }
  );
  const onRequestPhoneCode = useMemoizedFn(
    async (newPhoneNumber: string, nonce?: string) => {
      try {
        await getAccountManager().requestBindVerificationSMS(
          newPhoneNumber,
          nonce
        );
      } catch (error) {
        throw error;
      }
    }
  );

  const fieldPhone = 'phoneNumber';
  const fieldEmail = 'email';

  return (
    <div id="common-setting" className="common-setting">
      <div className="common-setting header-bg"></div>
      <div className="common-setting bottom-bg"></div>
      <div className="common-setting page-title"> {i18n('account')} </div>
      <div className="common-setting close-button" onClick={onClose}>
        <div className="close-button-inner"></div>
      </div>
      <div className="setting-list-content sub-setting-content setting-account">
        <SettingItem i18n={i18n} field={'id'} value={id}></SettingItem>
        <SettingItem
          i18n={i18n}
          field={'deviceName'}
          value={deviceName}
          placeholder="Unknown"
        ></SettingItem>
        <SettingItem
          i18n={i18n}
          field={fieldEmail}
          fieldRules={[
            {
              required: true,
              message: getRequiredTips(i18n, fieldEmail),
            },
            {
              type: 'email',
              message: getInvalidTips(i18n, fieldEmail),
            },
          ]}
          value={email}
          placeholder={i18n('setting.account.notLinked')}
          onUpdate={onUpdateEmail}
          onRequestCode={onRequestEmailCode}
          profileLoading={profileLoading}
          onRefreshProfile={onRefreshProfile}
        ></SettingItem>
        <SettingItem
          i18n={i18n}
          field={fieldPhone}
          fieldRules={[
            { required: true, message: getRequiredTips(i18n, fieldPhone) },
            {
              validator: async (_, value) => {
                if (!value) {
                  return;
                }

                if (!normalize(value, { regionCode: 'US' })) {
                  throw new Error('invlaid phone number');
                }
              },
              message: getInvalidTips(i18n, fieldPhone),
            },
          ]}
          value={phoneNumber}
          placeholder={i18n('setting.account.notLinked')}
          onUpdate={onUpdatePhoneNumber}
          onRequestCode={onRequestPhoneCode}
          profileLoading={profileLoading}
          onRefreshProfile={onRefreshProfile}
        ></SettingItem>
        <hr className="setting-account-divider"></hr>
        <div className="setting-account-logout" onClick={logout}>
          {i18n('clearDataButton')}
        </div>
      </div>
    </div>
  );
}
