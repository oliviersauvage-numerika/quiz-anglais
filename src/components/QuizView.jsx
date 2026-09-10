import React, { useState, useEffect, useRef, useMemo } from "react";
import confetti from "canvas-confetti";
import { 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Volume2, 
  RotateCcw, 
  Award,
  Mic,
  MicOff,
  Bell,
  Clock,
  BookOpen,
  Zap,
  Info,
  AlertCircle
} from "lucide-react";
import { PART_OF_SPEECH_LABELS } from "../services/translationService";
import { storageService } from "../services/storageService";
import { srsService } from "../services/srsService";

export function QuizView({ words, onWordsUpdate, onOpenAdd }) {
  // 3 Modes explicites : "srs-review" | "initial-learning" | "free-practice"
  const dueReviews = useMemo(() => words.filter((w) => srsService.isReviewDue(w)), [words]);
  const learningWords = useMemo(() => words.filter((w) => (w.srsStage || 0) === 0 && !w.isMastered), [words]);
  const masteredWords = useMemo(() => words.filter((w) => w.isMastered || (w.srsStage || 0) >= 10), [words]);

  // Choix du mode initial par défaut
  const [quizMode, setQuizMode] = useState(() => {
    if (words.some((w) => srsService.isReviewDue(w))) return "srs-review";
    if (words.some((w) => (w.srsStage || 0) === 0 && !w.isMastered)) return "initial-learning";
    return "free-practice";
  });

  const [currentWord, setCurrentWord] = useState(null);
  const [displayedPrompt, setDisplayedPrompt] = useState("");
  const [userAnswer, setUserAnswer] = useState("");
  const [quizState, setQuizState] = useState("answering"); // "answering" | "correct" | "incorrect"
  const [lastUpdatedWord, setLastUpdatedWord] = useState(null);
  const [emptyAnswerWarning, setEmptyAnswerWarning] = useState(null);

  // Instantané du résultat pour découplage strict avec les révisions encore dues et Supabase Realtime
  const [resultSnapshot, setResultSnapshot] = useState(null);
  
  const [roundQueue, setRoundQueue] = useState([]);
  const recentWordIdsRef = useRef([]); // Historique des 2 derniers IDs posés pour anti-répétition
  const inputRef = useRef(null);
  const isSubmittingRef = useRef(false); // Verrou anti-double validation

  // Reconnaissance vocale (Speech-to-Text)
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const recognitionRef = useRef(null);

  const [sessionScore, setSessionScore] = useState({ correct: 0, total: 0 });

  // Candidats selon le mode actif
  const candidateWords = useMemo(() => {
    if (quizMode === "srs-review") {
      return dueReviews;
    }
    if (quizMode === "initial-learning") {
      return learningWords;
    }
    // "free-practice" : toutes les cartes
    return words;
  }, [quizMode, dueReviews, learningWords, words]);

  const isSpeechSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  // Arrêter l'écoute vocale
  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  };

  // Sélection de la question suivante
  const pickNextQuestion = () => {
    stopListening();
    if (candidateWords.length === 0) {
      setCurrentWord(null);
      setQuizState("answering");
      setLastUpdatedWord(null);
      setResultSnapshot(null);
      isSubmittingRef.current = false;
      return;
    }

    let queue = [...roundQueue];
    // Ne conserver que les IDs qui font toujours partie des candidats éligibles
    queue = queue.filter((id) => candidateWords.some((w) => String(w.id) === String(id)));

    if (queue.length === 0) {
      queue = srsService.buildRoundQueue(candidateWords, recentWordIdsRef.current);
    }

    if (queue.length === 0) {
      setCurrentWord(null);
      setQuizState("answering");
      setLastUpdatedWord(null);
      setResultSnapshot(null);
      isSubmittingRef.current = false;
      return;
    }

    let nextId = queue.shift();

    // Anti-répétition consécutive : si N >= 2 et que la carte correspond à la dernière posée
    if (candidateWords.length > 1 && recentWordIdsRef.current.length > 0 && String(nextId) === String(recentWordIdsRef.current[0]) && queue.length > 0) {
      const altId = queue.shift();
      queue.unshift(nextId);
      nextId = altId;
    }

    const nextWord = candidateWords.find((w) => String(w.id) === String(nextId)) || candidateWords[0];
    
    // Mise à jour de l'historique récent (max 2 cartes)
    recentWordIdsRef.current = [nextWord.id, ...recentWordIdsRef.current.filter((id) => id !== nextWord.id)].slice(0, 2);

    // Détermination de la consigne (frenchPrompt ou première traduction)
    const prompt = nextWord.frenchPrompt || (nextWord.french_translations && nextWord.french_translations[0]) || "";

    setCurrentWord(nextWord);
    setDisplayedPrompt(prompt);
    setRoundQueue(queue);
    setUserAnswer("");
    setEmptyAnswerWarning(null);
    setQuizState("answering");
    setLastUpdatedWord(null);
    setResultSnapshot(null);
    isSubmittingRef.current = false;
  };

  // Changement explicite de mode de quiz
  const handleModeChange = (newMode) => {
    if (newMode === quizMode) return;
    stopListening();
    setQuizMode(newMode);
    setCurrentWord(null);
    setDisplayedPrompt("");
    setUserAnswer("");
    setEmptyAnswerWarning(null);
    setQuizState("answering");
    setLastUpdatedWord(null);
    setResultSnapshot(null);
    setRoundQueue([]);
    isSubmittingRef.current = false;
  };

  // Synchronisation des questions : déclenchée uniquement en état "answering"
  // Ne JAMAIS interrompre la lecture d'un résultat en cours d'affichage
  useEffect(() => {
    if (quizState !== "answering") {
      return;
    }

    if (candidateWords.length > 0) {
      if (!currentWord || !candidateWords.some((w) => String(w.id) === String(currentWord.id))) {
        pickNextQuestion();
      }
    } else {
      setCurrentWord(null);
    }
  }, [quizMode, candidateWords.length, quizState]);

  // Focus automatique de l'input lors du passage à une nouvelle question
  useEffect(() => {
    if (quizState === "answering" && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [quizState, currentWord]);

  // Raccourci clavier : touche Entrée pour passer à la question suivante lors de l'affichage du résultat
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter" && (quizState === "correct" || quizState === "incorrect")) {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [quizState, resultSnapshot]);

  // Nettoyage speech recognition
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
    if (quizState !== "answering") return;

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
        if (quizState !== "answering" || isSubmittingRef.current) return;

        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join("");
        
        if (transcript) {
          const cleaned = transcript.trim().replace(/\.$/, "");
          setUserAnswer(cleaned);
          setEmptyAnswerWarning(null);
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

  const playPronunciation = (text) => {
    if ("speechSynthesis" in window && text) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Soumission et validation de la réponse
  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    stopListening();

    // 1. Protection anti-double validation
    if (isSubmittingRef.current || quizState !== "answering") {
      return;
    }

    // 2. Gestion réponse vide sans la comptabiliser comme une erreur
    const trimmedAnswer = userAnswer.trim();
    if (!trimmedAnswer) {
      setEmptyAnswerWarning("Saisis une réponse avant de valider");
      inputRef.current?.focus();
      return;
    }

    setEmptyAnswerWarning(null);
    if (!currentWord) return;

    isSubmittingRef.current = true;

    // 3. Évaluation via srsService.checkAnswer (moteur centralisé avec tolérances linguistiques)
    const isCorrect = srsService.checkAnswer(trimmedAnswer, currentWord);

    // 4. Détection si c'est la dernière question de la session
    let isLast = false;
    if (quizMode === "srs-review") {
      const remainingDue = dueReviews.filter((w) => String(w.id) !== String(currentWord.id));
      isLast = remainingDue.length === 0;
    } else if (quizMode === "initial-learning") {
      const remainingLearning = learningWords.filter((w) => String(w.id) !== String(currentWord.id));
      const willGraduate = isCorrect && ((currentWord.learningSuccessCount || 0) + 1 >= 3);
      isLast = remainingLearning.length === 0 && willGraduate;
    } else {
      // free-practice
      const queueRemaining = roundQueue.filter((id) => String(id) !== String(currentWord.id));
      isLast = words.length <= 1 || queueRemaining.length === 0;
    }

    // 5. Enregistrement Local-First
    const { words: updatedWords, updatedWord } = storageService.recordQuizResult(
      currentWord.id, 
      isCorrect, 
      quizMode
    );

    // 6. Sauvegarde de l'instantané indépendant
    setResultSnapshot({
      word: currentWord,
      displayedPrompt,
      userAnswer: trimmedAnswer,
      isCorrect,
      updatedWord,
      isLastQuestion: isLast,
      quizMode
    });

    onWordsUpdate(updatedWords);
    setLastUpdatedWord(updatedWord);

    setSessionScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));

    if (isCorrect) {
      setQuizState("correct");
      playPronunciation(currentWord.english_word);

      if (quizMode !== "free-practice" && (updatedWord?.isMastered || (updatedWord?.srsStage === 1 && !currentWord.learned))) {
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.7 }
          });
        } catch {}
      }
    } else {
      setQuizState("incorrect");
    }
  };

  // Passage à la question suivante ou écran de fin
  const handleNext = () => {
    isSubmittingRef.current = false;
    const wasLast = resultSnapshot?.isLastQuestion;

    setResultSnapshot(null);
    setEmptyAnswerWarning(null);

    if (wasLast) {
      // Fin de la session
      setCurrentWord(null);
      setQuizState("answering");
      setLastUpdatedWord(null);
      setUserAnswer("");
      setRoundQueue([]);
      return;
    }

    pickNextQuestion();
  };

  // Références stables pour l'affichage (priorité au snapshot pendant la lecture du résultat)
  const activeWord = resultSnapshot ? resultSnapshot.word : currentWord;
  const activePrompt = resultSnapshot ? resultSnapshot.displayedPrompt : displayedPrompt;
  const isLastQuestion = resultSnapshot ? resultSnapshot.isLastQuestion : false;
  const activeUpdatedWord = resultSnapshot?.updatedWord || lastUpdatedWord;
  const activeUserAnswer = resultSnapshot?.userAnswer ?? userAnswer;

  const posInfo = PART_OF_SPEECH_LABELS[activeWord?.part_of_speech] || {
    fr: activeWord?.part_of_speech,
    color: "bg-slate-100 text-slate-800 border-slate-200"
  };

  const currentStageInfo = srsService.getStageInfo(activeWord?.srsStage || (activeWord?.learned ? 1 : 0));

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pt-1 pb-24 space-y-3">
      
      {/* Sélecteur de Mode de Quiz explicite */}
      <div className="bg-slate-200/70 dark:bg-slate-900 p-1 rounded-2xl flex items-center gap-1 border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => handleModeChange("srs-review")}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
            quizMode === "srs-review"
              ? "bg-amber-500 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Bell className="w-3 h-3" />
          <span>Révisions</span>
          {dueReviews.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
              quizMode === "srs-review" ? "bg-white text-amber-600" : "bg-amber-500 text-white"
            }`}>
              {dueReviews.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleModeChange("initial-learning")}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
            quizMode === "initial-learning"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Zap className="w-3 h-3" />
          <span>Apprentissage</span>
          {learningWords.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
              quizMode === "initial-learning" ? "bg-white text-indigo-600" : "bg-indigo-500 text-white"
            }`}>
              {learningWords.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleModeChange("free-practice")}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
            quizMode === "free-practice"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <BookOpen className="w-3 h-3" />
          <span>Entraînement</span>
        </button>
      </div>

      {/* État vide explicite lorsque le mode sélectionné n'a plus de cartes */}
      {!activeWord || (candidateWords.length === 0 && quizState === "answering") ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none min-h-[380px]">
          <div className="w-16 h-16 bg-gradient-to-tr from-emerald-400 to-teal-500 rounded-3xl shadow-lg shadow-emerald-500/20 flex items-center justify-center text-white mb-4 animate-pop-in">
            <Award className="w-8 h-8" />
          </div>
          
          <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">
            {quizMode === "srs-review" 
              ? "Toutes les révisions du jour sont terminées ! 🎉"
              : quizMode === "initial-learning"
              ? "Aucun mot en apprentissage initial !"
              : "Aucun mot dans votre vocabulaire"}
          </h2>
          
          <p className="text-slate-600 dark:text-slate-300 text-xs mb-6 max-w-xs leading-relaxed">
            {quizMode === "srs-review"
              ? "Vous êtes parfaitement à jour sur votre calendrier SRS. Pour continuer à vous exercer sans modifier vos échéances, lancez l'entraînement libre !"
              : quizMode === "initial-learning"
              ? "Tous vos mots ont validé le palier initial (3 réussites consécutives). Vous pouvez ajouter de nouveaux mots ou vous entraîner librement."
              : "Ajoutez vos premiers mots de vocabulaire pour démarrer."}
          </p>

          <div className="w-full space-y-2.5 max-w-xs">
            {quizMode !== "free-practice" && words.length > 0 && (
              <button
                onClick={() => handleModeChange("free-practice")}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Lancer l'entraînement libre ({words.length} mots)</span>
              </button>
            )}

            <button
              onClick={onOpenAdd}
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold rounded-2xl transition"
            >
              + Ajouter de nouveaux mots
            </button>
          </div>
        </div>
      ) : (
        /* Carte de la Question */
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 flex-1 flex flex-col justify-between min-h-[380px] animate-fade-in relative overflow-hidden">
          
          <div>
            {/* Header de la carte */}
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${posInfo.color}`}>
                {posInfo.fr}
              </span>

              {/* Mode actuel & Badge SRS */}
              <div className="flex items-center gap-1.5">
                {quizMode === "free-practice" ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    Mode Libre (neutre SRS)
                  </span>
                ) : quizMode === "srs-review" ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white flex items-center gap-1 shadow-xs">
                    <Bell className="w-3 h-3" />
                    <span>Révision ({currentStageInfo.shortLabel})</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-indigo-600" />
                    <span>{activeWord?.learningSuccessCount || 0}/3 ★ consécutifs</span>
                  </span>
                )}
              </div>
            </div>

            {/* Mot en français demandé (sens précis) avec rappel grammatical contextuel */}
            <div className="my-4 text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-xs font-semibold mb-2">
                Traduisez {posInfo.promptFr || "ce mot"} en anglais :
              </span>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                « {activePrompt} »
              </h1>
              
              {activeWord?.french_translations && activeWord.french_translations.length > 1 && (
                <p className="text-[11px] text-slate-400 mt-1">
                  (Autres variantes : {activeWord.french_translations.filter((t) => t !== activePrompt).join(", ")})
                </p>
              )}

              {/* Note de contexte / Précision de sens en jaune/ambre italique */}
              {(activeWord?.exampleSentence || activeWord?.example_sentence || activeWord?.notes) && (
                <div className="mt-3 px-3.5 py-2 bg-amber-500/10 dark:bg-amber-950/40 border border-amber-300/60 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 italic flex items-center justify-center gap-2 shadow-xs text-center">
                  <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>{activeWord.exampleSentence || activeWord.example_sentence || activeWord.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section de réponse / Résultat */}
          <div className="space-y-3">
            
            {quizState === "answering" && (
              <form onSubmit={handleSubmit} className="space-y-2.5">
                
                {/* Bouton de réponse vocale */}
                {isSpeechSupported && (
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={isListening ? stopListening : startListening}
                      className={`w-full py-2 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs ${
                        isListening
                          ? "bg-rose-500 hover:bg-rose-600 text-white animate-pulse ring-4 ring-rose-300 dark:ring-rose-900/50"
                          : "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/50"
                      }`}
                    >
                      {isListening ? (
                        <>
                          <MicOff className="w-3.5 h-3.5 animate-bounce shrink-0" />
                          <span>Écoute en cours... Parlez (cliquez pour arrêter)</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span>🎤 Répondre à l'oral</span>
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
                    onChange={(e) => {
                      setUserAnswer(e.target.value);
                      if (emptyAnswerWarning) setEmptyAnswerWarning(null);
                    }}
                    placeholder={posInfo.placeholder || "Tapez votre réponse en anglais..."}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 ${
                      emptyAnswerWarning 
                        ? "border-amber-400 dark:border-amber-500 ring-2 ring-amber-300/40" 
                        : "border-slate-200 dark:border-slate-700"
                    } rounded-2xl text-base font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-800 transition`}
                  />
                </div>

                {emptyAnswerWarning && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/60 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-200 flex items-center justify-center gap-1.5 animate-pop-in">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{emptyAnswerWarning}</span>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center font-medium">
                  💡 Les particules (to, a/the, one's...) sont facultatives
                </p>

                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-2xl shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 active:scale-95 transition"
                >
                  <span>Valider</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Feedback : Bonne réponse */}
            {quizState === "correct" && activeWord && (
              <div className="space-y-3 animate-pop-in">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-300 dark:border-emerald-700 rounded-2xl shadow-sm">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                          Bonne réponse !
                        </span>
                        <button
                          type="button"
                          onClick={() => playPronunciation(activeWord.english_word)}
                          className="p-1.5 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-full transition"
                          title="Écouter la prononciation"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mt-1">
                        <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 font-medium">
                          Réponse attendue :
                        </p>
                        <p className="text-2xl font-black text-emerald-950 dark:text-emerald-50 tracking-tight">
                          {activeWord.english_word}
                        </p>
                      </div>

                      {/* Saisie de l'utilisateur si différente de la casse/forme principale */}
                      {activeUserAnswer && activeUserAnswer.trim().toLowerCase() !== activeWord.english_word.trim().toLowerCase() && (
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                          Votre saisie : <span className="font-semibold">« {activeUserAnswer.trim()} »</span> (acceptée)
                        </p>
                      )}

                      {/* Explication du résultat selon le mode */}
                      <div className="mt-2.5 pt-2 border-t border-emerald-200/80 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-200 font-medium">
                        {quizMode === "free-practice" ? (
                          <p>🎯 Bonne réponse ! (Mode entraînement libre sans modification SRS)</p>
                        ) : activeUpdatedWord?.isMastered ? (
                          <p className="font-bold text-amber-800 dark:text-amber-200">
                            🏆 Palier 10 validé : Mot consolidé et maîtrisé !
                          </p>
                        ) : activeUpdatedWord?.srsStage === 1 && !activeWord.learned ? (
                          <p className="font-bold">
                            🎉 3 réussites consécutives ! Promotion au Palier 1 (Revue demain J+1).
                          </p>
                        ) : activeUpdatedWord?.srsStage > 0 ? (
                          <p>
                            ✅ <b>{srsService.getStageInfo(activeUpdatedWord.srsStage).label}</b> validé ! Prochaine révision : <b>{srsService.formatRelativeReviewDate(activeUpdatedWord.nextReviewAt)?.text}</b>.
                          </p>
                        ) : (
                          <p>
                            Bravo ! ({activeUpdatedWord?.learningSuccessCount || 0}/3 ★ consécutifs requis).
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleNext}
                  autoFocus
                  className={`w-full py-3.5 px-4 text-white font-bold rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition text-sm ${
                    isLastQuestion 
                      ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/25" 
                      : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25"
                  }`}
                >
                  <span>{isLastQuestion ? (quizMode === "srs-review" ? "Terminer les révisions" : "Terminer la session") : "Question suivante"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Feedback : Mauvaise réponse */}
            {quizState === "incorrect" && activeWord && (
              <div className="space-y-3 animate-shake">
                <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-700 rounded-2xl shadow-sm">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-black uppercase tracking-wider text-rose-800 dark:text-rose-200">
                          Réponse incorrecte
                        </span>
                        <button
                          type="button"
                          onClick={() => playPronunciation(activeWord.english_word)}
                          className="p-1.5 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-full transition"
                          title="Écouter la prononciation"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mt-1.5">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Votre réponse : <span className="font-bold line-through text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/50 px-1.5 py-0.5 rounded">« {activeUserAnswer.trim() || "(vide)"} »</span>
                        </p>
                      </div>

                      <div className="mt-2">
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold uppercase">
                          Réponse attendue :
                        </p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                          {activeWord.english_word}
                        </p>
                      </div>

                      {activeWord.accepted_answers && activeWord.accepted_answers.length > 0 && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Variantes acceptées : {activeWord.accepted_answers.join(", ")}
                        </p>
                      )}

                      {/* Explication de la rétrogradation */}
                      <div className="mt-2.5 pt-2 border-t border-rose-200/80 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-300 font-medium">
                        {quizMode === "free-practice" ? (
                          <p>Entraînement libre : aucun impact sur vos paliers SRS.</p>
                        ) : activeWord.srsStage >= 2 ? (
                          <p>
                            ↩️ Rétrogradation douce au <b>{srsService.getStageInfo(activeUpdatedWord?.srsStage || 0).label}</b> (Revue urgente demain à J+1).
                          </p>
                        ) : activeWord.srsStage === 1 ? (
                          <p>
                            ↩️ Retour au palier d'apprentissage initial (0/3 ★).
                          </p>
                        ) : (
                          <p>
                            Compteur d'apprentissage remis à 0/3 ★ consécutifs.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleNext}
                  autoFocus
                  className="w-full py-3.5 px-4 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 text-white font-bold rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition text-sm"
                >
                  <span>{isLastQuestion ? (quizMode === "srs-review" ? "Terminer les révisions" : "Terminer la session") : "Question suivante"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}
