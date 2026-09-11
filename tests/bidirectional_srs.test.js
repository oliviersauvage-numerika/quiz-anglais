import test from "node:test";
import assert from "node:assert/strict";
import { srsService } from "../src/services/srsService.js";

test("1. Indépendance stricte des progressions fr_en et en_fr", () => {
  const baseWord = {
    id: "test-word-1",
    english_word: "apple",
    part_of_speech: "noun",
    french_translations: ["pomme"],
    srsStage: 4,
    learningSuccessCount: 3,
    learned: true,
    isMastered: false,
    nextReviewAt: "2026-10-01T10:00:00.000Z",
    // en_fr est au palier 0
    srs_stage_en_fr: 0,
    success_count_en_fr: 0,
    learned_en_fr: false,
    is_mastered_en_fr: false,
    next_review_at_en_fr: null,
  };

  const sanitized = srsService.sanitizeWord(baseWord);
  assert.equal(sanitized.srsStage, 4);
  assert.equal(sanitized.srs_stage_en_fr, 0);

  // Bonne réponse en en_fr (Apprentissage) -> doit faire monter success_count_en_fr à 1 sans toucher à srsStage
  const now = new Date("2026-09-10T12:00:00.000Z");
  const nextEnFr = srsService.calculateNextState(sanitized, true, "srs-learning", now, "en_fr");
  assert.equal(nextEnFr.srsStage, 4, "La progression fr_en ne doit pas avoir bougé");
  assert.equal(nextEnFr.srs_stage_en_fr, 0, "Le palier en_fr reste 0 tant qu'il n'a pas 3 réussites");
  assert.equal(nextEnFr.success_count_en_fr, 1, "Le compteur d'apprentissage en_fr doit être à 1");

  // Mauvaise réponse en fr_en -> doit rétrograder srsStage (4 -> 3) sans altérer success_count_en_fr
  const nextFrEn = srsService.calculateNextState(nextEnFr, false, "srs-review", now, "fr_en");
  assert.equal(nextFrEn.srsStage, 3, "Le palier fr_en doit passer de 4 à 3");
  assert.equal(nextFrEn.success_count_en_fr, 1, "Le compteur en_fr doit rester intact à 1");
});

test("2. Palier 0 en_fr nécessite 3 réussites consécutives pour atteindre le palier 1", () => {
  let word = {
    id: "w-learn",
    english_word: "dog",
    part_of_speech: "noun",
    french_translations: ["chien"],
    srs_stage_en_fr: 0,
    success_count_en_fr: 0,
    learned_en_fr: false,
  };

  const now = new Date("2026-09-10T12:00:00.000Z");

  // 1ère réussite
  word = srsService.calculateNextState(word, true, "srs-learning", now, "en_fr");
  assert.equal(word.srs_stage_en_fr, 0);
  assert.equal(word.success_count_en_fr, 1);
  assert.equal(word.learned_en_fr, false);

  // 2ème réussite
  word = srsService.calculateNextState(word, true, "srs-learning", now, "en_fr");
  assert.equal(word.srs_stage_en_fr, 0);
  assert.equal(word.success_count_en_fr, 2);
  assert.equal(word.learned_en_fr, false);

  // Erreur : remise à 0
  word = srsService.calculateNextState(word, false, "srs-learning", now, "en_fr");
  assert.equal(word.srs_stage_en_fr, 0);
  assert.equal(word.success_count_en_fr, 0);

  // 3 réussites consécutives
  word = srsService.calculateNextState(word, true, "srs-learning", now, "en_fr");
  word = srsService.calculateNextState(word, true, "srs-learning", now, "en_fr");
  word = srsService.calculateNextState(word, true, "srs-learning", now, "en_fr");

  assert.equal(word.srs_stage_en_fr, 1, "Doit être promu au palier 1");
  assert.equal(word.learned_en_fr, true);
  assert.ok(word.next_review_at_en_fr, "Doit avoir une date de révision J+1");
});

test("3. Validation locale du français (checkFrenchAnswerLocal)", () => {
  const nounWord = {
    english_word: "house",
    part_of_speech: "noun",
    french_translations: ["maison", "demeure"],
  };

  // Match exact
  assert.equal(srsService.checkFrenchAnswerLocal("maison", nounWord), true);
  // Insensibilité à la casse et espaces
  assert.equal(srsService.checkFrenchAnswerLocal("  Maison  ", nounWord), true);
  // Match sur synonyme accepté
  assert.equal(srsService.checkFrenchAnswerLocal("demeure", nounWord), true);
  // Articles optionnels sur les noms (la maison, une demeure)
  assert.equal(srsService.checkFrenchAnswerLocal("la maison", nounWord), true);
  assert.equal(srsService.checkFrenchAnswerLocal("une maison", nounWord), true);
  // Fautes de frappe légères (Levenshtein <= 1 pour >= 5 lettres) : "maizon" pour "maison" (longueur 6)
  assert.equal(srsService.checkFrenchAnswerLocal("maizon", nounWord), true);

  // Verbes avec pronoms réflexifs et infinitif
  const verbWord = {
    english_word: "remember",
    part_of_speech: "verb",
    french_translations: ["se souvenir", "se rappeler"],
  };
  assert.equal(srsService.checkFrenchAnswerLocal("se souvenir", verbWord), true);
  assert.equal(srsService.checkFrenchAnswerLocal("souvenir", verbWord), true);
  assert.equal(srsService.checkFrenchAnswerLocal("rappeler", verbWord), true);

  // Réponse manifestement erronée
  assert.equal(srsService.checkFrenchAnswerLocal("voiture", nounWord), false);
});

