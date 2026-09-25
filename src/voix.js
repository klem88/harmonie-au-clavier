// Voix : détection de hauteur (autocorrélation) et évaluation d'une note chantée.
// detecterHauteur / evaluerChant sont purs et testés ; creerMicro n'existe que dans un navigateur.

// Fréquence fondamentale d'un tampon audio, ou null si trop faible ou non périodique.
export function detecterHauteur(buf, sampleRate, { seuilRms = 0.01, fMin = 70, fMax = 1000 } = {}) {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < seuilRms) return null;
  const lagMin = Math.floor(sampleRate / fMax);
  const lagMax = Math.min(Math.floor(sampleRate / fMin), n - 1);
  // autocorrélation normalisée (McLeod simplifié)
  let meilleurLag = -1; let meilleure = 0;
  const corr = new Float32Array(lagMax + 1);
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let s = 0; let e = 0;
    for (let i = 0; i < n - lag; i++) { s += buf[i] * buf[i + lag]; e += buf[i] * buf[i] + buf[i + lag] * buf[i + lag]; }
    corr[lag] = e ? (2 * s) / e : 0;
  }
  // après la descente initiale, le PREMIER pic proche du maximum : le pic à deux périodes est
  // aussi haut que celui à une période, et le prendre donnerait l'octave en dessous.
  let lag = lagMin;
  while (lag <= lagMax && corr[lag] > 0) lag++;
  let maxi = 0;
  for (let l = lag; l <= lagMax; l++) if (corr[l] > maxi) maxi = corr[l];
  if (maxi < 0.6) return null;
  for (let l = lag + 1; l < lagMax; l++) {
    if (corr[l] >= 0.9 * maxi && corr[l] >= corr[l - 1] && corr[l] >= corr[l + 1]) { meilleurLag = l; meilleure = corr[l]; break; }
  }
  if (meilleurLag < 0) return null;
  // interpolation parabolique autour du pic
  const a = corr[meilleurLag - 1] ?? meilleure; const b = meilleure; const c = corr[meilleurLag + 1] ?? meilleure;
  const denom = a - 2 * b + c;
  const decal = denom ? (0.5 * (a - c)) / denom : 0;
  return sampleRate / (meilleurLag + decal);
}

export const midiDeFrequence = (f) => 69 + 12 * Math.log2(f / 440);
export const frequenceDeMidi = (m) => 440 * 2 ** ((m - 69) / 12);

// Médiane
function medianeVoix(t) { const s = [...t].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

// frames : hauteurs MIDI (flottantes) mesurées pendant la fenêtre de chant ; cible : MIDI de la note attendue.
// L'octave est libre (voix d'homme ou de femme) : on compare la classe de hauteur, en cents.
export function evaluerChant(frames, cibleMidi, { tolerance = 50, minFrames = 8 } = {}) {
  const voisees = frames.filter((m) => Number.isFinite(m));
  if (voisees.length < minFrames) return { juste: false, cents: null, chante: null, raison: 'pas assez de voix' };
  // on garde le plateau stable : les valeurs à ±1 demi-ton de la médiane
  const med = medianeVoix(voisees);
  const stables = voisees.filter((m) => Math.abs(m - med) <= 1);
  const chante = medianeVoix(stables);
  let ecart = ((chante - cibleMidi) % 12 + 12) % 12;
  if (ecart > 6) ecart -= 12;
  const cents = Math.round(ecart * 100);
  return { juste: Math.abs(cents) <= tolerance, cents, chante, raison: null };
}

export function commentaireChant(r, nomCible, nomChante) {
  if (r.cents === null) return 'Je n’ai pas entendu de note tenue. Chante plus fort, plus près du micro, sur « la ».';
  const sens = r.cents === 0 ? 'pile juste' : r.cents > 0 ? `${r.cents} cents trop haut` : `${-r.cents} cents trop bas`;
  if (Math.abs(r.cents) <= 15) return `${nomCible} : ${sens}. Très propre.`;
  if (r.juste) return `${nomCible} : ${sens}, dans la tolérance. Vise le centre.`;
  return `Tu as chanté ${nomChante} (${sens}) ; il fallait ${nomCible}.`;
}

// Micro : capture pendant `dureeMs`, une mesure de hauteur toutes les ~50 ms.
export function creerMicro({ getUserMedia = globalThis.navigator?.mediaDevices?.getUserMedia?.bind(globalThis.navigator.mediaDevices), Contexte = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  if (!getUserMedia || !Contexte) return null;
  let ctx = null; let flux = null; let analyseur = null;
  async function ouvrir() {
    if (analyseur) return;
    flux = await getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
    ctx = new Contexte();
    if (ctx.state === 'suspended') await ctx.resume();
    analyseur = ctx.createAnalyser();
    analyseur.fftSize = 2048;
    ctx.createMediaStreamSource(flux).connect(analyseur);
  }
  return {
    async ecouter(dureeMs, onMesure = () => {}) {
      await ouvrir();
      const buf = new Float32Array(analyseur.fftSize);
      const frames = [];
      const debut = performance.now();
      return new Promise((resoudre) => {
        const tick = () => {
          analyseur.getFloatTimeDomainData(buf);
          const f = detecterHauteur(buf, ctx.sampleRate);
          const m = f ? midiDeFrequence(f) : null;
          frames.push(m);
          onMesure(m, (performance.now() - debut) / dureeMs);
          if (performance.now() - debut < dureeMs) setTimeout(tick, 50); else resoudre(frames);
        };
        tick();
      });
    },
    fermer() {
      if (flux) for (const p of flux.getTracks()) p.stop();
      flux = null; analyseur = null;
      if (ctx) { ctx.close().catch(() => {}); ctx = null; }
    },
  };
}
