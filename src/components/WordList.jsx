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
  Calendar,
  Pencil
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
  const [direction, setDirection] = useState(() => {
    const pref = storageService.getQuizDirectionPreference();
    return pref === "en_fr" ? "en_fr" : "fr_en";
  });
  const [filterType, setFilterType] = useState("all"); // "all" | "due" | "learning" | "reviewing" | "mastered"
  const [selectedLetter, setSelectedLetter] = useState(null); // null = toutes les lettres, ou 'A', 'B', etc.
  const [editingWordId, setEditingWordId] = useState(null);
  const [editText, setEditText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Statistiques SRS selon la direction active
  const dueCount = useMemo(() => words.filter((w) => srsService.isReviewDue(w, new Date(), direction)).length, [words, direction]);
  const learningCount = useMemo(() => words.filter((w) => srsService.isLearning(w, direction)).length, [words, direction]);
  const reviewingCount = useMemo(() => words.filter((w) => {
    const prog = srsService.getProgress(w, direction);
    return prog.stage >= 1 && prog.stage < 10 && !prog.isMastered;
  }).length, [words, direction]);
  const masteredCount = useMemo(() => words.filter((w) => {
    const prog = srsService.getProgress(w, direction);
    return prog.isMastered || prog.stage >= 10;
  }).length, [words, direction]);

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

      const prog = srsService.getProgress(w, direction);

      // Filtre par catégorie SRS selon la direction
      if (filterType === "due" && !srsService.isReviewDue(w, new Date(), direction)) return false;
      if (filterType === "learning" && (prog.stage > 0 || prog.learned)) return false;
      if (filterType === "reviewing" && (prog.stage === 0 || prog.stage >= 10 || prog.isMastered)) return false;
      if (filterType === "mastered" && !prog.isMastered && prog.stage < 10) return false;

      // Filtre alphabétique
      if (selectedLetter && getFirstLetter(w) !== selectedLetter) return false;

      return true;
    });
  }, [words, searchQuery, filterType, selectedLetter, direction]);

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
    const updated = storageService.resetWordProgress(id, direction);
    onWordsUpdate(updated);
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleStartEdit = (word, e) => {
    if (e) e.stopPropagation();
    setEditingWordId(word.id);
    const note = word.exampleSentence || word.example_sentence || word.notes || "";
    setEditText(note);
  };

  const handleCancelEdit = (e) => {
    if (e) e.stopPropagation();
    setEditingWordId(null);
    setEditText("");
  };

  const handleSaveEdit = async (wordId, e) => {
    if (e) e.stopPropagation();
    setIsSaving(true);
    try {
      const cleanText = editText.trim();
      const res = await storageService.updateContextNote(wordId, cleanText);
      onWordsUpdate(res.words);
      setEditingWordId(null);
      setEditText("");
      showToast(cleanText ? "Descriptif mis à jour avec succès !" : "Descriptif supprimé.");
    } catch (err) {
      console.error("Erreur enregistrement descriptif :", err);
      showToast("Erreur lors de l'enregistrement du descriptif.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pt-2 pb-24 space-y-3.5 animate-fade-in relative">
      
      {/* Toast de confirmation visible */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-xs w-full px-4 animate-fade-in pointer-events-none">
          <div className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border border-slate-700/50 dark:border-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
            <span className="flex-1">{toastMessage}</span>
          </div>
        </div>
      )}
      
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

      {/* Sélecteur de Sens de Progression */}
      <div className="bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 border border-slate-200/80 dark:border-slate-700/60 text-xs">
        <button
          onClick={() => setDirection("fr_en")}
          className={`flex-1 py-1 px-2 rounded-lg font-bold transition text-center ${
            direction === "fr_en"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          🇫🇷 → 🇬🇧 Français → Anglais
        </button>
        <button
          onClick={() => setDirection("en_fr")}
          className={`flex-1 py-1 px-2 rounded-lg font-bold transition text-center ${
            direction === "en_fr"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          🇬🇧 → 🇫🇷 Anglais → Français
        </button>
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

            const prog = srsService.getProgress(word, direction);
            const stage = prog.stage;
            const stageInfo = srsService.getStageInfo(stage);
            const isDue = srsService.isReviewDue(word, new Date(), direction);
            const relativeDate = srsService.formatRelativeReviewDate(prog.nextReviewAt);

            return (
              <div
                key={word.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-3.5 border transition-all shadow-xs ${
                  prog.isMastered || stage >= 10
                    ? "border-amber-300/80 dark:border-amber-800/60 bg-amber-50/20"
                    : isDue
                    ? "border-amber-400 dark:border-amber-600 bg-amber-50/30 ring-1 ring-amber-400"
                    : prog.learned || stage > 0
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

                    {/* Note de contexte / Précision de sens - Consultation & Édition */}
                    {editingWordId === word.id ? (
                      <div 
                        onClick={(e) => e.stopPropagation()} 
                        className="mt-2.5 p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded-xl space-y-2 animate-fade-in"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                            Note de contexte
                          </span>
                          <span className="text-[10px] text-amber-700/80 dark:text-amber-400">
                            (Indice au quiz)
                          </span>
                        </div>

                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          placeholder="Ex: aboyer (pour un chien), écorce d'un arbre..."
                          rows={2}
                          autoFocus
                          className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner resize-y"
                        />

                        <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 leading-snug">
                          💡 Donne un indice de sens ou d’usage sans révéler la traduction attendue.
                        </p>

                        <div className="flex items-center justify-between pt-1">
                          {editText.trim() ? (
                            <button
                              type="button"
                              onClick={() => setEditText("")}
                              className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline"
                            >
                              Effacer le texte
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Champ vide = suppression</span>
                          )}

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              disabled={isSaving}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition"
                            >
                              Annuler
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleSaveEdit(word.id, e)}
                              disabled={isSaving}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1"
                            >
                              {isSaving ? "Enregistrement..." : "Enregistrer"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (word.exampleSentence || word.example_sentence || word.notes) ? (
                      <div className="mt-1.5 flex items-start justify-between gap-1.5 group">
                        <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80 italic flex items-start gap-1 min-w-0 flex-1">
                          <span className="font-semibold not-italic text-amber-600 dark:text-amber-400 shrink-0">💡</span>
                          <span className="break-words">{word.exampleSentence || word.example_sentence || word.notes}</span>
                        </p>
                        <button
                          type="button"
                          onClick={(e) => handleStartEdit(word, e)}
                          className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
                          title="Modifier le descriptif"
                          aria-label="Modifier le descriptif"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <button
                          type="button"
                          onClick={(e) => handleStartEdit(word, e)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition py-0.5 rounded"
                          title="Ajouter un descriptif"
                          aria-label="Ajouter un descriptif"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Ajouter un descriptif</span>
                        </button>
                      </div>
                    )}

                    {/* Date de révision / Détail du palier */}
                    <div className="flex items-center gap-2 mt-2 text-[11px]">
                      {prog.isMastered || stage >= 10 ? (
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
                          Apprentissage initial ({prog.learningSuccessCount || 0}/3 ★)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Statut SRS & Actions */}
                  <div className="flex flex-col items-end gap-1.5">
                    {prog.isMastered || stage >= 10 ? (
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
                              idx < (prog.learningSuccessCount || 0)
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
                      {((prog.learningSuccessCount || 0) > 0 || stage > 0) && (
                        <button
                          onClick={(e) => handleResetProgress(word.id, e)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition rounded"
                          title="Remettre à zéro ce sens"
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
