// Where PuzzleMixx prizes can be sent. Anyone can play; only these countries can receive prizes.
// To add a country later: add its code to PRIZE_COUNTRIES (and update terms.html section 3).
(function () {
  var PRIZE_COUNTRIES = ['GB', 'IE', 'AU', 'NZ'];
  var NAMES = {
    GB: 'United Kingdom', IE: 'Ireland', AU: 'Australia', NZ: 'New Zealand', US: 'United States', CA: 'Canada',
    FR: 'France', DE: 'Germany', ES: 'Spain', IT: 'Italy', PT: 'Portugal', NL: 'Netherlands', BE: 'Belgium',
    CH: 'Switzerland', AT: 'Austria', SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland', PL: 'Poland',
    GR: 'Greece', CZ: 'Czechia', HU: 'Hungary', RO: 'Romania', IS: 'Iceland', LU: 'Luxembourg', MT: 'Malta', CY: 'Cyprus',
    JE: 'Jersey', GG: 'Guernsey', IM: 'Isle of Man', GI: 'Gibraltar',
    ZA: 'South Africa', NG: 'Nigeria', KE: 'Kenya', GH: 'Ghana', EG: 'Egypt', MA: 'Morocco',
    IN: 'India', PK: 'Pakistan', BD: 'Bangladesh', LK: 'Sri Lanka', CN: 'China', HK: 'Hong Kong', JP: 'Japan', KR: 'South Korea',
    SG: 'Singapore', MY: 'Malaysia', TH: 'Thailand', PH: 'Philippines', ID: 'Indonesia', VN: 'Vietnam',
    AE: 'United Arab Emirates', SA: 'Saudi Arabia', QA: 'Qatar', IL: 'Israel', TR: 'Türkiye',
    BR: 'Brazil', MX: 'Mexico', AR: 'Argentina', CL: 'Chile', CO: 'Colombia', PE: 'Peru', JM: 'Jamaica', TT: 'Trinidad and Tobago'
  };
  var all = Object.keys(NAMES).map(function (code) { return { code: code, name: NAMES[code] }; })
    .sort(function (a, b) { return a.name.localeCompare(b.name); });
  all.push({ code: 'OTHER', name: 'Somewhere else' });
  window.PM_COUNTRIES = {
    prize: PRIZE_COUNTRIES.slice(),
    all: all,
    find: function (code) { return all.find(function (c) { return c.code === code; }) || null; },
    canWin: function (code) { return PRIZE_COUNTRIES.indexOf(code) !== -1; },
    // "the United States", "the Netherlands"… for use inside sentences
    inSentence: function (code) { var n = NAMES[code]; if (!n) return 'your country'; return ['US', 'GB', 'AE', 'NL', 'PH', 'IM'].indexOf(code) !== -1 ? 'the ' + n : n; },
    names: function () { return PRIZE_COUNTRIES.map(function (c) { return NAMES[c]; }); }
  };
})();
