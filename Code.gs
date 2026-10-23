/**
 * LE MANAGER IDÉAL, VU PAR NOUS — moteur de collecte (Google Apps Script)
 *
 * À coller dans l'éditeur Apps Script d'une feuille Google Sheets
 * (menu Extensions > Apps Script). Voir AIDE-ADMINISTRATION.txt.
 *
 * Données stockées (anonymes : aucun nom, aucun identifiant, aucune adresse IP) :
 *   - onglet "SaisieA"  : mots, métaphore, 4 curseurs
 *   - onglet "SaisieB"  : classement des priorités, situation redoutée
 *   - onglet "Etat"     : étape en cours pour chaque session
 */

// ====== À MODIFIER ======
const CODE_ANIMATEUR = "CHANGEZ-MOI";   // votre code d'accès à la page animateur
// ========================

const MOMENTS = ["J1", "J3"];
const NB_PRIORITES = 6;
const MAX_REPONSES = 40;                 // plafond par session et par saisie (anti-saturation)

const ENTETES_A = ["horodatage", "session", "moment", "mot1", "mot2", "mot3", "metaphore",
  "structure_souplesse", "logique_valeurs", "concret_vision", "presence_discretion"];
const ENTETES_B = ["horodatage", "session", "moment", "priorite1", "priorite2", "priorite3",
  "priorite4", "priorite5", "priorite6", "situation_redoutee"];
const ENTETES_ETAT = ["session", "moment", "etape", "mise_a_jour"];
const CLES_CURSEURS = ["structure_souplesse", "logique_valeurs", "concret_vision", "presence_discretion"];

/** À exécuter une fois depuis l'éditeur : crée les onglets et déclenche l'autorisation Google. */
function installer() {
  ongletA_(); ongletB_(); ongletEtat_();
  Logger.log("Installation terminée : onglets SaisieA, SaisieB et Etat prêts.");
}

// ---------- Points d'entrée web ----------

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.action === "donnees") {
      return json_(formater_(nettoyerSession_(p.session), nettoyerMoment_(p.moment), true));
    }
    return json_({ ok: true, message: "Le manager idéal — service actif" });
  } catch (err) {
    return json_({ ok: false, erreur: String(err) });
  }
}

function doPost(e) {
  try {
    const corps = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const session = nettoyerSession_(corps.session);
    const moment = nettoyerMoment_(corps.moment);

    if (corps.action === "repondre") return json_(enregistrer_(session, moment, corps));

    // Actions réservées à l'animateur
    if (!codeValide_(corps.code)) {
      Utilities.sleep(800);
      return json_({ ok: false, erreur: "code_invalide" });
    }
    if (corps.action === "verifier") return json_({ ok: true });
    if (corps.action === "etape") return json_(changerEtape_(session, moment, corps.etape));
    if (corps.action === "reinitialiser") return json_(reinitialiser_(session, moment));
    if (corps.action === "admin_donnees") {
      const parMoment = {};
      MOMENTS.forEach(function (m) { parMoment[m] = formater_(session, m, false); });
      return json_({ ok: true, parMoment: parMoment });
    }
    return json_({ ok: false, erreur: "action_inconnue" });
  } catch (err) {
    return json_({ ok: false, erreur: String(err) });
  }
}

// ---------- Enregistrement des réponses ----------

function enregistrer_(session, moment, corps) {
  const etape = lireEtape_(session, moment);
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    if (corps.bloc === "A") {
      if (etape !== 0) return { ok: false, erreur: "saisie_fermee" };
      const r = corps.reponses || {};
      const mots = (Array.isArray(r.mots) ? r.mots : []).slice(0, 3).map(function (m) { return texte_(m, 30); });
      while (mots.length < 3) mots.push("");
      const metaphore = texte_(r.metaphore, 160);
      if (!mots[0] && !mots[1] && !mots[2]) return { ok: false, erreur: "mots_manquants" };
      if (!metaphore) return { ok: false, erreur: "metaphore_manquante" };
      const curseurs = CLES_CURSEURS.map(function (k) { return entier_((r.curseurs || {})[k], 1, 10); });
      if (curseurs.indexOf(null) !== -1) return { ok: false, erreur: "curseurs_manquants" };
      const feuille = ongletA_();
      if (compter_(feuille, session, moment) >= MAX_REPONSES) return { ok: false, erreur: "plafond_atteint" };
      feuille.appendRow([new Date(), session, moment].concat(mots, [metaphore], curseurs));
    } else if (corps.bloc === "B") {
      if (etape !== 4) return { ok: false, erreur: "saisie_fermee" };
      const r = corps.reponses || {};
      const prios = (Array.isArray(r.priorites) ? r.priorites : []).slice(0, NB_PRIORITES).map(function (m) { return texte_(m, 70); });
      const distincts = prios.filter(function (x, i) { return x && prios.indexOf(x) === i; });
      if (prios.length !== NB_PRIORITES || distincts.length !== NB_PRIORITES) return { ok: false, erreur: "classement_invalide" };
      const feuille = ongletB_();
      if (compter_(feuille, session, moment) >= MAX_REPONSES) return { ok: false, erreur: "plafond_atteint" };
      feuille.appendRow([new Date(), session, moment].concat(prios, [texte_(r.situation, 300)]));
    } else {
      return { ok: false, erreur: "bloc_inconnu" };
    }
    viderCache_(session, moment);
    return { ok: true };
  } finally {
    verrou.releaseLock();
  }
}

// ---------- Étapes ----------

