import { Router } from "express";
import type { IHealthResponse } from "./interfaces.js";

export const healthRouter = Router();

async function checkEspn(url: string, collectionKey: 'items' | 'sports'): Promise<'ok' | 'unavailable'> {
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (!response.ok) return 'unavailable';
        const data: unknown = await response.json();
        return typeof data === 'object' && data !== null &&
            Object.entries(data).some(([key, value]) => key === collectionKey && Array.isArray(value)) ? 'ok' : 'unavailable';
    } catch {
        return 'unavailable';
    }
}

/**
 * GET /health (this router is mounted at /health in index.ts).
 * Checks the ESPN Core and Site APIs in parallel, with a three-second timeout each.
 * Returns { status, checks: { api, espnCore, espnSite } } with 200 when all checks
 * pass, or 503 with status "degraded" if either ESPN probe fails.
 */
healthRouter.get("/", async (_req, res) => {
    const [espnCore, espnSite] = await Promise.all([
        checkEspn('http://sports.core.api.espn.com/v2/sports/soccer/leagues?limit=1', 'items'),
        checkEspn('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams?limit=1', 'sports'),
    ]);
    const healthy = espnCore === 'ok' && espnSite === 'ok';
    const result: IHealthResponse = {
        status: healthy ? 'ok' : 'degraded',
        checks: { api: 'ok', espnCore, espnSite },
    };
    res.status(healthy ? 200 : 503).json(result);
});
