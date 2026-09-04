import React, { useState, useMemo } from "react";
import { 
  Search, 
  Volume2, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  Plus,
  X,
  Bell,
  Clock,
  Sparkles,
  Calendar
} from "lucide-react";
import { PART_OF_SPEECH_LABELS } from "../services/translationService";
import { storageService } from "../services/storageService";
import { srsService } from "../services/srsService";

// Fonction utilitaire pour nettoyer et obtenir la clé de tri (sans 'to ', 'a ', 'an ', 'the ')
export function getSortKey(word) {
  if (!word || !word.english_word) return "";
  let clean = word.english_word.trim().toLowerCase();
  
  // Enlever les prépositions et articles initiaux
  clean = clean.replace(/^(to\s+|a\s+|an\s+|the\s+)/i, "").trim();
  
  // Enlever d'éventuels caractères spéciaux au début
  clean = clean.replace(/^[^a-z0-9]+/i, "");
  
  return clean;
}

// Fonction pour obtenir la première lettre effective du mot
export function getFirstLetter(word) {
  const key = getSortKey(word);
  if (!key) return "#";
  const firstChar = key[0].toUpperCase();
  return /^[A-Z]$/.test(firstChar) ? firstChar : "#";
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function WordList({ words, onWordsUpdate, onOpenAdd }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all"); // "all" | "due" | "learning" | "reviewing" | "mastered"
  const [selectedLetter, setSelectedLetter] = useState(null); // null = toutes les lettres, ou 'A', 'B', etc.

  // Statistiques SRS
  const dueCount = useMemo(() => words.filter((w) => srsService.isReviewDue(w)).length, [words]);
  const learningCount = useMemo(() => words.filter((w) => (w.srsStage || 0) === 0 && !w.learned).length, [words]);
  const reviewingCount = useMemo(() => words.filter((w) => (w.srsStage || 0) >= 1 && (w.srsStage || 0) < 10 && !w.isMastered).length, [words]);
  const masteredCount = useMemo(() => words.filter((w) => w.isMastered || (w.srsStage || 0) >= 10).length, [words]);

  // Calcul du nombre de mots par lettre
  const letterCounts = useMemo(() => {
    const counts = {};
    words.forEach((w) => {
      const letter = getFirstLetter(w);
      counts[letter] = (counts[letter] || 0) + 1;
    });
    return counts;
  }, [words]);

  // Tri alphabétique (ignorant les prépositions "to", "a", "an", "the") et filtrage
  const filteredWords = useMemo(() => {
    // 1. Trier tous les mots dans l'ordre alphabétique
    const sorted = [...words].sort((a, b) => {
      const keyA = getSortKey(a);
      const keyB = getSortKey(b);
      return keyA.localeCompare(keyB, "en", { sensitivity: "base" });
    });

    // 2. Filtrer par recherche, statut et lettre
    return sorted.filter((w) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        w.english_word?.toLowerCase().includes(q) ||
        w.french_translations?.some((t) => t.toLowerCase().includes(q));

      if (!matchesQuery) return false;

      // Filtre par catégorie SRS
      if (filterType === "due" && !srsService.isReviewDue(w)) return false;
      if (filterType === "learning" && ((w.srsStage || 0) > 0 || w.learned)) return false;
      if (filterType === "reviewing" && ((w.srsStage || 0) === 0 || (w.srsStage || 0) >= 10 || w.isMastered)) return false;
      if (filterType === "mastered" && !w.isMastered && (w.srsStage || 0) < 10) return false;

      // Filtre alphabétique
      if (selectedLetter && getFirstLetter(w) !== selectedLetter) return false;

      return true;
    });
  }, [words, searchQuery, filterType, selectedLetter]);

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
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pt-2 pb-24 space-y-3.5 animate-fade-in">
      
      {/* En-tête de la page */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Vocabulaire</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {words.length} mots classés par ordre alphabétique
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
          className="w-full pl-9 pr-9 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filtres SRS par statut */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
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

        {dueCount > 0 && (
          <button
            onClick={() => setFilterType("due")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1 ${
              filterType === "due"
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-200"
            }`}
          >
            <Bell className="w-3 h-3" />
            <span>À réviser ({dueCount})</span>
          </button>
        )}

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
          onClick={() => setFilterType("reviewing")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            filterType === "reviewing"
              ? "bg-purple-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200"
          }`}
        >
          Paliers SRS ({reviewingCount})
        </button>

        <button
          onClick={() => setFilterType("mastered")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            filterType === "mastered"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200"
          }`}
        >
          Maîtrisés 🏆 ({masteredCount})
        </button>
      </div>

      {/* Index Alphabétique (A-Z) */}
      <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Index Alphabétique
          </span>
          {selectedLetter && (
            <button
              onClick={() => setSelectedLetter(null)}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
            >
              <span>Afficher tout (A-Z)</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Barre de défilement des lettres */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedLetter(null)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition ${
              selectedLetter === null
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            Tous
          </button>

          {ALPHABET.map((letter) => {
            const count = letterCounts[letter] || 0;
            const isSelected = selectedLetter === letter;
            const hasWords = count > 0;

            return (
              <button
                key={letter}
                onClick={() => setSelectedLetter(isSelected ? null : letter)}
                disabled={!hasWords}
                className={`w-7 h-7 rounded-lg text-xs font-bold shrink-0 flex items-center justify-center transition relative ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-400"
                    : hasWords
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950"
                    : "text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-40"
                }`}
                title={hasWords ? `${count} mot${count > 1 ? "s" : ""}` : "Aucun mot"}
              >
                <span>{letter}</span>
                {hasWords && !isSelected && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Résumé du filtre actif */}
      {selectedLetter && (
        <div className="flex items-center justify-between px-1 text-xs text-slate-500 dark:text-slate-400">
          <span>Lettre sélectionnée : <b className="text-indigo-600 dark:text-indigo-400 text-sm">« {selectedLetter} »</b></span>
          <span>{filteredWords.length} mot{filteredWords.length > 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Liste des cartes de mots */}
      <div className="space-y-2">
        {filteredWords.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {selectedLetter ? `Aucun mot commençant par « ${selectedLetter} »` : "Aucun mot trouvé"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {selectedLetter ? "Sélectionnez une autre lettre ou effacez le filtre." : "Essayez un autre mot ou ajoutez-en un nouveau."}
            </p>
            {selectedLetter && (
              <button
                onClick={() => setSelectedLetter(null)}
                className="mt-3 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl"
              >
                Réinitialiser le filtre
              </button>
            )}
          </div>
        ) : (
          filteredWords.map((word) => {
            const posInfo = PART_OF_SPEECH_LABELS[word.part_of_speech] || {
              fr: word.part_of_speech,
              color: "bg-slate-100 text-slate-700"
            };

            const stage = word.srsStage || (word.learned ? 1 : 0);
            const stageInfo = srsService.getStageInfo(stage);
            const isDue = srsService.isReviewDue(word);
            const relativeDate = srsService.formatRelativeReviewDate(word.nextReviewAt);

            return (
              <div
                key={word.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-3.5 border transition-all shadow-xs ${
                  word.isMastered || stage >= 10
                    ? "border-amber-300/80 dark:border-amber-800/60 bg-amber-50/20"
                    : isDue
                    ? "border-amber-400 dark:border-amber-600 bg-amber-50/30 ring-1 ring-amber-400"
                    : word.learned || stage > 0
                    ? "border-indigo-200/80 dark:border-indigo-950 bg-indigo-50/10"
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

                    {/* Date de révision / Détail du palier */}
                    <div className="flex items-center gap-2 mt-2 text-[11px]">
                      {word.isMastered || stage >= 10 ? (
                        <span className="text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1">
                          🏆 Maîtrisé (~5 mois et demi validés)
                        </span>
                      ) : isDue ? (
                        <span className="text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1 animate-pulse">
                          <Bell className="w-3 h-3" />
                          <span>À réviser aujourd'hui ({stageInfo.label})</span>
                        </span>
                      ) : relativeDate ? (
                        <span className={`flex items-center gap-1 ${relativeDate.color}`}>
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Prochaine révision : {relativeDate.text} ({stageInfo.shortLabel})</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          Apprentissage initial ({word.learningSuccessCount || 0}/3 ★)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Statut SRS & Actions */}
                  <div className="flex flex-col items-end gap-1.5">
                    {word.isMastered || stage >= 10 ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                        🏆 Maîtrisé
                      </span>
                    ) : stage > 0 ? (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${stageInfo.badgeColor}`}>
                        {stageInfo.shortLabel}
                      </span>
                    ) : (
                      <div className="flex items-center gap-0.5 text-xs">
                        {[0, 1, 2].map((idx) => (
                          <span
                            key={idx}
                            className={
                              idx < (word.learningSuccessCount ?? word.successCount ?? 0)
                                ? "text-amber-400 font-bold"
                                : "text-slate-200 dark:text-slate-700"
                            }
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      {((word.learningSuccessCount || 0) > 0 || stage > 0) && (
                        <button
                          onClick={(e) => handleResetProgress(word.id, e)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition rounded"
                          title="Remettre à zéro"
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