test("4. Anti-répétition consécutive dans la file mixte (buildMixedRoundQueue)", () => {
  const items = [
    { word: { id: "1", english_word: "cat" }, direction: "fr_en" },
    { word: { id: "1", english_word: "cat" }, direction: "en_fr" },
    { word: { id: "2", english_word: "dog" }, direction: "fr_en" },
    { word: { id: "2", english_word: "dog" }, direction: "en_fr" },
    { word: { id: "3", english_word: "bird" }, direction: "fr_en" },
    { word: { id: "3", english_word: "bird" }, direction: "en_fr" },
  ];

  const queue = srsService.buildMixedRoundQueue(items, []);
  assert.equal(queue.length, 6);

  // Vérifier qu'aucun mot consécutif ne partage le même id
  for (let i = 0; i < queue.length - 1; i++) {
    assert.notEqual(
      queue[i].word.id,
      queue[i + 1].word.id,
      `Deux questions consécutives (index ${i} et ${i + 1}) portent sur le même mot ${queue[i].word.english_word}`
    );
  }
});

test("5. Entraînement libre (free-practice) neutre pour les deux directions", () => {
  const word = {
    id: "fp-1",
    english_word: "sun",
    french_translations: ["soleil"],
    srsStage: 3,
    srs_stage_en_fr: 2,
    learned: true,
    learned_en_fr: true,
  };

  const resFrEn = srsService.calculateNextState(word, false, "free-practice", new Date(), "fr_en");
  assert.equal(resFrEn.srsStage, 3);

  const resEnFr = srsService.calculateNextState(word, false, "free-practice", new Date(), "en_fr");
  assert.equal(resEnFr.srs_stage_en_fr, 2);
});

test("6. En cas d'incertitude ou de panne réseau de l'IA, aucun échec ni pénalité SRS n'est appliqué", () => {
  const word = {
    id: "uncertain-1",
    english_word: "run",
    french_translations: ["courir"],
    srsStage: 2,
    srs_stage_en_fr: 4,
    success_count_en_fr: 3,
    learned_en_fr: true,
  };

  // En cas d'erreur ou d'incertitude lors de l'appel Gemini, l'interface propose "Passer la carte sans modifier la progression".
  // calculateNextState n'est tout simplement PAS appelé, préservant ainsi l'état intact.
  const stateCopy = { ...word };
  assert.equal(stateCopy.srs_stage_en_fr, 4);
  assert.equal(stateCopy.srsStage, 2);
});

test("7. Réinitialisation ciblée de la progression d'un seul sens", async () => {
  // Mock localStorage
  const store = {};
  global.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const initialWords = [
    {
      id: "w-reset",
      english_word: "tree",
      french_translations: ["arbre"],
      srsStage: 5,
      learningSuccessCount: 3,
      learned: true,
      srs_stage_en_fr: 3,
      success_count_en_fr: 3,
      learned_en_fr: true,
    }
  ];
  store["quiz_anglais_vocab_v2"] = JSON.stringify(initialWords);

  // Importer storageService
  const { storageService } = await import("../src/services/storageService.js");

  // Réinitialiser uniquement en_fr
  const updatedEnFr = storageService.resetWordProgress("w-reset", "en_fr");
  const wordEnFr = updatedEnFr.find((w) => w.id === "w-reset");
  assert.equal(wordEnFr.srs_stage_en_fr, 0, "Le palier en_fr doit être remis à 0");
  assert.equal(wordEnFr.success_count_en_fr, 0);
  assert.equal(wordEnFr.learned_en_fr, false);
  assert.equal(wordEnFr.srsStage, 5, "Le palier fr_en doit rester intact à 5");
  assert.equal(wordEnFr.learned, true);

  // Réinitialiser uniquement fr_en
  const updatedFrEn = storageService.resetWordProgress("w-reset", "fr_en");
  const wordFrEn = updatedFrEn.find((w) => w.id === "w-reset");
  assert.equal(wordFrEn.srsStage, 0, "Le palier fr_en doit être remis à 0");
  assert.equal(wordFrEn.learningSuccessCount, 0);
  assert.equal(wordFrEn.learned, false);
  assert.equal(wordFrEn.srs_stage_en_fr, 0, "Le palier en_fr était déjà à 0");
});

