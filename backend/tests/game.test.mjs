import { afterEach, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';
import { app } from '../dist/index.js';
import { getLiveGame, mapGame, mapGameStatus } from '../dist/game.js';

const team = (id, name) => ({ id, displayName: name, abbreviation: name.slice(0, 3), logos: [{ href: `https://example.com/${id}.png`, rel: ['default'] }] });
function summary(state = 'post') {
  return {
    header: {
      id: '123', league: { name: 'Test League', slug: 'eng.1' }, season: { name: '2026-27' },
      competitions: [{
        date: '2026-10-22T14:00Z',
        status: { displayClock: "67'", period: 2, type: { state, completed: state === 'post', description: 'Test status' } },
        competitors: [
          { homeAway: 'away', id: '2', team: team('2', 'Away'), score: '1' },
          { homeAway: 'home', id: '1', team: team('1', 'Home'), score: '0' },
        ],
      }],
    },
    gameInfo: { venue: { fullName: 'Stadium', address: { city: 'London', country: 'England' } }, attendance: 30000 },
    boxscore: { teams: [{ team: { id: '1' }, statistics: [{ name: 'possessionPct', displayValue: '45.2' }, { name: 'saves', displayValue: '0' }] }] },
    keyEvents: [
      { id: 'e0', type: { type: 'kickoff' } },
      { id: 'e1', type: { type: 'goal' }, clock: { displayValue: "45+2'" }, team: { id: '2' }, participants: [{ athlete: { id: '7', displayName: 'Player' } }], ownGoal: true, penaltyKick: false },
      { id: 'e2', type: { type: 'yellow-card' } },
      { id: 'e3', type: { type: 'substitution' } },
      { id: 'e4', type: { type: 'red-card' } },
      { id: 'e5', type: { type: 'yellowred-card' } },
      { id: 'e6', type: { type: 'penalty---scored' } },
    ],
  };
}

afterEach(() => jest.restoreAllMocks());

describe('game response mapping', () => {
  test('identifies home/away by designation, preserves zero scores and excludes omitted fields', () => {
    const game = mapGame(summary());
    expect(game.homeTeam.id).toBe('1');
    expect(game.awayTeam.id).toBe('2');
    expect(game.homeTeamGoals).toBe(0);
    expect(game.awayTeamGoals).toBe(1);
    expect(game.status.type).toBe('FINISHED');
    expect(game.competition).toEqual({ name: 'Test League', slug: 'eng.1', season: '2026-27' });
    expect(game.venue).toEqual({ name: 'Stadium', city: 'London', country: 'England' });
    expect(game.statistics.homeTeam.possession).toBe(45.2);
    expect(game.statistics.homeTeam.saves).toBe(0);
    expect(game.statistics.awayTeam.shots).toBeNull();
    for (const field of ['lineups', 'attendance', 'referee']) expect(game).not.toHaveProperty(field);
  });

  test('scheduled games have null scores, not assumed zeroes', () => {
    const game = mapGame(summary('pre'));
    expect(game.homeTeamGoals).toBeNull();
    expect(game.awayTeamGoals).toBeNull();
    expect(game.status.type).toBe('SCHEDULED');
  });

  test('returns filtered timeline with enums, player IDs, stoppage time and goal flags', () => {
    const events = mapGame(summary()).timeline;
    expect(events.map((event) => event.type)).toEqual(['GOAL', 'YELLOW_CARD', 'RED_CARD', 'SECOND_YELLOW_CARD', 'GOAL']);
    expect(events[0]).toMatchObject({ minute: "45+2'", teamId: '2', players: [{ id: '7', name: 'Player' }], isOwnGoal: true, isPenalty: false });
    expect(events[4].isPenalty).toBe(true);
  });

  test.each(['POSTPONED', 'CANCELLED', 'ABANDONED', 'SUSPENDED'])('%s status takes precedence over state', (status) => {
    expect(mapGameStatus({ type: { name: `STATUS_${status}`, state: 'in' } })).toBe(status);
  });

  test('missing optional data produces null values and empty arrays', () => {
    const data = summary();
    delete data.gameInfo;
    delete data.keyEvents;
    delete data.boxscore;
    const game = mapGame(data);
    expect(game.venue).toBeNull();
    expect(game.timeline).toEqual([]);
    expect(Object.values(game.statistics.homeTeam).every((value) => value === null)).toBe(true);
  });
});

describe('GET /api/game/:eventId', () => {
  test('returns the formed game response', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(summary())));
    const response = await request(app).get('/api/game/123');
    expect(response.status).toBe(200);
    expect(response.body.eventId).toBe('123');
    expect(fetchMock.mock.calls[0][0]).toContain('soccer/all/summary?event=123');
  });

  test('rejects nonnumeric IDs without contacting ESPN', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    expect((await request(app).get('/api/game/abc')).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('returns 404 for a missing game', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }));
    expect((await request(app).get('/api/game/123')).status).toBe(404);
  });

  test.each(['http', 'network', 'json', 'shape'])('returns 502 for %s failures', async (failure) => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    if (failure === 'network') fetchMock.mockRejectedValue(new Error('Network failure'));
    else fetchMock.mockResolvedValue(new Response(failure === 'json' ? 'invalid json' : '{}', { status: failure === 'http' ? 503 : 200 }));
    expect((await request(app).get('/api/game/123')).status).toBe(502);
  });
});

describe('live game lookup', () => {
  test('finds a live game across competitions and returns the fixture format with current scores', async () => {
    const data = summary('in');
    const competition = data.header.competitions[0];
    jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ events: [{ id: '123', status: competition.status, competitions: [competition] }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify(data)));
    expect(await getLiveGame('1')).toEqual({ eventId: '123', date: competition.date, homeTeam: expect.objectContaining({ id: '1' }), awayTeam: expect.objectContaining({ id: '2' }), homeTeamGoals: 0, awayTeamGoals: 1 });
  });

  test('ignores other teams and finished fixtures; returns null', async () => {
    const data = summary();
    jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ events: [{ id: '123', status: data.header.competitions[0].status, competitions: data.header.competitions }] })));
    expect(await getLiveGame('1')).toBeNull();
  });

  test('checks yesterday for games continuing past midnight', async () => {
    const data = summary('in');
    jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ events: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ events: [{ id: '123', status: data.header.competitions[0].status, competitions: data.header.competitions }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify(data)));
    expect((await getLiveGame('1')).eventId).toBe('123');
  });
});
