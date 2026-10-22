#!/usr/bin/env node
/**
 * Verify Pick 'Em pipeline OUTSIDE the Devvit sandbox.
 *
 * Reddit playtest blocks custom HTTP domains until approved, so this script
 * is the way to confirm scoreboard + mods API + secret wiring before approval.
 *
 * Paths must stay aligned with src/server/lib/modsApi.ts and scoreboard.ts.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SCOREBOARD_API_BASE = 'https://scoreboard.redditcfb.com/api/v1';
const MODS_API_BASE = 'https://mods.redditcfb.com/api/devvit/v1';
const OFFICIAL_GROUP_ID = 6;
const SLATE_SIZE = 10;
const REQUIRED_HTTP_DOMAINS = [
  'scoreboard.redditcfb.com',
  'mods.redditcfb.com',
  'cdn.redditcfb.com',
];

const VERIFY_USERNAME = '__devvit_pipeline_verify__';

/** Calendar year for scoreboard API (mirrors src/shared/season.ts). */
const scoreboardSeasonYear = (pickemSeason) => {
  const match = /^(\d{4})/.exec(String(pickemSeason).trim());
  if (!match) {
    throw new Error(`Invalid pickem season: ${pickemSeason}`);
  }
  return Number(match[1]);
};

/** @typedef {{ name: string; ok: boolean; detail: string; hint?: string }} Check */

/** @type {Check[]} */
const checks = [];

const pass = (name, detail, hint) => {
  checks.push({ name, ok: true, detail, hint });
  console.log(`  ✓ ${name}: ${detail}`);
};

const fail = (name, detail, hint) => {
  checks.push({ name, ok: false, detail, hint });
  console.log(`  ✗ ${name}: ${detail}`);
  if (hint) console.log(`    → ${hint}`);
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const opts = {
    secret: process.env.MODS_API_SECRET ?? '',
    secretFile: process.env.MODS_API_SECRET_FILE ?? '',
    season: null,
    week: null,
    write: false,
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--write') opts.write = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--secret') opts.secret = args[++i] ?? '';
    else if (arg === '--secret-file') opts.secretFile = args[++i] ?? '';
    else if (arg === '--season') opts.season = args[++i] ?? '';
    else if (arg === '--week') opts.week = Number(args[++i]);
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!opts.secret && opts.secretFile) {
    opts.secret = readFileSync(resolve(opts.secretFile), 'utf8').trim();
  }

  if (!opts.secret) {
    for (const candidate of defaultSecretPaths()) {
      if (existsSync(candidate)) {
        opts.secret = readFileSync(candidate, 'utf8').trim();
        opts.secretFile = candidate;
        break;
      }
    }
  }

  return opts;
};

const defaultSecretPaths = () => [
  resolve(ROOT, '.mods-api-secret'),
  resolve(ROOT, '../redditcfb/redditcfb.com/scripts/devvit_api_secret'),
  '/home/rcfb/scripts/devvit_api_secret',
];

const printHelp = () => {
  console.log(`Usage: npm run verify:pipeline [-- options]

Local integration checks (no Devvit sandbox). Default is read-only.

Options:
  --secret <token>       Bearer token (or set MODS_API_SECRET)
  --secret-file <path>   Read token from file
  --season <key>         Override pickem season (e.g. 2026-week0; default: mods meta)
  --week <n>             Override week (default: from mods meta; 0 is valid)
  --write                Round-trip slate + picks (writes to MySQL)
  --json                 Machine-readable summary on stdout
  -h, --help             Show this help

Secret lookup order:
  1. --secret / MODS_API_SECRET
  2. --secret-file / MODS_API_SECRET_FILE
  3. .mods-api-secret (repo root, gitignored)
  4. ../redditcfb/redditcfb.com/scripts/devvit_api_secret

What each layer proves:
  This script     → scoreboard + mods API + secret + MySQL game rows
  Devvit playtest → UI, Redis draft, scoreboard from sandbox (mods blocked until approved)
  After approval  → full E2E picks persistence in playtest/production
`);
};

const fetchJson = async (url, options = {}) => {
  const res = await fetch(url, options);
  let body = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 200) };
    }
  }
  return { res, body };
};

