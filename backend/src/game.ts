import { GameEventType, GameStatus, type IGame, type IGameStatistics, type ITeamFixture, type ITeamSimple } from './interfaces.js';
import type { IEspnGameKeyEvent, IEspnGameStatus, IEspnGameSummaryResponse, IEspnGameTeamStatistics, IEspnScoreboardResponse, IEspnTeam } from './espn-interfaces.js';

export class GameNotFoundError extends Error {}

export function mapGameStatus(status?: IEspnGameStatus): GameStatus {
  const name = status?.type?.name?.toLowerCase() ?? '';
  if (name.includes('postpon')) return GameStatus.POSTPONED;
  if (name.includes('cancel')) return GameStatus.CANCELLED;
  if (name.includes('abandon')) return GameStatus.ABANDONED;
  if (name.includes('suspend')) return GameStatus.SUSPENDED;
  if (status?.type?.completed) return GameStatus.FINISHED;
  if (status?.type?.state === 'in') return GameStatus.LIVE;
  if (status?.type?.state === 'pre') return GameStatus.SCHEDULED;
  return GameStatus.UNKNOWN;
}

function compactTeam(team?: IEspnTeam): ITeamSimple {
  if (!team?.id) throw new Error('ESPN game is missing a team');
  return {
    id: team.id,
    name: team.displayName ?? team.name ?? '',
    abbreviation: team.abbreviation ?? null,
    logo: team.logos?.find((logo) => logo.rel?.includes('default'))?.href ?? team.logos?.[0]?.href ?? team.logo ?? null,
  };
}

function numeric(value?: string | number): number | null {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const result = Number(String(value).replace('%', ''));
  return Number.isFinite(result) ? result : null;
}

function statistics(teamId: string, data?: IEspnGameTeamStatistics[]): IGameStatistics {
  const stats = data?.find((item) => item.team?.id === teamId)?.statistics;
  const value = (name: string) => numeric(stats?.find((stat) => stat.name === name)?.displayValue);
  return {
    possession: value('possessionPct'), shots: value('totalShots'), shotsOnTarget: value('shotsOnTarget'),
    corners: value('wonCorners'), fouls: value('foulsCommitted'), offsides: value('offsides'),
    saves: value('saves'), yellowCards: value('yellowCards'), redCards: value('redCards'),
  };
}

function timelineType(event: IEspnGameKeyEvent): GameEventType | null {
  const type = `${event.type?.type ?? ''} ${event.type?.text ?? ''}`.toLowerCase().replace(/[-_]/g, ' ');
  if (type.includes('second yellow') || type.includes('yellowred') || type.includes('yellow red')) return GameEventType.SECOND_YELLOW_CARD;
  if (type.includes('red card')) return GameEventType.RED_CARD;
  if (type.includes('yellow card')) return GameEventType.YELLOW_CARD;
  if (type.includes('goal') || (type.includes('penalty') && type.includes('scored'))) return GameEventType.GOAL;
  return null;
}

export function mapGame(data: IEspnGameSummaryResponse): IGame {
  const header = data.header;
  const competition = header?.competitions?.[0];
  if (!header?.id || !competition) throw new Error('Invalid ESPN game summary');
  const home = competition.competitors?.find((team) => team.homeAway === 'home');
  const away = competition.competitors?.find((team) => team.homeAway === 'away');
  const homeTeam = compactTeam(home?.team);
  const awayTeam = compactTeam(away?.team);
  const status = mapGameStatus(competition.status);
  const scoresAvailable = status === GameStatus.LIVE || status === GameStatus.FINISHED || status === GameStatus.SUSPENDED || status === GameStatus.ABANDONED;
  const venue = data.gameInfo?.venue;
  return {
    eventId: header.id,
    date: competition.date ?? null,
    competition: { name: header.league?.name ?? null, slug: header.league?.slug ?? null, season: header.season?.name ?? null },
    status: {
      type: status, description: competition.status?.type?.description ?? null,
      clock: competition.status?.displayClock ?? competition.status?.type?.shortDetail ?? null,
      period: competition.status?.period ?? null,
    },
    homeTeam, awayTeam,
    homeTeamGoals: scoresAvailable ? numeric(home?.score) : null,
    awayTeamGoals: scoresAvailable ? numeric(away?.score) : null,
    venue: venue ? { name: venue.fullName ?? null, city: venue.address?.city ?? null, country: venue.address?.country ?? null } : null,
    statistics: { homeTeam: statistics(homeTeam.id, data.boxscore?.teams), awayTeam: statistics(awayTeam.id, data.boxscore?.teams) },
    timeline: (data.keyEvents ?? []).flatMap((event) => {
      const type = timelineType(event);
      if (!type) return [];
      const name = event.type?.type?.toLowerCase() ?? '';
      return [{
        id: event.id ?? null, type, minute: event.clock?.displayValue ?? null, teamId: event.team?.id ?? null,
        players: (event.participants ?? []).map(({ athlete }) => ({ id: athlete?.id ?? null, name: athlete?.displayName ?? null })),
        description: event.shortText ?? event.text ?? null,
        isOwnGoal: event.ownGoal ?? name.includes('own-goal'),
        isPenalty: event.penaltyKick ?? name.includes('penalty'),
      }];
    }),
  };
}

export async function getGame(eventId: string): Promise<IGame> {
  const response = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${encodeURIComponent(eventId)}`,
    { signal: AbortSignal.timeout(10000) },
  );
  if (response.status === 404) throw new GameNotFoundError('Game not found');
  if (!response.ok) throw new Error('ESPN game summary failed');
  const data: IEspnGameSummaryResponse = await response.json();
  return mapGame(data);
}

export async function getLiveGame(teamId: string): Promise<ITeamFixture | null> {
  // Include yesterday to cover fixtures that continue past midnight UTC.
  const dates = [new Date(), new Date(Date.now() - 86400000)].map((date) => date.toISOString().slice(0, 10).replace(/-/g, ''));
  for (const date of dates) {
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${date}&limit=1000`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) throw new Error('ESPN live scoreboard failed');
    const data: IEspnScoreboardResponse = await response.json();
    const live = data.events?.find((event) => {
      const competition = event.competitions?.[0];
      return mapGameStatus(event.status ?? competition?.status) === GameStatus.LIVE &&
        competition?.competitors?.some((competitor) => (competitor.team?.id ?? competitor.id) === teamId);
    });
    if (live?.id) {
      const game = await getGame(live.id);
      if (game.status.type !== GameStatus.LIVE) continue;
      return {
        eventId: game.eventId, date: game.date, homeTeam: game.homeTeam, awayTeam: game.awayTeam,
        ...(game.homeTeamGoals !== null ? { homeTeamGoals: game.homeTeamGoals } : {}),
        ...(game.awayTeamGoals !== null ? { awayTeamGoals: game.awayTeamGoals } : {}),
      };
    }
  }
  return null;
}
