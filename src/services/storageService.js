import { initialWords } from "../data/initialWords";
import { syncService, fromDBWord } from "./syncService";
import { srsService } from "./srsService";

const STORAGE_KEY = "quiz_anglais_vocab_v2";
const STATS_KEY = "quiz_anglais_stats_v2";

export const storageService = {
  // Lecture synchrone immédiate depuis le cache local avec nettoyage/assainissement
  getWords: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        const sanitizedInitials = initialWords.map(srsService.sanitizeWord);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedInitials));
        return sanitizedInitials;
      }
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return initialWords.map(srsService.sanitizeWord);
      return parsed.map(srsService.sanitizeWord);
    } catch (e) {
      console.error("Erreur lors de la lecture du LocalStorage", e);
      return initialWords.map(srsService.sanitizeWord);
    }
  },

  // Sauvegarde dans le cache local
  saveWordsLocally: (words) => {
    try {
      const sanitized = words.map(srsService.sanitizeWord);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch (e) {
      console.error("Erreur lors de la sauvegarde locale", e);
    }
  },

  // Rafraîchir les mots depuis Supabase et mettre à jour le cache local
  refreshFromSupabase: async () => {
    try {
      const res = await syncService.fetchWords();
      if (res.success && Array.isArray(res.words)) {
        const localWords = storageService.getWords();

        // 1. Si Supabase est totalement vide mais qu'on a des mots locaux : migration complète
        if (res.words.length === 0 && localWords.length > 0) {
          const stats = storageService.getGlobalStats();
          await syncService.migrateWords(localWords, stats);
          return { words: localWords, migrated: true, count: localWords.length };
        }

        // 2. Détecter d'éventuels mots locaux ajoutés hors-ligne ou non encore dans Supabase
        const remoteIds = new Set(res.words.map((w) => String(w.id)));
        const unsyncedWords = localWords.filter((w) => !remoteIds.has(String(w.id)));

        let finalWords = res.words.map(srsService.sanitizeWord);

        if (unsyncedWords.length > 0) {
          try {
            await syncService.migrateWords(unsyncedWords);
          } catch (e) {
            console.warn("Synchronisation des mots locaux en attente :", e);
          }
          finalWords = [...unsyncedWords.map(srsService.sanitizeWord), ...finalWords];
        }

        storageService.saveWordsLocally(finalWords);

        // Récupérer également les stats
        const statsRes = await syncService.fetchStats();
        if (statsRes.success && statsRes.stats) {
          localStorage.setItem(STATS_KEY, JSON.stringify(statsRes.stats));
        }

        return { words: finalWords, migrated: false };
      }
      return { words: storageService.getWords(), error: res.error };
    } catch (err) {
      console.error("Erreur lors du rafraîchissement Supabase :", err);
      return { words: storageService.getWords(), error: err.message };
    }
  },

  // Appliquer des modifications reçues en temps réel depuis Supabase
  applyRemoteRealtimeEvent: (event) => {
    try {
      if (!event) return storageService.getWords();

      if (event.type === "words_change" && event.payload) {
        const { eventType, new: newRow, old: oldRow } = event.payload;
        let words = storageService.getWords();

        if (eventType === "INSERT" && newRow) {
          const exists = words.some((w) => w.id === String(newRow.id));
          if (!exists) {
            words = [srsService.sanitizeWord(fromDBWord(newRow)), ...words];
          }
        } else if (eventType === "UPDATE" && newRow) {
          const updatedWord = srsService.sanitizeWord(fromDBWord(newRow));
          words = words.map((w) => (w.id === String(newRow.id) ? { ...w, ...updatedWord } : w));
        } else if (eventType === "DELETE" && oldRow) {
          words = words.filter((w) => w.id !== String(oldRow.id));
        }

        storageService.saveWordsLocally(words);
        return words;
      }

      if (event.type === "stats_change" && event.data) {
        localStorage.setItem(STATS_KEY, JSON.stringify(event.data));
      }

      return storageService.getWords();
    } catch (err) {
      console.error("Erreur application événement temps réel :", err);
      return storageService.getWords();
    }
  },

  // Vérifie si un mot existe déjà (insensible à la casse)
  findDuplicate: (englishWord, partOfSpeech) => {
    const words = storageService.getWords();
    const cleanEn = (englishWord || "").trim().toLowerCase();
    const cleanPos = (partOfSpeech || "").trim().toLowerCase();
    
    return words.find((w) => {
      const sameEn = (w.english_word || "").trim().toLowerCase() === cleanEn;
      if (!sameEn) return false;
      if (cleanPos && w.part_of_speech) {
        return w.part_of_speech.toLowerCase() === cleanPos;
      }
      return true;
    });
  },

  // Ajouter un mot
  addWord: async (newWordData) => {
    const words = storageService.getWords();
    const duplicate = storageService.findDuplicate(newWordData.english_word, newWordData.part_of_speech);
    
    if (duplicate) {
      return { success: false, reason: "duplicate", existing: duplicate };
    }

    const word = srsService.sanitizeWord({
      id: "word-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
      english_word: (newWordData.english_word || "").trim(),
      part_of_speech: (newWordData.part_of_speech || "noun").trim().toLowerCase(),
      french_translations: Array.isArray(newWordData.french_translations) 
        ? newWordData.french_translations.filter(Boolean)
        : [newWordData.french_translation_1].filter(Boolean),
      accepted_answers: Array.isArray(newWordData.accepted_answers)
        ? newWordData.accepted_answers.filter(Boolean)
        : [],
      frenchPrompt: newWordData.frenchPrompt || undefined,
      exampleSentence: newWordData.exampleSentence || undefined,
      senseId: newWordData.senseId || undefined,
      srsStage: 0,
      learningSuccessCount: 0,
      totalCorrectAnswers: 0,
      learned: false,
      isMastered: false,
      createdAt: new Date().toISOString()
    });

    // 1. Sauvegarde locale immédiate (optimiste)
    const updated = [word, ...words];
    storageService.saveWordsLocally(updated);

    // 2. Insertion en base de données Supabase
    let syncError = null;
    try {
      const syncRes = await syncService.insertWord(word);
      if (syncRes && !syncRes.success && syncRes.error) {
        syncError = syncRes.error;
        console.warn("Échec d'insertion Supabase :", syncRes.error);
      }
    } catch (e) {
      syncError = e.message;
      console.warn("Supabase insertion en arrière-plan :", e);
    }

    return { success: true, word, syncError };
  },

  // Mettre à jour un mot
  updateWord: (id, updates) => {
    const words = storageService.getWords();
    const updated = words.map((w) => (w.id === id ? srsService.sanitizeWord({ ...w, ...updates }) : w));
    storageService.saveWordsLocally(updated);

    // Synchronisation en base de données Supabase
    syncService.updateWord(id, updates);

    return updated;
  },

  // Supprimer un mot
  deleteWord: (id) => {
    const words = storageService.getWords();
    const updated = words.filter((w) => w.id !== id);
    storageService.saveWordsLocally(updated);

    // Suppression en base de données Supabase
    syncService.deleteWord(id);

    return updated;
  },

  // Enregistrer le résultat du quiz avec prise en compte du mode ("initial-learning" | "srs-review" | "free-practice")
  recordQuizResult: (id, isCorrect, mode = "srs-review") => {
    const words = storageService.getWords();
    let updatedWord = null;

    const updated = words.map((w) => {
      if (w.id !== id) return w;
      updatedWord = srsService.calculateNextState(w, isCorrect, mode);
      return updatedWord;
    });

    storageService.saveWordsLocally(updated);

    if (updatedWord) {
      syncService.updateWord(id, {
        successCount: updatedWord.learningSuccessCount,
        learningSuccessCount: updatedWord.learningSuccessCount,
        totalCorrectAnswers: updatedWord.totalCorrectAnswers,
        learned: updatedWord.learned,
        srsStage: updatedWord.srsStage,
        firstLearnedAt: updatedWord.firstLearnedAt,
        nextReviewAt: updatedWord.nextReviewAt,
        lastSrsReviewAt: updatedWord.lastSrsReviewAt,
        lastReviewedAt: updatedWord.lastSrsReviewAt,
        isMastered: updatedWord.isMastered,
        lastAnsweredAt: updatedWord.lastAnsweredAt,
        lastAnswered: updatedWord.lastAnsweredAt,
        lastCorrect: updatedWord.lastCorrect
      });
    }

    // Les statistiques globales sont incrémentées pour tous les modes
    storageService.recordGlobalStats(isCorrect);
    return { words: updated, updatedWord };
  },

  // Réinitialiser la progression d'un mot ou de tous les mots
  resetWordProgress: (id) => {
    const words = storageService.getWords();
    const updated = words.map((w) => 
      w.id === id ? srsService.sanitizeWord({ 
        ...w, 
        learningSuccessCount: 0, 
        successCount: 0,
        totalCorrectAnswers: 0,
        learned: false, 
        srsStage: 0, 
        firstLearnedAt: undefined, 
        nextReviewAt: null, 
        lastSrsReviewAt: undefined, 
        lastReviewedAt: undefined, 
        isMastered: false 
      }) : w
    );
    storageService.saveWordsLocally(updated);
    syncService.updateWord(id, { 
      successCount: 0, 
      learningSuccessCount: 0,
      totalCorrectAnswers: 0,
      learned: false, 
      srsStage: 0, 
      firstLearnedAt: null, 
      nextReviewAt: null, 
      lastSrsReviewAt: null,
      lastReviewedAt: null, 
      isMastered: false 
    });
    return updated;
  },

  resetAllProgress: () => {
    const words = storageService.getWords();
    const updated = words.map((w) => srsService.sanitizeWord({
      ...w,
      learningSuccessCount: 0,
      successCount: 0,
      totalCorrectAnswers: 0,
      learned: false,
      srsStage: 0,
      firstLearnedAt: undefined,
      nextReviewAt: null,
      lastSrsReviewAt: undefined,
      lastReviewedAt: undefined,
      isMastered: false,
      lastAnsweredAt: undefined,
      lastAnswered: undefined,
      lastCorrect: undefined
    }));
    storageService.saveWordsLocally(updated);
    syncService.migrateWords(updated);
    return updated;
  },

  restoreInitialWords: async () => {
    const sanitized = initialWords.map(srsService.sanitizeWord);
    storageService.saveWordsLocally(sanitized);
    await syncService.migrateWords(sanitized);
    return sanitized;
  },

  getGlobalStats: () => {
    try {
      const stored = localStorage.getItem(STATS_KEY);
      return stored ? JSON.parse(stored) : { totalAnswered: 0, correctAnswers: 0, streak: 0, maxStreak: 0 };
    } catch {
      return { totalAnswered: 0, correctAnswers: 0, streak: 0, maxStreak: 0 };
    }
  },

  recordGlobalStats: (isCorrect) => {
    const stats = storageService.getGlobalStats();
    stats.totalAnswered = (stats.totalAnswered || 0) + 1;
    if (isCorrect) {
      stats.correctAnswers = (stats.correctAnswers || 0) + 1;
      stats.streak = (stats.streak || 0) + 1;
      stats.maxStreak = Math.max(stats.maxStreak || 0, stats.streak);
    } else {
      stats.streak = 0;
    }
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    syncService.saveStats(stats);
  },

  exportData: () => {
    const words = storageService.getWords();
    const stats = storageService.getGlobalStats();
    return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), words, stats }, null, 2);
  },

  importData: async (jsonString) => {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.words)) {
        const cleaned = data.words.map(srsService.sanitizeWord);
        storageService.saveWordsLocally(cleaned);
        if (data.stats) {
          localStorage.setItem(STATS_KEY, JSON.stringify(data.stats));
        }
        await syncService.migrateWords(cleaned, data.stats || null);
        return { success: true, count: cleaned.length };
      }
      return { success: false, error: "Format JSON invalide (clé 'words' manquante)" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
