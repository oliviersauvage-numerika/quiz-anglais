// Service de gestion du Système de Répétition Espacée (SRS) et des Modes d'Apprentissage

export const SRS_INTERVALS = {
  0: 0,
  1: 1,
  2: 2,
  3: 4,
  4: 7,
  5: 30,
  6: 30,
  7: 30,
  8: 30,
  9: 30,
  10: null
};

export const SRS_STAGES = {
  0: {
    level: 0,
    label: "En apprentissage",
    shortLabel: "Apprentissage",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
    intervalDays: 0,
    description: "Phase d'apprentissage initial (3 réussites consécutives requises)"
  },
  1: {
    level: 1,
    label: "Palier 1 (J+1)",
    shortLabel: "J+1",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900",
    intervalDays: 1,
    description: "Première révision le lendemain"
  },
  2: {
    level: 2,
    label: "Palier 2 (J+2)",
    shortLabel: "J+2",
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-900",
    intervalDays: 2,
    description: "Deuxième révision 2 jours plus tard"
  },
  3: {
    level: 3,
    label: "Palier 3 (J+4)",
    shortLabel: "J+4",
    badgeColor: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-900",
    intervalDays: 4,
    description: "Troisième révision 4 jours plus tard"
  },
  4: {
    level: 4,
    label: "Palier 4 (1 semaine)",
    shortLabel: "1 sem.",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-900",
    intervalDays: 7,
    description: "Quatrième révision 1 semaine plus tard"
  },
  5: {
    level: 5,
    label: "Palier 5 (1 mois)",
    shortLabel: "1 mois",
    badgeColor: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-900",
    intervalDays: 30,
    description: "Cinquième révision 1 mois plus tard"
  },
  6: {
    level: 6,
    label: "Consolidation M2",
    shortLabel: "Mois 2",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
    intervalDays: 30,
    description: "Maintien mensuel (Mois 2)"
  },
  7: {
    level: 7,
    label: "Consolidation M3",
    shortLabel: "Mois 3",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
    intervalDays: 30,
    description: "Maintien mensuel (Mois 3)"
  },
  8: {
    level: 8,
    label: "Consolidation M4",
    shortLabel: "Mois 4",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
    intervalDays: 30,
    description: "Maintien mensuel (Mois 4)"
  },
  9: {
    level: 9,
    label: "Consolidation M5",
    shortLabel: "Mois 5",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
    intervalDays: 30,
    description: "Dernière révision mensuelle du cycle de consolidation"
  },
  10: {
    level: 10,
    label: "Maîtrisé 🏆",
    shortLabel: "Maîtrisé 🏆",
    badgeColor: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700",
    intervalDays: null,
    description: "Cycle de consolidation validé avec succès (~5 mois et demi)"
  }
};

