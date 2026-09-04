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

  // Nettoyer, normaliser et garantir la cohérence des propriétés d'un mot
  sanitizeWord: (word) => {
    if (!word || typeof word !== "object") return word;

    const rawStage = typeof word.srsStage === "number"
      ? word.srsStage
      : (typeof word.srs_stage === "number" ? word.srs_stage : (word.learned ? 1 : 0));
    const srsStage = Math.max(0, Math.min(10, Math.floor(Number(rawStage) || 0)));

    // Migration transparente des compteurs successCount -> learningSuccessCount & totalCorrectAnswers
    const legacyCount = typeof word.successCount === "number" 
      ? word.successCount 
      : (typeof word.success_count === "number" ? word.success_count : 0);
    
    const learningSuccessCount = typeof word.learningSuccessCount === "number"
      ? word.learningSuccessCount
      : (srsStage === 0 ? legacyCount : 0);

    const totalCorrectAnswers = typeof word.totalCorrectAnswers === "number"
      ? word.totalCorrectAnswers
      : legacyCount;

    // Cohérence stricte garantie
    const learned = srsStage >= 1;
    const isMastered = srsStage === 10;

    // Normalisation des dates (ISO string ou null/undefined)
    const nextReviewAt = (isMastered || srsStage === 0) 
      ? null 
      : (word.nextReviewAt || word.next_review_at || null);

    const lastAnsweredAt = word.lastAnsweredAt || word.lastAnswered || word.last_answered || null;
    const lastSrsReviewAt = word.lastSrsReviewAt || word.lastReviewedAt || word.last_reviewed_at || null;

    // Gestion multi-réponses et sens
    const acceptedAnswers = Array.isArray(word.accepted_answers) 
      ? word.accepted_answers 
      : (Array.isArray(word.acceptedAnswers) ? word.acceptedAnswers : []);

    return {
      ...word,
      srsStage,
      learningSuccessCount,
      totalCorrectAnswers,
      learned,
      isMastered,
      nextReviewAt,
      lastAnsweredAt,
      lastSrsReviewAt,
      accepted_answers: acceptedAnswers,
      frenchPrompt: word.frenchPrompt || word.french_prompt || undefined,
      exampleSentence: word.exampleSentence || word.example_sentence || undefined,
      senseId: word.senseId || word.sense_id || undefined,
      // Champs de compatibilité
      successCount: learningSuccessCount,
      lastAnswered: lastAnsweredAt,
      lastReviewedAt: lastSrsReviewAt
    };
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

  // Vérifier si un mot a une date d'échéance valide et atteinte
  isReviewDue: (word, now = new Date()) => {
    if (!word) return false;
    const stage = typeof word.srsStage === "number" ? word.srsStage : 0;
    
    // Une carte au palier 0 ou 10 n'a pas de révision SRS due
    if (stage < 1 || stage >= 10 || word.isMastered) return false;

    const nextReviewAt = word.nextReviewAt || word.next_review_at;
    // Une date absente ou invalide pour un palier >= 1 est une anomalie et ne doit pas être silencieusement considérée comme échue
    if (!nextReviewAt) return false;

    const reviewDate = new Date(nextReviewAt);
    if (isNaN(reviewDate.getTime())) return false;

    const currentDate = new Date(now);
    return reviewDate <= currentDate;
  },

  // Normalisation linguistique rigoureuse par catégorie grammaticale
  normalize: (text, partOfSpeech = "") => {
    let clean = (text || "")
      .trim()
      .toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/\s+/g, " ");

    const pos = (partOfSpeech || "").toLowerCase().trim();

    // Règle 1 : Retirer 'to ' UNIQUEMENT pour les verbes
    if (pos === "verb") {
      clean = clean.replace(/^to\s+/i, "").trim();
    }

    // Règle 2 : Retirer les articles 'a', 'an', 'the' UNIQUEMENT pour les noms
    if (pos === "noun") {
      clean = clean.replace(/^(a|an|the)\s+/i, "").trim();
    }

    return clean;
  },

  // Vérification de la réponse contre toutes les réponses acceptées
  checkAnswer: (userAnswer, word) => {
    if (!word || !userAnswer) return false;

    const pos = word.part_of_speech || "";
    const normalizedUser = srsService.normalize(userAnswer, pos);
    if (!normalizedUser) return false;

    const candidates = [
      word.english_word,
      ...(Array.isArray(word.accepted_answers) ? word.accepted_answers : [])
    ].filter(Boolean);

    // Élimination des doublons après normalisation
    const normalizedCandidates = Array.from(
      new Set(candidates.map((c) => srsService.normalize(c, pos)))
    );

    return normalizedCandidates.some((target) => target === normalizedUser);
  },

  // Machine à états et règles de transition SRS protégées selon le QuizMode
  // mode: "initial-learning" | "srs-review" | "free-practice"
  calculateNextState: (rawWord, isCorrect, mode = "srs-review", customNow = null) => {
    const word = srsService.sanitizeWord(rawWord);
    const now = (customNow ? new Date(customNow) : new Date()).toISOString();

    const stage = word.srsStage;
    let newStage = stage;
    let newLearningSuccessCount = word.learningSuccessCount;
    let newTotalCorrectAnswers = word.totalCorrectAnswers;
    let newLearned = word.learned;
    let newIsMastered = word.isMastered;
    let firstLearnedAt = word.firstLearnedAt || null;
    let nextReviewAt = word.nextReviewAt;
    let lastSrsReviewAt = word.lastSrsReviewAt;

    // MODE 3 : Entraînement libre (free-practice) -> Aucun impact sur l'état SRS
    if (mode === "free-practice") {
      return {
        ...word,
        lastAnsweredAt: now,
        lastAnswered: now,
        lastCorrect: isCorrect
      };
    }

    // MODE 1 & 2 : Apprentissage initial ou Révision SRS
    if (isCorrect) {
      newTotalCorrectAnswers += 1;

      if (stage === 0) {
        // Apprentissage initial (Palier 0) : 3 réussites consécutives requises
        newLearningSuccessCount += 1;
        if (newLearningSuccessCount >= 3) {
          // Passage au Palier 1
          newStage = 1;
          newLearned = true;
          firstLearnedAt = firstLearnedAt || now;
          nextReviewAt = srsService.calculateNextReviewDate(1, now); // J+1
          lastSrsReviewAt = now;
        }
      } else if (stage >= 1 && stage <= 9) {
        // Révision SRS (Paliers 1 à 9)
        // Vérification de sécurité : la date d'échéance doit être valide et atteinte
        const isDue = srsService.isReviewDue(word, now);
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
        // Si non échue (inappropriée), ne pas avancer de palier
      }
      // Palier 10 : Non modifié par le SRS standard
    } else {
      // ERREUR
      if (stage === 0) {
        // Au palier 0 : réinitialisation du compteur à zéro
        newLearningSuccessCount = 0;
        lastSrsReviewAt = now;
      } else if (stage === 1) {
        // Erreur au palier 1 : retour au palier 0 avec compteur nul
        newStage = 0;
        newLearningSuccessCount = 0;
        newLearned = false;
        newIsMastered = false;
        nextReviewAt = null;
        lastSrsReviewAt = now;
      } else if (stage >= 2 && stage <= 9) {
        // Rétrogradation douce d'un palier unique avec consolidation urgente à J+1
        newStage = stage - 1;
        newLearned = true;
        newIsMastered = false;
        nextReviewAt = srsService.calculateNextReviewDate(1, now); // Revoir dès demain
        lastSrsReviewAt = now;
      }
      // Palier 10 : Non modifié par le SRS standard
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

  // Ordonnancement & génération sécurisée de la file d'attente
  buildRoundQueue: (candidateWords, recentHistory = []) => {
    if (!Array.isArray(candidateWords) || candidateWords.length === 0) {
      return [];
    }

    // Déduplication stricte par identifiant
    const uniqueMap = new Map();
    candidateWords.forEach((w) => {
      if (w && w.id && !uniqueMap.has(String(w.id))) {
        uniqueMap.set(String(w.id), w);
      }
    });
    const uniqueList = Array.from(uniqueMap.values());

    if (uniqueList.length === 0) return [];
    if (uniqueList.length === 1) return [uniqueList[0].id];

    // Séparation : révisions dues d'abord, puis apprentissage / autres
    const dueList = uniqueList.filter((w) => srsService.isReviewDue(w)).map((w) => w.id);
    const dueSet = new Set(dueList);
    const othersList = uniqueList.filter((w) => !dueSet.has(w.id)).map((w) => w.id);

    // Mélange Fisher-Yates séparé
    const shuffle = (array) => {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    let queue = [...shuffle(dueList), ...shuffle(othersList)];

    // Protection anti-répétition consécutive
    // recentHistory: tableau des derniers IDs posés (ex: [lastId, secondLastId])
    const lastId = recentHistory.length > 0 ? recentHistory[0] : null;

    if (queue.length > 1 && lastId && queue[0] === lastId) {
      // Échanger avec le 2e élément
      const temp = queue[0];
      queue[0] = queue[1];
      queue[1] = temp;
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
