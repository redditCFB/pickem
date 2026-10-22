import type { Game, TeamDivision } from './types';

export type PickerDivisionKey = TeamDivision | 'cross';

export type GamePickerConferenceGroup = {
  name: string;
  games: Game[];
};

export type GamePickerDivisionGroup = {
  division: PickerDivisionKey;
  label: string;
  conferences: GamePickerConferenceGroup[];
  gameCount: number;
};

const NON_CONFERENCE = 'Non-conference';
const CROSS_DIVISION = 'FBS vs FCS';

export const getGamePickerBucket = (
  game: Game
): { division: PickerDivisionKey; conference: string } => {
  const awayDiv = game.away.division ?? 'fbs';
  const homeDiv = game.home.division ?? 'fbs';

  if (awayDiv !== homeDiv) {
    return { division: 'cross', conference: CROSS_DIVISION };
  }

  const awayConf = game.away.conference ?? 'Unknown';
  const homeConf = game.home.conference ?? 'Unknown';

  if (awayConf === homeConf) {
    return { division: awayDiv, conference: awayConf };
  }

  return { division: awayDiv, conference: NON_CONFERENCE };
};

const conferenceSortKey = (name: string): string => {
  if (name === NON_CONFERENCE) return `\uffff${name}`;
  if (name === CROSS_DIVISION) return `\ufffe${name}`;
  return name;
};

export const groupGamesForPicker = (games: Game[]): GamePickerDivisionGroup[] => {
  const buckets = new Map<string, Game[]>();

  for (const game of games) {
    const { division, conference } = getGamePickerBucket(game);
    const key = `${division}\0${conference}`;
    const list = buckets.get(key) ?? [];
    list.push(game);
    buckets.set(key, list);
  }

  const divisionOrder: { key: PickerDivisionKey; label: string }[] = [
    { key: 'fbs', label: 'FBS' },
    { key: 'fcs', label: 'FCS' },
    { key: 'cross', label: 'Cross-division' },
  ];

  return divisionOrder
    .map(({ key, label }) => {
      const conferences = [...buckets.entries()]
        .filter(([bucketKey]) => bucketKey.startsWith(`${key}\0`))
        .map(([bucketKey, bucketGames]) => ({
          name: bucketKey.split('\0')[1] ?? 'Unknown',
          games: [...bucketGames].sort((a, b) =>
            a.kickoff_at.localeCompare(b.kickoff_at)
          ),
        }))
        .sort((a, b) =>
          conferenceSortKey(a.name).localeCompare(conferenceSortKey(b.name))
        );

      const gameCount = conferences.reduce(
        (sum, group) => sum + group.games.length,
        0
      );

      return { division: key, label, conferences, gameCount };
    })
    .filter((group) => group.gameCount > 0);
};
