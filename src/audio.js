// Son des cartes d'oreille : une séquence d'événements { midis, dureeMs } jouée avec Web Audio.
// La partie pure (sequenceAudio) est testée ; le lecteur n'existe que dans un navigateur.

import { midi } from './theorie.js';

// Place des notes en montant à partir de l'octave 4 (comme le clavier), puis renvoie leurs numéros MIDI.
export function midisMontants(notes, octaveDepart = 4) {
  const out = [];
  let prec = null;
  for (const n of notes) {
    let m = midi(n, octaveDepart);
    if (prec !== null) { while (m <= prec) m += 12; }
    out.push(m);
    prec = m;
  }
  return out;
}

// spec = { mode: 'melodique' | 'accord' | 'cadence', notes | accords }
export function sequenceAudio(spec) {
  if (spec.mode === 'melodique') {
    const m = midisMontants(spec.notes);
    return [...m.map((x) => ({ midis: [x], dureeMs: 700 })), { midis: m, dureeMs: 1100 }];
  }
  if (spec.mode === 'accord') {
    const m = midisMontants(spec.notes);
    return [{ midis: [m[0] - 12, ...m], dureeMs: 1600 }];
  }
  if (spec.mode === 'midis') return spec.midis.map((m) => ({ midis: [m], dureeMs: spec.dureeMs || 900 }));
  if (spec.mode === 'accordMidis') return [{ midis: spec.midis, dureeMs: spec.dureeMs || 1600 }];
  if (spec.mode === 'cadence') {
    return spec.accords.map((notes) => { const m = midisMontants(notes, 3); return { midis: [m[0] - 12, ...m], dureeMs: 900 }; });
  }
  throw new Error(`mode audio inconnu : ${spec.mode}`);
}

export function dureeTotaleMs(sequence) { return sequence.reduce((s, e) => s + e.dureeMs, 0); }

const frequence = (m) => 440 * 2 ** ((m - 69) / 12);

// Lecteur Web Audio : son doux type « piano électrique » (fondamentale + 2 partiels, enveloppe percussive).
export function creerLecteur(Contexte = globalThis.AudioContext || globalThis.webkitAudioContext) {
  if (!Contexte) return null;
  let ctx = null;
  let enCours = [];
  function assurer() { if (!ctx) ctx = new Contexte(); if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  function noteA(m, debut, duree, gainMax) {
    const c = assurer();
    const sortie = c.createGain();
    sortie.connect(c.destination);
    sortie.gain.setValueAtTime(0, debut);
    sortie.gain.linearRampToValueAtTime(gainMax, debut + 0.015);
    sortie.gain.exponentialRampToValueAtTime(gainMax * 0.35, debut + duree * 0.5);
    sortie.gain.exponentialRampToValueAtTime(0.0005, debut + duree);
    for (const [mult, poids, type] of [[1, 1, 'triangle'], [2, 0.25, 'sine'], [3, 0.08, 'sine']]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = frequence(m) * mult;
      const g = c.createGain();
      g.gain.value = poids;
      o.connect(g).connect(sortie);
      o.start(debut);
      o.stop(debut + duree + 0.05);
      enCours.push(o);
    }
  }
  return {
    // Joue la séquence ; renvoie la durée totale en ms.
    jouer(sequence) {
      this.arreter();
      const c = assurer();
      let t = c.currentTime + 0.05;
      for (const ev of sequence) {
        const d = ev.dureeMs / 1000;
        const gain = 0.5 / Math.sqrt(ev.midis.length);
        for (const m of ev.midis) noteA(m, t, d, gain);
        t += d;
      }
      return dureeTotaleMs(sequence);
    },
    arreter() {
      for (const o of enCours) { try { o.stop(); } catch { /* déjà arrêté */ } }
      enCours = [];
    },
  };
}

// ---------- Métronome et percussions (dimension rythme) ----------
// Séquence pure : un décompte d'une mesure, puis `mesures` mesures de clics ; `onsetsMs` (relatifs au
// début de la première mesure jouée) ajoute des « notes » percussives. Retourne aussi l'origine.
export function sequencePercussions({ bpm, temps, mesures, onsetsMs = [], decompte = 1 }) {
  const battement = 60000 / bpm;
  const origineMs = Math.round(decompte * temps * battement);
  const evenements = [];
  for (let m = 0; m < decompte + mesures; m++) {
    for (let t = 0; t < temps; t++) {
      evenements.push({ tMs: Math.round((m * temps + t) * battement), genre: t === 0 ? 'accent' : 'clic' });
    }
  }
  for (const o of onsetsMs) evenements.push({ tMs: origineMs + o, genre: 'note' });
  evenements.sort((a, b) => a.tMs - b.tMs);
  return { evenements, origineMs, dureeMs: Math.round((decompte + mesures) * temps * battement) };
}

// Ajoute au lecteur Web Audio la lecture percussive. `jouerPercussions` renvoie l'instant
// performance.now() correspondant à tMs = 0, pour comparer les frappes de l'élève aux attaques attendues.
export function equiperPercussions(lecteur, Contexte = globalThis.AudioContext || globalThis.webkitAudioContext) {
  if (!lecteur) return null;
  let ctx = null;
  let actifs = [];
  function assurer() { if (!ctx) ctx = new Contexte(); if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  function percu(genre, debut) {
    const c = assurer();
    const o = c.createOscillator();
    const g = c.createGain();
    const [freq, duree, gain, type] = genre === 'accent' ? [1568, 0.07, 0.5, 'sine'] : genre === 'clic' ? [1046, 0.045, 0.3, 'sine'] : [523, 0.12, 0.6, 'triangle'];
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, debut);
    g.gain.exponentialRampToValueAtTime(0.0005, debut + duree);
    o.connect(g).connect(c.destination);
    o.start(debut); o.stop(debut + duree + 0.02);
    actifs.push(o);
  }
  lecteur.jouerPercussions = (evenements) => {
    lecteur.arreterPercussions();
    const c = assurer();
    const depart = c.currentTime + 0.12;
    for (const e of evenements) percu(e.genre, depart + e.tMs / 1000);
    // origine en temps performance.now() : maintenant + délai jusqu'au départ audio
    return performance.now() + (depart - c.currentTime) * 1000;
  };
  lecteur.arreterPercussions = () => {
    for (const o of actifs) { try { o.stop(); } catch { /* déjà arrêté */ } }
    actifs = [];
  };
  return lecteur;
}
