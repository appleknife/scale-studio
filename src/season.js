// The time of year, for the things that only come out for a while.
//
// Christmas runs from the first of November to Twelfth Night (6 January): long
// enough that a student who practises once a week still sees it. `?season=xmas`
// in the address shows it out of season, and `?season=off` hides it in season;
// both are for trying things out.

export const SEASON_ENDS = { xmas: { month: 1, day: 6 } };

export function seasonOn(date = new Date()) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if (m === 11 || m === 12 || (m === 1 && d <= SEASON_ENDS.xmas.day)) return 'xmas';
  return null;
}

/** The season the app should show now: the calendar's, unless the address says otherwise. */
export function currentSeason(date = new Date(), search = typeof location === 'undefined' ? '' : location.search) {
  const asked = new URLSearchParams(search).get('season');
  if (asked === 'off' || asked === 'none') return null;
  if (asked && asked in SEASON_ENDS) return asked;
  return seasonOn(date);
}
