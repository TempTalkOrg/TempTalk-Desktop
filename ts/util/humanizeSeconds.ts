import moment from 'moment';

export function humanizeSeconds(seconds: number) {
  return moment
    .duration(seconds, 'seconds')
    .humanize({ d: 365 })
    .replace(/^a /, '1 ');
}
