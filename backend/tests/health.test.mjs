import { afterEach, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';
import { app } from '../dist/index.js';

afterEach(() => jest.restoreAllMocks());

const healthyResponse = (url) => new Response(JSON.stringify(url.includes('sports.core.api') ? { items: [] } : { sports: [] }));

describe('GET /health', () => {
  test('checks both ESPN APIs with timeouts and reports available dependencies', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => healthyResponse(url));
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', checks: { api: 'ok', espnCore: 'ok', espnSite: 'ok' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.some(([url]) => url.startsWith('http://sports.core.api.espn.com/'))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => url.startsWith('https://site.api.espn.com/'))).toBe(true);
    for (const [, options] of fetchMock.mock.calls) expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  test.each(['core', 'site'])('reports the failed %s API without hiding the healthy dependency', async (dependency) => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const failed = url.includes(dependency === 'core' ? 'sports.core.api' : 'site.api');
      return failed ? new Response('{}', { status: 503 }) : healthyResponse(url);
    });
    const response = await request(app).get('/health');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'degraded', checks: {
      api: 'ok', espnCore: dependency === 'core' ? 'unavailable' : 'ok', espnSite: dependency === 'site' ? 'unavailable' : 'ok',
    } });
  });

  test.each(['network', 'timeout', 'json', 'shape'])('reports unavailable dependencies for %s failures', async (failure) => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      if (failure === 'network') throw new Error('Connection failed');
      if (failure === 'timeout') throw new DOMException('Timed out', 'TimeoutError');
      return new Response(failure === 'json' ? '<html>not json</html>' : '{}');
    });
    const response = await request(app).get('/health');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'degraded', checks: { api: 'ok', espnCore: 'unavailable', espnSite: 'unavailable' } });
  });

  test('starts both probes before either finishes', async () => {
    const pending = [];
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation((url) => new Promise((resolve) => {
      pending.push(() => resolve(healthyResponse(url)));
      if (pending.length === 2) pending.forEach((finish) => finish());
    }));
    const response = await request(app).get('/health');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
  });
});
