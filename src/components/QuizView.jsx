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
  Award
} from "lucide-react";
import { PART_OF_SPEECH_LABELS } from "../services/translationService";
import { storageService } from "../services/storageService";

export function QuizView({ words, onWordsUpdate, onOpenAdd }) {
  const [includeLearned, setIncludeLearned] = useState(false);

  const [currentWord, setCurrentWord] = useState(null);
  const [selectedFrenchTranslation, setSelectedFrenchTranslation] = useState("");
  const [userAnswer, setUserAnswer] = useState("");
  const [quizState, setQuizState] = useState("answering"); // "answering" | "correct" | "incorrect"
  
  const [roundQueue, setRoundQueue] = useState([]);
  const lastWordIdRef = useRef(null);
  const inputRef = useRef(null);

  const [sessionScore, setSessionScore] = useState({ correct: 0, total: 0 });

  const candidateWords = words.filter((w) => includeLearned || !w.learned);
  const learnedCount = words.filter((w) => w.learned).length;
  const totalCount = words.length;

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

  const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const pickNextQuestion = () => {
    if (candidateWords.length === 0) {
      setCurrentWord(null);
      return;
    }

    let queue = [...roundQueue];
    queue = queue.filter((id) => candidateWords.some((w) => w.id === id));

    if (queue.length === 0) {
      queue = shuffleArray(candidateWords.map((w) => w.id));
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
    if (quizState !== "answering" || !userAnswer.trim() || !currentWord) return;

    const userNorm = normalize(userAnswer, currentWord.part_of_speech);
    const correctNorm = normalize(currentWord.english_word, currentWord.part_of_speech);

    const isCorrect = userNorm === correctNorm;

    const { words: updatedWords, updatedWord } = storageService.recordQuizResult(currentWord.id, isCorrect);
    onWordsUpdate(updatedWords);

    setSessionScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));

    if (isCorrect) {
      setQuizState("correct");
      playPronunciation(currentWord.english_word);

      if (updatedWord?.learned) {
        try {
          confetti({
            particleCount: 70,
            spread: 60,
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
          Félicitations ! 🎉
        </h2>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">
          Vous avez appris la totalité de vos <span className="font-bold text-indigo-600 dark:text-indigo-400">{totalCount} mots</span> (3 réussites validées pour chacun) !
        </p>

        <div className="w-full space-y-3">
          <button
            onClick={() => setIncludeLearned(true)}
            className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Lancer un mode Révision</span>
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

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pt-2 pb-24">
      
      {/* Progression */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Progression
          </span>
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">
            {learnedCount} / {totalCount} acquis
          </span>
        </div>

        {/* Étoiles du mot actuel */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">Ce mot :</span>
          {[0, 1, 2].map((idx) => (
            <span
              key={idx}
              className={`text-xs ${
                idx < (currentWord?.successCount || 0)
                  ? "text-amber-400"
                  : "text-slate-300 dark:text-slate-600"
              }`}
            >
              ★
            </span>
          ))}
        </div>
      </div>

      {/* Carte de la Question */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 flex-1 flex flex-col justify-between min-h-[340px] animate-fade-in relative overflow-hidden">
        
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${posInfo.color}`}>
              {posInfo.fr}
            </span>

            <span className="text-xs text-slate-400 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              Traduire en anglais
            </span>
          </div>

          {/* Mot en français demandé */}
          <div className="my-6 text-center">
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
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Tapez le mot en anglais..."
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

          {/* Feedback : Bonne réponse */}
          {quizState === "correct" && (
            <div className="space-y-4 animate-pop-in">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
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
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium mt-0.5">
                      Bravo, c'est exact ! ({currentWord.successCount >= 3 ? "🎉 Mot Acquis !" : `Réussite ${currentWord.successCount}/3`})
                    </p>
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

          {/* Feedback : Mauvaise réponse */}
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
