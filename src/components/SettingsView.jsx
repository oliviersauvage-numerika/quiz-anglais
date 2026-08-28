import React, { useState, useRef, useEffect } from "react";
import { 
  Download, 
  Upload, 
  RotateCcw, 
  Smartphone, 
  Check, 
  AlertTriangle,
  FileJson,
  Copy,
  KeyRound,
  Bot,
  ExternalLink,
  Cloud,
  CloudCheck,
  CloudOff,
  RefreshCw,
  QrCode as QrCodeIcon,
  Database,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { storageService } from "../services/storageService";
import { translationService } from "../services/translationService";
import { syncService } from "../services/syncService";

export function SettingsView({ words, onWordsUpdate }) {
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [notification, setNotification] = useState(null);

  // Gemini API Key
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);

  // Supabase Sync Config
  const [syncConfig, setSyncConfig] = useState(syncService.getConfig());
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(syncConfig.url || "");
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(syncConfig.anonKey || "");
  const [syncCodeInput, setSyncCodeInput] = useState(syncConfig.syncCode || "");
  const [syncStatus, setSyncStatus] = useState(syncService.status);
  const [lastSynced, setLastSynced] = useState(syncService.lastSyncedAt);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showSupabaseConfig, setShowSupabaseConfig] = useState(!syncConfig.url || !syncConfig.anonKey);
  const [isSyncing, setIsSyncing] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const key = translationService.getGeminiApiKey();
    setApiKeyInput(key);
    setApiKeySaved(Boolean(key));

    const unsub = syncService.onStatusChange((status, timestamp) => {
      setSyncStatus(status);
      setLastSynced(timestamp);
    });

    return () => unsub();
  }, []);

  const showNotif = (text, type = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleSaveApiKey = () => {
    translationService.setGeminiApiKey(apiKeyInput);
    setApiKeySaved(Boolean(apiKeyInput.trim()));
    showNotif(apiKeyInput.trim() ? "Clé API IA enregistrée !" : "Clé API supprimée (Moteur intégré actif)");
  };

  const handleSaveSupabaseConfig = () => {
    const updated = syncService.saveConfig({
      url: supabaseUrlInput.trim(),
      anonKey: supabaseKeyInput.trim(),
      syncCode: syncCodeInput.trim() || syncConfig.syncCode
    });
    setSyncConfig(updated);
    showNotif("Configuration Supabase enregistrée !");
  };

  const handleManualPush = async () => {
    setIsSyncing(true);
    const wordsData = storageService.getWords();
    const statsData = storageService.getGlobalStats();
    const res = await syncService.pushData({
      words: wordsData,
      stats: statsData,
      exportedAt: new Date().toISOString()
    });
    setIsSyncing(false);

    if (res.success) {
      showNotif("Données synchronisées vers le Cloud avec succès !");
    } else {
      showNotif(`Erreur de synchronisation : ${res.error || "Vérifiez vos réglages Supabase"}`, "error");
    }
  };

  const handleManualPull = async () => {
    setIsSyncing(true);
    const res = await syncService.pullData(syncCodeInput.trim());
    setIsSyncing(false);

    if (res.success) {
      if (res.data) {
        storageService.applyRemoteData(res.data);
        onWordsUpdate(storageService.getWords());
        showNotif("Données du Cloud récupérées et appliquées !");
      } else {
        showNotif("Aucune donnée trouvée sur le Cloud pour ce code.", "error");
      }
    } else {
      showNotif(`Erreur : ${res.error || "Impossible de récupérer les données"}`, "error");
    }
  };

  const handleCopySyncCode = async () => {
    try {
      await navigator.clipboard.writeText(syncConfig.syncCode);
      setCopiedCode(true);
      showNotif("Code de synchronisation copié !");
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      showNotif("Code copié", "success");
    }
  };

  const sqlScript = `-- 1. Création de la table de synchronisation
create table if not exists public.quiz_sync (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- 2. Activer la synchronisation temps réel
alter publication supabase_realtime add table public.quiz_sync;

-- 3. Activer la sécurité RLS
alter table public.quiz_sync enable row level security;

-- 4. Autoriser la lecture et l'écriture avec la clé anon
drop policy if exists "Allow public read/write" on public.quiz_sync;
create policy "Allow public read/write" on public.quiz_sync
  for all using (true) with check (true);`;

  const handleCopySQL = async () => {
    try {
      await navigator.clipboard.writeText(sqlScript);
      setCopiedSql(true);
      showNotif("Script SQL copié dans le presse-papier !");
      setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      showNotif("Script SQL prêt à copier", "success");
    }
  };

  const handleExportJSON = () => {
    const jsonStr = storageService.exportData();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vocabulaire-anglais-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotif("Sauvegarde JSON téléchargée !");
  };

  const handleCopyJSON = async () => {
    const jsonStr = storageService.exportData();
    try {
      await navigator.clipboard.writeText(jsonStr);
      setCopied(true);
      showNotif("Données copiées dans le presse-papier !");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showNotif("Impossible de copier automatiquement", "error");
    }
  };

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        const res = storageService.importData(content);
        if (res.success) {
          onWordsUpdate(storageService.getWords());
          showNotif(`${res.count} mots restaurés avec succès !`);
        } else {
          showNotif(`Erreur d'import : ${res.error}`, "error");
        }
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleResetScores = () => {
    if (window.confirm("Voulez-vous réinitialiser tous les scores de quiz à 0 (les mots seront conservés) ?")) {
      const updated = storageService.resetAllProgress();
      onWordsUpdate(updated);
      showNotif("Scores réinitialisés !");
    }
  };

  const handleRestoreDefaults = () => {
    if (window.confirm("Rétablir la liste initiale par défaut ?")) {
      const initial = storageService.restoreInitialWords();
      onWordsUpdate(initial);
      showNotif("Vocabulaire initial restauré !");
    }
  };

  const isSupabaseConfigured = Boolean(syncConfig.url && syncConfig.anonKey);

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pt-2 pb-28 space-y-4 animate-fade-in">
      
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Réglages</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Synchronisation iPhone / Mac, IA et sauvegardes</p>
      </div>

      {notification && (
        <div className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-pop-in ${
          notification.type === "error"
            ? "bg-rose-50 text-rose-800 border border-rose-200"
            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
        }`}>
          <Check className="w-4 h-4 shrink-0" />
          <span>{notification.text}</span>
        </div>
      )}

      {/* SECTION SYNCHRONISATION AUTOMATIQUE SUPABASE */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Synchronisation iPhone & Mac
            </h2>
          </div>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
            isSupabaseConfigured
              ? syncStatus === "synced"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : syncStatus === "syncing"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              isSupabaseConfigured ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
            }`} />
            {isSupabaseConfigured ? (syncStatus === "syncing" ? "Synchronisation..." : "Actif en direct") : "À configurer"}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Vos mots ajoutés et vos scores se synchronisent automatiquement en temps réel entre votre iPhone et votre Mac grâce à votre base Supabase gratuite.
        </p>

        {/* Code de Synchronisation Partagé */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Votre Code de Synchronisation (Sync Key) :</span>
            <button
              onClick={() => setShowQrModal(!showQrModal)}
              className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1 font-semibold hover:underline"
            >
              <QrCodeIcon className="w-3.5 h-3.5" />
              <span>{showQrModal ? "Masquer QR" : "Afficher QR"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={syncCodeInput}
              onChange={(e) => setSyncCodeInput(e.target.value.toLowerCase().trim())}
              placeholder="quiz-xxxxxx"
              className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 tracking-wider text-center uppercase"
            />
            <button
              onClick={handleCopySyncCode}
              title="Copier le code"
              className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 text-slate-700 dark:text-slate-300 transition"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>

          {showQrModal && (
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center gap-3 animate-fade-in">
              <div className="p-3 bg-white rounded-2xl shadow-xs border border-slate-100">
                <QRCodeSVG 
                  value={syncService.getPairingUrl() || syncCodeInput || syncConfig.syncCode} 
                  size={180}
                  level="M" 
                />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 text-center max-w-xs font-medium">
                📷 <b>Scannez ce QR Code avec l'appareil photo de votre iPhone</b> pour ouvrir le quiz et synchroniser automatiquement la connexion Supabase et vos données !
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleManualPush}
              disabled={isSyncing || !isSupabaseConfigured}
              className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>Envoyer au Cloud</span>
            </button>

            <button
              onClick={handleManualPull}
              disabled={isSyncing || !isSupabaseConfigured}
              className="py-2 px-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Récupérer du Cloud</span>
            </button>
          </div>
        </div>

        {/* Panneau de configuration des identifiants Supabase */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-2">
          <button
            onClick={() => setShowSupabaseConfig(!showSupabaseConfig)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 py-1 hover:text-indigo-600 transition"
          >
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-indigo-500" />
              <span>Paramètres de connexion Supabase (Projet Gratuit)</span>
            </span>
            {showSupabaseConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showSupabaseConfig && (
            <div className="space-y-3 pt-3 animate-fade-in">
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/30 rounded-2xl text-[11px] text-indigo-950 dark:text-indigo-200 space-y-2">
                <p className="font-semibold">⚡ Comment configurer Supabase en 2 minutes :</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300">
                  <li>Créez un projet gratuit sur <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-semibold">supabase.com</a>.</li>
                  <li>Dans Supabase, ouvrez <b>SQL Editor</b>, collez le script ci-dessous et cliquez sur <b>Run</b>.</li>
                  <li>Dans <b>Project Settings &gt; API</b>, copiez l'<b>URL du projet</b> et la <b>clé anon public</b>.</li>
                </ol>
                <button
                  onClick={handleCopySQL}
                  className="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-1 transition"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedSql ? "Script SQL copié !" : "Copier le script SQL pour Supabase"}</span>
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    URL du projet Supabase
                  </label>
                  <input
                    type="text"
                    value={supabaseUrlInput}
                    onChange={(e) => setSupabaseUrlInput(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Clé publique Anon (anon public key)
                  </label>
                  <input
                    type="password"
                    value={supabaseKeyInput}
                    onChange={(e) => setSupabaseKeyInput(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>

                <button
                  onClick={handleSaveSupabaseConfig}
                  className="w-full py-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold transition shadow-xs"
                >
                  Enregistrer les identifiants Supabase
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Guide Installation iPhone */}
      <div className="bg-gradient-to-tr from-indigo-50 to-indigo-100/60 dark:from-indigo-950/40 dark:to-indigo-900/20 p-4 rounded-3xl border border-indigo-200/60 dark:border-indigo-800/40 space-y-2">
        <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
          <Smartphone className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-sm font-bold">Installation sur iPhone (PWA)</h2>
        </div>
        <p className="text-xs text-indigo-950/80 dark:text-indigo-300 leading-relaxed">
          Pour l'utiliser en plein écran comme une application native :
        </p>
        <ol className="text-xs text-indigo-900 dark:text-indigo-200 space-y-1.5 list-decimal list-inside font-medium bg-white/70 dark:bg-slate-900/60 p-3 rounded-2xl">
          <li>Ouvrez ce lien dans <span className="font-bold">Safari</span> sur votre iPhone.</li>
          <li>Appuyez sur le bouton <span className="font-bold">Partager</span> <span className="inline-block px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px]">⎋</span> en bas au milieu.</li>
          <li>Touchez <span className="font-bold">« Sur l'écran d'accueil »</span> (+).</li>
          <li>Validez avec <span className="font-bold">Ajouter</span> en haut à droite.</li>
        </ol>
      </div>

      {/* Moteur de Traduction IA (Optionnel) */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Moteur de Traduction
            </h2>
          </div>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            apiKeySaved 
              ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          }`}>
            {apiKeySaved ? "✨ IA Gemini Active" : "Moteur Intégré Gratuit"}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Le moteur intégré gratuit gère déjà les mots et expressions. Pour une traduction ultra-nuancée par IA (argot, idiotismes complexes), vous pouvez ajouter une clé d'API Google AI Studio (100% gratuite).
        </p>

        <div className="space-y-2">
          <div className="relative">
            <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Collez votre clé API Gemini (AIzaSy...)"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 font-mono"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSaveApiKey}
              className="flex-1 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{apiKeyInput.trim() ? "Enregistrer la clé" : "Utiliser le moteur gratuit"}</span>
            </button>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1 transition"
            >
              <span>Obtenir clé gratuite</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Sauvegarde & Export Local */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <FileJson className="w-4 h-4 text-indigo-600" />
          <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Sauvegarde & Export Manuel ({words.length} mots)
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExportJSON}
            className="p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex flex-col items-center gap-1.5 transition"
          >
            <Download className="w-4 h-4 text-indigo-600" />
            <span>Télécharger JSON</span>
          </button>

          <button
            onClick={handleCopyJSON}
            className="p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex flex-col items-center gap-1.5 transition"
          >
            <Copy className="w-4 h-4 text-indigo-600" />
            <span>{copied ? "Copié !" : "Copier JSON"}</span>
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileImport}
          accept=".json,application/json"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-2.5 px-3 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition border border-indigo-200/60 dark:border-indigo-800/40"
        >
          <Upload className="w-4 h-4" />
          <span>Restaurer / Importer un fichier JSON</span>
        </button>
      </div>

      {/* Zone de réinitialisation */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
        <div className="flex items-center gap-2 text-rose-600">
          <AlertTriangle className="w-4 h-4" />
          <h2 className="text-xs font-bold uppercase tracking-wider">
            Réinitialisations
          </h2>
        </div>

        <div className="space-y-2 pt-1">
          <button
            onClick={handleResetScores}
            className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Remettre les scores à zéro (recommencer le quiz)</span>
          </button>

          <button
            onClick={handleRestoreDefaults}
            className="w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <span>Rétablir la liste initiale par défaut</span>
          </button>
        </div>
      </div>

    </div>
  );
}
