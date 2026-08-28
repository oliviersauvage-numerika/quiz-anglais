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

class SyncService {
  constructor() {
    this.client = null;
    this.channel = null;
    this.listeners = new Set();
    this.statusListeners = new Set();
    this.status = "idle"; // "idle" | "syncing" | "synced" | "error" | "offline"
    this.lastSyncedAt = null;
    this.isApplyingRemoteChange = false;

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

      if (url && key && code) {
        this.saveConfig({
          url: decodeURIComponent(url),
          anonKey: decodeURIComponent(key),
          syncCode: decodeURIComponent(code)
        });

        // Nettoyer l'URL
        window.history.replaceState(null, "", window.location.pathname);
      } else if (code) {
        this.saveConfig({ syncCode: decodeURIComponent(code) });
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
      if (!config.url || !config.anonKey || !config.syncCode) return "";

      const baseUrl = window.location.origin + window.location.pathname;
      const params = new URLSearchParams({
        url: config.url,
        key: config.anonKey,
        code: config.syncCode
      });

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
        syncCode: savedCode || parsed.syncCode || this.generateSyncCode()
      };
    } catch {
      return { ...DEFAULT_CONFIG, syncCode: this.generateSyncCode() };
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

  generateSyncCode() {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let code = "quiz-";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    try {
      localStorage.setItem(SYNC_CODE_KEY, code);
    } catch {}
    return code;
  }

  init() {
    const config = this.getConfig();
    this.initClient(config);
  }

  initClient(config) {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
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
      this.subscribeRealtime(config.syncCode);
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

  subscribeRealtime(syncCode) {
    if (!this.client || !syncCode) return;

    this.channel = this.client
      .channel(`sync-room-${syncCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quiz_sync",
          filter: `id=eq.${syncCode}`
        },
        (payload) => {
          if (this.isApplyingRemoteChange) return;
          if (payload.new && payload.new.data) {
            this.lastSyncedAt = new Date();
            this.setStatus("synced");
            this.listeners.forEach((fn) => fn(payload.new.data));
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.setStatus("synced");
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          this.setStatus("offline");
        }
      });
  }

  // Téléverser les données actuelles vers le Cloud Supabase
  async pushData(data) {
    const config = this.getConfig();
    if (!this.client || !config.syncCode) return { success: false, reason: "not_configured" };

    try {
      this.setStatus("syncing");
      this.isApplyingRemoteChange = true;

      const payload = {
        id: config.syncCode,
        data: data,
        updated_at: new Date().toISOString()
      };

      const { error } = await this.client
        .from("quiz_sync")
        .upsert(payload, { onConflict: "id" });

      this.isApplyingRemoteChange = false;

      if (error) {
        console.error("Erreur push Supabase :", error);
        this.setStatus("error");
        return { success: false, error: error.message };
      }

      this.lastSyncedAt = new Date();
      this.setStatus("synced");
      return { success: true };
    } catch (err) {
      this.isApplyingRemoteChange = false;
      this.setStatus("error");
      return { success: false, error: err.message };
    }
  }

  // Récupérer les données depuis Supabase
  async pullData(customSyncCode = null) {
    const config = this.getConfig();
    const codeToUse = customSyncCode || config.syncCode;

    if (!this.client || !codeToUse) {
      return { success: false, reason: "not_configured" };
    }

    try {
      this.setStatus("syncing");
      const { data, error } = await this.client
        .from("quiz_sync")
        .select("data, updated_at")
        .eq("id", codeToUse)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // Ligne inexistante (première synchronisation)
          this.setStatus("synced");
          return { success: true, empty: true };
        }
        this.setStatus("error");
        return { success: false, error: error.message };
      }

      if (data && data.data) {
        this.lastSyncedAt = new Date(data.updated_at || Date.now());
        this.setStatus("synced");
        return { success: true, data: data.data };
      }

      return { success: true, empty: true };
    } catch (err) {
      this.setStatus("error");
      return { success: false, error: err.message };
    }
  }
}

export const syncService = new SyncService();
