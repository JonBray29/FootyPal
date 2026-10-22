# FootyPal backend API

Express API that provides supported leagues, teams and match information from ESPN.
The default base URL is `http://localhost:3000`. Set `PORT` to change the port.
All successful responses are JSON. Team and event IDs are numeric **strings**;
league identifiers are slugs such as `eng.1`.

## Running the backend

Run these commands from the repository root:

```sh
pnpm install
pnpm --filter @footypal/backend dev
```

To build and run the compiled server:

```sh
pnpm --filter @footypal/backend build
pnpm --filter @footypal/backend start
```

Run Jest tests with `pnpm --filter @footypal/backend test`. The test command builds
the backend first. Integration tests contact ESPN, including checking every
supported league and its returned team IDs, so they need network access and can
take time. The game mapping tests use mocked ESPN responses.

## Typical client flow

1. Request `/api/leagues` and let the user select a league.
2. Request `/api/leagues/:slug/teams` and let the user select a team.
3. Request `/api/teams/:teamId` to display the team profile, standings and fixtures.
4. Use a fixture's `eventId` with `/api/game/:eventId` for the match detail view.

Fixtures already contain compact home/away team details, including logos. There
is no separate `/simple` endpoint.

## Endpoints

| Method | Path | Response |
| --- | --- | --- |
| GET | `/health` | API and ESPN availability |
| GET | `/api/leagues` | Supported league array |
| GET | `/api/leagues/:slug/teams` | Team array for a supported league |
| GET | `/api/teams/:teamId` | Team profile, standings and fixtures |
| GET | `/api/game/:eventId` | Match details, statistics and timeline |

Examples below illustrate the response shapes. Dates, scores and statistics are
sample values, not current results. Arrays are shortened for readability; actual
responses contain all returned entries.

### GET /health

Example: `http://localhost:3000/health`

Checks that the API is running and that both ESPN APIs return successful,
usable JSON responses. Every health request runs these probes in parallel, each
with a three-second timeout:

| Check | ESPN request | Required response |
| --- | --- | --- |
| `espnCore` | `http://sports.core.api.espn.com/v2/sports/soccer/leagues?limit=1` | Successful HTTP response with valid JSON containing an `items` array |
| `espnSite` | `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams?limit=1` | Successful HTTP response with valid JSON containing a `sports` array |

An empty array passes the probe. This checks whether the two services return the
expected collection format; it does not verify every route, league or team.

| Response field | Possible values | Meaning |
| --- | --- | --- |
| `status` | `ok`, `degraded` | Overall availability; `degraded` means at least one ESPN check failed |
| `checks.api` | `ok` | The FootyPal API process is responding |
| `checks.espnCore` | `ok`, `unavailable` | Availability of the ESPN Core API |
| `checks.espnSite` | `ok`, `unavailable` | Availability of the ESPN Site API |

Returns HTTP `200` when both ESPN probes succeed:

```json
{
  "status": "ok",
  "checks": {
    "api": "ok",
    "espnCore": "ok",
    "espnSite": "ok"
  }
}
```

If a probe times out, cannot connect, returns a non-success HTTP status or returns
unusable JSON, the endpoint returns HTTP `503`. For example, if only the Site API
is unavailable:

```json
{
  "status": "degraded",
  "checks": {
    "api": "ok",
    "espnCore": "ok",
    "espnSite": "unavailable"
  }
}
```

The `api` check stays `ok` because the API process is responding; `degraded`
identifies a dependency failure. Both ESPN checks can be `unavailable` at the same
time. Clients should read the JSON response on HTTP `503` to see which service
failed. If the FootyPal process itself is down, this endpoint cannot respond.

### GET /api/leagues

Example: `http://localhost:3000/api/leagues`

Returns the configured supported leagues. `slug` is the value needed for the
league teams endpoint. `ref` is the ESPN Core API reference for the league.

```json
[
  {
    "name": "Premier League",
    "slug": "eng.1",
    "ref": "http://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.1"
  },
  {
    "name": "EFL Championship",
    "slug": "eng.2",
    "ref": "http://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.2"
  }
]
```

### GET /api/leagues/:slug/teams

Example: `http://localhost:3000/api/leagues/eng.2/teams`

Returns each team's ESPN ID, name, abbreviation and available logo variants.
Logo metadata comes from ESPN and can include dimensions, alternative text and
`rel` tags such as `default` or `dark`. An unavailable abbreviation is `null`;
missing logos produce an empty array.

