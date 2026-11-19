// Lightweight Moment.js replacement built on dayjs with commonly used plugins.
// This adapter preserves the subset of Moment APIs used in the codebase
// (constructor signature, format parsing, fromNow, startOf/endOf, add/subtract, duration).

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(utc);
dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);

function m(input, format, strict) {
  // Support Moment-like constructor with optional (input, format[, strict])
  if (format) return dayjs(input, format, strict);
  return dayjs(input);
}

// Attach duration constructor to mirror moment.duration()
m.duration = dayjs.duration;

// Attach utc constructor to mirror moment.utc()
m.utc = function(input, format, strict) {
  if (format) return dayjs.utc(input, format, strict);
  return dayjs.utc(input);
};

export default m;