function changerEtape_(session, moment, etape) {
  const n = entier_(etape, 0, 5);
  if (n === null) return { ok: false, erreur: "etape_invalide" };
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const feuille = ongletEtat_();
    const valeurs = feuille.getDataRange().getValues();
    let ligne = -1;
    for (let i = 1; i < valeurs.length; i++) {
      if (String(valeurs[i][0]) === session && String(valeurs[i][1]) === moment) { ligne = i + 1; break; }
    }
    if (ligne === -1) feuille.appendRow([session, moment, n, new Date()]);
    else feuille.getRange(ligne, 3, 1, 2).setValues([[n, new Date()]]);
    viderCache_(session, moment);
    return { ok: true, etape: n };
  } finally {
    verrou.releaseLock();
  }
}

function lireEtape_(session, moment) {
  const valeurs = ongletEtat_().getDataRange().getValues();
  for (let i = 1; i < valeurs.length; i++) {
    if (String(valeurs[i][0]) === session && String(valeurs[i][1]) === moment) return Number(valeurs[i][2]) || 0;
  }
  return 0;
}

function reinitialiser_(session, moment) {
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    [ongletA_(), ongletB_(), ongletEtat_()].forEach(function (feuille) {
      const col = feuille.getName() === "Etat" ? 0 : 1;   // colonne "session"
      const valeurs = feuille.getDataRange().getValues();
      for (let i = valeurs.length - 1; i >= 1; i--) {
        const memeSession = String(valeurs[i][col]) === session;
        const memeMoment = String(valeurs[i][col + 1]) === moment;
        if (memeSession && memeMoment) feuille.deleteRow(i + 1);
      }
    });
    viderCache_(session, moment);
    return { ok: true };
  } finally {
    verrou.releaseLock();
  }
}

// ---------- Lecture et mise en forme ----------

/**
 * masquer = true : version publique (téléphones). Les réponses ne sont diffusées
 * qu'une fois leur étape atteinte, quelle que soit la requête reçue.
 */
function formater_(session, moment, masquer) {
  const cache = CacheService.getScriptCache();
  const cleCache = cle_(session, moment) + (masquer ? ":pub" : ":adm");
  const enCache = cache.get(cleCache);
  if (enCache) return JSON.parse(enCache);

  const etape = lireEtape_(session, moment);
  const lignesA = lignes_(ongletA_(), session, moment);
  const lignesB = lignes_(ongletB_(), session, moment);

  const A = lignesA.map(function (r) {
    const o = {};
    if (!masquer || etape >= 1) o.mots = [r[3], r[4], r[5]].map(String).filter(function (x) { return x.trim() !== ""; });
    if (!masquer || etape >= 2) o.metaphore = String(r[6]);
    if (!masquer || etape >= 3) {
      o.curseurs = {};
      CLES_CURSEURS.forEach(function (k, i) { o.curseurs[k] = Number(r[7 + i]); });
    }
    return o;
  });
  const B = (masquer && etape < 5) ? [] : lignesB.map(function (r) {
    return { priorites: r.slice(3, 3 + NB_PRIORITES).map(String), situation: String(r[3 + NB_PRIORITES]) };
  });

  const resultat = { ok: true, etape: etape, nbA: lignesA.length, nbB: lignesB.length, A: A, B: B };
  try { cache.put(cleCache, JSON.stringify(resultat), 3); } catch (err) { /* cache facultatif */ }
  return resultat;
}

function lignes_(feuille, session, moment) {
  const valeurs = feuille.getDataRange().getValues();
  const sortie = [];
  for (let i = 1; i < valeurs.length; i++) {
    if (String(valeurs[i][1]) === session && String(valeurs[i][2]) === moment) sortie.push(valeurs[i]);
  }
  return sortie;
}

function compter_(feuille, session, moment) { return lignes_(feuille, session, moment).length; }

// ---------- Onglets ----------

function onglet_(nom, entetes) {
  const classeur = SpreadsheetApp.getActiveSpreadsheet();
  let feuille = classeur.getSheetByName(nom);
  if (!feuille) {
    feuille = classeur.insertSheet(nom);
    feuille.getRange(1, 1, 1, entetes.length).setValues([entetes]).setFontWeight("bold");
    feuille.setFrozenRows(1);
  }
  return feuille;
}
function ongletA_() { return onglet_("SaisieA", ENTETES_A); }
function ongletB_() { return onglet_("SaisieB", ENTETES_B); }
function ongletEtat_() { return onglet_("Etat", ENTETES_ETAT); }

// ---------- Utilitaires ----------

function json_(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet)).setMimeType(ContentService.MimeType.JSON);
}
function cle_(session, moment) { return "mi:" + session + ":" + moment; }
function viderCache_(session, moment) {
  CacheService.getScriptCache().removeAll([cle_(session, moment) + ":pub", cle_(session, moment) + ":adm"]);
}
function codeValide_(code) { return typeof code === "string" && code !== "" && code === CODE_ANIMATEUR; }

function nettoyerSession_(s) {
  const propre = String(s || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return propre || "defaut";
}
function nettoyerMoment_(m) {
  const propre = String(m || "").toUpperCase();
  return MOMENTS.indexOf(propre) !== -1 ? propre : MOMENTS[0];
}
function entier_(v, min, max) {
  const n = Number(v);
  return (v !== null && v !== "" && isFinite(n) && Math.floor(n) === n && n >= min && n <= max) ? n : null;
}
/** Nettoie un texte et neutralise l'interprétation en formule par Google Sheets. */
function texte_(v, longueurMax) {
  let t = String(v === null || v === undefined ? "" : v).replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, longueurMax);
  if (/^[=+\-@]/.test(t)) t = " " + t;
  return t;
}