```json
[
  {
    "id": "374",
    "name": "Derby County",
    "abbreviation": "DER",
    "logos": [
      {
        "href": "https://a.espncdn.com/i/teamlogos/soccer/500/374.png",
        "width": 500,
        "height": 500,
        "alt": "",
        "rel": ["full", "default"]
      }
    ]
  }
]
```

### GET /api/teams/:teamId

Example: `http://localhost:3000/api/teams/374`

Returns a team profile and its league context. No league parameter is needed;
the backend reads the team's default league from ESPN.

```json
{
  "id": "374",
  "name": "Derby County",
  "shortName": "Derby",
  "abbreviation": "DER",
  "nickname": "Rams",
  "location": "Derby County",
  "logos": [
    {
      "href": "https://a.espncdn.com/i/teamlogos/soccer/500/374.png",
      "rel": ["full", "default"]
    }
  ],
  "colors": { "primary": "#ffffff", "secondary": "#000000" },
  "isActive": true,
  "form": "WDLWW",
  "venue": {
    "id": "1",
    "name": "Pride Park Stadium",
    "city": "Derby",
    "country": "England"
  },
  "leagueRef": "http://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.2?lang=en&region=us",
  "recordRef": "http://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.2/seasons/2026/types/1/teams/374/record?lang=en&region=us",
  "eventsRef": "http://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.2/seasons/2026/teams/374/events?lang=en&region=us",
  "standings": [
    {
      "position": 6,
      "positionType": "PLAYOFF",
      "teamName": "Derby County",
      "gamesPlayed": 10,
      "won": 5,
      "drew": 3,
      "lost": 2,
      "goalsFor": 16,
      "goalsAgainst": 10,
      "goalDifference": 6,
      "points": 18
    }
  ],
  "liveGame": null,
  "previousMatches": [
    {
      "eventId": "401880337",
      "date": "2026-08-15T14:00Z",
      "homeTeam": {
        "id": "372",
        "name": "Charlton Athletic",
        "abbreviation": "CHA",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/372.png"
      },
      "awayTeam": {
        "id": "374",
        "name": "Derby County",
        "abbreviation": "DER",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/374.png"
      },
      "homeTeamGoals": 2,
      "awayTeamGoals": 1
    }
  ],
  "upcomingFixtures": [
    {
      "eventId": "401880338",
      "date": "2026-10-24T14:00Z",
      "homeTeam": {
        "id": "374",
        "name": "Derby County",
        "abbreviation": "DER",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/374.png"
      },
      "awayTeam": {
        "id": "372",
        "name": "Charlton Athletic",
        "abbreviation": "CHA",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/372.png"
      }
    }
  ],
  "links": [
    {
      "href": "https://www.espn.com/soccer/club/_/id/374/derby-county",
      "text": "Clubhouse"
    }
  ]
}
```

- `location` is ESPN's team label; it is not necessarily the club's city.
- `form` is ESPN's form string, using `W`, `D` and `L` for wins, draws and losses.
- Colours include the CSS `#` prefix; missing or invalid colours are `null`.
- `standings` contains league table rows. The backend maps ESPN's notes to the
  `positionType` enum; it does not calculate qualification or relegation rules.
- `previousMatches` is ordered newest first. The results request currently uses
  the current UTC calendar year as ESPN's season parameter.
- `upcomingFixtures` is ordered soonest first and uses the team's current Core
  API season event list. Fixture goals are optional and omitted for upcoming games.
- `liveGame` uses the same fixture object as the arrays, with available current
  scores. It is `null` when no live match is found. The live lookup searches all
  competitions on today's and yesterday's UTC scoreboards, including cup matches.
  A live fixture is excluded from the previous/upcoming arrays.
- Fixture team objects have `{ id, name, abbreviation, logo }`; `logo` is one URL
  or `null`, whereas the main profile's `logos` contains all available variants.
- The `*Ref` fields are ESPN URLs for clients that need the underlying resources.
- Optional profile values can be `null`, and collections can be empty where no
  data is available. Results and upcoming fixtures are drawn from the default
  league's season sources, rather than a combined schedule across competitions.

`positionType` values:

```text
NONE, CHAMPIONS_LEAGUE, EUROPA_LEAGUE, CONFERENCE_LEAGUE,
PROMOTION, PLAYOFF, RELEGATION, OTHER
```

`NONE` means ESPN supplied no position note. `OTHER` means it supplied a note
that did not match the known categories.

### GET /api/game/:eventId

Example: `http://localhost:3000/api/game/401880337`

