export type TrophyTier = 'gold' | 'silver' | 'bronze' | null;

export interface TrackRecord {
  bestLapTime: number | null;
  bestRaceTime: number | null;
  bestRank: number;
  topSpeedKmh: number;
  racesCompleted: number;
  bestLapsCount: number;
}

export interface RecordSubmissionResult {
  isNewBestLap: boolean;
  isNewBestRace: boolean;
  isNewBestRank: boolean;
  previousBestLap: number | null;
  trophy: TrophyTier;
}

const STORAGE_KEY = 'neon_apex_records_v1';

export function rankToTrophy(rank: number): TrophyTier {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return null;
}

export function trophyIcon(tier: TrophyTier): string {
  if (tier === 'gold') return '🥇';
  if (tier === 'silver') return '🥈';
  if (tier === 'bronze') return '🥉';
  return '';
}

class RecordsManagerImpl {
  private records: Record<string, TrackRecord> = {};
  private readonly listeners = new Set<() => void>();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, Partial<TrackRecord>>;
      if (!parsed || typeof parsed !== 'object') return;
      for (const [id, rec] of Object.entries(parsed)) {
        if (!rec || typeof rec !== 'object') continue;
        this.records[id] = {
          bestLapTime: typeof rec.bestLapTime === 'number' && Number.isFinite(rec.bestLapTime) ? rec.bestLapTime : null,
          bestRaceTime: typeof rec.bestRaceTime === 'number' && Number.isFinite(rec.bestRaceTime) ? rec.bestRaceTime : null,
          bestRank: typeof rec.bestRank === 'number' && rec.bestRank >= 1 ? Math.round(rec.bestRank) : 6,
          topSpeedKmh: typeof rec.topSpeedKmh === 'number' && Number.isFinite(rec.topSpeedKmh) ? rec.topSpeedKmh : 0,
          racesCompleted: typeof rec.racesCompleted === 'number' && rec.racesCompleted >= 0 ? Math.round(rec.racesCompleted) : 0,
          bestLapsCount: typeof rec.bestLapsCount === 'number' && rec.bestLapsCount >= 1 ? Math.round(rec.bestLapsCount) : 1,
        };
      }
    } catch {
      this.records = {};
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch {
      // Ignore storage quota errors
    }
  }

  private emit(): void {
    this.save();
    for (const cb of this.listeners) cb();
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public getTrackRecord(trackId: string): TrackRecord | null {
    return this.records[trackId] ?? null;
  }

  public getTrophy(trackId: string): TrophyTier {
    const rec = this.records[trackId];
    return rec ? rankToTrophy(rec.bestRank) : null;
  }

  public getTrophyStats(trackIds: string[]): { gold: number; podium: number; total: number } {
    let gold = 0;
    let podium = 0;
    for (const id of trackIds) {
      const tier = this.getTrophy(id);
      if (tier === 'gold') {
        gold++;
        podium++;
      } else if (tier === 'silver' || tier === 'bronze') {
        podium++;
      }
    }
    return { gold, podium, total: trackIds.length };
  }

  public submitResult(
    trackId: string,
    params: {
      rank: number;
      totalTime: number;
      bestLapTime: number | null;
      topSpeedKmh: number;
      laps: number;
    }
  ): RecordSubmissionResult {
    const prev = this.records[trackId];
    const previousBestLap = prev?.bestLapTime ?? null;

    const validLap =
      params.bestLapTime !== null && Number.isFinite(params.bestLapTime) && params.bestLapTime > 3
        ? params.bestLapTime
        : null;

    const isNewBestLap =
      validLap !== null && (previousBestLap === null || validLap < previousBestLap - 0.005);

    const sameOrHigherLaps = !prev || params.laps === prev.bestLapsCount;
    const isNewBestRace =
      Number.isFinite(params.totalTime) &&
      params.totalTime > 3 &&
      (!prev ||
        prev.bestRaceTime === null ||
        (sameOrHigherLaps && params.totalTime < prev.bestRaceTime - 0.005));

    const isNewBestRank = !prev || params.rank < prev.bestRank;

    this.records[trackId] = {
      bestLapTime: isNewBestLap ? validLap : previousBestLap,
      bestRaceTime: isNewBestRace ? params.totalTime : (prev?.bestRaceTime ?? params.totalTime),
      bestRank: prev ? Math.min(prev.bestRank, params.rank) : params.rank,
      topSpeedKmh: Math.max(prev?.topSpeedKmh ?? 0, Math.round(params.topSpeedKmh)),
      racesCompleted: (prev?.racesCompleted ?? 0) + 1,
      bestLapsCount: isNewBestRace ? params.laps : (prev?.bestLapsCount ?? params.laps),
    };

    this.emit();

    return {
      isNewBestLap,
      isNewBestRace,
      isNewBestRank,
      previousBestLap,
      trophy: rankToTrophy(this.records[trackId].bestRank),
    };
  }
}

export const recordsManager = new RecordsManagerImpl();
