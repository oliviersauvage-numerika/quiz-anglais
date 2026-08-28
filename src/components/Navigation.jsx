import React from "react";
import { BookOpen, Sparkles, PlusCircle, BarChart3, Settings } from "lucide-react";

export function Navigation({ activeTab, setActiveTab, onOpenAdd, unlearnedCount }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-around">
        {/* Tab: Quiz */}
        <button
          onClick={() => setActiveTab("quiz")}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === "quiz"
              ? "text-indigo-600 dark:text-indigo-400 font-semibold"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <div className="relative">
            <Sparkles className="w-6 h-6" />
            {unlearnedCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center">
                {unlearnedCount}
              </span>
            )}
          </div>
          <span className="text-xs mt-1">Quiz</span>
        </button>

        {/* Tab: Vocabulaire */}
        <button
          onClick={() => setActiveTab("list")}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === "list"
              ? "text-indigo-600 dark:text-indigo-400 font-semibold"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <BookOpen className="w-6 h-6" />
          <span className="text-xs mt-1">Vocabulaire</span>
        </button>

        {/* Center Action: Ajouter */}
        <button
          onClick={onOpenAdd}
          className="flex flex-col items-center justify-center flex-1 py-1 group"
          aria-label="Ajouter un mot"
        >
          <div className="w-12 h-12 -mt-5 bg-gradient-to-tr from-indigo-600 to-violet-500 text-white rounded-full shadow-lg shadow-indigo-500/30 flex items-center justify-center transition-transform group-hover:scale-105 active:scale-95">
            <PlusCircle className="w-7 h-7" />
          </div>
          <span className="text-xs mt-0.5 text-indigo-600 dark:text-indigo-400 font-medium">Ajouter</span>
        </button>

        {/* Tab: Stats */}
        <button
          onClick={() => setActiveTab("stats")}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === "stats"
              ? "text-indigo-600 dark:text-indigo-400 font-semibold"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <BarChart3 className="w-6 h-6" />
          <span className="text-xs mt-1">Progression</span>
        </button>

        {/* Tab: Paramètres */}
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === "settings"
              ? "text-indigo-600 dark:text-indigo-400 font-semibold"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Settings className="w-6 h-6" />
          <span className="text-xs mt-1">Réglages</span>
        </button>
      </div>
    </nav>
  );
}
