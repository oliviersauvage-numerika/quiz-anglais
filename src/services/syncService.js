import { createClient } from "@supabase/supabase-js";

const SYNC_CONFIG_KEY = "quiz_anglais_sync_config";
const SYNC_CODE_KEY = "quiz_anglais_sync_code";

// Configuration par défaut ou stockée
const DEFAULT_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL || "",
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  syncCode: "",
  autoSync: true,
};

// Fonctions de transformation Objet JS <-> Ligne Base de Données
export function toDBWord(w) {
  return {
    id: String(w.id || ("word-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5))),
    english_word: (w.english_word || "").trim(),
    part_of_speech: (w.part_of_speech || "noun").trim().toLowerCase(),
    french_translations: Array.isArray(w.french_translations) 
      ? w.french_translations.filter(Boolean)
      : [w.french_translation_1].filter(Boolean),
    success_count: typeof w.successCount === "number" ? w.successCount : (w.success_count || 0),
    learned: Boolean(w.learned),
    srs_stage: typeof w.srsStage === "number" ? w.srsStage : (typeof w.srs_stage === "number" ? w.srs_stage : (w.learned ? 1 : 0)),
    first_learned_at: w.firstLearnedAt || w.first_learned_at || (w.learned ? w.createdAt || new Date().toISOString() : null),
    next_review_at: w.nextReviewAt || w.next_review_at || null,
    last_reviewed_at: w.lastReviewedAt || w.last_reviewed_at || null,
    is_mastered: Boolean(w.isMastered || w.is_mastered || (w.srsStage >= 10)),
    last_answered: w.lastAnswered || w.last_answered || null,
    last_correct: typeof w.lastCorrect === "boolean" ? w.lastCorrect : (typeof w.last_correct === "boolean" ? w.last_correct : null),
    created_at: w.createdAt || w.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function fromDBWord(row) {
  return {
    id: String(row.id),
    english_word: row.english_word,
    part_of_speech: row.part_of_speech,
    french_translations: Array.isArray(row.french_translations) ? row.french_translations : [],
    successCount: row.success_count ?? 0,
    learned: Boolean(row.learned),
    srsStage: typeof row.srs_stage === "number" ? row.srs_stage : (row.learned ? 1 : 0),
    firstLearnedAt: row.first_learned_at || undefined,
    nextReviewAt: row.next_review_at || undefined,
    lastReviewedAt: row.last_reviewed_at || undefined,
    isMastered: Boolean(row.is_mastered || (row.srs_stage >= 10)),
    lastAnswered: row.last_answered || undefined,
    lastCorrect: row.last_correct !== null ? row.last_correct : undefined,
    createdAt: row.created_at || new Date().toISOString()
  };
}

export function toDBStats(stats) {
  return {
    id: "global_stats",
    total_answered: stats.totalAnswered || 0,
    correct_answers: stats.correctAnswers || 0,
    streak: stats.streak || 0,
    max_streak: stats.maxStreak || 0,
    updated_at: new Date().toISOString()
  };
}

export function fromDBStats(row) {
  return {
    totalAnswered: row.total_answered || 0,
    correctAnswers: row.correct_answers || 0,
    streak: row.streak || 0,
    maxStreak: row.max_streak || 0
  };
}

class SyncService {
  constructor() {
    this.client = null;
    this.wordsChannel = null;
    this.statsChannel = null;
    this.listeners = new Set();
    this.statusListeners = new Set();
    this.status = "idle"; // "idle" | "syncing" | "synced" | "error" | "offline"
    this.lastSyncedAt = null;

    // Vérifier si des paramètres de jumelage sont présents dans l'URL
    this.checkUrlPairing();
    this.init();
  }

  // Permet de jumeler l'iPhone en 1 scan de QR Code ou clic de lien
  checkUrlPairing() {
    try {
      if (typeof window === "undefined") return;
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      const queryString = hash.includes("pair?") 
        ? hash.split("pair?")[1] 
        : search.startsWith("?") ? search.slice(1) : "";

      if (!queryString) return;

      const params = new URLSearchParams(queryString);
      const url = params.get("url");
      const key = params.get("key");
      const code = params.get("code");
      const gemini = params.get("gemini");

      if (url && key) {
        this.saveConfig({
          url: decodeURIComponent(url),
          anonKey: decodeURIComponent(key),
          syncCode: code ? decodeURIComponent(code) : ""
        });
      }

      if (gemini) {
        localStorage.setItem("quiz_anglais_gemini_api_key", decodeURIComponent(gemini).trim());
      }

      // Nettoyer l'URL
      if (url || key || gemini) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch (e) {
      console.warn("Erreur lecture pairing URL :", e);
    }
  }

  // Génère l'URL complète de jumelage pour le QR Code
  getPairingUrl() {
    try {
      const config = this.getConfig();
      if (!config.url || !config.anonKey) return "";

      const baseUrl = window.location.origin + window.location.pathname;
      const params = new URLSearchParams({
        url: config.url,
        key: config.anonKey
      });

      const geminiKey = localStorage.getItem("quiz_anglais_gemini_api_key");
      if (geminiKey && geminiKey.trim()) {
        params.set("gemini", geminiKey.trim());
      }

      return `${baseUrl}#pair?${params.toString()}`;
    } catch {
      return "";
    }
  }

  getConfig() {
    try {
      const stored = localStorage.getItem(SYNC_CONFIG_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      const savedCode = localStorage.getItem(SYNC_CODE_KEY) || "";
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        syncCode: savedCode || parsed.syncCode || ""
      };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  saveConfig(newConfig) {
    try {
      const current = this.getConfig();
      const updated = { ...current, ...newConfig };
      localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(updated));
      if (updated.syncCode) {
        localStorage.setItem(SYNC_CODE_KEY, updated.syncCode);
      }
      this.initClient(updated);
      return updated;
    } catch (e) {
      console.error("Erreur lors de la sauvegarde de la configuration de sync", e);
    }
  }

  init() {
    const config = this.getConfig();
    this.initClient(config);
  }

  initClient(config) {
    if (this.wordsChannel) {
      this.wordsChannel.unsubscribe();
      this.wordsChannel = null;
    }
    if (this.statsChannel) {
      this.statsChannel.unsubscribe();
      this.statsChannel = null;
    }

    if (!config.url || !config.anonKey) {
      this.client = null;
      this.setStatus("idle");
      return;
    }

    try {
      this.client = createClient(config.url, config.anonKey, {
        auth: { persistSession: false },
        realtime: { params: { eventsPerSecond: 10 } }
      });
      this.subscribeRealtime();
      this.setStatus("synced");
    } catch (err) {
      console.error("Impossible d'initialiser Supabase :", err);
      this.setStatus("error");
    }
  }

  setStatus(newStatus) {
    this.status = newStatus;
    this.statusListeners.forEach((fn) => fn(this.status, this.lastSyncedAt));
  }

  onStatusChange(callback) {
    this.statusListeners.add(callback);
    callback(this.status, this.lastSyncedAt);
    return () => this.statusListeners.delete(callback);
  }

  onRemoteUpdate(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  subscribeRealtime() {
    if (!this.client) return;

    // Écouter les modifications directes sur la table 'words'
    this.wordsChannel = this.client
      .channel("words-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "words"
        },
        async (payload) => {
          this.lastSyncedAt = new Date();
          this.setStatus("synced");
          this.listeners.forEach((fn) => fn({ type: "words_change", payload }));
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.setStatus("synced");
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          this.setStatus("offline");
        }
      });

    // Écouter les modifications sur les stats
    this.statsChannel = this.client
      .channel("stats-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quiz_stats"
        },
        (payload) => {
          if (payload.new) {
            this.lastSyncedAt = new Date();
            this.setStatus("synced");
            this.listeners.forEach((fn) => fn({ type: "stats_change", data: fromDBStats(payload.new) }));
          }
        }
      )
      .subscribe();
  }

  // Vérifier si la base de données est accessible
  async testConnection() {
    if (!this.client) return { connected: false, error: "Supabase non configuré" };
    try {
      const { data, error } = await this.client.from("words").select("id").limit(1);
      if (error) {
        return { connected: false, error: error.message };
      }
      return { connected: true, data };
    } catch (err) {
      return { connected: false, error: err.message };
    }
  }

  // Récupérer tous les mots depuis la table Supabase 'words'
  async fetchWords() {
    if (!this.client) return { success: false, reason: "not_configured" };

    try {
      this.setStatus("syncing");
      const { data, error } = await this.client
        .from("words")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erreur lecture Supabase words :", error);
        this.setStatus("error");
        return { success: false, error: error.message };
      }

      this.lastSyncedAt = new Date();
      this.setStatus("synced");
      const words = (data || []).map(fromDBWord);
      return { success: true, words };
    } catch (err) {
      this.setStatus("error");
      return { success: false, error: err.message };
    }
  }

  // Récupérer les stats globales
  async fetchStats() {
    if (!this.client) return { success: false, reason: "not_configured" };

    try {
      const { data, error } = await this.client
        .from("quiz_stats")
        .select("*")
        .eq("id", "global_stats")
        .single();

      if (error && error.code !== "PGRST116") {
        return { success: false, error: error.message };
      }

      if (data) {
        return { success: true, stats: fromDBStats(data) };
      }
      return { success: true, stats: null };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Insérer un mot directement dans Supabase
  async insertWord(word) {
    if (!this.client) return { success: false, reason: "not_configured" };
    try {
      const dbWord = toDBWord(word);
      const { data, error } = await this.client
        .from("words")
        .insert(dbWord)
        .select()
        .single();

      if (error) throw error;
      this.lastSyncedAt = new Date();
      return { success: true, word: fromDBWord(data) };
    } catch (err) {
      console.error("Erreur insertion Supabase :", err);
      return { success: false, error: err.message };
    }
  }

  // Mettre à jour un mot dans Supabase
  async updateWord(id, updates) {
    if (!this.client) return { success: false, reason: "not_configured" };
    try {
      const dbUpdates = { updated_at: new Date().toISOString() };
      if (updates.english_word !== undefined) dbUpdates.english_word = updates.english_word.trim();
      if (updates.part_of_speech !== undefined) dbUpdates.part_of_speech = updates.part_of_speech.trim().toLowerCase();
      if (updates.french_translations !== undefined) dbUpdates.french_translations = updates.french_translations;
      if (updates.successCount !== undefined) dbUpdates.success_count = updates.successCount;
      if (updates.success_count !== undefined) dbUpdates.success_count = updates.success_count;
      if (updates.learned !== undefined) dbUpdates.learned = updates.learned;
      if (updates.srsStage !== undefined) dbUpdates.srs_stage = updates.srsStage;
      if (updates.srs_stage !== undefined) dbUpdates.srs_stage = updates.srs_stage;
      if (updates.firstLearnedAt !== undefined) dbUpdates.first_learned_at = updates.firstLearnedAt;
      if (updates.first_learned_at !== undefined) dbUpdates.first_learned_at = updates.first_learned_at;
      if (updates.nextReviewAt !== undefined) dbUpdates.next_review_at = updates.nextReviewAt;
      if (updates.next_review_at !== undefined) dbUpdates.next_review_at = updates.next_review_at;
      if (updates.lastReviewedAt !== undefined) dbUpdates.last_reviewed_at = updates.lastReviewedAt;
      if (updates.last_reviewed_at !== undefined) dbUpdates.last_reviewed_at = updates.last_reviewed_at;
      if (updates.isMastered !== undefined) dbUpdates.is_mastered = updates.isMastered;
      if (updates.is_mastered !== undefined) dbUpdates.is_mastered = updates.is_mastered;
      if (updates.lastAnswered !== undefined) dbUpdates.last_answered = updates.lastAnswered;
      if (updates.last_answered !== undefined) dbUpdates.last_answered = updates.last_answered;
      if (updates.lastCorrect !== undefined) dbUpdates.last_correct = updates.lastCorrect;
      if (updates.last_correct !== undefined) dbUpdates.last_correct = updates.last_correct;

      const { data, error } = await this.client
        .from("words")
        .update(dbUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      this.lastSyncedAt = new Date();
      return { success: true, word: data ? fromDBWord(data) : null };
    } catch (err) {
      console.error("Erreur update Supabase :", err);
      return { success: false, error: err.message };
    }
  }

  // Supprimer un mot dans Supabase
  async deleteWord(id) {
    if (!this.client) return { success: false, reason: "not_configured" };
    try {
      const { error } = await this.client
        .from("words")
        .delete()
        .eq("id", id);

      if (error) throw error;
      this.lastSyncedAt = new Date();
      return { success: true };
    } catch (err) {
      console.error("Erreur delete Supabase :", err);
      return { success: false, error: err.message };
    }
  }

  // Mettre à jour les stats dans Supabase
  async saveStats(stats) {
    if (!this.client) return { success: false, reason: "not_configured" };
    try {
      const dbStats = toDBStats(stats);
      const { error } = await this.client
        .from("quiz_stats")
        .upsert(dbStats, { onConflict: "id" });

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error("Erreur stats Supabase :", err);
      return { success: false, error: err.message };
    }
  }

  // Migration / Transfert en masse de mots locaux vers Supabase
  async migrateWords(words, stats = null) {
    if (!this.client) return { success: false, reason: "not_configured" };
    if (!Array.isArray(words) || words.length === 0) return { success: true, count: 0 };

    try {
      this.setStatus("syncing");
      const dbWords = words.map(toDBWord);

      // Effectuer un upsert par paquets pour éviter les limites de taille de requête
      const chunkSize = 50;
      for (let i = 0; i < dbWords.length; i += chunkSize) {
        const chunk = dbWords.slice(i, i + chunkSize);
        const { error } = await this.client
          .from("words")
          .upsert(chunk, { onConflict: "id" });

        if (error) throw error;
      }

      if (stats) {
        await this.saveStats(stats);
      }

      this.lastSyncedAt = new Date();
      this.setStatus("synced");
      return { success: true, count: dbWords.length };
    } catch (err) {
      this.setStatus("error");
      console.error("Erreur lors de la migration des mots :", err);
      return { success: false, error: err.message };
    }
  }
}

export const syncService = new SyncService();