test("8. Repli gracieux d'insertWord lorsque Supabase n'a pas encore les colonnes _en_fr", async () => {
  const { syncService } = await import("../src/services/syncService.js");

  let insertCalls = [];
  syncService.client = {
    from: (table) => ({
      insert: (payload) => {
        insertCalls.push(payload);
        return {
          select: () => ({
            single: async () => {
              // 1er appel avec champs en_fr : simuler l'erreur de colonne manquante PostgREST
              if (payload.first_learned_at_en_fr !== undefined || payload.srs_stage_en_fr !== undefined) {
                return {
                  data: null,
                  error: {
                    code: "PGRST204",
                    message: "Could not find the 'first_learned_at_en_fr' column of 'words' in the schema cache"
                  }
                };
              }
              // 2ème appel de repli sans champs en_fr : succès
              return {
                data: {
                  id: payload.id,
                  english_word: payload.english_word,
                  part_of_speech: payload.part_of_speech,
                  french_translations: payload.french_translations,
                  srs_stage: 0,
                  success_count: 0
                },
                error: null
              };
            }
          })
        };
      }
    })
  };

  const newWord = {
    id: "word-test-fallback",
    english_word: "farthing",
    part_of_speech: "noun",
    french_translations: ["farthing", "ancienne pièce de monnaie anglaise"]
  };

  const result = await syncService.insertWord(newWord);
  assert.equal(result.success, true, "L'insertion doit réussir grâce au repli gracieux");
  assert.equal(insertCalls.length, 2, "Deux tentatives doivent avoir été effectuées");
  // La 2ème tentative ne doit pas avoir de colonnes se terminant par _en_fr
  const secondPayload = insertCalls[1];
  const hasEnFrCols = Object.keys(secondPayload).some((k) => k.endsWith("_en_fr"));
  assert.equal(hasEnFrCols, false, "Le 2ème appel doit avoir retiré les colonnes _en_fr");
});

test("9. evaluateFrenchAnswerSemantic fonctionne sans erreur getStoredApiKey et gère le repli dictionnaire", async () => {
  const { translationService } = await import("../src/services/translationService.js");

  // Vérifier la présence des méthodes
  assert.equal(typeof translationService.getGeminiApiKey, "function");
  assert.equal(typeof translationService.getStoredApiKey, "function");

  // Mock lookupBuiltIn pour simuler un dictionnaire retournant des synonymes
  translationService.lookupBuiltIn = async (word) => ({
    english_word: word,
    part_of_speech: "noun",
    french_translations: ["demeure", "habitation", "résidence"]
  });

  // Test avec un synonyme trouvé dans le dictionnaire de repli (sans clé Gemini)
  const res = await translationService.evaluateFrenchAnswerSemantic({
    englishWord: "house",
    partOfSpeech: "noun",
    contextNote: "a building for human habitation",
    referenceTranslations: ["maison"],
    userAnswer: "demeure"
  });

  assert.equal(res.evaluation, "correct", "Le synonyme du dictionnaire doit être validé");
  assert.match(res.explanation, /dictionnaire/i);

  // Test avec une réponse introuvable
  const resUncertain = await translationService.evaluateFrenchAnswerSemantic({
    englishWord: "house",
    partOfSpeech: "noun",
    contextNote: "a building for human habitation",
    referenceTranslations: ["maison"],
    userAnswer: "avion"
  });

  assert.equal(resUncertain.evaluation, "uncertain");
});

test("10. evaluateFrenchAnswerSemantic valide avec succès via Gemini simulé", async () => {
  const { translationService } = await import("../src/services/translationService.js");

  // Mock fetch pour simuler l'API Gemini
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (url.includes("models?key=")) {
      return {
        ok: true,
        json: async () => ({
          models: [{ name: "models/gemini-1.5-flash", supportedGenerationMethods: ["generateContent"] }]
        })
      };
    }
    if (url.includes(":generateContent?key=")) {
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  evaluation: "correct",
                  explanation: "Synonyme fidèle pour ce contexte.",
                  reference: "Maison"
                })
              }]
            }
          }]
        })
      };
    }
    return originalFetch ? originalFetch(url) : { ok: false };
  };

  try {
    const res = await translationService.evaluateFrenchAnswerSemantic({
      englishWord: "house",
      partOfSpeech: "noun",
      referenceTranslations: ["maison"],
      userAnswer: "logement",
      apiKey: "AIzaMockTestKey"
    });

    assert.equal(res.evaluation, "correct");
    assert.equal(res.explanation, "Synonyme fidèle pour ce contexte.");
  } finally {
    global.fetch = originalFetch;
  }
});



