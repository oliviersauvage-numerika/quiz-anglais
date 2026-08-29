import React, { useState, useEffect } from "react";
import { 
  X, 
  Search, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Loader2, 
  Volume2, 
  Bot, 
  KeyRound, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  Info,
  RefreshCw
} from "lucide-react";
import { translationService, PART_OF_SPEECH_LABELS } from "../services/translationService";
import { storageService } from "../services/storageService";

export function AddWordModal({ isOpen, onClose, onWordAdded }) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [translationSource, setTranslationSource] = useState("");
  const [rawResponseData, setRawResponseData] = useState(null);
  const [showRawJson, setShowRawJson] = useState(true);

  // Clé Gemini
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Données éditables du mot
  const [englishWord, setEnglishWord] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("noun");
  const [translations, setTranslations] = useState([""]);

  // Alerte doublon & statut
  const [duplicateFound, setDuplicateFound] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setGeminiApiKey(translationService.getGeminiApiKey());
    } else {
      setQuery("");
      setIsLoading(false);
      setHasSearched(false);
      setTranslationSource("");
      setRawResponseData(null);
      setEnglishWord("");
      setPartOfSpeech("noun");
      setTranslations([""]);
      setDuplicateFound(null);
      setStatusMessage(null);
      setShowKeyInput(false);
      setShowRawJson(true);
    }
  }, [isOpen]);

  const hasGemini = Boolean(geminiApiKey.trim());

  const handleTestKey = async () => {
    if (!geminiApiKey.trim()) {
      setStatusMessage({ type: "error", text: "Veuillez d'abord coller une clé API." });
      return;
    }
    setIsTestingKey(true);
    setStatusMessage(null);
    const res = await translationService.testGeminiKey(geminiApiKey);
    setIsTestingKey(false);

    if (res.success) {
      translationService.setGeminiApiKey(geminiApiKey);
      setStatusMessage({ type: "success", text: `✅ Clé API valide ! Modèle ${res.model} connecté.` });
      setShowKeyInput(false);
    } else {
      setStatusMessage({ type: "error", text: `❌ Erreur Google : ${res.error}` });
    }
  };

  const handleSaveApiKey = (key) => {
    translationService.setGeminiApiKey(key);
    setGeminiApiKey(key.trim());
    if (key.trim()) {
      handleTestKey();
    } else {
      setShowKeyInput(false);
      setStatusMessage({ type: "info", text: "Clé supprimée. Le moteur intégré gratuit est actif." });
    }
  };

  const checkDuplicate = (enWord, pos) => {
    if (!enWord) {
      setDuplicateFound(null);
      return null;
    }
    const found = storageService.findDuplicate(enWord, pos);
    setDuplicateFound(found || null);
    return found;
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setStatusMessage(null);
    setDuplicateFound(null);
    setRawResponseData(null);

    try {
      const result = await translationService.lookupWord(query.trim());
      setEnglishWord(result.english_word);
      setPartOfSpeech(result.part_of_speech);
      setTranslations(result.french_translations.length > 0 ? result.french_translations : [""]);
      setTranslationSource(result.source || "");
      setRawResponseData(result.rawResponse || result);
      setHasSearched(true);

      checkDuplicate(result.english_word, result.part_of_speech);
    } catch (err) {
      console.error(err);
      setStatusMessage({ 
        type: "error", 
        text: `Erreur : ${err.message}. Vous pouvez vérifier votre clé API ou saisir manuellement la traduction.` 
      });
      setEnglishWord(query);
      setHasSearched(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslationChange = (index, value) => {
    const updated = [...translations];
    updated[index] = value;
    setTranslations(updated);
  };

  const addTranslationField = () => {
    if (translations.length < 5) {
      setTranslations([...translations, ""]);
    }
  };

  const removeTranslationField = (index) => {
    if (translations.length > 1) {
      setTranslations(translations.filter((_, i) => i !== index));
    }
  };

  const playPronunciation = (text) => {
    if ("speechSynthesis" in window && text) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSave = async () => {
    if (!englishWord.trim()) {
      setStatusMessage({ type: "error", text: "Veuillez indiquer le mot ou l'expression en anglais." });
      return;
    }

    const cleanTranslations = translations.map((t) => t.trim()).filter(Boolean);
    if (cleanTranslations.length === 0) {
      setStatusMessage({ type: "error", text: "Veuillez indiquer au moins une traduction en français." });
      return;
    }

    try {
      const res = await storageService.addWord({
        english_word: englishWord.trim(),
        part_of_speech: partOfSpeech,
        french_translations: cleanTranslations
      });

      if (!res.success && res.reason === "duplicate") {
        setDuplicateFound(res.existing);
        setStatusMessage({ type: "warning", text: `« ${englishWord} » est déjà enregistré dans votre liste.` });
        return;
      }

      if (res.success) {
        onWordAdded(res.word);
        onClose();
      }
    } catch (err) {
      console.error("Erreur enregistrement mot :", err);
      setStatusMessage({ type: "error", text: `Erreur lors de l'enregistrement : ${err.message}` });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-fade-in">
      <div className="w-full sm:max-w-lg max-h-[92vh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${
              hasGemini 
                ? "bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400"
                : "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400"
            }`}>
              {hasGemini ? <Bot className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Ajouter du vocabulaire</h2>
                <button
                  type="button"
                  onClick={() => setShowKeyInput(!showKeyInput)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition ${
                    hasGemini
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 hover:bg-purple-200"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                  title="Configurer ou tester la clé Gemini"
                >
                  <Bot className="w-3 h-3" />
                  {hasGemini ? "Clé Gemini configurée" : "+ Activer Gemini"}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Traduction & classification Anglais ➔ Français</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* Panneau de configuration & test clé Gemini */}
          {showKeyInput && (
            <div className="p-3.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-2xl space-y-2.5 animate-pop-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900 dark:text-purple-200">
                  <KeyRound className="w-4 h-4 text-purple-600" />
                  <span>Clé API Google Gemini (Gratuite)</span>
                </div>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold flex items-center gap-0.5 hover:underline"
                >
                  <span>Obtenir sur Google AI Studio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="Collez votre clé AIzaSy..."
                  className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-mono"
                />
                <button
                  type="button"
                  disabled={isTestingKey}
                  onClick={handleTestKey}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition"
                >
                  {isTestingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Tester & Activer</span>
                </button>
              </div>
            </div>
          )}

          {/* Saisie mot anglais */}
          <form onSubmit={handleSearch} className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Mot ou expression en anglais
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ex: Rife, Shrewd, To boast, A piece of cake..."
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-transparent focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 active:scale-95 transition"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Traduire</span>
              </button>
            </div>
          </form>

          {/* Alerte Doublon */}
          {duplicateFound && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5 animate-pop-in">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-200">
                <p className="font-semibold">Cet élément est déjà dans votre vocabulaire !</p>
                <p className="mt-0.5">
                  « {duplicateFound.english_word} » ({PART_OF_SPEECH_LABELS[duplicateFound.part_of_speech]?.fr || duplicateFound.part_of_speech}) est déjà enregistré.
                </p>
              </div>
            </div>
          )}

          {/* Message de statut */}
          {statusMessage && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              statusMessage.type === "error"
                ? "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 border border-rose-200"
                : statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 border border-emerald-200"
                : "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200 border border-blue-200"
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Encadré d'inspection intégrale du résultat */}
          {hasSearched && rawResponseData && (
            <div className="p-3.5 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 space-y-2.5 shadow-md animate-fade-in">
              <div 
                onClick={() => setShowRawJson(!showRawJson)} 
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${translationSource.includes('Gemini') ? 'bg-purple-400' : 'bg-emerald-400'} animate-pulse`} />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Résultat de l'analyse
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded text-indigo-300 font-semibold">{translationSource}</span>
                  {showRawJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </div>
              </div>

              {showRawJson && (
                <div className="space-y-2 text-xs pt-1 border-t border-slate-800 font-mono">
                  <div className="grid grid-cols-2 gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Mot anglais détecté</span>
                      <strong className="text-emerald-400 text-sm font-sans">{rawResponseData.english_word}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Nature grammaticale</span>
                      <strong className="text-indigo-400 text-sm font-sans">
                        {PART_OF_SPEECH_LABELS[rawResponseData.part_of_speech]?.fr || rawResponseData.part_of_speech}
                      </strong>
                    </div>
                  </div>

                  <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 block uppercase mb-1">Traductions françaises renvoyées</span>
                    <div className="flex flex-wrap gap-1">
                      {rawResponseData.french_translations?.filter(Boolean).map((t, idx) => (
                        <span key={idx} className="bg-indigo-900/60 text-indigo-200 px-2 py-0.5 rounded text-xs font-sans">
                          {t}
                        </span>
                      ))}
                      {(!rawResponseData.french_translations || rawResponseData.french_translations.length === 0) && (
                        <span className="text-slate-500 text-xs italic">Aucune traduction trouvée</span>
                      )}
                    </div>
                  </div>

                  {rawResponseData.notes && (
                    <div className="text-[11px] text-amber-300/90 font-sans italic flex items-center gap-1.5 pt-0.5">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>{rawResponseData.notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Formulaire éditable */}
          {(hasSearched || englishWord) && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Champs à enregistrer (modifiables)
                </span>
                <span className="text-[11px] text-slate-400">Vérifiez et ajustez</span>
              </div>

              {/* Mot ou expression en anglais */}
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  Mot / Expression en Anglais
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={englishWord}
                    onChange={(e) => {
                      setEnglishWord(e.target.value);
                      checkDuplicate(e.target.value, partOfSpeech);
                    }}
                    placeholder="Ex: Rife, A piece of cake"
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                  {englishWord && (
                    <button
                      type="button"
                      onClick={() => playPronunciation(englishWord)}
                      className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl transition"
                      title="Écouter la prononciation"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Nature grammaticale */}
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  Nature grammaticale
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {Object.entries(PART_OF_SPEECH_LABELS).map(([key, info]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setPartOfSpeech(key);
                        checkDuplicate(englishWord, key);
                      }}
                      className={`py-1.5 px-2 text-xs font-medium rounded-lg border text-center transition ${
                        partOfSpeech === key
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {info.fr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Traductions en français */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Traductions en Français ({translations.filter(Boolean).length})
                  </label>
                  {translations.length < 5 && (
                    <button
                      type="button"
                      onClick={addTranslationField}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1 hover:underline"
                    >
                      <Plus className="w-3 h-3" /> Ajouter une variante
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {translations.map((t, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={t}
                        onChange={(e) => handleTranslationChange(idx, e.target.value)}
                        placeholder={`Traduction ${idx + 1} en français (ex: Courant, Répandu)`}
                        className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                      {translations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTranslationField(idx)}
                          className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!englishWord || duplicateFound !== null}
            className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-md shadow-indigo-500/20 flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Enregistrer dans ma liste</span>
          </button>
        </div>

      </div>
    </div>
  );
}