Returns match details using only an ESPN event ID. Both sides use the compact
team format shared by fixtures. Timeline entries include goals and cards.

```json
{
  "eventId": "401880337",
  "date": "2026-08-15T14:00Z",
  "competition": {
    "name": "English League Championship",
    "slug": "eng.2",
    "season": "2026-27 English League Championship, Regular Season"
  },
  "status": {
    "type": "FINISHED",
    "description": "Full Time",
    "clock": "FT",
    "period": null
  },
  "homeTeam": {
    "id": "372",
    "name": "Charlton Athletic",
    "abbreviation": "CHA",
    "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/372.png"
  },
  "awayTeam": {
    "id": "374",
    "name": "Derby County",
    "abbreviation": "DER",
    "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/374.png"
  },
  "homeTeamGoals": 2,
  "awayTeamGoals": 1,
  "venue": { "name": "The Valley", "city": "London", "country": "England" },
  "statistics": {
    "homeTeam": {
      "possession": 45.2,
      "shots": 13,
      "shotsOnTarget": 4,
      "corners": 5,
      "fouls": 7,
      "offsides": 0,
      "saves": 3,
      "yellowCards": 0,
      "redCards": 0
    },
    "awayTeam": {
      "possession": 54.8,
      "shots": 11,
      "shotsOnTarget": 4,
      "corners": 3,
      "fouls": 9,
      "offsides": 1,
      "saves": 2,
      "yellowCards": 1,
      "redCards": 0
    }
  },
  "timeline": [
    {
      "id": "50879231",
      "type": "GOAL",
      "minute": "23'",
      "teamId": "374",
      "players": [
        { "id": "223547", "name": "Sammie Szmodics" },
        { "id": "194823", "name": "Carlton Morris" }
      ],
      "description": "Sammie Szmodics Goal",
      "isOwnGoal": false,
      "isPenalty": false
    }
  ]
}
```

- `status.type` is a string enum. `description` is ESPN's readable status;
  `clock` is ESPN's display clock or short status detail, so it can contain
  values such as `67'`, `HT` or `FT`. `period` can be `null`.
- Scheduled matches have `null` scores, rather than an assumed `0–0`.
- Statistics are numbers, or `null` when unavailable. Possession is expressed
  as a percentage such as `45.2`, not a fraction such as `0.452`.
- Timeline `minute` preserves ESPN's display value, including stoppage time.
  `players` lists the participants ESPN supplies; their order does not assign
  explicit scorer/assist roles. `isOwnGoal` and `isPenalty` identify goal flags.
- Missing venue data is `null`; missing timeline data is an empty array.
- The response excludes substitutions, lineups, attendance and referee details.

Game status values:

```text
SCHEDULED, LIVE, FINISHED, POSTPONED, CANCELLED, ABANDONED, SUSPENDED, UNKNOWN
```

Timeline event types:

```text
GOAL, YELLOW_CARD, RED_CARD, SECOND_YELLOW_CARD
```

## Errors

League, team and game error responses use `{ "error": "message" }`. Health
dependency failures return HTTP `503` with the health response shown above.

| Endpoint | Status | Message |
| --- | --- | --- |
| Health | 503 | Health JSON with `status: "degraded"` and per-service checks |
| League teams | 404 | `League not found` |
| League teams | 502 | `Unable to retrieve teams from ESPN` |
| Team details | 400 | `Team ID must be numeric` |
| Team details | 404 | `Team not found` |
| Team details | 502 | `Unable to retrieve team details from ESPN` |
| Game details | 400 | `Event ID must be numeric` |
| Game details | 404 | `Game not found` |
| Game details | 502 | `Unable to retrieve game details from ESPN` |

For example, `GET /api/teams/derby` returns HTTP `400`:

```json
{
  "error": "Team ID must be numeric"
}
```

The `404` responses for teams and games reflect an ESPN `404`. Other upstream
errors, timeouts or unusable responses produce `502`. Team details combine
several ESPN requests, so failure of a required request can fail the overall
response. The league list does not require ESPN access; health now does.

## Source files

- `src/index.ts`: Express app and league, team and game route handlers.
- `src/health.ts`: health router, mounted at `/health`.
- `src/server.ts`: starts the HTTP listener.
- `src/game.ts`: ESPN game lookup, response mapping and live-game lookup.
- `src/constants.ts`: configured supported leagues.
- `src/interfaces.ts`: FootyPal response interfaces and enums.
- `src/espn-interfaces.ts`: interfaces for upstream ESPN payloads.
