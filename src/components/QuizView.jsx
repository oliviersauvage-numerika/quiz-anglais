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
  AlertCircle,
  HelpCircle,
  Loader2,
  Eye,
  Shuffle
} from "lucide-react";
import { PART_OF_SPEECH_LABELS, translationService } from "../services/translationService";
import { storageService } from "../services/storageService";
import { srsService } from "../services/srsService";

export function QuizView({ words, onWordsUpdate, onOpenAdd }) {
  // Préférence de direction : "fr_en" | "en_fr" | "mixed"
  const [directionPreference, setDirectionPreference] = useState(() => storageService.getQuizDirectionPreference());

  // 3 Modes explicites : "srs-review" | "initial-learning" | "free-practice"
  const [quizMode, setQuizMode] = useState(() => {
    const pref = storageService.getQuizDirectionPreference();
    if (words.some((w) => srsService.isReviewDue(w, new Date(), pref === "mixed" ? "fr_en" : pref) || (pref === "mixed" && srsService.isReviewDue(w, new Date(), "en_fr")))) {
      return "srs-review";
    }
    if (words.some((w) => srsService.isLearning(w, pref === "mixed" ? "fr_en" : pref) || (pref === "mixed" && srsService.isLearning(w, "en_fr")))) {
      return "initial-learning";
    }
    return "free-practice";
  });

  // Calculs des révisions dues par direction
  const dueReviewsFrEn = useMemo(() => words.filter((w) => srsService.isReviewDue(w, new Date(), "fr_en")), [words]);
  const dueReviewsEnFr = useMemo(() => words.filter((w) => srsService.isReviewDue(w, new Date(), "en_fr")), [words]);

  // Calculs des apprentissages par direction
  const learningWordsFrEn = useMemo(() => words.filter((w) => srsService.isLearning(w, "fr_en")), [words]);
  const learningWordsEnFr = useMemo(() => words.filter((w) => srsService.isLearning(w, "en_fr")), [words]);

  // Éléments candidats selon le mode et la direction
  const candidateItems = useMemo(() => {
    if (quizMode === "srs-review") {
      if (directionPreference === "fr_en") {
        return dueReviewsFrEn.map((w) => ({ wordId: String(w.id), direction: "fr_en", word: w }));
      }
      if (directionPreference === "en_fr") {
        return dueReviewsEnFr.map((w) => ({ wordId: String(w.id), direction: "en_fr", word: w }));
      }
      return [
        ...dueReviewsFrEn.map((w) => ({ wordId: String(w.id), direction: "fr_en", word: w })),
        ...dueReviewsEnFr.map((w) => ({ wordId: String(w.id), direction: "en_fr", word: w }))
      ];
    }

    if (quizMode === "initial-learning") {
      if (directionPreference === "fr_en") {
        return learningWordsFrEn.map((w) => ({ wordId: String(w.id), direction: "fr_en", word: w }));
      }
      if (directionPreference === "en_fr") {
        return learningWordsEnFr.map((w) => ({ wordId: String(w.id), direction: "en_fr", word: w }));
      }
      return [
        ...learningWordsFrEn.map((w) => ({ wordId: String(w.id), direction: "fr_en", word: w })),
        ...learningWordsEnFr.map((w) => ({ wordId: String(w.id), direction: "en_fr", word: w }))
      ];
    }

    // free-practice
    if (directionPreference === "fr_en") {
      return words.map((w) => ({ wordId: String(w.id), direction: "fr_en", word: w }));
    }
    if (directionPreference === "en_fr") {
      return words.map((w) => ({ wordId: String(w.id), direction: "en_fr", word: w }));
    }
    return [
      ...words.map((w) => ({ wordId: String(w.id), direction: "fr_en", word: w })),
      ...words.map((w) => ({ wordId: String(w.id), direction: "en_fr", word: w }))
    ];
  }, [quizMode, directionPreference, dueReviewsFrEn, dueReviewsEnFr, learningWordsFrEn, learningWordsEnFr, words]);

  // Total des révisions dues et apprentissages visibles selon le sélecteur
  const visibleDueCount = useMemo(() => {
    if (directionPreference === "fr_en") return dueReviewsFrEn.length;
    if (directionPreference === "en_fr") return dueReviewsEnFr.length;
    return dueReviewsFrEn.length + dueReviewsEnFr.length;
  }, [directionPreference, dueReviewsFrEn.length, dueReviewsEnFr.length]);

  const visibleLearningCount = useMemo(() => {
    if (directionPreference === "fr_en") return learningWordsFrEn.length;
    if (directionPreference === "en_fr") return learningWordsEnFr.length;
    return learningWordsFrEn.length + learningWordsEnFr.length;
  }, [directionPreference, learningWordsFrEn.length, learningWordsEnFr.length]);

  // États de la question courante
  const [currentWord, setCurrentWord] = useState(null);
  const [currentDirection, setCurrentDirection] = useState("fr_en"); // "fr_en" | "en_fr"
  const [displayedPrompt, setDisplayedPrompt] = useState("");
  const [userAnswer, setUserAnswer] = useState("");
  const [showHint, setShowHint] = useState(false); // Masquage de l'indice en EN -> FR

  // États du cycle de vie du quiz : "answering" | "evaluating" | "correct" | "incorrect" | "uncertain"
  const [quizState, setQuizState] = useState("answering");
  const [lastUpdatedWord, setLastUpdatedWord] = useState(null);
  const [emptyAnswerWarning, setEmptyAnswerWarning] = useState(null);
  const [uncertainDetails, setUncertainDetails] = useState(null);

  // Instantané du résultat pour découplage strict
  const [resultSnapshot, setResultSnapshot] = useState(null);
  
  const [roundQueue, setRoundQueue] = useState([]);
  const recentWordIdsRef = useRef([]); // Historique récent des IDs posés pour anti-répétition
  const submissionIdRef = useRef(0); // Jetons d'invalidation pour requêtes asynchrones
  const inputRef = useRef(null);
  const isSubmittingRef = useRef(false);

  // Reconnaissance vocale (Speech-to-Text)
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const recognitionRef = useRef(null);

  const [sessionScore, setSessionScore] = useState({ correct: 0, total: 0 });

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
    setShowHint(false);
    setUncertainDetails(null);

    if (candidateItems.length === 0) {
      setCurrentWord(null);
      setQuizState("answering");
      setLastUpdatedWord(null);
      setResultSnapshot(null);
      isSubmittingRef.current = false;
      return;
    }

    let queue = [...roundQueue];
    // Conserver uniquement les items toujours éligibles
    queue = queue.filter((item) => candidateItems.some((c) => String(c.wordId) === String(item.wordId) && c.direction === item.direction));

    if (queue.length === 0) {
      if (directionPreference === "mixed") {
        queue = srsService.buildMixedRoundQueue(candidateItems, recentWordIdsRef.current);
      } else {
        const wordList = candidateItems.map((c) => c.word);
        const rawIds = srsService.buildRoundQueue(wordList, recentWordIdsRef.current, directionPreference);
        queue = rawIds.map((id) => ({
          wordId: String(id),
          direction: directionPreference,
          word: candidateItems.find((c) => String(c.wordId) === String(id))?.word
        }));
      }
    }

    if (queue.length === 0) {
      setCurrentWord(null);
      setQuizState("answering");
      setLastUpdatedWord(null);
      setResultSnapshot(null);
      isSubmittingRef.current = false;
      return;
    }

    let nextItem = queue.shift();

    // Anti-répétition consécutive stricte sur le même mot (même dans un sens différent)
    if (candidateItems.length > 1 && recentWordIdsRef.current.length > 0 && String(nextItem.wordId) === String(recentWordIdsRef.current[0]) && queue.length > 0) {
      const altItem = queue.shift();
      queue.unshift(nextItem);
      nextItem = altItem;
    }

    const nextWord = candidateItems.find((c) => String(c.wordId) === String(nextItem.wordId))?.word || candidateItems[0].word;
    const nextDir = nextItem.direction || directionPreference;

    // Mise à jour de l'historique récent (max 2 cartes)
    recentWordIdsRef.current = [nextWord.id, ...recentWordIdsRef.current.filter((id) => id !== nextWord.id)].slice(0, 2);

    // Détermination de la consigne
    let prompt = "";
    if (nextDir === "en_fr") {
      prompt = nextWord.english_word || "";
    } else {
      prompt = nextWord.frenchPrompt || (nextWord.french_translations && nextWord.french_translations[0]) || "";
    }

    setCurrentWord(nextWord);
    setCurrentDirection(nextDir);
    setDisplayedPrompt(prompt);
    setRoundQueue(queue);
    setUserAnswer("");
    setEmptyAnswerWarning(null);
    setQuizState("answering");
    setLastUpdatedWord(null);
    setResultSnapshot(null);
    isSubmittingRef.current = false;
  };

  // Changement explicite de direction
  const handleDirectionChange = (newDir) => {
    if (newDir === directionPreference) return;
    stopListening();
    submissionIdRef.current++;
    storageService.setQuizDirectionPreference(newDir);
    setDirectionPreference(newDir);
    setCurrentWord(null);
    setDisplayedPrompt("");
    setUserAnswer("");
    setEmptyAnswerWarning(null);
    setQuizState("answering");
    setLastUpdatedWord(null);
    setResultSnapshot(null);
    setRoundQueue([]);
    setShowHint(false);
    setUncertainDetails(null);
    isSubmittingRef.current = false;
  };

  // Changement explicite de mode de quiz
  const handleModeChange = (newMode) => {
    if (newMode === quizMode) return;
    stopListening();
    submissionIdRef.current++;
    setQuizMode(newMode);
    setCurrentWord(null);
    setDisplayedPrompt("");
    setUserAnswer("");
    setEmptyAnswerWarning(null);
    setQuizState("answering");
    setLastUpdatedWord(null);
    setResultSnapshot(null);
    setRoundQueue([]);
    setShowHint(false);
    setUncertainDetails(null);
    isSubmittingRef.current = false;
  };

  // Synchronisation des questions : déclenchée uniquement en état "answering"
  useEffect(() => {
    if (quizState !== "answering") {
      return;
    }

    if (candidateItems.length > 0) {
      if (!currentWord || !candidateItems.some((c) => String(c.wordId) === String(currentWord.id) && c.direction === currentDirection)) {
        pickNextQuestion();
      }
    } else {
      setCurrentWord(null);
    }
  }, [quizMode, directionPreference, candidateItems.length, quizState]);

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
      
      // Langue adaptée selon le sens attendu
      recognition.lang = currentDirection === "en_fr" ? "fr-FR" : "en-US";
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

  const playPronunciation = (text, lang = "en-US") => {
    if ("speechSynthesis" in window && text) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Finalisation et enregistrement du résultat dans le SRS
  const finalizeSubmission = (isCorrect, details = {}) => {
    const trimmedAnswer = userAnswer.trim();
    const targetDirection = currentDirection;

    // Détection si c'est la dernière question de la session
    let isLast = false;
    if (quizMode === "srs-review") {
      const remainingDue = candidateItems.filter((c) => !(String(c.wordId) === String(currentWord.id) && c.direction === targetDirection));
      isLast = remainingDue.length === 0;
    } else if (quizMode === "initial-learning") {
      const remainingLearning = candidateItems.filter((c) => !(String(c.wordId) === String(currentWord.id) && c.direction === targetDirection));
      const currentProg = srsService.getProgress(currentWord, targetDirection);
      const willGraduate = isCorrect && (currentProg.learningSuccessCount + 1 >= 3);
      isLast = remainingLearning.length === 0 && willGraduate;
    } else {
      // free-practice
      const queueRemaining = roundQueue.filter((item) => !(String(item.wordId) === String(currentWord.id) && item.direction === targetDirection));
      isLast = candidateItems.length <= 1 || queueRemaining.length === 0;
    }

    // Enregistrement Local-First avec direction ciblée
    const { words: updatedWords, updatedWord } = storageService.recordQuizResult(
      currentWord.id, 
      isCorrect, 
      quizMode,
      targetDirection
    );

    // Sauvegarde de l'instantané indépendant
    setResultSnapshot({
      word: currentWord,
      direction: targetDirection,
      displayedPrompt,
      userAnswer: trimmedAnswer,
      isCorrect,
      explanation: details.explanation || (isCorrect ? "Bonne réponse !" : "Réponse incorrecte"),
      reference: details.reference || (targetDirection === "en_fr" ? (currentWord.french_translations?.[0] || "") : currentWord.english_word),
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
      if (targetDirection === "fr_en") {
        playPronunciation(currentWord.english_word, "en-US");
      }

      const updatedProg = srsService.getProgress(updatedWord, targetDirection);
      const prevProg = srsService.getProgress(currentWord, targetDirection);

      const isPromotedToPalier1 = (updatedProg.stage === 1 || updatedProg.srsStage === 1) && !prevProg.learned;
      if (quizMode !== "free-practice" && (updatedProg.isMastered || isPromotedToPalier1)) {
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

  // Soumission et validation de la réponse
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    stopListening();

    // Protection anti-double validation
    if (isSubmittingRef.current || quizState !== "answering") {
      return;
    }

    const trimmedAnswer = userAnswer.trim();
    if (!trimmedAnswer) {
      setEmptyAnswerWarning("Saisis une réponse avant de valider");
      inputRef.current?.focus();
      return;
    }

    setEmptyAnswerWarning(null);
    if (!currentWord) return;

    isSubmittingRef.current = true;
    const currentSubId = ++submissionIdRef.current;

    if (currentDirection === "fr_en") {
      // Sens FR -> EN : évaluation synchrone avec tolérances
      const isCorrect = srsService.checkAnswer(trimmedAnswer, currentWord, "fr_en");
      finalizeSubmission(isCorrect, {
        explanation: isCorrect ? "Bonne réponse !" : "Réponse incorrecte",
        reference: currentWord.english_word
      });
    } else {
      // Sens EN -> FR : Évaluation en deux étapes
      // 1. Contrôle local strict (traductions enregistrées, accents, coquilles légères)
      const isLocalMatch = srsService.checkFrenchAnswerLocal(trimmedAnswer, currentWord);
      if (isLocalMatch) {
        finalizeSubmission(true, {
          explanation: "Traduction exacte reconnue localement.",
          reference: currentWord.french_translations?.[0] || ""
        });
        return;
      }

      // 2. Évaluation sémantique via Gemini (synonymes, reformulations fidèles)
      setQuizState("evaluating");
      try {
        const semanticRes = await translationService.evaluateFrenchAnswerSemantic({
          englishWord: currentWord.english_word,
          partOfSpeech: currentWord.part_of_speech,
          contextNote: currentWord.exampleSentence,
          referenceTranslations: currentWord.french_translations,
          userAnswer: trimmedAnswer
        });

        // Rejeter la réponse si la question a changé entre-temps
        if (submissionIdRef.current !== currentSubId) {
          return;
        }

        if (semanticRes.evaluation === "correct") {
          finalizeSubmission(true, {
            explanation: semanticRes.explanation || "Traduction acceptée par analyse du sens.",
            reference: semanticRes.reference || currentWord.french_translations?.[0]
          });
        } else if (semanticRes.evaluation === "incorrect") {
          finalizeSubmission(false, {
            explanation: semanticRes.explanation || "Contresens ou formulation incorrecte.",
            reference: semanticRes.reference || currentWord.french_translations?.[0]
          });
        } else {
          // Évaluation incertaine, hors-ligne ou panne : aucun échec comptabilisé
          setQuizState("uncertain");
          setUncertainDetails({
            explanation: semanticRes.explanation || "Vérification indisponible ou ambiguë.",
            reference: semanticRes.reference || currentWord.french_translations?.[0]
          });
          isSubmittingRef.current = false;
        }
      } catch (err) {
        if (submissionIdRef.current !== currentSubId) return;
        setQuizState("uncertain");
        setUncertainDetails({
          explanation: "Impossible de joindre le service de vérification.",
          reference: currentWord.french_translations?.[0]
        });
        isSubmittingRef.current = false;
      }
    }
  };

  // Validation manuelle par l'utilisateur en cas d'évaluation incertaine ou hors-ligne
  const handleManualValidation = (isCorrect) => {
    isSubmittingRef.current = false;
    finalizeSubmission(isCorrect, {
      explanation: isCorrect 
        ? "Réponse validée manuellement par l'apprenant."
        : "Comptabilisée comme erreur par l'apprenant.",
      reference: uncertainDetails?.reference || currentWord?.french_translations?.[0]
    });
    setUncertainDetails(null);
  };

  // Passer sans pénalité SRS en cas d'incertitude ou hors-ligne
  const handleSkipWithoutPenalty = () => {
    isSubmittingRef.current = false;
    setQuizState("answering");
    setUncertainDetails(null);
    setUserAnswer("");
    pickNextQuestion();
  };

  // Réessayer la réponse courante
  const handleRetryCurrent = () => {
    isSubmittingRef.current = false;
    setQuizState("answering");
    setUncertainDetails(null);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Passage à la question suivante ou écran de fin
  const handleNext = () => {
    isSubmittingRef.current = false;
    const wasLast = resultSnapshot?.isLastQuestion;

    setResultSnapshot(null);
    setEmptyAnswerWarning(null);
    setUncertainDetails(null);

    if (wasLast) {
      setCurrentWord(null);
      setQuizState("answering");
      setLastUpdatedWord(null);
      setUserAnswer("");
      setRoundQueue([]);
      return;
    }

    pickNextQuestion();
  };

  // Références stables pour l'affichage (priorité au snapshot pendant le feedback)
  const activeWord = resultSnapshot ? resultSnapshot.word : currentWord;
  const activeDirection = resultSnapshot ? resultSnapshot.direction : currentDirection;
  const activePrompt = resultSnapshot ? resultSnapshot.displayedPrompt : displayedPrompt;
  const isLastQuestion = resultSnapshot ? resultSnapshot.isLastQuestion : false;
  const activeUpdatedWord = resultSnapshot?.updatedWord || lastUpdatedWord;
  const activeUserAnswer = resultSnapshot?.userAnswer ?? userAnswer;

  const posInfo = PART_OF_SPEECH_LABELS[activeWord?.part_of_speech] || {
    fr: activeWord?.part_of_speech,
    color: "bg-slate-100 text-slate-800 border-slate-200"
  };

  const activeProg = activeWord ? srsService.getProgress(activeWord, activeDirection) : { stage: 0, learningSuccessCount: 0, isMastered: false, learned: false };
  const updatedProg = activeUpdatedWord ? srsService.getProgress(activeUpdatedWord, activeDirection) : activeProg;
  const currentStageInfo = srsService.getStageInfo(activeProg.stage);

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pt-1 pb-24 space-y-3">
      
      {/* Sélecteur de Mode de Quiz */}
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
          {visibleDueCount > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
              quizMode === "srs-review" ? "bg-white text-amber-600" : "bg-amber-500 text-white"
            }`}>
              {visibleDueCount}
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
          {visibleLearningCount > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
              quizMode === "initial-learning" ? "bg-white text-indigo-600" : "bg-indigo-500 text-white"
            }`}>
              {visibleLearningCount}
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

      {/* Sélecteur de Sens de Travail (Français -> Anglais, Anglais -> Français, Mixte) */}
      <div className="bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 border border-slate-200/80 dark:border-slate-700/60 text-xs">
        <button
          onClick={() => handleDirectionChange("fr_en")}
          className={`flex-1 py-1 px-2 rounded-lg font-bold transition text-center ${
            directionPreference === "fr_en"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          🇫🇷 → 🇬🇧 <span className="hidden sm:inline">Français → Anglais</span>
        </button>

        <button
          onClick={() => handleDirectionChange("en_fr")}
          className={`flex-1 py-1 px-2 rounded-lg font-bold transition text-center ${
            directionPreference === "en_fr"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          🇬🇧 → 🇫🇷 <span className="hidden sm:inline">Anglais → Français</span>
        </button>

        <button
          onClick={() => handleDirectionChange("mixed")}
          className={`flex-1 py-1 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1 text-center ${
            directionPreference === "mixed"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Shuffle className="w-3 h-3" />
          <span>Mixte</span>
        </button>
      </div>

      {/* État vide lorsque le mode/sens sélectionné n'a plus de cartes */}
      {!activeWord || (candidateItems.length === 0 && quizState === "answering") ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none min-h-[380px]">
          <div className="w-16 h-16 bg-gradient-to-tr from-emerald-400 to-teal-500 rounded-3xl shadow-lg shadow-emerald-500/20 flex items-center justify-center text-white mb-4 animate-pop-in">
            <Award className="w-8 h-8" />
          </div>
          
          <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">
            {quizMode === "srs-review" 
              ? "Toutes les révisions du jour sont terminées ! 🎉"
              : quizMode === "initial-learning"
              ? "Aucun mot en apprentissage dans ce sens !"
              : "Aucun mot dans votre vocabulaire"}
          </h2>
          
          <p className="text-slate-600 dark:text-slate-300 text-xs mb-6 max-w-xs leading-relaxed">
            {quizMode === "srs-review"
              ? "Vous êtes à jour sur votre calendrier SRS pour ce sens de travail. Entraînez-vous librement ou changez de sens !"
              : quizMode === "initial-learning"
              ? "Tous vos mots ont validé le palier initial (3 réussites consécutives). Lancez l'autre sens ou entraînez-vous librement."
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
              <div className="flex items-center gap-1.5">
                <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${posInfo.color}`}>
                  {posInfo.fr}
                </span>

                {/* Badge de sens de la question active */}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {activeDirection === "en_fr" ? "🇬🇧 → 🇫🇷" : "🇫🇷 → 🇬🇧"}
                </span>
              </div>

              {/* Mode actuel & Badge SRS pour cette direction */}
              <div className="flex items-center gap-1.5">
                {quizMode === "free-practice" ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    Mode Libre
                  </span>
                ) : quizMode === "srs-review" ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white flex items-center gap-1 shadow-xs">
                    <Bell className="w-3 h-3" />
                    <span>Révision ({currentStageInfo.shortLabel})</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-indigo-600" />
                    <span>{activeProg.learningSuccessCount || 0}/3 ★</span>
                  </span>
                )}
              </div>
            </div>

            {/* Mot demandé */}
            <div className="my-4 text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-xs font-semibold mb-2">
                {activeDirection === "en_fr" ? "Traduisez en français :" : `Traduisez ${posInfo.promptFr || "ce mot"} en anglais :`}
              </span>

              <div className="flex items-center justify-center gap-2">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  « {activePrompt} »
                </h1>
                {activeDirection === "en_fr" && (
                  <button
                    type="button"
                    onClick={() => playPronunciation(activeWord.english_word, "en-US")}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full transition"
                    title="Écouter la prononciation anglaise"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              {activeDirection === "fr_en" && activeWord?.french_translations && activeWord.french_translations.length > 1 && (
                <p className="text-[11px] text-slate-400 mt-1">
                  (Autres variantes : {activeWord.french_translations.filter((t) => t !== activePrompt).join(", ")})
                </p>
              )}

              {/* Note de contexte : en Anglais -> Français, masquée par défaut pour ne pas révéler la réponse */}
              {(activeWord?.exampleSentence || activeWord?.example_sentence || activeWord?.notes) && (
                <div className="mt-3">
                  {activeDirection === "en_fr" && quizState === "answering" && !showHint ? (
                    <button
                      type="button"
                      onClick={() => setShowHint(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 px-2.5 py-1 rounded-xl transition"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Afficher un indice de contexte (peut contenir la réponse)</span>
                    </button>
                  ) : (
                    <div className="px-3.5 py-2 bg-amber-500/10 dark:bg-amber-950/40 border border-amber-300/60 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 italic flex items-center justify-center gap-2 shadow-xs text-center animate-fade-in">
                      <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>{activeWord.exampleSentence || activeWord.example_sentence || activeWord.notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section de réponse / Résultat */}
          <div className="space-y-3">
            
            {/* État : Saisie de réponse */}
            {(quizState === "answering" || quizState === "evaluating") && (
              <form onSubmit={handleSubmit} className="space-y-2.5">
                
                {/* Bouton de réponse vocale */}
                {isSpeechSupported && quizState === "answering" && (
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
                          <span>Écoute en cours ({activeDirection === "en_fr" ? "français" : "anglais"})...</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span>🎤 Répondre à l'oral ({activeDirection === "en_fr" ? "en français" : "en anglais"})</span>
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
                    disabled={quizState === "evaluating"}
                    value={userAnswer}
                    onChange={(e) => {
                      setUserAnswer(e.target.value);
                      if (emptyAnswerWarning) setEmptyAnswerWarning(null);
                    }}
                    placeholder={
                      activeDirection === "en_fr" 
                        ? "Tapez votre traduction en français..." 
                        : (posInfo.placeholder || "Tapez votre réponse en anglais...")
                    }
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 ${
                      emptyAnswerWarning 
                        ? "border-amber-400 dark:border-amber-500 ring-2 ring-amber-300/40" 
                        : "border-slate-200 dark:border-slate-700"
                    } rounded-2xl text-base font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-800 transition disabled:opacity-60`}
                  />
                </div>

                {emptyAnswerWarning && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/60 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-200 flex items-center justify-center gap-1.5 animate-pop-in">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{emptyAnswerWarning}</span>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center font-medium">
                  {activeDirection === "en_fr"
                    ? "💡 Articles et nuances acceptés. L'IA évalue la fidélité du sens."
                    : "💡 Les particules (to, a/the, one's...) sont facultatives."}
                </p>

                {quizState === "evaluating" ? (
                  <div className="w-full py-3 px-4 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold rounded-2xl flex items-center justify-center gap-2 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Vérification de la réponse en cours…</span>
                  </div>
                ) : (
                  <button
                    type="submit"
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-2xl shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 active:scale-95 transition"
                  >
                    <span>Valider</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </form>
            )}

            {/* État : Évaluation incertaine / panne IA */}
            {quizState === "uncertain" && (
              <div className="space-y-3 animate-pop-in">
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 rounded-2xl">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-amber-900 dark:text-amber-200">
                        Vérification incertaine
                      </h4>
                      <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-1">
                        {uncertainDetails?.explanation || "La réponse n'a pas pu être validée avec certitude à distance."}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                        Traduction de référence recommandée : <span className="font-bold text-slate-900 dark:text-white">« {uncertainDetails?.reference || activeWord?.french_translations?.[0]} »</span>
                      </p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 italic">
                        Aucun échec n'a été comptabilisé sur votre progression SRS.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleManualValidation(true)}
                      className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Valider ma réponse
                    </button>
                    <button
                      onClick={() => handleManualValidation(false)}
                      className="flex-1 py-2.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <XCircle className="w-4 h-4" />
                      Compter comme erreur
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRetryCurrent}
                      className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-xl text-xs transition"
                    >
                      Réessayer
                    </button>
                    <button
                      onClick={handleSkipWithoutPenalty}
                      className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-xl text-xs transition"
                    >
                      Passer sans pénalité
                    </button>
                  </div>
                </div>
              </div>
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
                          onClick={() => playPronunciation(activeWord.english_word, "en-US")}
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
                          {activeDirection === "en_fr" ? (resultSnapshot?.reference || activeWord.french_translations?.[0]) : activeWord.english_word}
                        </p>
                      </div>

                      {/* Explication ou saisie utilisateur */}
                      {resultSnapshot?.explanation && resultSnapshot.explanation !== "Bonne réponse !" && (
                        <p className="text-xs text-emerald-800 dark:text-emerald-200 mt-1 font-medium">
                          💡 {resultSnapshot.explanation}
                        </p>
                      )}

                      {activeUserAnswer && (
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                          Votre saisie : <span className="font-semibold">« {activeUserAnswer.trim()} »</span> (validée)
                        </p>
                      )}

                      {/* Explication du résultat selon le mode et direction */}
                      <div className="mt-2.5 pt-2 border-t border-emerald-200/80 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-200 font-medium">
                        {quizMode === "free-practice" ? (
                          <p>🎯 Bonne réponse ! (Mode entraînement libre)</p>
                        ) : updatedProg.isMastered ? (
                          <p className="font-bold text-amber-800 dark:text-amber-200">
                            🏆 Palier 10 validé : Mot consolidé et maîtrisé dans ce sens !
                          </p>
                        ) : updatedProg.stage === 1 && !activeProg.learned ? (
                          <p className="font-bold">
                            🎉 3 réussites consécutives ! Promotion au Palier 1 (Revue demain J+1).
                          </p>
                        ) : updatedProg.stage > 0 ? (
                          <p>
                            ✅ <b>{srsService.getStageInfo(updatedProg.stage).label}</b> validé ! Prochaine révision : <b>{srsService.formatRelativeReviewDate(updatedProg.nextReviewAt)?.text}</b>.
                          </p>
                        ) : (
                          <p>
                            Bravo ! ({updatedProg.learningSuccessCount || 0}/3 ★ consécutifs requis).
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
                          onClick={() => playPronunciation(activeWord.english_word, "en-US")}
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
                          {activeDirection === "en_fr" ? (resultSnapshot?.reference || activeWord.french_translations?.[0]) : activeWord.english_word}
                        </p>
                      </div>

                      {/* Explication IA si disponible */}
                      {resultSnapshot?.explanation && resultSnapshot.explanation !== "Réponse incorrecte" && (
                        <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 font-medium">
                          💡 {resultSnapshot.explanation}
                        </p>
                      )}

                      {activeDirection === "en_fr" && activeWord.french_translations && activeWord.french_translations.length > 1 && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Traductions acceptées : {activeWord.french_translations.join(", ")}
                        </p>
                      )}

                      {/* Explication de la rétrogradation */}
                      <div className="mt-2.5 pt-2 border-t border-rose-200/80 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-300 font-medium">
                        {quizMode === "free-practice" ? (
                          <p>Entraînement libre : aucun impact sur vos paliers SRS.</p>
                        ) : activeProg.stage >= 2 ? (
                          <p>
                            ↩️ Rétrogradation douce au <b>{srsService.getStageInfo(updatedProg.stage || 0).label}</b> (Revue urgente demain à J+1).
                          </p>
                        ) : activeProg.stage === 1 ? (
                          <p>
                            ↩️ Retour au palier d'apprentissage initial (0/3 ★).
                          </p>
                        ) : (
                          <p>
                            Compteur d'apprentissage remis à 0/3 ★ consécutifs dans ce sens.
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