export const srsService = {
  // Obtenir les informations d'un palier
  getStageInfo: (stage = 0) => {
    const validStage = Math.max(0, Math.min(10, Math.floor(Number(stage) || 0)));
    return SRS_STAGES[validStage] || SRS_STAGES[0];
  },

  // Obtenir la progression propre à une direction ("fr_en" | "en_fr")
  getProgress: (word, direction = "fr_en") => {
    if (!word) {
      return {
        srsStage: 0,
        learningSuccessCount: 0,
        totalCorrectAnswers: 0,
        learned: false,
        isMastered: false,
        nextReviewAt: null,
        lastSrsReviewAt: null,
        firstLearnedAt: null,
        lastAnsweredAt: null,
        lastCorrect: null
      };
    }

    if (direction === "en_fr") {
      const stage = typeof word.srsStage_en_fr === "number" ? word.srsStage_en_fr : 0;
      return {
        srsStage: stage,
        learningSuccessCount: word.learningSuccessCount_en_fr || 0,
        totalCorrectAnswers: word.totalCorrectAnswers_en_fr || 0,
        learned: Boolean(word.learned_en_fr || stage >= 1),
        isMastered: Boolean(word.isMastered_en_fr || stage >= 10),
        nextReviewAt: word.nextReviewAt_en_fr || null,
        lastSrsReviewAt: word.lastSrsReviewAt_en_fr || null,
        firstLearnedAt: word.firstLearnedAt_en_fr || null,
        lastAnsweredAt: word.lastAnsweredAt_en_fr || null,
        lastCorrect: word.lastCorrect_en_fr ?? null
      };
    }

    // Direction "fr_en" (par défaut / existante)
    const stage = typeof word.srsStage === "number" ? word.srsStage : 0;
    return {
      srsStage: stage,
      learningSuccessCount: word.learningSuccessCount || 0,
      totalCorrectAnswers: word.totalCorrectAnswers || 0,
      learned: Boolean(word.learned || stage >= 1),
      isMastered: Boolean(word.isMastered || stage >= 10),
      nextReviewAt: word.nextReviewAt || null,
      lastSrsReviewAt: word.lastSrsReviewAt || null,
      firstLearnedAt: word.firstLearnedAt || null,
      lastAnsweredAt: word.lastAnsweredAt || null,
      lastCorrect: word.lastCorrect ?? null
    };
  },

  // Nettoyer, normaliser et garantir la cohérence des propriétés d'un mot (sur les deux directions)
  sanitizeWord: (word) => {
    if (!word || typeof word !== "object") return word;

    // --- Direction 1 : FR -> EN (existante) ---
    const rawStage = typeof word.srsStage === "number"
      ? word.srsStage
      : (typeof word.srs_stage === "number" ? word.srs_stage : (word.learned ? 1 : 0));
    const srsStage = Math.max(0, Math.min(10, Math.floor(Number(rawStage) || 0)));

    const legacyCount = typeof word.successCount === "number" 
      ? word.successCount 
      : (typeof word.success_count === "number" ? word.success_count : 0);
    
    const learningSuccessCount = typeof word.learningSuccessCount === "number"
      ? word.learningSuccessCount
      : (srsStage === 0 ? legacyCount : 0);

    const totalCorrectAnswers = typeof word.totalCorrectAnswers === "number"
      ? word.totalCorrectAnswers
      : legacyCount;

    const learned = srsStage >= 1;
    const isMastered = srsStage === 10;

    const nextReviewAt = (isMastered || srsStage === 0) 
      ? null 
      : (word.nextReviewAt || word.next_review_at || null);

    const lastAnsweredAt = word.lastAnsweredAt || word.lastAnswered || word.last_answered || null;
    const lastSrsReviewAt = word.lastSrsReviewAt || word.lastReviewedAt || word.last_reviewed_at || null;

    // --- Direction 2 : EN -> FR (nouvelle) ---
    const rawStageEnFr = typeof word.srsStage_en_fr === "number"
      ? word.srsStage_en_fr
      : (typeof word.srs_stage_en_fr === "number" ? word.srs_stage_en_fr : (word.learned_en_fr ? 1 : 0));
    const srsStage_en_fr = Math.max(0, Math.min(10, Math.floor(Number(rawStageEnFr) || 0)));

    const learningSuccessCount_en_fr = typeof word.learningSuccessCount_en_fr === "number"
      ? word.learningSuccessCount_en_fr
      : (typeof word.success_count_en_fr === "number" ? word.success_count_en_fr : 0);

    const totalCorrectAnswers_en_fr = typeof word.totalCorrectAnswers_en_fr === "number"
      ? word.totalCorrectAnswers_en_fr
      : (typeof word.total_correct_answers_en_fr === "number" ? word.total_correct_answers_en_fr : 0);

    const learned_en_fr = srsStage_en_fr >= 1;
    const isMastered_en_fr = srsStage_en_fr === 10;

    const nextReviewAt_en_fr = (isMastered_en_fr || srsStage_en_fr === 0)
      ? null
      : (word.nextReviewAt_en_fr || word.next_review_at_en_fr || null);

    const lastAnsweredAt_en_fr = word.lastAnsweredAt_en_fr || word.last_answered_en_fr || null;
    const lastSrsReviewAt_en_fr = word.lastSrsReviewAt_en_fr || word.last_reviewed_at_en_fr || null;
    const firstLearnedAt_en_fr = word.firstLearnedAt_en_fr || word.first_learned_at_en_fr || null;
    const lastCorrect_en_fr = typeof word.lastCorrect_en_fr === "boolean" 
      ? word.lastCorrect_en_fr 
      : (typeof word.last_correct_en_fr === "boolean" ? word.last_correct_en_fr : null);

    // Gestion multi-réponses et sens
    const acceptedAnswers = Array.isArray(word.accepted_answers) 
      ? word.accepted_answers 
      : (Array.isArray(word.acceptedAnswers) ? word.acceptedAnswers : []);

    const sanitized = {
      ...word,
      // Direction FR -> EN
      srsStage,
      learningSuccessCount,
      totalCorrectAnswers,
      learned,
      isMastered,
      nextReviewAt,
      lastAnsweredAt,
      lastSrsReviewAt,
      // Direction EN -> FR
      srsStage_en_fr,
      learningSuccessCount_en_fr,
      totalCorrectAnswers_en_fr,
      learned_en_fr,
      isMastered_en_fr,
      nextReviewAt_en_fr,
      lastSrsReviewAt_en_fr,
      lastAnsweredAt_en_fr,
      firstLearnedAt_en_fr,
      lastCorrect_en_fr,
      // Alias Supabase
      srs_stage_en_fr: srsStage_en_fr,
      success_count_en_fr: learningSuccessCount_en_fr,
      total_correct_answers_en_fr: totalCorrectAnswers_en_fr,
      next_review_at_en_fr: nextReviewAt_en_fr,
      last_reviewed_at_en_fr: lastSrsReviewAt_en_fr,
      last_answered_en_fr: lastAnsweredAt_en_fr,
      first_learned_at_en_fr: firstLearnedAt_en_fr,
      last_correct_en_fr: lastCorrect_en_fr,
      // Métadonnées dictionnaire
      accepted_answers: acceptedAnswers,
      frenchPrompt: word.frenchPrompt || word.french_prompt || undefined,
      senseId: word.senseId || word.sense_id || undefined,
      // Alias historiques
      successCount: learningSuccessCount,
      lastAnswered: lastAnsweredAt,
      lastReviewedAt: lastSrsReviewAt
    };

    // Gestion du descriptif contextuel (élimination stricte de l'ancien champ notes en cas de suppression/vidage)
    let contextNote = undefined;
    if (
      word.exampleSentence === null || word.exampleSentence === "" ||
      word.notes === null || word.notes === "" ||
      word.example_sentence === null || word.example_sentence === ""
    ) {
      contextNote = undefined;
    } else {
      const raw = word.exampleSentence || word.example_sentence || word.notes;
      if (typeof raw === "string" && raw.trim().length > 0) {
        contextNote = raw.trim();
      }
    }

    if (contextNote) {
      sanitized.exampleSentence = contextNote;
      sanitized.notes = contextNote;
      sanitized.example_sentence = contextNote;
    } else {
      delete sanitized.exampleSentence;
      delete sanitized.notes;
      delete sanitized.example_sentence;
    }

    return sanitized;
  },

  // Calculer la prochaine date de révision calendaire dans le fuseau horaire utilisateur
  calculateNextReviewDate: (stage, baseDate = new Date()) => {
    const validStage = Math.max(0, Math.min(10, Math.floor(Number(stage) || 0)));
    const intervalDays = SRS_INTERVALS[validStage];
    if (intervalDays === null || intervalDays === undefined || intervalDays === 0 || validStage >= 10) {
      return null;
    }

    const date = new Date(baseDate);
    if (isNaN(date.getTime())) return null;

    // Ajout calendaire respectant le fuseau horaire local
    date.setDate(date.getDate() + intervalDays);
    return date.toISOString();
  },

  // Vérifier si un mot a une date d'échéance valide et atteinte pour une direction donnée
  isReviewDue: (word, now = new Date(), direction = "fr_en") => {
    if (!word) return false;
    const p = srsService.getProgress(word, direction);
    
    // Une carte au palier 0 ou 10 n'a pas de révision SRS due
    if (p.srsStage < 1 || p.srsStage >= 10 || p.isMastered) return false;

    // Une date absente ou invalide pour un palier >= 1 est une anomalie et ne doit pas être silencieusement considérée comme échue
    if (!p.nextReviewAt) return false;

    const reviewDate = new Date(p.nextReviewAt);
    if (isNaN(reviewDate.getTime())) return false;

    const currentDate = new Date(now);
    return reviewDate <= currentDate;
  },

  // Vérifier si un mot est en phase d'apprentissage initial (Palier 0)
  isLearning: (word, direction = "fr_en") => {
    if (!word) return false;
    const p = srsService.getProgress(word, direction);
    return p.srsStage === 0 && !p.isMastered;
  },

  // Vérifier si un mot est maîtrisé (Palier 10)
  isMastered: (word, direction = "fr_en") => {
    if (!word) return false;
    const p = srsService.getProgress(word, direction);
    return p.isMastered || p.srsStage >= 10;
  },

  // Extraction des variantes linguistiques tolérées (articles, infinitif to, pronoms impersonnels)
  getNormalizedVariants: (text, partOfSpeech = "") => {
    if (!text || typeof text !== "string") return [];

    const pos = (partOfSpeech || "").toLowerCase().trim();

    // 1. Nettoyage de base (apostrophes typographiques, ponctuation finale, espaces)
    let raw = text
      .trim()
      .toLowerCase()
      .replace(/[’‘`]/g, "'")
      .replace(/[.,!?;:]+$/g, "")
      .replace(/\s+/g, " ");

    if (!raw) return [];

    const forms = new Set([raw]);

    // Gestion du contenu entre parenthèses facultatif (ex: "look after (someone)" -> "look after" et "look after someone")
    if (raw.includes("(") && raw.includes(")")) {
      const withoutParens = raw.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
      if (withoutParens) forms.add(withoutParens);
      const withParensStripped = raw.replace(/[()]/g, "").replace(/\s+/g, " ").trim();
      if (withParensStripped) forms.add(withParensStripped);
    }

    const processed = new Set();

    forms.forEach((str) => {
      let clean = str;

      // Retrait initial de 'to ' pour verbes, expressions ou saisies libres
      if (pos === "verb" || pos === "expression" || /^to\s+/i.test(clean)) {
        if (pos !== "adverb" && pos !== "adjective") {
          clean = clean.replace(/^to\s+/i, "").trim();
        }
      }

      // Retrait initial des articles 'a', 'an', 'the'
      if (pos === "noun" || pos === "expression" || /^(a|an|the)\s+/i.test(clean)) {
        if (pos !== "adverb" && pos !== "adjective") {
          clean = clean.replace(/^(a|an|the)\s+/i, "").trim();
        }
      }

      if (clean) {
        processed.add(clean);

        // Variante sans articles internes (ex: "give a hand" -> "give hand")
        const withoutArticles = clean
          .replace(/\b(a|an|the)\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();
        if (withoutArticles && withoutArticles.length > 0) {
          processed.add(withoutArticles);
        }

        // Variante sans pronoms possessifs impersonnels (one's, someone's, etc.)
        const strippedPossessives = clean
          .replace(/\b(one's|someone's|somebody's|your|my|his|her|their|our)\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();
        if (strippedPossessives && strippedPossessives.length > 0) {
          processed.add(strippedPossessives);
        }

        // Variante sans pronoms réfléchis et indéfinis impersonnels
        const strippedPronouns = clean
          .replace(/\b(oneself|yourself|himself|herself|itself|themselves|ourselves|someone|somebody|one|person|something|sb|sth)\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();
        if (strippedPronouns && strippedPronouns.length > 0) {
          processed.add(strippedPronouns);
        }

        // Variante combinée globale (sans articles, ni particules, ni pronoms impersonnels)
        const combined = clean
          .replace(/\b(a|an|the|to|one's|someone's|somebody's|your|my|his|her|their|our|oneself|yourself|himself|herself|itself|themselves|ourselves|someone|somebody|one|person|something|sb|sth)\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();
        if (combined && combined.length > 0) {
          processed.add(combined);
        }
      }
    });

    return Array.from(processed);
  },

  // Normalisation linguistique (forme canonique par défaut)
  normalize: (text, partOfSpeech = "") => {
    const variants = srsService.getNormalizedVariants(text, partOfSpeech);
    return variants[0] || (text || "").trim().toLowerCase();
  },

  // Distance de Levenshtein pour tolérer les petites coquilles de frappe sans altérer le sens
  levenshteinDistance: (a, b) => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  },

  // Extraction des variantes linguistiques tolérées en français (accents, élisions, articles, réflexifs)
  getFrenchNormalizedVariants: (text, partOfSpeech = "") => {
    if (!text || typeof text !== "string") return [];
    const pos = (partOfSpeech || "").toLowerCase().trim();

    let raw = text
      .trim()
      .toLowerCase()
      .replace(/[’‘`]/g, "'")
      .replace(/[.,!?;:]+$/g, "")
      .replace(/\s+/g, " ");

    if (!raw) return [];

    const stripAccents = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const forms = new Set([raw, stripAccents(raw)]);

    // Gestion du contenu entre parenthèses (ex: "se coucher (tard)" -> "se coucher" et "se coucher tard")
    if (raw.includes("(") && raw.includes(")")) {
      const withoutParens = raw.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
      if (withoutParens) {
        forms.add(withoutParens);
        forms.add(stripAccents(withoutParens));
      }
      const withParensStripped = raw.replace(/[()]/g, "").replace(/\s+/g, " ").trim();
      if (withParensStripped) {
        forms.add(withParensStripped);
        forms.add(stripAccents(withParensStripped));
      }
    }

    const processed = new Set();
    forms.forEach((str) => {
      let clean = str.trim();
      if (!clean) return;

      processed.add(clean);

      // Retrait des élisions et articles français initiaux
      const withoutLeadingArticles = clean
        .replace(/^(l'|d'|s'|c'|j'|m'|t'|n')/i, "")
        .replace(/^(le|la|les|un|une|des|du|de la|de l'|de)\s+/i, "")
        .trim();
      if (withoutLeadingArticles && withoutLeadingArticles !== clean) {
        processed.add(withoutLeadingArticles);
      }

      // Retrait des pronoms réflexifs initiaux pour verbes (ex: "se réveiller" -> "réveiller")
      if (pos === "verb" || /^se\s+/i.test(clean) || /^s'/i.test(clean)) {
        const withoutReflexive = clean.replace(/^(se\s+|s')/i, "").trim();
        if (withoutReflexive) {
          processed.add(withoutReflexive);
        }
      }

      // Retrait des articles internes ("faire l'acquisition" -> "faire acquisition")
      const withoutInnerArticles = clean
        .replace(/\b(le|la|les|un|une|des|du)\b/gi, "")
        .replace(/\b(l'|d')/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      if (withoutInnerArticles) {
        processed.add(withoutInnerArticles);
      }
    });

    return Array.from(processed).filter(Boolean);
  },

  // Vérification locale rapide d'une réponse française (Anglais -> Français)
  checkFrenchAnswerLocal: (userAnswer, word) => {
    if (!word || !userAnswer) return false;

    const pos = word.part_of_speech || "";
    const userVariants = srsService.getFrenchNormalizedVariants(userAnswer, pos);
    if (userVariants.length === 0) return false;

    const frenchCandidates = Array.isArray(word.french_translations)
      ? [...word.french_translations]
      : [word.french_translation_1, word.french_translation_2, word.french_translation_3].filter(Boolean);

    if (word.frenchPrompt) {
      frenchCandidates.push(word.frenchPrompt);
    }

    const targetVariants = new Set();
    frenchCandidates.forEach((c) => {
      srsService.getFrenchNormalizedVariants(c, pos).forEach((v) => targetVariants.add(v));
    });

    // 1. Correspondance exacte sur les variantes normalisées
    for (const uv of userVariants) {
      if (targetVariants.has(uv)) return true;
    }

    // 2. Tolérance pour fautes mineures de frappe (distance <= 1 pour les mots de 5 lettres ou plus)
    for (const uv of userVariants) {
      if (uv.length >= 5) {
        for (const tv of targetVariants) {
          if (tv.length >= 5 && Math.abs(uv.length - tv.length) <= 1) {
            if (srsService.levenshteinDistance(uv, tv) <= 1) {
              return true;
            }
          }
        }
      }
    }

    return false;
  },

  // Vérification de la réponse selon la direction du quiz
  checkAnswer: (userAnswer, word, direction = "fr_en") => {
    if (!word || !userAnswer) return false;

    // Sens Anglais -> Français : vérification locale des traductions françaises
    if (direction === "en_fr") {
      return srsService.checkFrenchAnswerLocal(userAnswer, word);
    }

    // Sens Français -> Anglais : vérification contre l'anglais attendu
    const pos = word.part_of_speech || "";
    const userVariants = srsService.getNormalizedVariants(userAnswer, pos);
    if (userVariants.length === 0) return false;

    const candidates = [
      word.english_word,
      ...(Array.isArray(word.accepted_answers) ? word.accepted_answers : [])
    ].filter(Boolean);

    const targetVariants = new Set();
    candidates.forEach((c) => {
      srsService.getNormalizedVariants(c, pos).forEach((v) => targetVariants.add(v));
    });

    // Tolérance : vrai si au moins une variante utilisateur correspond à une variante cible
    return userVariants.some((uv) => targetVariants.has(uv));
  },

  // Machine à états et règles de transition SRS protégées selon le QuizMode et la Direction
  // mode: "initial-learning" | "srs-review" | "free-practice"
  // direction: "fr_en" | "en_fr"
  calculateNextState: (rawWord, isCorrect, mode = "srs-review", customNow = null, direction = "fr_en") => {
    const word = srsService.sanitizeWord(rawWord);
    const now = (customNow ? new Date(customNow) : new Date()).toISOString();

    // --- Traitement de la direction ANGLAIS -> FRANÇAIS ---
    if (direction === "en_fr") {
      const stage = word.srsStage_en_fr || 0;
      let newStage = stage;
      let newLearningSuccessCount = word.learningSuccessCount_en_fr || 0;
      let newTotalCorrectAnswers = word.totalCorrectAnswers_en_fr || 0;
      let newLearned = word.learned_en_fr || false;
      let newIsMastered = word.isMastered_en_fr || false;
      let firstLearnedAt = word.firstLearnedAt_en_fr || null;
      let nextReviewAt = word.nextReviewAt_en_fr || null;
      let lastSrsReviewAt = word.lastSrsReviewAt_en_fr || null;

      // Entraînement libre : aucun impact sur le palier ni les révisions
      if (mode === "free-practice") {
        return {
          ...word,
          lastAnsweredAt_en_fr: now,
          lastCorrect_en_fr: isCorrect
        };
      }

      if (isCorrect) {
        newTotalCorrectAnswers += 1;

        if (stage === 0) {
          newLearningSuccessCount += 1;
          if (newLearningSuccessCount >= 3) {
            newStage = 1;
            newLearned = true;
            firstLearnedAt = firstLearnedAt || now;
            nextReviewAt = srsService.calculateNextReviewDate(1, now);
            lastSrsReviewAt = now;
          }
        } else if (stage >= 1 && stage <= 9) {
          const isDue = srsService.isReviewDue(word, now, "en_fr");
          if (isDue) {
            newStage = Math.min(10, stage + 1);
            newLearned = true;
            lastSrsReviewAt = now;

            if (newStage >= 10) {
              newIsMastered = true;
              nextReviewAt = null;
            } else {
              nextReviewAt = srsService.calculateNextReviewDate(newStage, now);
            }
          }
        }
      } else {
        if (stage === 0) {
          newLearningSuccessCount = 0;
          lastSrsReviewAt = now;
        } else if (stage === 1) {
          newStage = 0;
          newLearningSuccessCount = 0;
          newLearned = false;
          newIsMastered = false;
          nextReviewAt = null;
          lastSrsReviewAt = now;
        } else if (stage >= 2 && stage <= 9) {
          newStage = stage - 1;
          newLearned = true;
          newIsMastered = false;
          nextReviewAt = srsService.calculateNextReviewDate(1, now);
          lastSrsReviewAt = now;
        }
      }

      return srsService.sanitizeWord({
        ...word,
        srsStage_en_fr: newStage,
        learningSuccessCount_en_fr: newLearningSuccessCount,
        totalCorrectAnswers_en_fr: newTotalCorrectAnswers,
        learned_en_fr: newStage >= 1,
        isMastered_en_fr: newStage === 10,
        firstLearnedAt_en_fr: firstLearnedAt,
        nextReviewAt_en_fr: nextReviewAt,
        lastSrsReviewAt_en_fr: lastSrsReviewAt,
        lastAnsweredAt_en_fr: now,
        lastCorrect_en_fr: isCorrect
      });
    }

    // --- Traitement de la direction FRANÇAIS -> ANGLAIS (par défaut) ---
    const stage = word.srsStage;
    let newStage = stage;
    let newLearningSuccessCount = word.learningSuccessCount;
    let newTotalCorrectAnswers = word.totalCorrectAnswers;
    let newLearned = word.learned;
    let newIsMastered = word.isMastered;
    let firstLearnedAt = word.firstLearnedAt || null;
    let nextReviewAt = word.nextReviewAt;
    let lastSrsReviewAt = word.lastSrsReviewAt;

    // Entraînement libre
    if (mode === "free-practice") {
      return {
        ...word,
        lastAnsweredAt: now,
        lastAnswered: now,
        lastCorrect: isCorrect
      };
    }

    // Apprentissage initial ou Révision SRS
    if (isCorrect) {
      newTotalCorrectAnswers += 1;

      if (stage === 0) {
        newLearningSuccessCount += 1;
        if (newLearningSuccessCount >= 3) {
          newStage = 1;
          newLearned = true;
          firstLearnedAt = firstLearnedAt || now;
          nextReviewAt = srsService.calculateNextReviewDate(1, now);
          lastSrsReviewAt = now;
        }
      } else if (stage >= 1 && stage <= 9) {
        const isDue = srsService.isReviewDue(word, now, "fr_en");
        if (isDue) {
          newStage = Math.min(10, stage + 1);
          newLearned = true;
          lastSrsReviewAt = now;

          if (newStage >= 10) {
            newIsMastered = true;
            nextReviewAt = null;
          } else {
            nextReviewAt = srsService.calculateNextReviewDate(newStage, now);
          }
        }
      }
    } else {
      if (stage === 0) {
        newLearningSuccessCount = 0;
        lastSrsReviewAt = now;
      } else if (stage === 1) {
        newStage = 0;
        newLearningSuccessCount = 0;
        newLearned = false;
        newIsMastered = false;
        nextReviewAt = null;
        lastSrsReviewAt = now;
      } else if (stage >= 2 && stage <= 9) {
        newStage = stage - 1;
        newLearned = true;
        newIsMastered = false;
        nextReviewAt = srsService.calculateNextReviewDate(1, now);
        lastSrsReviewAt = now;
      }
    }

    return srsService.sanitizeWord({
      ...word,
      srsStage: newStage,
      learningSuccessCount: newLearningSuccessCount,
      totalCorrectAnswers: newTotalCorrectAnswers,
      learned: newStage >= 1,
      isMastered: newStage === 10,
      firstLearnedAt: firstLearnedAt,
      nextReviewAt: nextReviewAt,
      lastSrsReviewAt: lastSrsReviewAt,
      lastReviewedAt: lastSrsReviewAt,
      lastAnsweredAt: now,
      lastAnswered: now,
      lastCorrect: isCorrect
    });
  },

  // Ordonnancement & génération sécurisée de la file d'attente pour une direction spécifique
  buildRoundQueue: (candidateWords, recentHistory = [], direction = "fr_en") => {
    if (!Array.isArray(candidateWords) || candidateWords.length === 0) {
      return [];
    }

    const uniqueMap = new Map();
    candidateWords.forEach((w) => {
      if (w && w.id && !uniqueMap.has(String(w.id))) {
        uniqueMap.set(String(w.id), w);
      }
    });
    const uniqueList = Array.from(uniqueMap.values());

    if (uniqueList.length === 0) return [];
    if (uniqueList.length === 1) return [uniqueList[0].id];

    // Séparation : révisions dues d'abord selon la direction, puis autres
    const dueList = uniqueList.filter((w) => srsService.isReviewDue(w, new Date(), direction)).map((w) => w.id);
    const dueSet = new Set(dueList);
    const othersList = uniqueList.filter((w) => !dueSet.has(w.id)).map((w) => w.id);

    const shuffle = (array) => {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    let queue = [...shuffle(dueList), ...shuffle(othersList)];

    const lastId = recentHistory.length > 0 ? recentHistory[0] : null;
    if (queue.length > 1 && lastId && queue[0] === lastId) {
      const temp = queue[0];
      queue[0] = queue[1];
      queue[1] = temp;
    }

    return queue;
  },

  // Ordonnancement du mode MIXTE : file d'éléments { wordId, direction } ou { word, direction }
  // avec anti-répétition consécutive pour un même mot dans les deux sens
  buildMixedRoundQueue: (items, recentHistory = []) => {
    if (!Array.isArray(items) || items.length === 0) return [];
    if (items.length === 1) return [items[0]];

    const getEntryWordId = (item) => {
      if (!item) return null;
      if (typeof item === "string") return item;
      return item.wordId || item.word?.id || item.id || null;
    };

    const shuffle = (array) => {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    let queue = shuffle(items);

    // Anti-répétition consécutive stricte du même mot (que ce soit dans le même sens ou dans l'autre)
    for (let i = 0; i < queue.length; i++) {
      const prevWordId = i === 0 
        ? (recentHistory.length > 0 ? recentHistory[0] : null)
        : getEntryWordId(queue[i - 1]);

      const currentWordId = getEntryWordId(queue[i]);

      if (prevWordId && currentWordId && String(currentWordId) === String(prevWordId)) {
        // 1. Chercher en avant un candidat qui n'a pas le même ID
        let swapIdx = queue.findIndex((candidate, idx) => idx > i && String(getEntryWordId(candidate)) !== String(prevWordId));
        
        // 2. Si aucun candidat trouvé en avant (ex: en fin de tableau), chercher en arrière une position valide
        if (swapIdx === -1) {
          swapIdx = queue.findIndex((candidate, idx) => {
            if (idx >= i - 1) return false;
            const before = idx > 0 ? getEntryWordId(queue[idx - 1]) : null;
            const after = getEntryWordId(queue[idx + 1]);
            return String(currentWordId) !== String(before) && String(currentWordId) !== String(after);
          });
        }

        if (swapIdx !== -1) {
          const tmp = queue[i];
          queue[i] = queue[swapIdx];
          queue[swapIdx] = tmp;
        }
      }
    }

    return queue;
  },

  // Formater une date relative conviviale
  formatRelativeReviewDate: (nextReviewAt) => {
    if (!nextReviewAt) return null;
    const reviewDate = new Date(nextReviewAt);
    if (isNaN(reviewDate.getTime())) return null;

    const now = new Date();
    const diffTime = reviewDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return { text: "À réviser aujourd'hui", isDue: true, color: "text-amber-600 dark:text-amber-400 font-bold" };
    }
    if (diffDays === 1) {
      return { text: "Revue demain (J+1)", isDue: false, color: "text-blue-600 dark:text-blue-400" };
    }
    if (diffDays <= 7) {
      return { text: `Dans ${diffDays} jours`, isDue: false, color: "text-indigo-600 dark:text-indigo-400" };
    }
    if (diffDays <= 31) {
      const weeks = Math.round(diffDays / 7);
      return { text: `Dans ~${weeks} sem.`, isDue: false, color: "text-purple-600 dark:text-purple-400" };
    }
    const months = Math.round(diffDays / 30);
    return { text: `Dans ~${months} mois`, isDue: false, color: "text-emerald-600 dark:text-emerald-400" };
  }
};
