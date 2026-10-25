/* LE MANAGER IDÉAL, VU PAR NOUS — fonctions communes aux deux pages */
(function () {
  "use strict";

  const CFG = window.CONFIG;
  const NB_CRANS = 4;   // curseurs à 4 crans : 1-2 = côté gauche, 3-4 = côté droit
  const COULEURS_MOTS_SOMBRE = ["#ffd54a", "#ff8fb1", "#7cc6f5", "#98e2b0", "#ff9f5a", "#f4f1e8"];
  const COULEURS_MOTS_CLAIR = ["#0e7c6b", "#c2185b", "#2f6db5", "#b85f00", "#7a3e8e", "#172033"];
  function couleursMots() {
    return document.body && document.body.classList.contains("theme-clair") ? COULEURS_MOTS_CLAIR : COULEURS_MOTS_SOMBRE;
  }

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

  /** Répartition d'un curseur : réponses côté gauche (crans 1-2) et côté droit (crans 3-4). */
  function repartition(valeurs) {
    const v = (valeurs || []).filter(function (x) { return Number.isInteger(x) && x >= 1 && x <= NB_CRANS; });
    const g = v.filter(function (x) { return x <= NB_CRANS / 2; }).length;
    return { n: v.length, g: g, d: v.length - g, valeurs: v };
  }

  function etiquetteDispersion(valeurs) {
    const r = repartition(valeurs);
    if (r.n < 3) return "";
    const p = Math.max(r.g, r.d) / r.n;
    if (p >= 0.8) return "Consensus";
    if (p <= 0.625) return "Opinions partagées";
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
          color: couleursMots()[hs % couleursMots().length],
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

  /** series : [{nom, couleur, valeurs: {cle: [crans 1 à 4]}}] ; plusieurs séries = comparaison jour 1 / jour 3 */
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
        h("div", { class: "libelles" }, h("span", { class: "a" }, it.gauche), h("span", { class: "b" }, it.droite)));
      series.forEach(function (s) {
        const r = repartition(s.valeurs[it.cle]);
        const piles = {};
        r.valeurs.forEach(function (v) { piles[v] = (piles[v] || 0) + 1; });
        const hauteur = Math.max.apply(null, [1].concat(Object.keys(piles).map(function (k) { return piles[k]; })));
        const places = {};
        const piste = h("div", { class: "piste", style: { "--pile": hauteur } }, h("span", { class: "centre" }));
        for (let k = 1; k <= NB_CRANS; k++) piste.append(h("span", { class: "tic", style: { "--x": ((k - 0.5) / NB_CRANS * 100).toFixed(2) } }));
        r.valeurs.slice().sort(function (a, b) { return a - b; }).forEach(function (v) {
          const rang = places[v] = (places[v] || 0) + 1;
          const cle = it.cle + ":" + s.nom + ":" + v + ":" + rang;
          const neuf = !vus.has(cle);
          vus.add(cle);
          piste.append(h("span", {
            class: "pt " + (v <= NB_CRANS / 2 ? "g" : "d") + (neuf ? " neuf" : ""),
            style: { "--x": ((v - 0.5) / NB_CRANS * 100).toFixed(2), "--k": rang - 1 }
          }));
        });
        if (series.length > 1) {
          bloc.append(h("div", { class: "legende" }, h("i", { style: { background: s.couleur } }), s.nom));
        }
        bloc.append(h("div", { class: "rangee-serie" },
          h("div", { class: "tally g", "aria-label": r.g + " personne(s) côté gauche" }, String(r.g)),
          piste,
          h("div", { class: "tally d", "aria-label": r.d + " personne(s) côté droit" }, String(r.d))));
        const disp = etiquetteDispersion(r.valeurs);
        if (disp) bloc.append(h("span", { class: "etiquette" }, disp));
      });
      const reperes = CFG.QUESTIONS.curseurs.crans || ["Tout à fait", "Plutôt", "Plutôt", "Tout à fait"];
      bloc.append(h("div", { class: "rangee-serie" }, h("span"),
        h("div", { class: "reperes" }, reperes.map(function (l) { return h("span", null, l); })), h("span")));
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
        .filter(function (x) { return Number.isInteger(x) && x >= 1 && x <= NB_CRANS; });
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
      const vals = A.map(function (r) { return r.curseurs && r.curseurs[it.cle]; });
      const r = repartition(vals);
      if (!r.n) return;
      let tendance;
      if (r.g > r.d) tendance = "Penche vers « " + it.courtGauche + " » : " + r.g + " sur " + r.n;
      else if (r.d > r.g) tendance = "Penche vers « " + it.courtDroite + " » : " + r.d + " sur " + r.n;
      else tendance = "Groupe partagé : autant pour « " + it.courtGauche + " » que pour « " + it.courtDroite + " »";
      const disp = etiquetteDispersion(r.valeurs);
      lignes.push(h("li", null, tendance + (disp && r.g !== r.d ? " (" + disp.toLowerCase() + ")" : "")));
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
