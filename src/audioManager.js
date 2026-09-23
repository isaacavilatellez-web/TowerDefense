export class AudioManager {
  constructor(save) { this.enabled = save.settings.sound; this.context = null; }
  ping(frequency = 420, duration = 0.06) {
    if (!this.enabled) return;
    try {
      this.context ||= new AudioContext();
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.035, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(); oscillator.stop(this.context.currentTime + duration);
    } catch (error) {
      this.enabled = false;
      console.warn('Audio opcional no disponible; la partida continuará sin sonido.', error);
    }
  }
}
