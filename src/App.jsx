import React, { useState, useEffect } from "react";
import { QuizView } from "./components/QuizView";
import { WordList } from "./components/WordList";
import { StatsView } from "./components/StatsView";
import { SettingsView } from "./components/SettingsView";
import { AddWordModal } from "./components/AddWordModal";
import { Navigation } from "./components/Navigation";
import { storageService } from "./services/storageService";
import { syncService } from "./services/syncService";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("quiz"); // "quiz" | "list" | "stats" | "settings"
  const [words, setWords] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState(syncService.status);

  // Charger les mots au démarrage et écouter les changements
  useEffect(() => {
    // 1. Chargement instantané depuis le cache local (aucun écran blanc)
    const initialWords = storageService.getWords();
    setWords(initialWords);

    // 2. Synchronisation / Rafraîchissement depuis la table Supabase
    storageService.refreshFromSupabase().then((res) => {
      if (res && res.words) {
        setWords(res.words);
      }
    });

    // 3. Écoute des mises à jour distantes en direct (Realtime PostgreSQL)
    const unsubRemote = syncService.onRemoteUpdate((event) => {
      const updated = storageService.applyRemoteRealtimeEvent(event);
      setWords([...updated]);
    });

    // 4. Écoute du statut de synchronisation
    const unsubStatus = syncService.onStatusChange((status) => {
      setSyncStatus(status);
    });

    return () => {
      unsubRemote();
      unsubStatus();
    };
  }, []);

  const handleWordsUpdate = (updatedWords) => {
    setWords(updatedWords);
  };

  const handleWordAdded = () => {
    const loaded = storageService.getWords();
    setWords(loaded);
  };

  const unlearnedCount = words.filter((w) => !w.learned).length;
  const isSyncConfigured = Boolean(syncService.getConfig().url && syncService.getConfig().anonKey);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      
      {/* Barre supérieure minimale */}
      <header className="sticky top-0 z-20 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md px-4 py-3 border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-xs">
              EN
            </div>
            <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Quiz Anglais
            </span>

            {/* Indicateur de synchro Cloud */}
            <button 
              onClick={() => setActiveTab("settings")}
              title={
                !isSyncConfigured
                  ? "Base de données non configurée. Cliquez pour jumeler l'iPhone ou renseigner Supabase."
                  : syncStatus === "syncing" 
                  ? "Synchronisation avec Supabase en cours..." 
                  : syncStatus === "synced" 
                  ? "Base de données Supabase connectée en direct" 
                  : "Erreur de connexion Supabase (mode hors-ligne)"
              }
              className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border transition hover:opacity-80 ${
                isSyncConfigured
                  ? syncStatus === "synced"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                    : syncStatus === "syncing"
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
            >
              {isSyncConfigured ? (
                syncStatus === "syncing" ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />
                    <span className="hidden sm:inline">Synchro...</span>
                  </>
                ) : syncStatus === "synced" ? (
                  <>
                    <Cloud className="w-3 h-3 text-emerald-500" />
                    <span className="hidden sm:inline">Connecté</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="w-3 h-3 text-rose-500" />
                    <span className="hidden sm:inline">Déconnecté</span>
                  </>
                )
              ) : (
                <>
                  <CloudOff className="w-3 h-3 text-slate-400" />
                  <span>Jumeler Cloud</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-slate-600 dark:text-slate-300">
              {unlearnedCount > 0 ? `${unlearnedCount} à apprendre` : "Tout acquis 🎉"}
            </span>
          </div>
        </div>
      </header>

      {/* Vue principale */}
      <main className="flex-1 flex flex-col pt-3">
        {activeTab === "quiz" && (
          <QuizView
            words={words}
            onWordsUpdate={handleWordsUpdate}
            onOpenAdd={() => setIsAddModalOpen(true)}
          />
        )}

        {activeTab === "list" && (
          <WordList
            words={words}
            onWordsUpdate={handleWordsUpdate}
            onOpenAdd={() => setIsAddModalOpen(true)}
          />
        )}

        {activeTab === "stats" && (
          <StatsView words={words} />
        )}

        {activeTab === "settings" && (
          <SettingsView
            words={words}
            onWordsUpdate={handleWordsUpdate}
          />
        )}
      </main>

      {/* Barre de navigation inférieure */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAdd={() => setIsAddModalOpen(true)}
        unlearnedCount={unlearnedCount}
      />

      {/* Modal d'ajout de vocabulaire avec traduction automatique */}
      <AddWordModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onWordAdded={handleWordAdded}
      />

    </div>
  );
}
