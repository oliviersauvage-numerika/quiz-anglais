// Service de recherche & traduction (Anglais -> Français) avec support Gemini et Moteur Intégré

export const PART_OF_SPEECH_LABELS = {
  noun: { fr: "Nom", en: "Noun", color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300" },
  verb: { fr: "Verbe", en: "Verb", color: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300" },
  adjective: { fr: "Adjectif", en: "Adjective", color: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300" },
  adverb: { fr: "Adverbe", en: "Adverb", color: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300" },
  preposition: { fr: "Préposition", en: "Preposition", color: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300" },
  expression: { fr: "Expression", en: "Idiom", color: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300" }
};

const GEMINI_STORAGE_KEY = "quiz_anglais_gemini_api_key";

export const translationService = {
  getGeminiApiKey: () => {
    try {
      return localStorage.getItem(GEMINI_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  },

  setGeminiApiKey: (key) => {
    try {
      if (!key || !key.trim()) {
        localStorage.removeItem(GEMINI_STORAGE_KEY);
      } else {
        localStorage.setItem(GEMINI_STORAGE_KEY, key.trim());
      }
    } catch (e) {
      console.error(e);
    }
  },

  /**
   * Tester la validité d'une clé API Gemini
   */
  testGeminiKey: async (apiKey) => {
    const key = (apiKey || "").trim();
    if (!key) return { success: false, error: "Veuillez saisir une clé API." };

    const testModels = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];
    let lastErr = "";

    for (const model of testModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "OK" }] }]
          })
        });

        if (response.ok) {
          return { success: true, model };
        } else {
          const err = await response.json().catch(() => ({}));
          lastErr = err.error?.message || `Erreur HTTP ${response.status}`;
        }
      } catch (e) {
        lastErr = e.message;
      }
    }

    return { success: false, error: lastErr || "Clé API invalide ou indisponible" };
  },

  /**
   * Traduction de haute précision via l'API Google Gemini (Anglais -> Français)
   */
  lookupWithGemini: async (query, apiKey) => {
    const prompt = `Tu es un dictionnaire bilingue anglais-français de référence et de haute précision.
L'utilisateur apprend l'anglais et cherche la traduction en FRANÇAIS d'un mot ou d'une expression en ANGLAIS.

Terme anglais saisi par l'utilisateur : "${query}"

Consignes strictes :
1. "english_word" : Le mot ou l'expression en anglais, correctement orthographié et capitalisé (ex: "Rife", "To boast", "A piece of cake"). Si c'est un verbe à l'infinitif en anglais, préfixe-le avec "To ".
2. "part_of_speech" : La nature grammaticale du terme anglais parmi STRICTEMENT : "noun", "verb", "adjective", "adverb", "preposition", ou "expression". (Par exemple pour "rife", c'est un "adjective").
3. "french_translations" : Une liste de 1 à 4 traductions équivalentes, naturelles et usuelles en FRANÇAIS (ex pour "rife" -> ["Courant", "Répandu", "Qui sévit", "Fréquent"], pour "boaster" -> ["Fanfaron", "Vantard", "Prétentieux"]).
4. "notes" : Une courte précision de sens ou de registre si pertinent.

Réponds UNIQUEMENT sous forme d'un objet JSON strict :
{
  "english_word": "...",
  "part_of_speech": "noun" | "verb" | "adjective" | "adverb" | "preposition" | "expression",
  "french_translations": ["...", "..."],
  "notes": "..."
}`;

    // Modèles compatibles et actuels de l'API Google
    const models = [
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-2.5-flash"
    ];

    let lastError = null;
    let data = null;
    let usedModel = models[0];

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1
            }
          })
        });

        if (response.ok) {
          data = await response.json();
          usedModel = model;
          break;
        } else {
          const err = await response.json().catch(() => ({}));
          lastError = err.error?.message || `Erreur API Gemini (${response.status})`;
        }
      } catch (e) {
        lastError = e.message;
      }
    }

    if (!data) {
      throw new Error(`Échec de l'appel Gemini : ${lastError}`);
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Réponse vide de Gemini");

    const parsed = JSON.parse(rawText);
    
    const validPos = ["noun", "verb", "adjective", "adverb", "preposition", "expression"];
    let pos = (parsed.part_of_speech || "noun").toLowerCase().trim();
    if (!validPos.includes(pos)) {
      pos = "expression";
    }

    let enWord = (parsed.english_word || query).trim();
    if (pos === "verb" && !enWord.toLowerCase().startsWith("to ")) {
      enWord = "To " + enWord;
    }

    return {
      english_word: enWord,
      part_of_speech: pos,
      french_translations: Array.isArray(parsed.french_translations)
        ? parsed.french_translations.filter(Boolean)
        : [parsed.french_translations].filter(Boolean),
      source: `✨ Google Gemini IA (${usedModel})`,
      rawResponse: parsed
    };
  },

  /**
   * Moteur de traduction intégré gratuit (Anglais -> Français)
   */
  lookupBuiltIn: async (rawQuery) => {
    const query = (rawQuery || "").trim();
    if (!query) throw new Error("Veuillez saisir un mot ou une expression en anglais.");

    const isExplicitVerb = /^to\s+/i.test(query);
    const wordsCount = query.split(/\s+/).length;

    let englishWord = query.charAt(0).toUpperCase() + query.slice(1);
    let frenchTranslations = [];

    // 1. Détection de la nature grammaticale via Wiktionary & Dictionary API d'abord pour précision
    let partOfSpeech = "noun";
    if (wordsCount >= 3) {
      partOfSpeech = isExplicitVerb ? "verb" : "expression";
    } else if (isExplicitVerb) {
      partOfSpeech = "verb";
    } else {
      try {
        const cleanEnWord = englishWord.replace(/^to\s+/i, "").trim().toLowerCase();
        const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanEnWord)}`);
        if (dictRes.ok) {
          const dictData = await dictRes.json();
          if (Array.isArray(dictData) && dictData.length > 0) {
            const meanings = dictData[0].meanings || [];
            if (meanings.length > 0) {
              const detected = meanings[0].partOfSpeech?.toLowerCase();
              if (["noun", "verb", "adjective", "adverb", "preposition"].includes(detected)) {
                partOfSpeech = detected;
              }
            }
          }
        } else {
          const wiktionaryRes = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(cleanEnWord)}`);
          if (wiktionaryRes.ok) {
            const wiktData = await wiktionaryRes.json();
            if (wiktData.en && wiktData.en.length > 0) {
              const pos = wiktData.en[0].partOfSpeech?.toLowerCase();
              if (["noun", "verb", "adjective", "adverb", "preposition"].includes(pos)) {
                partOfSpeech = pos;
              }
            }
          }
        }
      } catch (e) {
        console.warn("Erreur détection grammaticale", e);
      }
    }

    // 2. Recherche MyMemory avec filtrage strict des bruits (dates, titres de films, noms propres)
    try {
      const enFrUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(query)}&langpair=en|fr&de=quizanglais@vocab.app`;
      const resEnFr = await fetch(enFrUrl);
      const dataEnFr = await resEnFr.json();

      let primaryEnFr = dataEnFr?.responseData?.translatedText || "";
      let matches = dataEnFr?.matches || [];

      // Filtrer les chaînes contenant des années comme (2002) ou des titres
      const isNoise = (text) => {
        return /\(\d{4}\)/.test(text) || /royal\s+rife/i.test(text) || /wikipedia/i.test(text) || /http/i.test(text);
      };

      if (primaryEnFr && primaryEnFr.toLowerCase() !== query.toLowerCase() && !isNoise(primaryEnFr)) {
        const splitParts = primaryEnFr.split(/\s*[\/;,]\s*/);
        splitParts.forEach((p) => {
          if (p.toLowerCase() !== query.toLowerCase() && !isNoise(p)) {
            frenchTranslations.push(p);
          }
        });
      }

      for (const m of matches) {
        const trans = m.translation || "";
        const score = parseFloat(m.match || 0);

        if (trans && score >= 0.45 && !isNoise(trans)) {
          const parts = trans.split(/\s*[\/;,]\s*/);
          for (let part of parts) {
            let clean = part
              .replace(/<[^>]*>/g, "")
              .replace(/^[«"“']|[»"”']$/g, "")
              .replace(/[\.!\?]+$/g, "")
              .trim();

            if (isExplicitVerb && clean.toLowerCase().startsWith("pour ")) {
              clean = clean.substring(5).trim();
            }

            if (
              clean &&
              clean.length < 60 &&
              clean.toLowerCase() !== query.toLowerCase() &&
              !clean.toLowerCase().includes("mymemory") &&
              !clean.toLowerCase().includes("http") &&
              !clean.toLowerCase().includes("@") &&
              !isNoise(clean) &&
              !frenchTranslations.some((t) => t.toLowerCase() === clean.toLowerCase())
            ) {
              if (frenchTranslations.length < 5) {
                clean = clean.charAt(0).toUpperCase() + clean.slice(1);
                frenchTranslations.push(clean);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Erreur MyMemory:", e);
    }

    // Nettoyer les traductions françaises
    frenchTranslations = frenchTranslations
      .map((t) => {
        let clean = t
          .replace(/<[^>]*>/g, "")
          .replace(/^[«"“']|[»"”']$/g, "")
          .replace(/[\.!\?]+$/g, "")
          .trim();
        if (isExplicitVerb && clean.toLowerCase().startsWith("pour ")) {
          clean = clean.substring(5).trim();
        }
        return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "";
      })
      .filter((t, idx, self) => t && self.indexOf(t) === idx && t.toLowerCase() !== englishWord.toLowerCase());

    return {
      english_word: englishWord,
      part_of_speech: partOfSpeech,
      french_translations: frenchTranslations.filter(Boolean),
      source: "Moteur Hybride (Gratuit)",
      rawResponse: {
        english_word: englishWord,
        part_of_speech: partOfSpeech,
        french_translations: frenchTranslations.filter(Boolean)
      }
    };
  },

  /**
   * Point d'entrée principal avec fallback automatique
   */
  lookupWord: async (rawQuery) => {
    const apiKey = translationService.getGeminiApiKey();
    if (apiKey) {
      try {
        return await translationService.lookupWithGemini(rawQuery, apiKey);
      } catch (err) {
        console.warn("Gemini a échoué, bascule automatique sur le moteur intégré :", err);
        // Fallback transparent sur le moteur gratuit au lieu de bloquer l'utilisateur
        const fallbackRes = await translationService.lookupBuiltIn(rawQuery);
        return {
          ...fallbackRes,
          source: `${fallbackRes.source} (IA indisponible)`
        };
      }
    }

    return await translationService.lookupBuiltIn(rawQuery);
  }
};
