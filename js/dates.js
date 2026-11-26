// Date helpers. Dates are stored as ISO strings ("2026-11-25") and handled in UTC
// so a plan never shifts by a day because of time zones or daylight saving.
(function (root) {
  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function parse(iso) {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  const toIso = (date) => date.toISOString().slice(0, 10);

  function addDays(iso, count) {
    const date = parse(iso);
    date.setUTCDate(date.getUTCDate() + count);
    return toIso(date);
  }

  const weekday = (iso) => DAY_KEYS[parse(iso).getUTCDay()];
  const daysBetween = (from, to) => Math.round((parse(to) - parse(from)) / 86400000);
  const isValid = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') && toIso(parse(iso)) === iso;

  function localToday(now = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function label(iso) {
    const date = parse(iso);
    return `${DAY_NAMES[date.getUTCDay()]}, ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
  }

  const api = { DAY_KEYS, parse, addDays, weekday, daysBetween, isValid, localToday, label };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Dates = api;
})(this);
