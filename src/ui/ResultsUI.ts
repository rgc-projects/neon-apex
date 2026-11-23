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
  private readonly backMenuBtn = document.getElementById('btn-back-menu')!;

  constructor(callbacks: { onRaceAgain: () => void; onBackToMenu: () => void }) {
    this.raceAgainBtn.addEventListener('click', callbacks.onRaceAgain);
    this.backMenuBtn.addEventListener('click', callbacks.onBackToMenu);
  }

  public setVisible(visible: boolean): void {
    this.root.classList.toggle('active', visible);
  }

  public show(res: RaceResults): void {
    const rankStr = `${res.rank}${ordinalSuffix(res.rank).toUpperCase()}`;
    this.headlineEl.textContent =
      res.rank === 1
        ? '1ST PLACE VICTORY! // 冠军冲线'
        : res.rank <= 3
          ? `${rankStr} PLACE PODIUM! // 登上领奖台`
          : `FINISHED ${rankStr} // 完赛报告`;

    this.badgeEl.textContent = `#${res.rank}`;
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
      const timeLabel = s.finishTime !== null ? formatTime(s.finishTime) : 'RACING...';
      row.innerHTML = `
        <span class="mono" style="color:${s.rank === 1 ? '#ffb800' : '#00f2ff'}">#${s.rank}</span>
        <span class="color-swatch" style="background:${s.colorHex};color:${s.colorHex}"></span>
        <span>${s.name}${s.isPlayer ? ' (YOU)' : ''}</span>
        <span class="dim" style="font-size:11px">${s.carName}</span>
        <span class="mono" style="text-align:right">${timeLabel}</span>
      `;
      this.standingsEl.appendChild(row);
    }

    this.setVisible(true);
  }
}
