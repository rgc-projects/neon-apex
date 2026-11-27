import { i18n, t } from '../i18n/i18n';
import { RaceResults } from '../types';
import { formatTime, ordinalSuffix } from '../utils/math';

export class ResultsUI {
  private readonly root = document.getElementById('results-overlay')!;
  private readonly headlineEl = document.getElementById('results-headline')!;
  private readonly badgeEl = document.getElementById('results-rank-badge')!;
  private readonly totalTimeEl = document.getElementById('res-total-time')!;
  private readonly bestLapEl = document.getElementById('res-best-lap')!;
  private readonly topSpeedEl = document.getElementById('res-top-speed')!;
  private readonly longestDriftEl = document.getElementById('res-longest-drift')!;
  private readonly airTimeEl = document.getElementById('res-air-time')!;
  private readonly styleScoreEl = document.getElementById('res-style-score')!;
  private readonly standingsEl = document.getElementById('results-standings')!;

  private readonly raceAgainBtn = document.getElementById('btn-race-again')!;
  private readonly nextTrackBtn = document.getElementById('btn-results-next-track');
  private readonly backMenuBtn = document.getElementById('btn-back-menu')!;
  private readonly recordBannerEl = document.getElementById('results-record-banner');
  private lastResults: RaceResults | null = null;

  constructor(callbacks: { onRaceAgain: () => void; onNextTrack?: () => void; onBackToMenu: () => void }) {
    this.raceAgainBtn.addEventListener('click', callbacks.onRaceAgain);
    this.nextTrackBtn?.addEventListener('click', () => callbacks.onNextTrack?.());
    this.backMenuBtn.addEventListener('click', callbacks.onBackToMenu);

    i18n.subscribe(() => {
      if (this.lastResults && this.root.classList.contains('active')) {
        this.render(this.lastResults);
      }
    });
  }

  public setVisible(visible: boolean): void {
    this.root.classList.toggle('active', visible);
  }

  public show(res: RaceResults): void {
    this.lastResults = res;
    this.render(res);
    this.setVisible(true);
  }

  private render(res: RaceResults): void {
    const rankStr = i18n.isZh
      ? String(res.rank)
      : `${res.rank}${ordinalSuffix(res.rank).toUpperCase()}`;

    this.headlineEl.textContent =
      res.rank === 1
        ? t('resultsWin')
        : res.rank <= 3
          ? t('resultsPodium', { rank: rankStr })
          : t('resultsFinished', { rank: rankStr });

    this.badgeEl.textContent = `#${res.rank}`;
    if (this.recordBannerEl) {
      if (res.isNewBestLap) {
        this.recordBannerEl.textContent = t('resNewBestLap');
        this.recordBannerEl.classList.remove('hidden');
      } else if (res.isNewBestRace) {
        this.recordBannerEl.textContent = t('resNewRecord');
        this.recordBannerEl.classList.remove('hidden');
      } else {
        this.recordBannerEl.classList.add('hidden');
      }
    }
    this.totalTimeEl.textContent = formatTime(res.totalTime);
    this.bestLapEl.textContent = res.bestLapTime !== null ? formatTime(res.bestLapTime) : '--:--.--';
    this.topSpeedEl.textContent = `${Math.round(res.topSpeedKmh)} KM/H`;
    this.longestDriftEl.textContent = `${Math.round(res.longestDriftMeters)} m`;
    this.airTimeEl.textContent = `${res.totalAirTime.toFixed(1)} s`;
    this.styleScoreEl.textContent = res.styleScore.toLocaleString();

    this.standingsEl.innerHTML = '';
    for (const s of res.standings) {
      const row = document.createElement('div');
      row.className = `standing-row ${s.isPlayer ? 'player' : ''}`;
      const timeLabel = s.finishTime !== null ? formatTime(s.finishTime) : t('resRacing');
      const displayName = s.isPlayer ? `${t('resPlayerName')}${t('resYou')}` : s.name;
      row.innerHTML = `
        <span class="mono" style="color:${s.rank === 1 ? '#ffb800' : '#00f2ff'}">#${s.rank}</span>
        <span class="color-swatch" style="background:${s.colorHex};color:${s.colorHex}"></span>
        <span>${displayName}</span>
        <span class="dim" style="font-size:11px">${s.carName}</span>
        <span class="mono" style="text-align:right">${timeLabel}</span>
      `;
      this.standingsEl.appendChild(row);
    }
  }
}
