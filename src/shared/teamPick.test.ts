import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePickToken,
  resolvePickForGame,
  resolveWinnerShort,
} from './teamPick.ts';
import type { Game } from './types.ts';

const makeGame = (
  awayShort: string,
  homeShort: string,
  awayAbbrev?: string,
  homeAbbrev?: string
): Game => ({
  id: '1',
  season: 2025,
  week: 1,
  kickoff_at: '2099-01-01T17:00:00Z',
  kickoff_et: 'Sat 12:00 PM',
  is_locked_for_picks: false,
  status: 'scheduled',
  away: {
    short: awayShort,
    name: `${awayShort} Team`,
    ...(awayAbbrev ? { abbrev: awayAbbrev } : {}),
    flair_slug: 'away',
    logo_url: '/api/logo/away',
  },
  home: {
    short: homeShort,
    name: `${homeShort} Team`,
    ...(homeAbbrev ? { abbrev: homeAbbrev } : {}),
    flair_slug: 'home',
    logo_url: '/api/logo/home',
  },
  away_score: null,
  home_score: null,
  winner_short: null,
});

describe('teamPick', () => {
  it('normalizePickToken strips punctuation', () => {
    assert.equal(normalizePickToken("Hawai'i"), 'hawaii');
    assert.equal(normalizePickToken('Ohio State'), 'ohiostate');
  });

  it('resolvePickForGame accepts scoreboard short', () => {
    const game = makeGame('Ohio State', 'Texas');
    assert.equal(resolvePickForGame('Ohio State', game), 'Ohio State');
    assert.equal(resolvePickForGame('Texas', game), 'Texas');
  });

  it('resolvePickForGame maps ESPN abbrev to scoreboard short', () => {
    const game = makeGame('Ohio State', 'Texas', 'OSU');
    assert.equal(resolvePickForGame('OSU', game), 'Ohio State');
  });

  it('resolveWinnerShort maps winner label to team short', () => {
    const game = makeGame('Ohio State', 'Texas', 'OSU', 'TEX');
    assert.equal(
      resolveWinnerShort('Ohio State', game.away, game.home),
      'Ohio State'
    );
    assert.equal(resolveWinnerShort('TEX', game.away, game.home), 'Texas');
  });
});
