import React from 'react';
import { LocalizerType } from '../../types/Util';

interface Props {
  i18n: LocalizerType;
  remindCycle: string;
  name: string;
  groupRemind: any;
  type: string;
}

interface State {
  lang: string;
  time: string;
  period: string;
}

const CN_DAY = [
  '每周一',
  '每周二',
  '每周三',
  '每周四',
  '每周五',
  '每周六',
  '每周日',
];
const EN_DAY = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export class RemindCycleNotification extends React.Component<Props, State> {
  public renderTurnOffReminder() {
    const { i18n, name } = this.props;
    return (
      <div>
        {name && (
          <span className={'module_notification_highlight'}>{name + ' '}</span>
        )}
        <span>{i18n('turn_off_remind_cycle_tip')}</span>
      </div>
    );
  }

  public renderDailyReminder(
    lang: string,
    time: string,
    period: string,
    remindDescription: string
  ) {
    const { i18n, name } = this.props;
    return (
      <div>
        <div>
          {name && (
            <span className={'module_notification_highlight'}>{name}</span>
          )}
          <span>{i18n('remind_cycle_tip', [i18n('daily_time_tip')])}</span>
          <span className={'module_notification_highlight'}>
            {remindDescription || "Don't forget to update!"}
          </span>
        </div>
        <div>
          {lang === 'zh-CN' ? (
            <span>
              <span>将会在</span>
              <span className={'module_notification_highlight'}>
                {'每日' + period + time + '(UTC+8)'}
              </span>
              <span>进行提醒</span>
            </span>
          ) : (
            <span>
              <span>There will be a reminder</span>
              <span className={'module_notification_highlight'}>
                {' every day at ' + time + ' ' + period + ' (UTC+8)'}
              </span>
            </span>
          )}
        </div>
      </div>
    );
  }

  public renderWeeklyReminder(
    lang: string,
    time: string,
    period: string,
    remindDescription: string,
    remindWeekDay: number
  ) {
    const { i18n, name } = this.props;
    return (
      <div>
        <div>
          {name && (
            <span className={'module_notification_highlight'}>{name}</span>
          )}
          <span>{i18n('remind_cycle_tip', [i18n('weekly_time_tip')])}</span>
          <span className={'module_notification_highlight'}>
            {remindDescription || "Don't forget to update!"}
          </span>
        </div>
        <div>
          {lang === 'zh-CN' ? (
            <span>
              <span>将会在</span>
              <span className={'module_notification_highlight'}>
                {CN_DAY[remindWeekDay - 1] + period + time + '(UTC+8)'}
              </span>
              <span>进行提醒</span>
            </span>
          ) : (
            <span>
              <span>There will be a reminder</span>
              <span className={'module_notification_highlight'}>
                {' every ' +
                  EN_DAY[remindWeekDay - 1] +
                  ' at ' +
                  time +
                  ' ' +
                  period +
                  ' (UTC+8)'}
              </span>
            </span>
          )}
        </div>
      </div>
    );
  }

  public getMonthDay(remindMonthDay: number) {
    const singleDigit = remindMonthDay % 10;
    let prefix;
    if (remindMonthDay <= 20) {
      if (remindMonthDay === 1) {
        prefix = '1st';
      } else if (remindMonthDay === 2) {
        prefix = '2nd';
      } else if (remindMonthDay === 3) {
        prefix = '3rd';
      } else {
        prefix = remindMonthDay + 'th';
      }
    } else {
      if (singleDigit === 1) {
        prefix = remindMonthDay + 'st';
      } else if (singleDigit === 2) {
        prefix = remindMonthDay + 'nd';
      } else if (singleDigit === 3) {
        prefix = remindMonthDay + 'rd';
      } else {
        prefix = remindMonthDay + 'th';
      }
    }
    return prefix + ' day of every month';
  }

  public renderMonthlyReminder(
    lang: string,
    time: string,
    period: string,
    remindDescription: string,
    remindMonthDay: number
  ) {
    const { i18n, name } = this.props;
    const dayStringCN =
      remindMonthDay === -1 ? '最后一天' : '第' + remindMonthDay + '天';
    const dayStringEN =
      remindMonthDay === -1
        ? 'on the last day of month'
        : this.getMonthDay(remindMonthDay);

    return (
      <div>
        <div>
          {name && (
            <span className={'module_notification_highlight'}>{name}</span>
          )}
          <span>{i18n('remind_cycle_tip', [i18n('monthly_time_tip')])}</span>
          <span className={'module_notification_highlight'}>
            {remindDescription || "Don't forget to update!"}
          </span>
        </div>
        <div>
          {lang === 'zh-CN' ? (
            <span>
              <span>将会在</span>
              <span className={'module_notification_highlight'}>
                {'每月' + dayStringCN + period + time + '(UTC+8)'}
              </span>
              <span>进行提醒</span>
            </span>
          ) : (
            <span>
              <span>There will be a reminder</span>
              <span className={'module_notification_highlight'}>
                {' at ' + time + ' ' + period + ' (UTC+8) ' + dayStringEN}
              </span>
            </span>
          )}
        </div>
      </div>
    );
  }

  public renderCycleReminder(lang: string, remindDescription: string) {
    const { i18n, remindCycle } = this.props;
    return (
      <div>
        {lang === 'zh-CN' ? (
          <span>
            <span>{i18n(remindCycle + '_time_tip')}</span>
            <span>{i18n('group_remind')}</span>
            <span className={'module_notification_highlight'}>
              {remindDescription || "Don't forget to update!"}
            </span>
          </span>
        ) : (
          <span>
            <span>{i18n(remindCycle + '_time_tip')}</span>
            <span>{i18n('group_remind')}</span>
            <span className={'module_notification_highlight'}>
              {remindDescription || "Don't forget to update!"}
            </span>
          </span>
        )}
      </div>
    );
  }

  public renderDefault() {
    const { type, i18n, name } = this.props;
    if (type === 'cycle') {
      return (
        <div className="module-remind-cycle-notification">
          <span>{i18n('remind_default_cycle')}</span>
          <span className={'module_notification_highlight'}>
            Don't forget to update!
          </span>
        </div>
      );
    } else {
      return (
        <div className="module-remind-cycle-notification">
          <span className={'module_notification_highlight'}>{name}</span>
          <span>{i18n('remind_default_immediate')}</span>
        </div>
      );
    }
  }

  public render() {
    const { remindCycle, groupRemind, type } = this.props;
    if (!remindCycle) return null;

    const { remindTime, remindDescription, remindMonthDay, remindWeekDay } =
      groupRemind || {};

    // 没有全局配置的情况下， 渲染兜底提示
    if (!remindTime || !remindMonthDay || !remindWeekDay) {
      return this.renderDefault();
    }

    const lang = (window as any).getLocalLanguage();
    const time = remindTime > 12 ? remindTime - 12 + ':00' : remindTime + ':00';
    const period =
      lang === 'zh-CN'
        ? remindTime === remindTime > 12
          ? '下午'
          : '上午'
        : remindTime === remindTime > 12
          ? 'pm'
          : 'am';

    return (
      <div>
        {remindCycle && (
          <div className="module-remind-cycle-notification">
            {remindCycle === 'none' &&
              type === 'immediate' &&
              this.renderTurnOffReminder()}
            {remindCycle === 'daily' &&
              type === 'immediate' &&
              this.renderDailyReminder(lang, time, period, remindDescription)}
            {remindCycle === 'weekly' &&
              type === 'immediate' &&
              this.renderWeeklyReminder(
                lang,
                time,
                period,
                remindDescription,
                remindWeekDay
              )}
            {remindCycle === 'monthly' &&
              type === 'immediate' &&
              this.renderMonthlyReminder(
                lang,
                time,
                period,
                remindDescription,
                remindMonthDay
              )}
            {type === 'cycle' &&
              this.renderCycleReminder(lang, remindDescription)}
          </div>
        )}
      </div>
    );
  }
}
