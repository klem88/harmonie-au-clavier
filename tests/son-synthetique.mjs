// Outils de test : son de piano synthétique (fondamentale faible, harmoniques, extinction), FFT, trames mains ensemble.
import { trameEnsemble } from '../src/verification.js';

export const SR = 48000;
export const FFT = 4096;
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const PARTIELS = [0.35, 1, 0.6, 0.45, 0.3, 0.2]; // le grave du piano et le micro du téléphone rendent mal la fondamentale

// evenements : [{ tMs, midi, dureeMs, gain = 1 }]
export function synthetiser(evenements, dureeMs) {
  const n = Math.round((dureeMs / 1000) * SR);
  const buf = new Float32Array(n);
  for (const e of evenements) {
    const d0 = Math.round((e.tMs / 1000) * SR);
    const fin = Math.min(n, Math.round(((e.tMs + e.dureeMs + 40) / 1000) * SR));
    const g = 0.08 * (e.gain ?? 1);
    for (let i = Math.max(0, d0); i < fin; i++) {
      const t = (i - d0) / SR;
      const attaque = Math.min(1, t / 0.005);
      const relache = t * 1000 > e.dureeMs ? Math.max(0, 1 - (t * 1000 - e.dureeMs) / 40) : 1;
      let v = 0;
      for (let k = 0; k < PARTIELS.length; k++) v += PARTIELS[k] * Math.sin(2 * Math.PI * hz(e.midi) * (k + 1) * t);
      buf[i] += g * attaque * relache * Math.exp(-t / 0.6) * v;
    }
  }
  return buf;
}

// Spectre d'amplitude (fenêtre de Blackman, comme l'AnalyserNode), fftSize / 2 cases.
export function amplitudes(bloc) {
  const N = bloc.length;
  const re = new Float64Array(N); const im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = bloc[i] * (0.42 - 0.5 * Math.cos((2 * Math.PI * i) / N) + 0.08 * Math.cos((4 * Math.PI * i) / N));
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < N; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k); const wi = Math.sin(ang * k);
        const ur = re[i + k]; const ui = im[i + k];
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
      }
    }
  }
  const a = new Float32Array(N / 2);
  for (let i = 0; i < N / 2; i++) a[i] = Math.hypot(re[i], im[i]) / N;
  return a;
}

// Trames toutes les 15 ms, comme creerEcoute en mode mains ensemble.
export function tramesDe(signal, candidats, { pas = 15 } = {}) {
  const trames = [];
  for (let t = 0; ; t += pas) {
    const fin = Math.round((t / 1000) * SR);
    if (fin > signal.length) break;
    const bloc = new Float32Array(FFT);
    const de = fin - FFT;
    for (let i = 0; i < FFT; i++) bloc[i] = de + i >= 0 ? signal[de + i] : 0;
    trames.push(trameEnsemble(bloc, amplitudes(bloc), { sampleRate: SR, fftSize: FFT }, candidats, t));
  }
  return trames;
}
