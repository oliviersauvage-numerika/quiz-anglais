import React, { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Volume2, 
  RotateCcw, 
  HelpCircle, 
  Award,
  Mic,
  MicOff,
  Bell,
  Clock,
  Calendar,
  Zap
} from "lucide-react";
import { PART_OF_SPEECH_LABELS } from "../services/translationService";
import { storageService } from "../services/storageService";
import { srsService } from "../services/srsService";

export function QuizView({ words, onWordsUpdate, onOpenAdd }) {
  const [includeLearned, setIncludeLearned] = useState(false);

  const [currentWord, setCurrentWord] = useState(null);
  const [selectedFrenchTranslation, setSelectedFrenchTranslation] = useState("");
  const [userAnswer, setUserAnswer] = useState("");
  const [quizState, setQuizState] = useState("answering"); // "answering" | "correct" | "incorrect"
  const [lastUpdatedWord, setLastUpdatedWord] = useState(null);
  
  const [roundQueue, setRoundQueue] = useState([]);
  const lastWordIdRef = useRef(null);
  const inputRef = useRef(null);

  // Reconnaissance vocale (Speech-to-Text)
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const recognitionRef = useRef(null);

  const [sessionScore, setSessionScore] = useState({ correct: 0, total: 0 });

  // Séparation SRS
  const dueReviews = words.filter((w) => srsService.isReviewDue(w));
  const learningWords = words.filter((w) => (w.srsStage || 0) === 0);
  const masteredWords = words.filter((w) => w.isMastered || (w.srsStage || 0) >= 10);
  const totalCount = words.length;

  // Détermination des mots candidats selon les priorités SRS
  const candidateWords = React.useMemo(() => {
    if (includeLearned) return words;
    // 1. Priorité aux révisions dues aujourd'hui + mots en apprentissage
    const activePool = [...dueReviews, ...learningWords];
    if (activePool.length > 0) return activePool;

    // 2. Si aucune révision due et aucun mot en apprentissage : mots en cours de palier non maîtrisés
    const inProgress = words.filter((w) => !w.isMastered && (w.srsStage || 0) < 10);
    if (inProgress.length > 0) return inProgress;

    // 3. Sinon tous les mots
    return words;
  }, [words, includeLearned, dueReviews.length, learningWords.length]);

  const isSpeechSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    if (candidateWords.length > 0 && (!currentWord || !candidateWords.some(w => w.id === currentWord.id))) {
      pickNextQuestion();
    }
  }, [words, includeLearned]);

  useEffect(() => {
    if (quizState === "answering" && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [quizState, currentWord]);

  // Arrêter l'écoute lors du démontage du composant
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const startListening = () => {
    if (!isSpeechSupported) {
      setSpeechError("La reconnaissance vocale n'est pas disponible sur ce navigateur.");
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join("");
        
        if (transcript) {
          const cleaned = transcript.trim().replace(/\.$/, "");
          setUserAnswer(cleaned);
        }
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setSpeechError("Accès au microphone refusé. Veuillez l'autoriser.");
        } else if (event.error !== "no-speech") {
          setSpeechError("Erreur d'écoute, veuillez réessayer.");
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Erreur lors de l'écoute vocale :", err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  };

  const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const pickNextQuestion = () => {
    stopListening();
    if (candidateWords.length === 0) {
      setCurrentWord(null);
      return;
    }

    let queue = [...roundQueue];
    queue = queue.filter((id) => candidateWords.some((w) => w.id === id));

    if (queue.length === 0) {
      // Prioriser les révisions du jour d'abord dans la file
      const dueInCandidates = candidateWords.filter(w => srsService.isReviewDue(w)).map(w => w.id);
      const othersInCandidates = candidateWords.filter(w => !srsService.isReviewDue(w)).map(w => w.id);
      
      queue = [...shuffleArray(dueInCandidates), ...shuffleArray(othersInCandidates)];
      
      if (candidateWords.length > 1 && queue[0] === lastWordIdRef.current) {
        const temp = queue[0];
        queue[0] = queue[1];
        queue[1] = temp;
      }
    }

    let nextId = queue.shift();

    if (candidateWords.length > 1 && nextId === lastWordIdRef.current && queue.length > 0) {
      const alternativeId = queue.shift();
      queue.unshift(nextId);
      nextId = alternativeId;
    }

    const nextWord = candidateWords.find((w) => w.id === nextId) || candidateWords[0];
    lastWordIdRef.current = nextWord.id;

    const transList = nextWord.french_translations || [""];
    const randomFrench = transList[Math.floor(Math.random() * transList.length)] || transList[0] || "";

    setCurrentWord(nextWord);
    setSelectedFrenchTranslation(randomFrench);
    setRoundQueue(queue);
    setUserAnswer("");
    setQuizState("answering");
    setLastUpdatedWord(null);
  };

  const normalize = (text, partOfSpeech = "") => {
    let clean = (text || "")
      .trim()
      .toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/\s+/g, " ");

    const pos = (partOfSpeech || "").toLowerCase();

    // Pour les verbes : accepter ou ignorer le préfixe "to "
    if (pos === "verb" || clean.startsWith("to ")) {
      clean = clean.replace(/^to\s+/i, "").trim();
    }

    // Pour les noms : accepter les articles / prépositions "a", "an", "the"
    if (pos === "noun" || /^(a|an|the)\s+/i.test(clean)) {
      clean = clean.replace(/^(a|an|the)\s+/i, "").trim();
    }

    return clean;
  };

  const playPronunciation = (text) => {
    if ("speechSynthesis" in window && text) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    stopListening();
    if (quizState !== "answering" || !userAnswer.trim() || !currentWord) return;

    const userNorm = normalize(userAnswer, currentWord.part_of_speech);
    const correctNorm = normalize(currentWord.english_word, currentWord.part_of_speech);

    const isCorrect = userNorm === correctNorm;

    const { words: updatedWords, updatedWord } = storageService.recordQuizResult(currentWord.id, isCorrect);
    onWordsUpdate(updatedWords);
    setLastUpdatedWord(updatedWord);

    setSessionScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));

    if (isCorrect) {
      setQuizState("correct");
      playPronunciation(currentWord.english_word);

      if (updatedWord?.isMastered || (updatedWord?.srsStage === 1 && !currentWord.learned)) {
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.7 }
          });
        } catch {
          // Confetti fallback
        }
      }
    } else {
      setQuizState("incorrect");
    }
  };

  if (candidateWords.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in max-w-md mx-auto">
        <div className="w-20 h-20 bg-gradient-to-tr from-amber-400 to-amber-500 rounded-3xl shadow-xl shadow-amber-500/20 flex items-center justify-center text-white mb-6 animate-pop-in">
          <Award className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
          Toutes les révisions du jour sont faites ! 🎉
        </h2>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">
          Aucun mot n'est en attente de révision aujourd'hui. Vos mots progressent sur le calendrier espacé !
        </p>

        <div className="w-full space-y-3">
          <button
            onClick={() => setIncludeLearned(true)}
            className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <RotateCcw className="w-5 h-5" />
            <span>S'entraîner en mode Révision libre</span>
          </button>

          <button
            onClick={onOpenAdd}
            className="w-full py-3.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-semibold rounded-2xl hover:bg-slate-50 transition"
          >
            Ajouter de nouveaux mots
          </button>
        </div>
      </div>
    );
  }

  const posInfo = PART_OF_SPEECH_LABELS[currentWord?.part_of_speech] || {
    fr: currentWord?.part_of_speech,
    color: "bg-slate-100 text-slate-800 border-slate-200"
  };

  const isCurrentDue = currentWord && srsService.isReviewDue(currentWord);
  const currentStageInfo = srsService.getStageInfo(currentWord?.srsStage || (currentWord?.learned ? 1 : 0));

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pt-2 pb-24">
      
      {/* Barre de suivi SRS & Progression */}
      <div className="flex items-center justify-between mb-3 text-xs">
        <div className="flex items-center gap-2">
          {dueReviews.length > 0 ? (
            <span className="font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70 border border-amber-300/80 dark:border-amber-800 px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
              <Bell className="w-3.5 h-3.5" />
              <span>{dueReviews.length} à réviser aujourd'hui</span>
            </span>
          ) : (
            <span className="font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>À jour pour aujourd'hui</span>
            </span>
          )}
        </div>

        <span className="font-semibold text-slate-500 dark:text-slate-400">
          {learningWords.length} en apprentissage
        </span>
      </div>

      {/* Carte de la Question */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 flex-1 flex flex-col justify-between min-h-[360px] animate-fade-in relative overflow-hidden">
        
        <div>
          {/* Header de la carte avec Type de palier SRS */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${posInfo.color}`}>
              {posInfo.fr}
            </span>

            {/* Badge SRS du mot actuel */}
            <div className="flex items-center gap-1.5">
              {isCurrentDue ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white flex items-center gap-1 shadow-xs">
                  <Bell className="w-3 h-3" />
                  <span>Révision ({currentStageInfo.shortLabel})</span>
                </span>
              ) : currentWord?.srsStage === 0 || !currentWord?.learned ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-indigo-600" />
                  <span>Apprentissage ({currentWord?.successCount || 0}/3 ★)</span>
                </span>
              ) : (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${currentStageInfo.badgeColor}`}>
                  {currentStageInfo.shortLabel}
                </span>
              )}
            </div>
          </div>

          {/* Mot en français demandé */}
          <div className="my-5 text-center">
            <span className="text-xs text-slate-400 font-medium block mb-1">Mot en français</span>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              « {selectedFrenchTranslation} »
            </h1>
            
            {currentWord?.french_translations?.length > 1 && (
              <p className="text-xs text-slate-400 mt-1">
                (Autres sens : {currentWord.french_translations.filter(t => t !== selectedFrenchTranslation).join(", ")})
              </p>
            )}
          </div>
        </div>

        {/* Section de réponse / Résultat */}
        <div className="space-y-4">
          
          {quizState === "answering" && (
            <form onSubmit={handleSubmit} className="space-y-3">
              
              {/* Bouton de réponse vocale au-dessus du champ de réponse */}
              {isSpeechSupported && (
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    className={`w-full py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs ${
                      isListening
                        ? "bg-rose-500 hover:bg-rose-600 text-white animate-pulse ring-4 ring-rose-300 dark:ring-rose-900/50"
                        : "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/50"
                    }`}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-4 h-4 animate-bounce shrink-0" />
                        <span>Écoute en cours... Parlez en anglais (cliquez pour terminer)</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>🎤 Répondre à l'oral (Micro)</span>
                      </>
                    )}
                  </button>
                  {speechError && (
                    <p className="text-[11px] text-rose-500 font-medium text-center">
                      {speechError}
                    </p>
                  )}
                </div>
              )}

              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Tapez ou dictez le mot en anglais..."
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-base font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-800 transition"
                />
              </div>

              <button
                type="submit"
                disabled={!userAnswer.trim()}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <span>Valider</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}

          {/* Feedback : Bonne réponse avec Progression SRS */}
          {quizState === "correct" && (
            <div className="space-y-4 animate-pop-in">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-emerald-900 dark:text-emerald-100">
                        {currentWord.english_word}
                      </span>
                      <button
                        onClick={() => playPronunciation(currentWord.english_word)}
                        className="p-1 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-full"
                        title="Écouter"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Détails du palier SRS atteint */}
                    <div className="mt-1 text-xs text-emerald-800 dark:text-emerald-200 font-medium">
                      {lastUpdatedWord?.isMastered ? (
                        <p className="font-bold text-amber-800 dark:text-amber-200">
                          🏆 Extraordinaire ! Mot validé 6 mois : Définitivement Acquis !
                        </p>
                      ) : lastUpdatedWord?.srsStage === 1 && !currentWord.learned ? (
                        <p className="font-bold">
                          🎉 1ʳᵉ acquisition validée ! Prochaine révision à J+1 (demain).
                        </p>
                      ) : lastUpdatedWord?.srsStage > 0 ? (
                        <p>
                          ✅ <b>{srsService.getStageInfo(lastUpdatedWord.srsStage).label}</b> validé ! Prochaine révision : <b>{srsService.formatRelativeReviewDate(lastUpdatedWord.nextReviewAt)?.text}</b>.
                        </p>
                      ) : (
                        <p>
                          Bravo ! Réussite {lastUpdatedWord?.successCount}/3 pour la 1ʳᵉ acquisition.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={pickNextQuestion}
                autoFocus
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <span>Question suivante</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Feedback : Mauvaise réponse avec Rétrogradation Option B */}
          {quizState === "incorrect" && (
            <div className="space-y-4 animate-shake">
              <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl">
                <div className="flex items-start gap-3">
                  <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold uppercase">
                      La bonne réponse était :
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-2xl font-black text-rose-950 dark:text-rose-100">
                        {currentWord.english_word}
                      </span>
                      <button
                        onClick={() => playPronunciation(currentWord.english_word)}
                        className="p-1 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900 rounded-full"
                        title="Écouter"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Votre réponse : <span className="line-through">{userAnswer}</span>
                    </p>

                    {/* Explication de la rétrogradation SRS */}
                    <div className="mt-2 pt-2 border-t border-rose-200 dark:border-rose-900/60 text-[11px] text-rose-800 dark:text-rose-300">
                      {lastUpdatedWord?.srsStage > 0 ? (
                        <span>
                          ↩️ <b>Rétrogradation d'un palier :</b> replacé au <b>{srsService.getStageInfo(lastUpdatedWord.srsStage).label}</b> (Revue dès demain pour consolider).
                        </span>
                      ) : currentWord.learned ? (
                        <span>
                          ↩️ <b>Retour en apprentissage :</b> le mot repasse en apprentissage initial (2/3 ★).
                        </span>
                      ) : (
                        <span>
                          Continuez l'entraînement pour valider les 3 étoiles.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={pickNextQuestion}
                autoFocus
                className="w-full py-3.5 px-4 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <span>Continuer</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
