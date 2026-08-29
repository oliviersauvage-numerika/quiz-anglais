import React from "react";
import { Award, Flame, CheckCircle, Target, BookOpen, Layers, Clock, Bell, Sparkles } from "lucide-react";
import { storageService } from "../services/storageService";
import { srsService } from "../services/srsService";
import { PART_OF_SPEECH_LABELS } from "../services/translationService";

export function StatsView({ words }) {
  const stats = storageService.getGlobalStats();
  const totalWords = words.length;

  const dueCount = words.filter((w) => srsService.isReviewDue(w)).length;
  const learningCount = words.filter((w) => (w.srsStage || 0) === 0 && !w.learned).length;
  const reviewingCount = words.filter((w) => (w.srsStage || 0) >= 1 && (w.srsStage || 0) < 10 && !w.isMastered).length;
  const masteredCount = words.filter((w) => w.isMastered || (w.srsStage || 0) >= 10).length;

  const progressPercent = totalWords > 0 ? Math.round(((reviewingCount + masteredCount) / totalWords) * 100) : 0;

  // Répartition par nature grammaticale
  const posCounts = words.reduce((acc, w) => {
    const pos = w.part_of_speech || "other";
    if (!acc[pos]) acc[pos] = { total: 0, learned: 0 };
    acc[pos].total += 1;
    if (w.learned || (w.srsStage || 0) > 0) acc[pos].learned += 1;
    return acc;
  }, {});

  const accuracy = stats.totalAnswered > 0 
    ? Math.round((stats.correctAnswers / stats.totalAnswered) * 100) 
    : 0;

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pt-2 pb-24 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Progression</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Répétition espacée & statistiques</p>
      </div>

      {/* Carte principale de progression */}
      <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 text-white rounded-3xl p-5 shadow-xl shadow-indigo-500/20 relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
              Vocabulaire acquis ou en consolidation
            </span>
            <h2 className="text-3xl font-black mt-0.5">
              {reviewingCount + masteredCount} <span className="text-lg font-normal text-indigo-200">/ {totalWords}</span>
            </h2>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center font-black text-xl">
            {progressPercent}%
          </div>
        </div>

        {/* Barre de progression */}
        <div className="w-full bg-white/20 h-3 rounded-full overflow-hidden">
          <div
            className="bg-white h-full transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* État des Paliers SRS */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white">
            <Clock className="w-4 h-4 text-indigo-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Paliers de Répétition Espacée</h3>
          </div>
          {dueCount > 0 && (
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <Bell className="w-3 h-3" />
              <span>{dueCount} révisions dues</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-2xl">
            <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">En apprentissage (3★)</span>
            <span className="text-xl font-black text-amber-700 dark:text-amber-300">{learningCount} mots</span>
          </div>

          <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 rounded-2xl">
            <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">Paliers SRS (J+1 à J+30)</span>
            <span className="text-xl font-black text-indigo-700 dark:text-indigo-300">{reviewingCount} mots</span>
          </div>

          <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl col-span-2 flex items-center justify-between">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">Définitivement Acquis (6 mois)</span>
              <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">🏆 {masteredCount} mots</span>
            </div>
            <Sparkles className="w-6 h-6 text-amber-500" />
          </div>
        </div>
      </div>

      {/* Grille de métriques */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 text-amber-500 mb-1">
            <Flame className="w-4 h-4" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Série en cours</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {stats.streak || 0} <span className="text-xs font-normal text-slate-400">d'affilée</span>
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 text-emerald-500 mb-1">
            <Target className="w-4 h-4" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Précision Quiz</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {accuracy}%
          </p>
        </div>
      </div>

      {/* Répartition par catégories */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
          <Layers className="w-4 h-4 text-indigo-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider">Par catégorie grammaticale</h3>
        </div>

        <div className="space-y-2">
          {Object.entries(posCounts).map(([posKey, data]) => {
            const label = PART_OF_SPEECH_LABELS[posKey]?.fr || posKey;
            const pct = data.total > 0 ? Math.round((data.learned / data.total) * 100) : 0;

            return (
              <div key={posKey} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-700 dark:text-slate-300">{label}</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {data.learned}/{data.total} ({pct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
