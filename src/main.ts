import { GameEngine } from './game/GameEngine';
import { ensurePrivacyConsent } from './ui/PrivacyModal';

window.addEventListener('DOMContentLoaded', () => {
  ensurePrivacyConsent(() => {
    new GameEngine();
  });
});
