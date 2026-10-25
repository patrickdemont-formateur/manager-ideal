/*
 * CONFIGURATION — « Le manager idéal, vu par nous »
 *
 * 1) Collez l’adresse de votre déploiement Apps Script dans APPS_SCRIPT_URL.
 * 2) Vous pouvez reformuler tous les textes ci-dessous.
 *
 * À NE PAS MODIFIER : les valeurs "cle" des curseurs, et le nombre de crans (4) (elles correspondent aux colonnes de la feuille Google).
 * À NE PAS CHANGER entre le jour 1 et le jour 3 : les libellés des priorités (la comparaison s’appuie dessus).
 */
window.CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzlxXZ4BcgG4-pIL8w10_fID-SJlb4ntNXqIYJDt08FbuyJ79pURId0Uy_1Qw_36MGJ9Q/exec",

  TITRE: "Le manager idéal, vu par nous",
  SOUS_TITRE: "Manager pour la première fois",

  MOMENTS: {
    J1: "Jour 1 : ouverture",
    J3: "Jour 3 : bilan"
  },

  ETAPES: [
    "Saisie des représentations",
    "Les mots",
    "Les métaphores",
    "Les curseurs",
    "Saisie des attentes",
    "Synthèse"
  ],

  // Sous-titre de chaque étape (qui agit ?)
  ETAPES_SOUS: [
    "Les participants répondent",
    "On dévoile",
    "On dévoile",
    "On dévoile",
    "Les participants répondent",
    "On conclut"
  ],

  QUESTIONS: {
    mots: {
      titre: "Un manager idéal, c’est quelqu’un qui…",
      aide: "Trois mots maximum, les premiers qui vous viennent.",
      placeholders: ["premier mot", "deuxième mot", "troisième mot"]
    },
    metaphore: {
      titre: "Si mon manager idéal était un objet, un animal ou un lieu, ce serait…",
      aide: "Une seule image, puis quelques mots pour dire pourquoi.",
      placeholder: "Un phare, parce qu’il montre le cap sans diriger le bateau"
    },
    curseurs: {
      titre: "Un bon manager…",
      aide: "Pour chaque ligne, choisissez le côté qui vous ressemble le plus. Il n’y a pas de position neutre : il faut prendre parti.",
      // Libellés des 4 crans, de gauche à droite (4 crans exactement : le script Google en attend 4)
      crans: ["Tout à fait", "Plutôt", "Plutôt", "Tout à fait"],
      items: [
        {
          cle: "structure_souplesse",
          nom: "Cadre et souplesse",
          gauche: "fixe un cap clair et un cadre précis",
          droite: "laisse de la marge et s’adapte au fil de l’eau",
          courtGauche: "un cadre clair",
          courtDroite: "de la souplesse"
        },
        {
          cle: "logique_valeurs",
          nom: "Faits et personnes",
          gauche: "décide surtout sur les faits et la logique",
          droite: "décide en tenant compte des personnes et des valeurs",
          courtGauche: "les faits et la logique",
          courtDroite: "les personnes et les valeurs"
        },
        {
          cle: "concret_vision",
          nom: "Concret et vision",
          gauche: "s’appuie sur l’expérience et le concret",
          droite: "s’appuie sur la vision et les possibles",
          courtGauche: "l’expérience et le concret",
          courtDroite: "la vision et les possibles"
        },
        {
          cle: "presence_discretion",
          nom: "Présence et discrétion",
          gauche: "est très présent et communicant",
          droite: "est plutôt discret, disponible sur demande",
          courtGauche: "la présence",
          courtDroite: "la discrétion"
        }
      ]
    }
  },

  ATTENTES: {
    priorites: {
      titre: "Ce que je viens chercher ici",
      aide: "Touchez les thèmes dans l’ordre : le plus important pour vous en premier.",
      items: [
        "Trouver ma légitimité de manager",
        "Connaître et motiver mon équipe",
        "Prendre mes premières décisions",
        "Communiquer et donner du feed-back",
        "Gérer les situations difficiles",
        "Construire mon réseau et mes appuis"
      ]
    },
    situation: {
      titre: "La situation de management que je redoute le plus, c’est…",
      aide: "Décrivez-la en une ou deux phrases. Elle restera anonyme.",
      placeholder: "Annoncer une décision impopulaire à d’anciens collègues"
    }
  }
};
