import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { app } from '../dist/index.js';
import { SUPPORTED_LEAGUES } from '../dist/constants.js';

let server;
let baseUrl;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe('API routes', () => {
  test('GET /health returns healthy status', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  test('GET /api/leagues returns every configured league', async () => {
    const response = await fetch(`${baseUrl}/api/leagues`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SUPPORTED_LEAGUES);
  });

  test('GET /api/leagues/:slug/teams rejects unsupported leagues', async () => {
    const response = await fetch(`${baseUrl}/api/leagues/not-a-league/teams`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'League not found' });
  });

  test('GET /api/teams/:teamId validates numeric IDs', async () => {
    const response = await fetch(`${baseUrl}/api/teams/not-numeric`);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Team ID must be numeric' });
  });

  test('GET /api/teams/:teamId returns 404 for an unknown team', async () => {
    const response = await fetch(`${baseUrl}/api/teams/999999999`);
    expect(response.status).toBe(404);
  });
});

describe('ESPN reachability for configured leagues and teams', () => {
  jest.setTimeout(600000);

  test.each(SUPPORTED_LEAGUES)('$name ($slug) returns teams with IDs and names', async (league) => {
    const response = await fetch(`${baseUrl}/api/leagues/${league.slug}/teams`);
    expect(response.status).toBe(200);
    const teams = await response.json();
    expect(Array.isArray(teams)).toBe(true);
    expect(teams.length).toBeGreaterThan(0);
    for (const team of teams) {
      expect(team.id).toMatch(/^\d+$/);
      expect(team.name).toEqual(expect.any(String));
      expect(Array.isArray(team.logos)).toBe(true);
    }
  });

  test('team detail endpoint reaches ESPN for every team in every configured league', async () => {
    for (const league of SUPPORTED_LEAGUES) {
      const listResponse = await fetch(`${baseUrl}/api/leagues/${league.slug}/teams`);
      expect(listResponse.status).toBe(200);
      const teams = await listResponse.json();

      for (let index = 0; index < teams.length; index += 8) {
        const results = await Promise.all(teams.slice(index, index + 8).map(async (team) => {
          const response = await fetch(`${baseUrl}/api/teams/${team.id}`);
          return { team, response, details: response.ok ? await response.json() : null };
        }));
        for (const { team, response, details } of results) {
          expect(response.status).toBe(200);
          expect(details.id).toBe(team.id);
          expect(details.name).toEqual(expect.any(String));
          expect(Array.isArray(details.logos)).toBe(true);
          expect([details.colors.primary, details.colors.secondary].every((value) => value === null || typeof value === 'string')).toBe(true);
          expect(Array.isArray(details.links)).toBe(true);
        }
      }
    }
  });
});
