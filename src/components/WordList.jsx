import React, { useState } from "react";
import { 
  Search, 
  Volume2, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  Plus
} from "lucide-react";
import { PART_OF_SPEECH_LABELS } from "../services/translationService";
import { storageService } from "../services/storageService";

export function WordList({ words, onWordsUpdate, onOpenAdd }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all"); // "all" | "learning" | "learned"

  // Filtrage des mots
  const filteredWords = words.filter((w) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      w.english_word?.toLowerCase().includes(q) ||
      w.french_translations?.some((t) => t.toLowerCase().includes(q));

    if (!matchesQuery) return false;

    if (filterType === "learning" && w.learned) return false;
    if (filterType === "learned" && !w.learned) return false;

    return true;
  });

  const learnedCount = words.filter((w) => w.learned).length;
  const learningCount = words.length - learnedCount;

  const playPronunciation = (text, e) => {
    if (e) e.stopPropagation();
    if ("speechSynthesis" in window && text) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleDelete = (id, word, e) => {
    if (e) e.stopPropagation();
    if (window.confirm(`Supprimer « ${word} » de votre liste ?`)) {
      const updated = storageService.deleteWord(id);
      onWordsUpdate(updated);
    }
  };

  const handleResetProgress = (id, e) => {
    if (e) e.stopPropagation();
    const updated = storageService.resetWordProgress(id);
    onWordsUpdate(updated);
  };

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pt-2 pb-24 space-y-4 animate-fade-in">
      
      {/* En-tête de la page */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Vocabulaire</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {words.length} mots au total • {learnedCount} acquis
          </p>
        </div>
        <button
          onClick={onOpenAdd}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-500/20 active:scale-95 transition flex items-center gap-1 text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter</span>
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher en français ou anglais..."
          className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
        />
      </div>

      {/* Filtres par statut */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setFilterType("all")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            filterType === "all"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200"
          }`}
        >
          Tous ({words.length})
        </button>
        <button
          onClick={() => setFilterType("learning")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            filterType === "learning"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200"
          }`}
        >
          En cours ({learningCount})
        </button>
        <button
          onClick={() => setFilterType("learned")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            filterType === "learned"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200"
          }`}
        >
          Acquis ({learnedCount})
        </button>
      </div>

      {/* Liste des cartes de mots */}
      <div className="space-y-2">
        {filteredWords.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Aucun mot trouvé</p>
            <p className="text-xs text-slate-400 mt-1">Essayez un autre mot ou ajoutez-en un nouveau.</p>
          </div>
        ) : (
          filteredWords.map((word) => {
            const posInfo = PART_OF_SPEECH_LABELS[word.part_of_speech] || {
              fr: word.part_of_speech,
              color: "bg-slate-100 text-slate-700"
            };

            return (
              <div
                key={word.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-3.5 border transition-all shadow-xs ${
                  word.learned
                    ? "border-emerald-200/80 dark:border-emerald-950 bg-emerald-50/20"
                    : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  
                  {/* Mot anglais & catégorie */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                        {word.english_word}
                      </span>
                      <button
                        onClick={(e) => playPronunciation(word.english_word, e)}
                        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition rounded-full"
                        title="Écouter la prononciation"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${posInfo.color}`}>
                        {posInfo.fr}
                      </span>
                    </div>

                    {/* Traductions françaises */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      {word.french_translations?.map((t, idx) => (
                        <span
                          key={idx}
                          className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Statut & Actions */}
                  <div className="flex flex-col items-end gap-1.5">
                    {word.learned ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        Acquis
                      </span>
                    ) : (
                      <div className="flex items-center gap-0.5 text-xs">
                        {[0, 1, 2].map((idx) => (
                          <span
                            key={idx}
                            className={
                              idx < (word.successCount || 0)
                                ? "text-amber-400"
                                : "text-slate-200 dark:text-slate-700"
                            }
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      {word.successCount > 0 && (
                        <button
                          onClick={(e) => handleResetProgress(word.id, e)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition rounded"
                          title="Remettre le score à zéro"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDelete(word.id, word.english_word, e)}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition rounded"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
