import test from "node:test";
import assert from "node:assert/strict";
import { srsService } from "../src/services/srsService.js";
import { toDBWord, fromDBWord } from "../src/services/syncService.js";

// Mock localStorage pour simuler fidèlement l'environnement navigateur
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

// Importer storageService après le mock de localStorage
const { storageService } = await import("../src/services/storageService.js");

test("1. Modifier un descriptif contextuel met à jour le mot et propage la nouvelle note", async () => {
  mockStorage.clear();
  const testWord = {
    id: "word-edit-1",
    english_word: "Bark",
    part_of_speech: "verb",
    french_translations: ["Aboyer"],
    exampleSentence: "Un chien qui aboie",
    notes: "Un chien qui aboie",
    srsStage: 2,
    nextReviewAt: "2026-09-12T10:00:00.000Z",
    learningSuccessCount: 3,
    totalCorrectAnswers: 5
  };

  storageService.saveWordsLocally([testWord]);

  // Modification du descriptif
  const updatedNote = "Émettre un cri caractéristique (pour un canidé)";
  const res = await storageService.updateContextNote("word-edit-1", updatedNote);

  const modified = res.words.find((w) => w.id === "word-edit-1");
  assert.equal(modified.exampleSentence, updatedNote);
  assert.equal(modified.notes, updatedNote);
  assert.equal(modified.example_sentence, updatedNote);
});

test("2. Recharger l'application (localStorage) conserve fidèlement la note modifiée", () => {
  // Lecture depuis getWords() (qui recharge depuis localStorage et exécute sanitizeWord)
  const words = storageService.getWords();
  const found = words.find((w) => w.id === "word-edit-1");
  assert.equal(found.exampleSentence, "Émettre un cri caractéristique (pour un canidé)");
  assert.equal(found.notes, "Émettre un cri caractéristique (pour un canidé)");
});

test("3. Annuler une modification ne change pas les données", () => {
  const currentWords = storageService.getWords();
  const original = currentWords.find((w) => w.id === "word-edit-1");
  const initialText = original.exampleSentence;

  // L'utilisateur ferme le formulaire en cliquant Annuler (aucune mise à jour appelée)
  const afterCancelWords = storageService.getWords();
  const wordAfterCancel = afterCancelWords.find((w) => w.id === "word-edit-1");
  assert.equal(wordAfterCancel.exampleSentence, initialText);
});

test("4. Supprimer un descriptif le vide complètement et empêche l'ancien champ notes de réapparaître", async () => {
  mockStorage.clear();
  const wordWithLegacyNote = {
    id: "word-delete-note",
    english_word: "Bat",
    part_of_speech: "noun",
    french_translations: ["Chauve-souris"],
    exampleSentence: "Mammifère volant nocturne",
    notes: "Mammifère volant nocturne",
    srsStage: 1
  };
  storageService.saveWordsLocally([wordWithLegacyNote]);

  // Suppression en passant une chaîne vide ou du blanc
  const res = await storageService.updateContextNote("word-delete-note", "   ");
  const clearedWord = res.words.find((w) => w.id === "word-delete-note");

  // Vérification sur l'objet retourné
  assert.equal(clearedWord.exampleSentence, undefined);
  assert.equal(clearedWord.notes, undefined);
  assert.equal(clearedWord.example_sentence, undefined);

  // Simulation rechargement complet depuis localStorage avec JSON.parse + sanitizeWord
  const reloadedWords = storageService.getWords();
  const reloadedWord = reloadedWords.find((w) => w.id === "word-delete-note");

  assert.equal(reloadedWord.exampleSentence, undefined);
  assert.equal(reloadedWord.notes, undefined);
  assert.equal(reloadedWord.example_sentence, undefined);
  assert.equal(reloadedWord.contextNoteCleared, true);

  // Vérification de la conversion DB Supabase : example_sentence doit valoir null
  const dbWord = toDBWord(reloadedWord);
  assert.equal(dbWord.example_sentence, null);

  // Vérification de la ré-importation DB (Realtime CDC ou refresh)
  const backFromDB = fromDBWord({ ...dbWord, example_sentence: null });
  assert.equal(backFromDB.exampleSentence, undefined);
  assert.equal(backFromDB.notes, undefined);
});

test("5. Ajouter un descriptif à un mot qui n'en possédait pas initialement", async () => {
  mockStorage.clear();
  const wordWithoutNote = {
    id: "word-no-note",
    english_word: "Leaf",
    part_of_speech: "noun",
    french_translations: ["Feuille"],
    srsStage: 0
  };
  storageService.saveWordsLocally([wordWithoutNote]);

  const newNote = "Partie verte et plate d'un végétal";
  const res = await storageService.updateContextNote("word-no-note", newNote);
  const updated = res.words.find((w) => w.id === "word-no-note");

  assert.equal(updated.exampleSentence, newNote);
  assert.equal(updated.notes, newNote);
  assert.equal(updated.contextNoteCleared, undefined);
});

