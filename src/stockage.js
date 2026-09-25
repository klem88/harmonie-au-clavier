// Lecture/écriture de l'état de l'élève. Trois modes, même interface :
// 'artefact' (base de la page claude.ai, avec copie locale), 'local' (localStorage), 'memoire'.

export const CLE_LOCALE = 'harmonie.etat.v1';
const CHEMIN_DOC = 'etat/eleve';

export function creerStockage({ local = globalThis.localStorage, db = null } = {}) {
  let memoire = null;
  let fileEcriture = Promise.resolve();
  const s = { mode: db ? 'artefact' : local ? 'local' : 'memoire', derniereErreur: null };

  function lireLocal() {
    if (!local) return null;
    let brut;
    try { brut = local.getItem(CLE_LOCALE); } catch (e) { s.derniereErreur = e; local = null; s.mode = db ? 'artefact' : 'memoire'; return null; }
    if (brut == null) return null;
    try { return JSON.parse(brut); } catch {
      try { local.setItem(CLE_LOCALE + '.corrompu', brut); } catch { /* tant pis */ }
      return null;
    }
  }
  function ecrireLocal(etat) {
    if (!local) return;
    try { local.setItem(CLE_LOCALE, JSON.stringify(etat)); } catch (e) { s.derniereErreur = e; local = null; if (!db) s.mode = 'memoire'; }
  }

  s.charger = async () => {
    if (db) {
      try {
        const snap = await db.doc(CHEMIN_DOC).get();
        if (snap.exists) { const d = snap.data(); ecrireLocal(d); return d; }
        // rien en base : on récupère une éventuelle copie locale (première publication)
        const l = lireLocal();
        if (l) return l;
        return null;
      } catch (e) { s.derniereErreur = e; }
    }
    const l = lireLocal();
    if (l) return l;
    return memoire;
  };

  s.sauver = async (etat) => {
    memoire = JSON.parse(JSON.stringify(etat));
    ecrireLocal(memoire);
    if (!db) return;
    const copie = memoire;
    fileEcriture = fileEcriture.then(async () => {
      try { await db.doc(CHEMIN_DOC).set(copie); } catch (e) { s.derniereErreur = e; }
    });
    await fileEcriture;
  };

  return s;
}
