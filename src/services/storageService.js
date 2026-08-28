import { initialWords } from "../data/initialWords";
import { syncService } from "./syncService";

const STORAGE_KEY = "quiz_anglais_vocab_v2";
const STATS_KEY = "quiz_anglais_stats_v2";

export const storageService = {
  getWords: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialWords));
        return initialWords;
      }
      const parsed = JSON.parse(stored);
      // Nettoyer d'éventuels anciens exemples résiduels
      return parsed.map(({ example_english, example_french, ...rest }) => rest);
    } catch (e) {
      console.error("Erreur lors de la lecture du LocalStorage", e);
      return initialWords;
    }
  },

  saveWords: (words, triggerSync = true) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
      if (triggerSync) {
        storageService.triggerAutoSync();
      }
    } catch (e) {
      console.error("Erreur lors de la sauvegarde du LocalStorage", e);
    }
  },

  // Déclenche une synchronisation en arrière-plan vers Supabase
  triggerAutoSync: () => {
    try {
      const words = storageService.getWords();
      const stats = storageService.getGlobalStats();
      syncService.pushData({ words, stats, exportedAt: new Date().toISOString() });
    } catch (err) {
      console.error("Erreur lors de la synchronisation automatique :", err);
    }
  },

  // Appliquer des données reçues du Cloud (sans réémettre de push)
  applyRemoteData: (remoteData) => {
    if (!remoteData || !Array.isArray(remoteData.words)) return false;
    
    try {
      const cleaned = remoteData.words.map(({ example_english, example_french, ...rest }) => rest);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      if (remoteData.stats) {
        localStorage.setItem(STATS_KEY, JSON.stringify(remoteData.stats));
      }
      return true;
    } catch (e) {
      console.error("Erreur lors de l'application des données distantes :", e);
      return false;
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
  addWord: (newWordData) => {
    const words = storageService.getWords();
    const duplicate = storageService.findDuplicate(newWordData.english_word, newWordData.part_of_speech);
    
    if (duplicate) {
      return { success: false, reason: "duplicate", existing: duplicate };
    }

    const word = {
      id: "word-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
      english_word: (newWordData.english_word || "").trim(),
      part_of_speech: (newWordData.part_of_speech || "noun").trim().toLowerCase(),
      french_translations: Array.isArray(newWordData.french_translations) 
        ? newWordData.french_translations.filter(Boolean)
        : [newWordData.french_translation_1].filter(Boolean),
      successCount: 0,
      learned: false,
      createdAt: new Date().toISOString()
    };

    const updated = [word, ...words];
    storageService.saveWords(updated);
    return { success: true, word };
  },

  // Mettre à jour un mot
  updateWord: (id, updates) => {
    const words = storageService.getWords();
    const updated = words.map((w) => (w.id === id ? { ...w, ...updates } : w));
    storageService.saveWords(updated);
    return updated;
  },

  // Supprimer un mot
  deleteWord: (id) => {
    const words = storageService.getWords();
    const updated = words.filter((w) => w.id !== id);
    storageService.saveWords(updated);
    return updated;
  },

  // Enregistrer le résultat du quiz
  recordQuizResult: (id, isCorrect) => {
    const words = storageService.getWords();
    let updatedWord = null;

    const updated = words.map((w) => {
      if (w.id !== id) return w;
      
      const currentCount = w.successCount || 0;
      const newCount = isCorrect ? currentCount + 1 : currentCount;
      const isLearned = newCount >= 3;

      updatedWord = {
        ...w,
        successCount: newCount,
        learned: isLearned,
        lastAnswered: new Date().toISOString(),
        lastCorrect: isCorrect
      };
      return updatedWord;
    });

    storageService.saveWords(updated, false); // Ne pas déclencher le push tout de suite
    storageService.recordGlobalStats(isCorrect, true); // Déclenchera le push avec stats mises à jour

    return { words: updated, updatedWord };
  },

  // Réinitialiser la progression d'un mot ou de tous les mots
  resetWordProgress: (id) => {
    const words = storageService.getWords();
    const updated = words.map((w) => 
      w.id === id ? { ...w, successCount: 0, learned: false } : w
    );
    storageService.saveWords(updated);
    return updated;
  },

  resetAllProgress: () => {
    const words = storageService.getWords();
    const updated = words.map((w) => ({
      ...w,
      successCount: 0,
      learned: false,
      lastAnswered: undefined
    }));
    storageService.saveWords(updated);
    return updated;
  },

  restoreInitialWords: () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialWords));
    storageService.triggerAutoSync();
    return initialWords;
  },

  getGlobalStats: () => {
    try {
      const stored = localStorage.getItem(STATS_KEY);
      return stored ? JSON.parse(stored) : { totalAnswered: 0, correctAnswers: 0, streak: 0, maxStreak: 0 };
    } catch {
      return { totalAnswered: 0, correctAnswers: 0, streak: 0, maxStreak: 0 };
    }
  },

  recordGlobalStats: (isCorrect, triggerSync = true) => {
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
    if (triggerSync) {
      storageService.triggerAutoSync();
    }
  },

  exportData: () => {
    const words = storageService.getWords();
    const stats = storageService.getGlobalStats();
    return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), words, stats }, null, 2);
  },

  importData: (jsonString) => {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.words)) {
        const cleaned = data.words.map(({ example_english, example_french, ...rest }) => rest);
        storageService.saveWords(cleaned);
        if (data.stats) {
          localStorage.setItem(STATS_KEY, JSON.stringify(data.stats));
        }
        storageService.triggerAutoSync();
        return { success: true, count: cleaned.length };
      }
      return { success: false, error: "Format JSON invalide (clé 'words' manquante)" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
