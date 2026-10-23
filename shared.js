/* LE MANAGER IDÉAL, VU PAR NOUS — fonctions communes aux deux pages */
(function () {
  "use strict";

  const CFG = window.CONFIG;
  const COULEURS_MOTS = ["#ffd54a", "#ff8fb1", "#7cc6f5", "#98e2b0", "#ff9f5a", "#f4f1e8"];

  // ---------- Construction du DOM (aucune injection de HTML : les réponses restent du texte) ----------

  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const cle of Object.keys(attrs)) {
        const v = attrs[cle];
        if (v === null || v === undefined || v === false) continue;
        if (cle === "class") el.className = v;
        else if (cle === "style" && typeof v === "object") {
          for (const p of Object.keys(v)) {
            if (p.indexOf("--") === 0) el.style.setProperty(p, v[p]);
            else el.style[p] = v[p];
          }
        } else if (cle.indexOf("on") === 0 && typeof v === "function") el.addEventListener(cle.slice(2), v);
        else el.setAttribute(cle, v === true ? "" : v);
      }
    }
    const enfants = Array.prototype.slice.call(arguments, 2);
    enfants.flat(Infinity).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    return el;
  }

  function vide(texte) { return h("p", { class: "vide-resultat" }, texte); }

  // ---------- Contexte (session et moment) ----------

  function contexte() {
    const p = new URLSearchParams(location.search);
    const session = (p.get("session") || "defaut").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) || "defaut";
    let moment = (p.get("moment") || "J1").toUpperCase();
    if (!CFG.MOMENTS[moment]) moment = Object.keys(CFG.MOMENTS)[0];
    return { session: session, moment: moment };
  }

  function nettoyerSession(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) || "defaut";
  }

  // ---------- Appels au service Google ----------

  function urlService() {
    const u = CFG.APPS_SCRIPT_URL;
    if (!u || u.indexOf("COLLER_ICI") !== -1) {
      const e = new Error("L'adresse du service n'est pas renseignée dans config.js");
      e.code = "config";
      throw e;
    }
    return u;
  }

  async function appelGet(params) {
    const r = await fetch(urlService() + "?" + new URLSearchParams(params).toString(), { cache: "no-store" });
    if (!r.ok) throw new Error("http " + r.status);
    return r.json();
  }

  async function appelPost(corps) {
    // Corps en texte brut : évite la pré-vérification CORS que Google n'accepte pas.
    const r = await fetch(urlService(), { method: "POST", body: JSON.stringify(corps) });
    if (!r.ok) throw new Error("http " + r.status);
    return r.json();
  }

  // ---------- Stockage local (marque « déjà répondu » sur ce téléphone) ----------

  const memoire = {};
  function lire(cle) { try { return localStorage.getItem(cle); } catch (e) { return memoire[cle] || null; } }
  function ecrire(cle, valeur) { try { localStorage.setItem(cle, valeur); } catch (e) { memoire[cle] = valeur; } }

  // ---------- Outils numériques et textuels ----------

  function hash(s) {
    let x = 5381;
    for (const c of String(s)) x = ((x << 5) + x + c.codePointAt(0)) >>> 0;
    return x;
  }
  function moyenne(v) { return v.reduce(function (a, b) { return a + b; }, 0) / v.length; }
  function ecartType(v) {
    const m = moyenne(v);
    return Math.sqrt(moyenne(v.map(function (x) { return (x - m) * (x - m); })));
  }
  function fmt(n) { return (Math.round(n * 10) / 10).toFixed(1).replace(".", ","); }

  function cleMot(s) {
    return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9' -]/g, "").trim();
  }

  function compterMots(listes) {
    const m = new Map();
    (listes || []).forEach(function (liste) {
      (liste || []).forEach(function (brut) {
        const affiche = String(brut).trim().replace(/\s+/g, " ").toLowerCase();
        const k = cleMot(affiche);
        if (!k) return;
        const e = m.get(k) || { mot: affiche, n: 0 };
        e.n++;
        m.set(k, e);
      });
    });
    return Array.from(m.values()).sort(function (a, b) { return b.n - a.n || a.mot.localeCompare(b.mot, "fr"); });
  }

  function etiquetteDispersion(valeurs) {
    if (!valeurs || valeurs.length < 3) return "";
    const sd = ecartType(valeurs);
    if (sd <= 1.5) return "Consensus";
    if (sd >= 2.8) return "Opinions partagées";
    return "Plutôt nuancé";
  }

  // ---------- Rendus ----------

  function suivi(el) { return el._vus || (el._vus = new Set()); }

  function rendreNuage(el, mots) {
    const sig = JSON.stringify(mots);
    if (el._sig === sig) return;
    el._sig = sig;
    const vus = suivi(el);
    el.replaceChildren();
    if (!mots.length) { el.append(vide("Les premiers mots arrivent…")); return; }
    const max = mots[0].n;
    let rang = 0;
    mots.slice().sort(function (a, b) { return hash(a.mot) - hash(b.mot); }).forEach(function (m) {
      const t = max === 1 ? 0.35 : (m.n - 1) / (max - 1);
      const neuf = !vus.has(m.mot);
      vus.add(m.mot);
      const hs = hash(m.mot);
      el.append(h("span", {
        class: "mot" + (hs % 3 === 0 ? " note" : "") + (neuf ? " neuf" : ""),
        style: {
          fontSize: (1.15 + t * 2.3).toFixed(2) + "em",
          color: COULEURS_MOTS[hs % COULEURS_MOTS.length],
          animationDelay: neuf ? (rang++ * 70) + "ms" : "0ms"
        }
      }, m.mot, m.n > 1 ? h("sup", null, m.n) : null));
    });
  }

  function rendrePostits(el, textes, messageVide) {
    const sig = JSON.stringify(textes);
    if (el._sig === sig) return;
    el._sig = sig;
    const vus = suivi(el);
    el.replaceChildren();
    if (!textes.length) { el.append(vide(messageVide)); return; }
    let rang = 0;
    textes.forEach(function (t, i) {
      const cle = i + ":" + t;
      const neuf = !vus.has(cle);
      vus.add(cle);
      const hs = hash(t);
      el.append(h("div", {
        class: "postit c" + (hs % 5 + 1) + (neuf ? " neuf" : ""),
        style: { "--r": ((hs % 9) - 4) * 0.9 + "deg", animationDelay: neuf ? (rang++ * 120) + "ms" : "0ms" }
      }, t.trim()));
    });
  }

  /** series : [{nom, couleur, valeurs: {cle: [nombres]}}] — plusieurs séries = comparaison jour 1 / jour 3 */
  function rendreCurseurs(el, series) {
    const sig = JSON.stringify(series);
    if (el._sig === sig) return;
    el._sig = sig;
    const vus = suivi(el);
    el.replaceChildren();
    const total = series.reduce(function (a, s) {
      return a + Object.keys(s.valeurs).reduce(function (b, k) { return b + s.valeurs[k].length; }, 0);
    }, 0);
    if (!total) { el.append(vide("Les curseurs arrivent…")); return; }

    CFG.QUESTIONS.curseurs.items.forEach(function (it) {
      const bloc = h("div", { class: "bloc-curseur" },
        h("div", { class: "libelles" }, h("span", null, it.gauche), h("span", null, it.droite)));
      series.forEach(function (s) {
        const vals = (s.valeurs[it.cle] || []).filter(function (v) { return v >= 1 && v <= 10; });
        const piles = {};
        vals.forEach(function (v) { piles[v] = (piles[v] || 0) + 1; });
        const hauteur = Math.max.apply(null, [1].concat(Object.keys(piles).map(function (k) { return piles[k]; })));
        const places = {};
        const piste = h("div", { class: "piste", style: { "--pile": hauteur, "--c": s.couleur } });
        vals.slice().sort(function (a, b) { return a - b; }).forEach(function (v) {
          const k = places[v] = (places[v] || 0) + 1;
          const cle = it.cle + ":" + s.nom + ":" + v + ":" + k;
          const neuf = !vus.has(cle);
          vus.add(cle);
          piste.append(h("span", {
            class: "pt" + (neuf ? " neuf" : ""),
            style: { "--x": ((v - 1) / 9 * 100).toFixed(2), "--k": k - 1 }
          }));
        });
        if (vals.length >= 2) piste.append(h("span", { class: "moy", style: { "--x": ((moyenne(vals) - 1) / 9 * 100).toFixed(2) } }));
        const disp = etiquetteDispersion(vals);
        bloc.append(h("div", { class: "piste-serie", style: { "--c": s.couleur } },
          series.length > 1 ? h("div", { class: "legende" }, h("i"), s.nom) : null,
          piste,
          disp ? h("span", { class: "etiquette" }, disp) : null));
      });
      el.append(bloc);
    });
  }

  function classerPriorites(listes) {
    const labels = CFG.ATTENTES.priorites.items.slice();
    listes.forEach(function (l) { l.forEach(function (x) { if (labels.indexOf(x) === -1) labels.push(x); }); });
    return labels.map(function (label) {
      const rangs = listes.map(function (l) { return l.indexOf(label); })
        .filter(function (i) { return i >= 0; }).map(function (i) { return i + 1; });
      return {
        label: label,
        n: rangs.length,
        moy: rangs.length ? moyenne(rangs) : Infinity,
        premiers: rangs.filter(function (r) { return r === 1; }).length
      };
    }).filter(function (r) { return r.n > 0; })
      .sort(function (a, b) { return a.moy - b.moy; });
  }

  function rendrePriorites(el, listes) {
    const sig = JSON.stringify(listes);
    if (el._sig === sig) return;
    el._sig = sig;
    el.replaceChildren();
    if (!listes.length) { el.append(vide("Les classements arrivent…")); return; }
    const classement = classerPriorites(listes);
    const N = Math.max(CFG.ATTENTES.priorites.items.length, 2);
    classement.forEach(function (r, i) {
      const largeur = Math.max(6, ((N - r.moy + 1) / N) * 100);
      el.append(h("div", { class: "prio-ligne" },
        h("div", { class: "badge" }, i + 1),
        h("div", null,
          h("div", { class: "nom" }, r.label),
          h("div", { class: "barre" }, h("i", { style: { width: largeur.toFixed(1) + "%" } })),
          h("div", { class: "detail" }, "Rang moyen " + fmt(r.moy) + (r.premiers ? " : premier choix de " + r.premiers : "")))));
    });
  }

  /** Regroupe les valeurs des curseurs par question : {cle: [nombres]} */
  function valeursCurseurs(A) {
    const v = {};
    CFG.QUESTIONS.curseurs.items.forEach(function (it) {
      v[it.cle] = (A || []).map(function (r) { return r.curseurs && r.curseurs[it.cle]; })
        .filter(function (x) { return typeof x === "number"; });
    });
    return v;
  }

  // ---------- Portrait collectif ----------

  function construirePortrait(A, B) {
    const racine = h("div", { class: "portrait" }, h("h2", null, "Le manager idéal pour ce groupe"));
    const mots = compterMots(A.map(function (r) { return r.mots; })).slice(0, 6);
    if (!mots.length) { racine.append(vide("Le portrait se dessine dès que les réponses arrivent.")); return racine; }

    racine.append(h("p", { class: "phrase" }, "C'est quelqu'un qui…"),
      h("div", { class: "mots-cles" }, mots.map(function (m) { return h("span", null, m.mot); })));

    const lignes = [];
    CFG.QUESTIONS.curseurs.items.forEach(function (it) {
      const vals = A.map(function (r) { return r.curseurs && r.curseurs[it.cle]; })
        .filter(function (v) { return typeof v === "number" && v >= 1 && v <= 10; });
      if (!vals.length) return;
      const m = moyenne(vals);
      let tendance;
      if (m < 4.5) tendance = "Penche vers « " + it.courtGauche + " »";
      else if (m > 6.5) tendance = "Penche vers « " + it.courtDroite + " »";
      else tendance = "Équilibre entre « " + it.courtGauche + " » et « " + it.courtDroite + " »";
      const disp = etiquetteDispersion(vals);
      lignes.push(h("li", null, tendance + " (moyenne " + fmt(m) + " sur 10)" + (disp ? ", " + disp.toLowerCase() : "")));
    });
    if (lignes.length) racine.append(h("h3", null, "Ce que le groupe attend de lui"), h("ul", null, lignes));

    if (B && B.length) {
      const top = classerPriorites(B.map(function (r) { return r.priorites; })).slice(0, 3);
      racine.append(h("h3", null, "Les priorités du groupe"),
        h("ol", null, top.map(function (r) { return h("li", null, r.label); })));
    }
    return racine;
  }

  window.MI = {
    h: h, vide: vide, contexte: contexte, nettoyerSession: nettoyerSession,
    appelGet: appelGet, appelPost: appelPost, lire: lire, ecrire: ecrire,
    hash: hash, fmt: fmt, compterMots: compterMots,
    rendreNuage: rendreNuage, rendrePostits: rendrePostits, rendreCurseurs: rendreCurseurs,
    rendrePriorites: rendrePriorites, construirePortrait: construirePortrait, valeursCurseurs: valeursCurseurs
  };
})();
