import type { Game, PickemMeta, StandingsEntry, UserPick } from '../../shared/types';

const mockTeams = [
  { short: 'Indiana', name: 'Indiana Hoosiers', flair_slug: 'indiana' },
  { short: 'Michigan', name: 'Michigan Wolverines', flair_slug: 'michigan' },
  { short: 'Ohio State', name: 'Ohio State Buckeyes', flair_slug: 'ohiostate', abbrev: 'OSU' },
  { short: 'Penn State', name: 'Penn State Nittany Lions', flair_slug: 'pennstate' },
  { short: 'Georgia', name: 'Georgia Bulldogs', flair_slug: 'georgia' },
  { short: 'Alabama', name: 'Alabama Crimson Tide', flair_slug: 'alabama' },
  { short: 'Texas', name: 'Texas Longhorns', flair_slug: 'texas', abbrev: 'TEX' },
  { short: 'Oklahoma', name: 'Oklahoma Sooners', flair_slug: 'oklahoma' },
  { short: 'Oregon', name: 'Oregon Ducks', flair_slug: 'oregon' },
  { short: 'USC', name: 'USC Trojans', flair_slug: 'usc' },
  { short: 'Notre Dame', name: 'Notre Dame Fighting Irish', flair_slug: 'notredame' },
  { short: 'Clemson', name: 'Clemson Tigers', flair_slug: 'clemson' },
  { short: 'LSU', name: 'LSU Tigers', flair_slug: 'lsu' },
  { short: 'Florida', name: 'Florida Gators', flair_slug: 'florida' },
  { short: 'Tennessee', name: 'Tennessee Volunteers', flair_slug: 'tennessee' },
  { short: 'Auburn', name: 'Auburn Tigers', flair_slug: 'auburn' },
  { short: 'Wisconsin', name: 'Wisconsin Badgers', flair_slug: 'wisconsin' },
  { short: 'Iowa', name: 'Iowa Hawkeyes', flair_slug: 'iowa' },
  { short: 'Nebraska', name: 'Nebraska Cornhuskers', flair_slug: 'nebraska' },
  { short: 'Washington', name: 'Washington Huskies', flair_slug: 'washington' },
] as const;

const logoUrl = (slug: string) =>
  `https://cdn.redditcfb.com/60x40/cfb/${slug}.png`;

const makeTeam = (
  team: (typeof mockTeams)[number],
  conference: string,
  division: 'fbs' | 'fcs'
) => ({
  short: team.short,
  name: team.name,
  flair_slug: team.flair_slug,
  logo_url: logoUrl(team.flair_slug),
  conference,
  division,
  ...('abbrev' in team && team.abbrev ? { abbrev: team.abbrev } : {}),
});

const kickoffOffsetHours = (hours: number) => {
  const d = new Date();
  d.setHours(d.getHours() + hours, 0, 0, 0);
  return d.toISOString();
};

const kickoffEt = (hours: number) => {
  const d = new Date();
  d.setHours(d.getHours() + hours, 0, 0, 0);
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const mockMeta: PickemMeta = {
  current_season: '2025',
  current_week: 0,
};

export const mockGamePool: Game[] = Array.from({ length: 20 }, (_, i) => {
  const away = mockTeams[i * 2] ?? mockTeams[0];
  const home = mockTeams[i * 2 + 1] ?? mockTeams[1];
  const hoursFromNow = i < 2 ? -2 : i * 3 + 6;
  const locked = hoursFromNow < 0;
  const conference =
    i % 3 === 0 ? 'Big Ten' : i % 3 === 1 ? 'SEC' : 'Non-conference';

  return {
    id: `4017526${70 + i}`,
    season: 2025,
    week: mockMeta.current_week,
    kickoff_at: kickoffOffsetHours(hoursFromNow),
    kickoff_et: kickoffEt(hoursFromNow),
    is_locked_for_picks: locked,
    status: locked ? 'in_progress' : 'scheduled',
    away: makeTeam(away, conference, 'fbs'),
    home: makeTeam(home, conference, 'fbs'),
    away_score: locked ? 14 : null,
    home_score: locked ? 10 : null,
    winner_short: null,
  };
});

export const mockSlateGames = mockGamePool.slice(0, 10);

export const mockStandings: StandingsEntry[] = [
  { rank: 1, username: 'cfb_fan_2025', total: 142 },
  { rank: 2, username: 'gridiron_guru', total: 138 },
  { rank: 2, username: 'touchdown_tom', total: 138 },
  { rank: 4, username: 'saturday_hero', total: 135 },
  { rank: 5, username: 'pigskin_pro', total: 131 },
  { rank: 6, username: 'tailgate_king', total: 128 },
  { rank: 7, username: 'fourth_and_long', total: 125 },
  { rank: 8, username: 'hail_mary_hope', total: 122 },
  { rank: 9, username: 'sec_superfan', total: 119 },
  { rank: 10, username: 'big_ten_boss', total: 116 },
];

export const mockUserPicks: UserPick[] = mockSlateGames.map((game, i) => ({
  game_id: game.id,
  pick: i % 2 === 0 ? game.home.short : game.away.short,
  points: i + 1,
  is_correct: null,
  points_earned: null,
}));

export const mockSeasonTotal = 87;
