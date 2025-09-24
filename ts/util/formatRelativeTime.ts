import moment from 'moment';
import { LocalizerType } from '../types/Util';

const getExtendedFormats = (i18n: LocalizerType) => ({
  y: 'lll',
  M: `${i18n('timestampFormat_M') || 'MMM D'} LT`,
  d: 'ddd LT',
});
const getShortFormats = (i18n: LocalizerType) => ({
  y: 'll',
  M: i18n('timestampFormat_M') || 'MMM D',
  d: 'ddd',
});

function isToday(timestamp: moment.Moment) {
  const today = moment().format('DDD');
  const targetDay = moment(timestamp).format('DDD');

  return today === targetDay;
}

function isYesterday(timestamp: moment.Moment) {
  const yesterday = moment().subtract(1, 'day').format('DDD');
  const targetDay = moment(timestamp).format('DDD');

  return yesterday === targetDay;
}

function isYear(timestamp: moment.Moment) {
  const year = moment().format('YYYY');
  const targetYear = moment(timestamp).format('YYYY');

  return year === targetYear;
}

export function formatDateSeparator(
  rawTimestamp: number,
  options: { i18n: LocalizerType & { getLocale?: () => string } }
) {
  const { i18n } = options;
  const timestamp = moment(rawTimestamp);
  const local = i18n.getLocale?.();

  if (isToday(timestamp)) {
    return i18n('today');
  } else if (isYesterday(timestamp)) {
    return i18n('yesterday');
  } else if (isYear(timestamp)) {
    return local === 'zh-CN'
      ? timestamp.format('M月D日 ddd')
      : timestamp.format('ddd, MMM D');
  } else {
    return timestamp.format('YYYY/MM/DD');
  }
}

function formatTimeExtended(
  rawTimestamp: number | Date,
  options: {
    i18n: LocalizerType & { getLocale?: () => string };
  }
) {
  const { i18n } = options;

  const timestamp = moment(rawTimestamp);
  const local = i18n.getLocale?.();

  const body =
    local === 'zh-CN' ? timestamp.format('HH:mm') : timestamp.format('h:mm A');

  if (isYear(timestamp)) {
    if (local === 'zh-CN') {
      return `${timestamp.format('M月D日 ddd')} ${body}`;
    } else {
      return `${timestamp.format('ddd, MMM D')} ${body}`;
    }
  } else {
    return timestamp.format('YYYY/M/D');
  }
}

function formatTimeShort(
  rawTimestamp: number | Date,
  options: { i18n: LocalizerType & { getLocale?: () => string } }
) {
  const { i18n } = options;
  const timestamp = moment(rawTimestamp);
  const local = i18n.getLocale?.();

  return local === 'zh-CN'
    ? timestamp.format('A h:mm')
    : timestamp.format('h:mm A');
}

export function formatTime(
  rawTimestamp: number | Date,
  options: {
    is24Hour?: boolean;
    i18n: LocalizerType & { getLocale?: () => string };
    extended?: boolean;
    short?: boolean;
  }
) {
  const { is24Hour, i18n, extended = false, short = false } = options;

  if (extended) {
    return formatTimeExtended(rawTimestamp, options);
  }

  if (short) {
    return formatTimeShort(rawTimestamp, options);
  }

  const timestamp = moment(rawTimestamp);

  if (isToday(timestamp)) {
    if (is24Hour) {
      return timestamp.format('HH:mm');
    } else {
      const hour = timestamp.format('h');
      const minute = timestamp.format('mm');
      const a = timestamp.format('A');
      const local = i18n.getLocale?.();

      if (local === 'zh-CN') {
        return `${a} ${hour}:${minute}`;
      } else {
        return `${hour}:${minute} ${a}`;
      }
    }
  } else if (isYear(timestamp)) {
    const month = timestamp.format('M');
    const day = timestamp.format('D');
    return i18n('formatTime.isYear', [month, day]);
  } else {
    return moment(rawTimestamp).format('YYYY/M/D');
  }
}

export function formatRelativeTime(
  rawTimestamp: number | Date,
  options: { extended?: boolean; i18n: LocalizerType }
) {
  const { extended, i18n } = options;

  const formats = extended ? getExtendedFormats(i18n) : getShortFormats(i18n);
  const timestamp = moment(rawTimestamp);
  const now = moment();
  const diff = moment.duration(now.diff(timestamp));

  if (diff.years() >= 1 || !isYear(timestamp)) {
    return timestamp.format(formats.y);
  } else if (diff.months() >= 1 || diff.days() > 6) {
    return timestamp.format(formats.M);
  } else if (diff.days() >= 1 || !isToday(timestamp)) {
    return timestamp.format(formats.d);
  } else if (diff.hours() >= 1) {
    const key = extended ? 'hoursAgo' : 'hoursAgoShort';

    return i18n(key, [String(diff.hours())]);
  } else if (diff.minutes() >= 1) {
    const key = extended ? 'minutesAgo' : 'minutesAgoShort';

    return i18n(key, [String(diff.minutes())]);
  }

  return i18n('justNow');
}

export function simplifySeconds(seconds: number) {
  const duration = moment.duration(seconds, 'seconds');

  const days = Math.floor(duration.asDays());
  const hours = duration.hours();
  const minutes = duration.minutes();
  const secs = duration.seconds();

  let formatted = '';
  if (days > 0) {
    formatted += `${days}d `;
  }

  if (hours > 0) {
    formatted += `${hours}h `;
  }

  if (minutes > 0) {
    formatted += `${minutes}m `;
  }

  if (secs > 0) {
    formatted += `${secs}s`;
  }

  return formatted.trim();
}
