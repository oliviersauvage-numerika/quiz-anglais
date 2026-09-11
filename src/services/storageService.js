import { initialWords } from "../data/initialWords.js";
import { syncService, fromDBWord } from "./syncService.js";
import { srsService } from "./srsService.js";

const STORAGE_KEY = "quiz_anglais_vocab_v2";
const STATS_KEY = "quiz_anglais_stats_v2";
const PENDING_UPDATES_KEY = "quiz_anglais_pending_updates_v2";

export const storageService = {
  // Gestion de la file d'attente des modifications hors-ligne
  getPendingUpdates: () => {
    try {
      const stored = localStorage.getItem(PENDING_UPDATES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  },

  addPendingUpdate: (id, updates) => {
    try {
      const pending = storageService.getPendingUpdates();
      pending[String(id)] = {
        ...(pending[String(id)] || {}),
        ...updates,
        _updatedAt: Date.now()
      };
      localStorage.setItem(PENDING_UPDATES_KEY, JSON.stringify(pending));
    } catch (e) {
      console.warn("Erreur stockage modification en attente :", e);
    }
  },

  clearPendingUpdate: (id) => {
    try {
      const pending = storageService.getPendingUpdates();
      delete pending[String(id)];
      localStorage.setItem(PENDING_UPDATES_KEY, JSON.stringify(pending));
    } catch (e) {
      console.warn("Erreur suppression modification en attente :", e);
    }
  },

  flushPendingUpdates: async () => {
    const pending = storageService.getPendingUpdates();
    const ids = Object.keys(pending);
    if (ids.length === 0) return;

    for (const id of ids) {
      const { _updatedAt, ...updates } = pending[id];
      try {
        const res = await syncService.updateWord(id, updates);
        if (res && res.success) {
          storageService.clearPendingUpdate(id);
        }
      } catch (err) {
        console.warn(`Synchronisation différée échouée pour le mot ${id} :`, err);
      }
    }
  },

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
      // 0. Appliquer d'abord les éventuelles modifications hors-ligne en attente
      await storageService.flushPendingUpdates();

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
  updateWord: async (id, updates) => {
    const words = storageService.getWords();
    const updated = words.map((w) => (String(w.id) === String(id) ? srsService.sanitizeWord({ ...w, ...updates }) : w));
    storageService.saveWordsLocally(updated);

    // Synchronisation en base de données Supabase
    let syncRes = null;
    try {
      syncRes = await syncService.updateWord(id, updates);
      if (!syncRes || !syncRes.success) {
        storageService.addPendingUpdate(id, updates);
      } else {
        storageService.clearPendingUpdate(id);
      }
    } catch (e) {
      console.warn("Erreur mise à jour Supabase, mise en attente hors-ligne :", e);
      storageService.addPendingUpdate(id, updates);
      syncRes = { success: false, error: e.message };
    }

    return { words: updated, syncRes };
  },

  // Mettre à jour spécifiquement le descriptif contextuel (note de contexte / indice de sens)
  updateContextNote: async (id, newNote) => {
    const cleanNote = (typeof newNote === "string" ? newNote.trim() : "") || null;
    const isCleared = cleanNote === null;

    const words = storageService.getWords();
    const updated = words.map((w) => {
      if (String(w.id) !== String(id)) return w;

      const copy = { ...w };
      if (isCleared) {
        copy.exampleSentence = null;
        copy.notes = null;
        copy.example_sentence = null;
        copy.contextNoteCleared = true;
      } else {
        copy.exampleSentence = cleanNote;
        copy.notes = cleanNote;
        copy.example_sentence = cleanNote;
        delete copy.contextNoteCleared;
      }
      return srsService.sanitizeWord(copy);
    });

    storageService.saveWordsLocally(updated);

    const updates = {
      exampleSentence: cleanNote,
      notes: cleanNote,
      example_sentence: cleanNote
    };

    let syncRes = null;
    try {
      syncRes = await syncService.updateWord(id, updates);
      if (!syncRes || !syncRes.success) {
        storageService.addPendingUpdate(id, updates);
      } else {
        storageService.clearPendingUpdate(id);
      }
    } catch (e) {
      console.warn("Erreur synchronisation note Supabase, en attente hors-ligne :", e);
      storageService.addPendingUpdate(id, updates);
      syncRes = { success: false, error: e.message };
    }

    return { words: updated, syncRes };
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

  // Gestion de la préférence de direction ("fr_en" | "en_fr" | "mixed")
  getQuizDirectionPreference: () => {
    try {
      const saved = localStorage.getItem("quiz_anglais_direction_preference");
      if (saved === "fr_en" || saved === "en_fr" || saved === "mixed") {
        return saved;
      }
    } catch {}
    return "fr_en"; // Par défaut Français -> Anglais
  },

  setQuizDirectionPreference: (direction) => {
    try {
      if (["fr_en", "en_fr", "mixed"].includes(direction)) {
        localStorage.setItem("quiz_anglais_direction_preference", direction);
      }
    } catch {}
  },

  // Enregistrer le résultat du quiz avec prise en compte du mode et de la direction
  // mode: "initial-learning" | "srs-review" | "free-practice"
  // direction: "fr_en" | "en_fr"
  recordQuizResult: (id, isCorrect, mode = "srs-review", direction = "fr_en") => {
    const words = storageService.getWords();
    let updatedWord = null;

    const updated = words.map((w) => {
      if (w.id !== id) return w;
      updatedWord = srsService.calculateNextState(w, isCorrect, mode, null, direction);
      return updatedWord;
    });

    storageService.saveWordsLocally(updated);

    if (updatedWord) {
      if (direction === "en_fr") {
        syncService.updateWord(id, {
          srsStage_en_fr: updatedWord.srsStage_en_fr,
          learningSuccessCount_en_fr: updatedWord.learningSuccessCount_en_fr,
          totalCorrectAnswers_en_fr: updatedWord.totalCorrectAnswers_en_fr,
          learned_en_fr: updatedWord.learned_en_fr,
          firstLearnedAt_en_fr: updatedWord.firstLearnedAt_en_fr,
          nextReviewAt_en_fr: updatedWord.nextReviewAt_en_fr,
          lastSrsReviewAt_en_fr: updatedWord.lastSrsReviewAt_en_fr,
          isMastered_en_fr: updatedWord.isMastered_en_fr,
          lastAnsweredAt_en_fr: updatedWord.lastAnsweredAt_en_fr,
          lastCorrect_en_fr: updatedWord.lastCorrect_en_fr
        });
      } else {
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
    }

    // Les statistiques globales sont incrémentées pour tous les modes
    storageService.recordGlobalStats(isCorrect);
    return { words: updated, updatedWord };
  },

  // Réinitialiser la progression d'un mot ou de tous les mots (support ciblé par direction)
  resetWordProgress: (id, direction = "both") => {
    const words = storageService.getWords();
    const updated = words.map((w) => {
      if (w.id !== id) return w;

      const resetFrEn = direction === "both" || direction === "fr_en";
      const resetEnFr = direction === "both" || direction === "en_fr";

      const modified = { ...w };
      if (resetFrEn) {
        modified.learningSuccessCount = 0;
        modified.successCount = 0;
        modified.totalCorrectAnswers = 0;
        modified.learned = false;
        modified.srsStage = 0;
        modified.firstLearnedAt = undefined;
        modified.nextReviewAt = null;
        modified.lastSrsReviewAt = undefined;
        modified.lastReviewedAt = undefined;
        modified.isMastered = false;
      }
      if (resetEnFr) {
        modified.learningSuccessCount_en_fr = 0;
        modified.totalCorrectAnswers_en_fr = 0;
        modified.learned_en_fr = false;
        modified.srsStage_en_fr = 0;
        modified.firstLearnedAt_en_fr = undefined;
        modified.nextReviewAt_en_fr = null;
        modified.lastSrsReviewAt_en_fr = undefined;
        modified.isMastered_en_fr = false;
      }

      return srsService.sanitizeWord(modified);
    });

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

// Vider automatiquement la file d'attente hors-ligne dès que la connexion Internet est rétablie
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("online", () => {
    storageService.flushPendingUpdates().catch(() => {});
  });
}