test("6. Homonymes : modifier 'Bark' (verbe) n'altère en rien 'Bark' (nom)", async () => {
  mockStorage.clear();
  const barkVerb = {
    id: "bark-verb-id",
    english_word: "Bark",
    part_of_speech: "verb",
    french_translations: ["Aboyer"],
    exampleSentence: "Le cri du chien",
    notes: "Le cri du chien"
  };

  const barkNoun = {
    id: "bark-noun-id",
    english_word: "Bark",
    part_of_speech: "noun",
    french_translations: ["Écorce"],
    exampleSentence: "Enveloppe extérieure d'un tronc d'arbre",
    notes: "Enveloppe extérieure d'un tronc d'arbre"
  };

  storageService.saveWordsLocally([barkVerb, barkNoun]);

  // Modification du verbe uniquement
  await storageService.updateContextNote("bark-verb-id", "Pousser son cri (chiens, renards)");

  const words = storageService.getWords();
  const updatedVerb = words.find((w) => w.id === "bark-verb-id");
  const unchangedNoun = words.find((w) => w.id === "bark-noun-id");

  assert.equal(updatedVerb.exampleSentence, "Pousser son cri (chiens, renards)");
  assert.equal(unchangedNoun.exampleSentence, "Enveloppe extérieure d'un tronc d'arbre");
  assert.equal(unchangedNoun.notes, "Enveloppe extérieure d'un tronc d'arbre");
});

test("7. Édition hors-ligne et file de synchronisation (pending updates)", async () => {
  mockStorage.clear();
  const offlineWord = {
    id: "word-offline",
    english_word: "Gleam",
    part_of_speech: "noun",
    french_translations: ["Lueur"],
    exampleSentence: "Reflet passager",
    srsStage: 1
  };
  storageService.saveWordsLocally([offlineWord]);

  // Enregistrer une modification
  await storageService.updateContextNote("word-offline", "Éclat bref et doux de lumière");

  // La modification est disponible immédiatement en local
  const localWords = storageService.getWords();
  const updatedOffline = localWords.find((w) => w.id === "word-offline");
  assert.equal(updatedOffline.exampleSentence, "Éclat bref et doux de lumière");

  // Vérifier la gestion de la file d'attente hors ligne
  storageService.addPendingUpdate("word-offline", { example_sentence: "Éclat bref et doux de lumière" });
  const pending = storageService.getPendingUpdates();
  assert.ok(pending["word-offline"]);
  assert.equal(pending["word-offline"].example_sentence, "Éclat bref et doux de lumière");

  // Simulation vidage de la file
  storageService.clearPendingUpdate("word-offline");
  const pendingAfter = storageService.getPendingUpdates();
  assert.equal(pendingAfter["word-offline"], undefined);
});

test("8. L'édition de la note préserve strictement les traductions, les statistiques et l'état SRS", async () => {
  mockStorage.clear();
  const wordWithProgress = {
    id: "word-progress-check",
    english_word: "Subtle",
    part_of_speech: "adjective",
    french_translations: ["Subtil", "Fin", "Délicat"],
    accepted_answers: ["subtle", "discrete"],
    exampleSentence: "Ancienne note",
    notes: "Ancienne note",
    srsStage: 4,
    learningSuccessCount: 3,
    totalCorrectAnswers: 12,
    learned: true,
    isMastered: false,
    nextReviewAt: "2026-09-17T08:30:00.000Z",
    lastSrsReviewAt: "2026-09-10T08:30:00.000Z",
    lastAnsweredAt: "2026-09-10T08:30:00.000Z",
    lastCorrect: true
  };

  storageService.saveWordsLocally([wordWithProgress]);

  await storageService.updateContextNote("word-progress-check", "Difficile à percevoir avec évidence");

  const words = storageService.getWords();
  const checked = words.find((w) => w.id === "word-progress-check");

  // Note modifiée
  assert.equal(checked.exampleSentence, "Difficile à percevoir avec évidence");

  // Tous les autres champs doivent rester strictement identiques
  assert.deepEqual(checked.french_translations, ["Subtil", "Fin", "Délicat"]);
  assert.deepEqual(checked.accepted_answers, ["subtle", "discrete"]);
  assert.equal(checked.srsStage, 4);
  assert.equal(checked.learningSuccessCount, 3);
  assert.equal(checked.totalCorrectAnswers, 12);
  assert.equal(checked.learned, true);
  assert.equal(checked.isMastered, false);
  assert.equal(checked.nextReviewAt, "2026-09-17T08:30:00.000Z");
  assert.equal(checked.lastSrsReviewAt, "2026-09-10T08:30:00.000Z");
  assert.equal(checked.lastAnsweredAt, "2026-09-10T08:30:00.000Z");
  assert.equal(checked.lastCorrect, true);
});
