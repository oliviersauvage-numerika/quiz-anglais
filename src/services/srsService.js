// Service de gestion du Système de Répétition Espacée (SRS)

export const SRS_STAGES = {
  0: {
    level: 0,
    label: "En apprentissage",
    shortLabel: "Apprentissage",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
    intervalDays: 0,
    description: "Phase d'apprentissage initial (3 réussites à valider)"
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
    description: "Dernière révision mensuelle avant maîtrise totale"
  },
  10: {
    level: 10,
    label: "Définitivement Acquis 🎉",
    shortLabel: "Maîtrisé 🏆",
    badgeColor: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700",
    intervalDays: 0,
    description: "6 mois validés avec succès sans rechute : ancré à vie !"
  }
};

export const srsService = {
  // Obtenir les informations d'un palier
  getStageInfo: (stage = 0) => {
    return SRS_STAGES[stage] || SRS_STAGES[0];
  },

  // Calculer la prochaine date de révision
  calculateNextReviewDate: (stage) => {
    const info = SRS_STAGES[stage];
    if (!info || info.intervalDays === 0 || stage >= 10) return null;
    
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + info.intervalDays);
    return nextDate.toISOString();
  },

  // Vérifier si un mot doit être révisé aujourd'hui
  isReviewDue: (word) => {
    if (!word || word.isMastered || (word.srsStage || 0) < 1) return false;
    if (!word.nextReviewAt) return true;
    return new Date(word.nextReviewAt) <= new Date();
  },

  // Calculer le nouvel état d'un mot après une réponse au Quiz
  calculateNextState: (word, isCorrect) => {
    const now = new Date().toISOString();
    const currentStage = word.srsStage || (word.learned ? 1 : 0);
    const currentCount = word.successCount || 0;

    let newStage = currentStage;
    let newSuccessCount = currentCount;
    let newLearned = word.learned || false;
    let newIsMastered = word.isMastered || false;
    let firstLearnedAt = word.firstLearnedAt || null;
    let nextReviewAt = word.nextReviewAt || null;

    if (isCorrect) {
      if (currentStage === 0) {
        // En phase d'apprentissage initial
        newSuccessCount = currentCount + 1;
        if (newSuccessCount >= 3) {
          // Première acquisition réussie !
          newStage = 1;
          newLearned = true;
          firstLearnedAt = firstLearnedAt || now;
          nextReviewAt = srsService.calculateNextReviewDate(1); // J+1
        }
      } else {
        // En phase de répétition espacée (Paliers 1 à 9)
        newSuccessCount = currentCount + 1;
        newStage = Math.min(10, currentStage + 1);
        newLearned = true;
        
        if (newStage >= 10) {
          newIsMastered = true;
          nextReviewAt = null;
        } else {
          nextReviewAt = srsService.calculateNextReviewDate(newStage);
        }
      }
    } else {
      // ERREUR : Application de l'Option B (Rétrogradation d'un palier)
      if (currentStage >= 2) {
        // Rétrograde d'un palier avec révision rapprochée à J+1 pour vite consolider
        newStage = currentStage - 1;
        newLearned = true;
        newIsMastered = false;
        
        const reviewDate = new Date();
        reviewDate.setDate(reviewDate.getDate() + 1); // Revoir dès demain
        nextReviewAt = reviewDate.toISOString();
      } else if (currentStage === 1) {
        // Rétrograde en apprentissage initial (2 étoiles sur 3)
        newStage = 0;
        newSuccessCount = 2;
        newLearned = false;
        newIsMastered = false;
        nextReviewAt = null;
      } else {
        // Était déjà au palier 0
        newStage = 0;
        newLearned = false;
        newIsMastered = false;
        nextReviewAt = null;
      }
    }

    return {
      ...word,
      srsStage: newStage,
      successCount: newSuccessCount,
      learned: newLearned,
      isMastered: newIsMastered,
      firstLearnedAt: firstLearnedAt,
      nextReviewAt: nextReviewAt,
      lastReviewedAt: now,
      lastAnswered: now,
      lastCorrect: isCorrect
    };
  },

  // Formater une date relative conviviale pour l'interface
  formatRelativeReviewDate: (nextReviewAt) => {
    if (!nextReviewAt) return null;
    const reviewDate = new Date(nextReviewAt);
    const now = new Date();
    
    // Normaliser au jour (sans heures)
    const diffTime = reviewDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return { text: "À réviser aujourd'hui", isDue: true, color: "text-amber-600 dark:text-amber-400 font-bold" };
    }
    if (diffDays === 1) {
      return { text: "Revue demain", isDue: false, color: "text-blue-600 dark:text-blue-400" };
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
