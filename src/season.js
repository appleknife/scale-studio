// The time of year, for the things that only come out for a while.
//
// Christmas runs from the first of November to Twelfth Night (6 January): long
// enough that a student who practises once a week still sees it. The South Park
// limited edition keeps the same dates, so the two winter collections share a
// shelf. `?season=xmas` or `?season=southpark` in the address shows one out of
// season, and `?season=off` hides both; all three are for trying things out.

export const SEASONS = {
  xmas: { month: 1, day: 6 },
  southpark: { month: 1, day: 6 },
};

// Kept because the pet room and its tests have asked for these names.
export const SEASON_ENDS = SEASONS;

/** Every season that is on that day, in the order the shop shows them. */
export function seasonsOn(date = new Date()) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return Object.keys(SEASONS).filter((season) => {
    const end = SEASONS[season];
    return m === 11 || m === 12 || (m === 1 && d <= end.day);
  });
}

/** The first season that is on, or null — the one that colours the app. */
export function seasonOn(date = new Date()) {
  return seasonsOn(date)[0] || null;
}

/** What the app should show now: the calendar's, unless the address says otherwise. */
export function currentSeasons(date = new Date(), search = typeof location === 'undefined' ? '' : location.search) {
  const asked = new URLSearchParams(search).get('season');
  if (asked === 'off' || asked === 'none') return [];
  if (asked && asked in SEASONS) return [asked];
  return seasonsOn(date);
}

/** The first season the app should show, or null. */
export function currentSeason(date = new Date(), search = typeof location === 'undefined' ? '' : location.search) {
  return currentSeasons(date, search)[0] || null;
}