const modsFetch = async (path, secret, options = {}) => {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${secret}`);
  headers.set('Content-Type', 'application/json');
  return fetchJson(`${MODS_API_BASE}${path}`, { ...options, headers });
};

const checkDevvitConfig = () => {
  const configPath = resolve(ROOT, 'devvit.json');
  if (!existsSync(configPath)) {
    fail('devvit.json', 'File not found');
    return;
  }

  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const domains = config.permissions?.http?.domains ?? [];
  const missing = REQUIRED_HTTP_DOMAINS.filter((d) => !domains.includes(d));

  if (!config.permissions?.http?.enable) {
    fail('devvit.json HTTP', 'permissions.http.enable is not true', 'Enable HTTP in devvit.json');
    return;
  }

  if (missing.length > 0) {
    fail(
      'devvit.json domains',
      `Missing: ${missing.join(', ')}`,
      'Add domains under permissions.http.domains and re-upload'
    );
    return;
  }

  pass(
    'devvit.json domains',
    `HTTP enabled; ${domains.length} domain(s) listed including mods + scoreboard`
  );
};

const checkScoreboard = async (pickemSeason, week) => {
  const scoreboardSeason = scoreboardSeasonYear(pickemSeason);
  const divisions = ['fbs', 'fcs'];
  /** @type {import('../src/shared/types.js') | never[]} */
  let allItems = [];

  for (const division of divisions) {
    const url = `${SCOREBOARD_API_BASE}/games?season=${scoreboardSeason}&week=${week}&division=${division}`;
    const { res, body } = await fetchJson(url);
    if (!res.ok) {
      fail(
        `scoreboard ${division}`,
        `HTTP ${res.status} for pickem=${pickemSeason} scoreboard=${scoreboardSeason} week=${week}`,
        'Confirm scoreboard.redditcfb.com is up'
      );
      continue;
    }
    if (!body?.ok || !Array.isArray(body.items)) {
      fail(`scoreboard ${division}`, 'Invalid JSON response');
      continue;
    }
    allItems = allItems.concat(body.items);
    pass(
      `scoreboard ${division}`,
      `${body.items.length} games (pickem ${pickemSeason}, scoreboard ${scoreboardSeason}, week ${week})`
    );
  }

  const byId = new Map();
  for (const item of allItems) {
    byId.set(String(item.id), item);
  }

  const unlocked = [...byId.values()].filter(
    (g) => g.is_locked_for_picks === false || g.is_locked_for_picks === 0
  );

  pass(
    'scoreboard pool',
    `${byId.size} unique games; ${unlocked.length} still open for picks`
  );

  return { games: [...byId.values()], unlocked };
};

const checkModsHealth = async (secret) => {
  const { res, body } = await modsFetch('/health', secret);
  if (!res.ok || !body?.ok) {
    fail(
      'mods health',
      `HTTP ${res.status}${body?.message ? `: ${body.message}` : ''}`,
      'Deploy api/devvit/v1 to mods.redditcfb.com (see PICKEM_MODS_API_HANDOFF.md)'
    );
    return false;
  }
  pass('mods health', `API is live (${body.service ?? 'devvit-api'})`);
  return true;
};

const checkModsAuth = async (secret) => {
  const { res: unauthRes } = await fetchJson(`${MODS_API_BASE}/pickem/meta`);
  if (unauthRes.status !== 401) {
    fail(
      'mods auth (no token)',
      `Expected 401, got ${unauthRes.status}`,
      'Server should reject unauthenticated requests'
    );
  } else {
    pass('mods auth (no token)', 'Correctly returns 401 without Bearer token');
  }

  const { res, body } = await modsFetch('/pickem/meta', secret);
  if (res.status === 401) {
    fail(
      'mods auth (secret)',
      '401 Unauthorized',
      'Secret mismatch: compare devvit settings set modsApiSecret with server devvit_api_secret'
    );
    return null;
  }
  if (!res.ok || !body?.ok) {
    fail('mods meta', `HTTP ${res.status}: ${JSON.stringify(body)}`);
    return null;
  }

  pass(
    'mods meta',
    `season=${body.current_season}, week=${body.current_week} (matches pickem.states)`
  );
  return {
    current_season: body.current_season,
    current_week: body.current_week,
  };
};

const checkModsReadEndpoints = async (secret, season) => {
  const standings = await modsFetch(
    `/pickem/standings?season=${season}&group_id=${OFFICIAL_GROUP_ID}&limit=5`,
    secret
  );
  if (!standings.res.ok || !standings.body?.ok) {
    fail('mods standings', `HTTP ${standings.res.status}`);
  } else {
    const count = standings.body.items?.length ?? 0;
    pass('mods standings', `${count} row(s) returned`);
  }

  const top = await modsFetch(
    `/pickem/standings/top?season=${season}&group_id=${OFFICIAL_GROUP_ID}`,
    secret
  );
  if (!top.res.ok || !top.body?.ok) {
    fail('mods standings/top', `HTTP ${top.res.status}`);
  } else {
    const count = top.body.items?.length ?? 0;
    pass('mods standings/top', `${count} row(s) returned`);
  }
};

const pickSlateGames = (games, count = SLATE_SIZE) => {
  const sorted = [...games].sort((a, b) =>
    String(a.kickoff_at).localeCompare(String(b.kickoff_at))
  );
  return sorted.slice(0, count);
};

const pickForWriteTest = (game) => {
  const away = game.away?.short ?? game.away_short ?? game.away_shortened ?? '';
  const home = game.home?.short ?? game.home_short ?? game.home_shortened ?? '';
  return away || home;
};

const checkWriteRoundTrip = async (secret, season, week, scoreboardGames) => {
  let gameIds = [];
  let slateGames = [];
  let skipSlatePut = false;

  if (scoreboardGames.length >= SLATE_SIZE) {
    slateGames = pickSlateGames(scoreboardGames);
    gameIds = slateGames.map((g) => String(g.id));
  }

  const existing = await modsFetch(
    `/pickem/slate?season=${season}&week=${week}&group_id=${OFFICIAL_GROUP_ID}`,
    secret
  );

  if (existing.res.ok && existing.body?.ok && existing.body.game_ids?.length === SLATE_SIZE) {
    gameIds = existing.body.game_ids.map(String);
    slateGames = await Promise.all(
      gameIds.map(async (id) => {
        const fromBoard = scoreboardGames.find((g) => String(g.id) === id);
        if (fromBoard) return fromBoard;
        const url = `${SCOREBOARD_API_BASE}/games/${id}?season=${scoreboardSeasonYear(season)}`;
        const { res, body } = await fetchJson(url);
        if (res.ok && body?.ok && body.item) return body.item;
        return { id, away: { short: '' }, kickoff_at: '' };
      })
    );
    skipSlatePut = true;
    pass(
      'mods slate (existing)',
      `Using ${SLATE_SIZE} game ids already stored for week ${week}`
    );
  }

  if (gameIds.length < SLATE_SIZE) {
    fail(
      'write round-trip',
      `Need ${SLATE_SIZE} games for week ${week}; scoreboard has ${scoreboardGames.length}, mods slate has ${gameIds.length}`,
      'Add games to pickem.games / selected_games for week 0, or load more on scoreboard'
    );
    return;
  }

  const allLocked = scoreboardGames.every(
    (g) => g.is_locked_for_picks === true || g.is_locked_for_picks === 1
  );
  if (week === 0 || allLocked) {
    skipSlatePut = true;
  }

  console.log('\n  Write test uses verify user and may update picks in MySQL.');
  console.log(`  Season ${season} week ${week}, games: ${gameIds.join(', ')}\n`);

  if (skipSlatePut) {
    pass(
      'mods slate PUT',
      week === 0
        ? 'Skipped for week 0 (games locked / slate already set on server)'
        : 'Skipped (using existing slate or locked games)'
    );
  } else {
    const saveSlate = await modsFetch('/pickem/slate', secret, {
      method: 'PUT',
      body: JSON.stringify({
        season,
        week,
        group_id: OFFICIAL_GROUP_ID,
        game_ids: gameIds,
      }),
    });

    if (!saveSlate.res.ok || !saveSlate.body?.ok) {
      fail(
        'mods slate PUT',
        `HTTP ${saveSlate.res.status}: ${JSON.stringify(saveSlate.body)}`,
        'Often "game not found" → run loadGames for this week on redditcfb (pickem.games.espn_id)'
      );
      return;
    }
    pass('mods slate PUT', `Saved ${SLATE_SIZE} game ids`);
  }

  const getSlate = await modsFetch(
    `/pickem/slate?season=${season}&week=${week}&group_id=${OFFICIAL_GROUP_ID}`,
    secret
  );
  if (!getSlate.res.ok || !getSlate.body?.ok) {
    fail('mods slate GET', `HTTP ${getSlate.res.status}`);
    return;
  }

  const returned = (getSlate.body.game_ids ?? []).map(String).sort();
  const expected = [...gameIds].sort();
  if (JSON.stringify(returned) !== JSON.stringify(expected)) {
    fail(
      'mods slate round-trip',
      `Expected ${expected.join(',')}; got ${returned.join(',')}`
    );
    return;
  }
  pass('mods slate GET', 'Round-trip game_ids match');

  const picks = slateGames.map((game, index) => ({
    game_id: String(game.id),
    pick: pickForWriteTest(game),
    points: index + 1,
  }));

  const missingPick = picks.find((p) => !p.pick);
  if (missingPick) {
    fail(
      'mods picks payload',
      `Scoreboard missing away short for game ${missingPick.game_id}`,
      'Team short names must match pickem.games away_shortened/home_shortened'
    );
    return;
  }

  const savePicks = await modsFetch('/pickem/picks', secret, {
    method: 'PUT',
    body: JSON.stringify({
      season,
      week,
      group_id: OFFICIAL_GROUP_ID,
      username: VERIFY_USERNAME,
      picks,
    }),
  });

  if (!savePicks.res.ok || !savePicks.body?.ok) {
    fail(
      'mods picks PUT',
      `HTTP ${savePicks.res.status}: ${JSON.stringify(savePicks.body)}`,
      'Pick team short names must match pickem.games away_shortened/home_shortened'
    );
    return;
  }
  pass('mods picks PUT', `Saved ${picks.length} picks for ${VERIFY_USERNAME}`);

  const getPicks = await modsFetch(
    `/pickem/picks/me?season=${season}&week=${week}&group_id=${OFFICIAL_GROUP_ID}&username=${encodeURIComponent(VERIFY_USERNAME)}`,
    secret
  );

  if (!getPicks.res.ok || !getPicks.body?.ok) {
    fail('mods picks GET', `HTTP ${getPicks.res.status}`);
    return;
  }

  const savedCount = getPicks.body.picks?.length ?? 0;
  if (savedCount !== SLATE_SIZE) {
    fail('mods picks round-trip', `Expected ${SLATE_SIZE} picks, got ${savedCount}`);
    return;
  }
  pass('mods picks GET', `${savedCount} picks returned for verify user`);
};

const printSummary = (opts) => {
  const failed = checks.filter((c) => !c.ok);
  const passed = checks.filter((c) => c.ok);

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          ok: failed.length === 0,
          passed: passed.length,
          failed: failed.length,
          checks,
        },
        null,
        2
      )
    );
    return;
  }

  console.log('\n--- Summary ---');
  console.log(`${passed.length} passed, ${failed.length} failed`);

  if (failed.length === 0) {
    console.log('\nPipeline looks wired. Remaining gate is Reddit HTTP domain approval for playtest.');
    console.log('Request mods.redditcfb.com in Developer Portal → re-upload → playtest E2E.');
    return;
  }

  console.log('\nFailed checks:');
  for (const check of failed) {
    console.log(`  • ${check.name}: ${check.detail}`);
    if (check.hint) console.log(`    ${check.hint}`);
  }
};

const main = async () => {
  const opts = parseArgs();

  if (!opts.json) {
    console.log('Pick \'Em pipeline verification (local, outside Devvit)\n');
  }

  checkDevvitConfig();

  if (!opts.secret) {
    fail(
      'mods secret',
      'No bearer token found',
      'Copy server secret to .mods-api-secret or pass --secret-file'
    );
    printSummary(opts);
    process.exit(1);
  }

  if (!opts.json && opts.secretFile) {
    console.log(`Using secret from ${opts.secretFile}\n`);
  }

  const modsUp = await checkModsHealth(opts.secret);
  if (!modsUp) {
    printSummary(opts);
    process.exit(1);
  }

  const meta = await checkModsAuth(opts.secret);
  if (!meta) {
    printSummary(opts);
    process.exit(1);
  }

  const season = opts.season ?? meta.current_season;
  const week = opts.week ?? meta.current_week;

  await checkModsReadEndpoints(opts.secret, season);

  const scoreboard = await checkScoreboard(season, week);
  if (scoreboard) {
    const locked = scoreboard.games.length - scoreboard.unlocked.length;
    if (scoreboard.games.length >= SLATE_SIZE) {
      pass(
        'scoreboard ↔ slate capacity',
        `${scoreboard.games.length} games on board (${scoreboard.unlocked.length} unlocked, ${locked} locked)`
      );
    } else {
      pass(
        'scoreboard ↔ slate capacity',
        `${scoreboard.games.length} games on scoreboard for week ${week} (slate needs ${SLATE_SIZE}; may use existing mods slate for --write)`
      );
    }
  }

  if (opts.write && scoreboard) {
    console.log('\n--write: round-trip slate + picks --');
    await checkWriteRoundTrip(opts.secret, season, week, scoreboard.games);
  } else if (!opts.write && !opts.json) {
    console.log('\nTip: run with --write to round-trip slate + picks against MySQL');
  }

  printSummary(opts);
  process.exit(checks.some((c) => !c.ok) ? 1 : 0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
