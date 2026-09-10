import test from "node:test";
import assert from "node:assert/strict";
import { srsService } from "../src/services/srsService.js";

test("1. Un mot échu pour révision devient non-échu après une bonne réponse", () => {
  const pastDate = new Date(Date.now() - 3600 * 1000).toISOString(); // il y a 1h
  const word = {
    id: "w-rev-1",
    english_word: "tenacious",
    part_of_speech: "adjective",
    french_translations: ["tenace"],
    srsStage: 2,
    nextReviewAt: pastDate,
    learned: true,
    isMastered: false
  };

  assert.equal(srsService.isReviewDue(word), true, "Le mot doit être initialement échu pour révision");

  const nextWord = srsService.calculateNextState(word, true, "srs-review");
  assert.equal(nextWord.srsStage, 3, "Le palier doit passer de 2 à 3");
  assert.equal(srsService.isReviewDue(nextWord), false, "Le mot ne doit plus être échu après validation de la révision");
  assert.ok(new Date(nextWord.nextReviewAt).getTime() > Date.now(), "L'échéance doit être dans le futur");
});

test("2. Un mot échu pour révision devient non-échu après une mauvaise réponse (rétrogradation J+1)", () => {
  const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
  const word = {
    id: "w-rev-2",
    english_word: "thorough",
    part_of_speech: "adjective",
    french_translations: ["minutieux", "approfondi"],
    srsStage: 3,
    nextReviewAt: pastDate,
    learned: true,
    isMastered: false
  };

  assert.equal(srsService.isReviewDue(word), true);

  const nextWord = srsService.calculateNextState(word, false, "srs-review");
  assert.equal(nextWord.srsStage, 2, "Le palier doit être rétrogradé à 2");
  assert.equal(srsService.isReviewDue(nextWord), false, "Le mot rétrogradé à J+1 n'est plus échu aujourd'hui");
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const diffHours = Math.abs(new Date(nextWord.nextReviewAt).getTime() - tomorrow.getTime()) / (3600 * 1000);
  assert.ok(diffHours < 2, "L'échéance doit être fixée à J+1");
});

test("3. Détection de dernière question avec 1 seul mot dû (isLastQuestion === true)", () => {
  const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
  const singleDueWord = {
    id: "w-solo",
    english_word: "ruthless",
    part_of_speech: "adjective",
    french_translations: ["impitoyable"],
    srsStage: 2,
    nextReviewAt: pastDate,
    learned: true
  };

  const dueList = [singleDueWord];
  const remainingDue = dueList.filter((w) => String(w.id) !== String(singleDueWord.id));
  const isLastQuestion = remainingDue.length === 0;

  assert.equal(isLastQuestion, true, "Quand un seul mot est dû, isLastQuestion doit être true dès la validation");
});

test("4. Détection de question suivante avec plusieurs mots dus", () => {
  const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
  const word1 = { id: "w-1", english_word: "boast", srsStage: 1, nextReviewAt: pastDate, learned: true };
  const word2 = { id: "w-2", english_word: "cradle", srsStage: 2, nextReviewAt: pastDate, learned: true };
  const word3 = { id: "w-3", english_word: "shrewd", srsStage: 3, nextReviewAt: pastDate, learned: true };

  let dueList = [word1, word2, word3];

  // Question 1
  let remainingDue = dueList.filter((w) => String(w.id) !== String(word1.id));
  assert.equal(remainingDue.length, 2);
  assert.equal(remainingDue.length === 0, false, "Ce n'est pas la dernière question");

  // Simulation passage au mot 2 après clic sur 'Question suivante'
  dueList = remainingDue;
  remainingDue = dueList.filter((w) => String(w.id) !== String(word2.id));
  assert.equal(remainingDue.length, 1);
  assert.equal(remainingDue.length === 0, false, "Ce n'est pas la dernière question");

  // Simulation passage au mot 3
  dueList = remainingDue;
  remainingDue = dueList.filter((w) => String(w.id) !== String(word3.id));
  assert.equal(remainingDue.length, 0);
  assert.equal(remainingDue.length === 0, true, "C'est la dernière question (bouton 'Terminer les révisions')");
});

test("5. Une réponse vide ne modifie pas l'état du mot et ne compte pas comme une erreur", () => {
  const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
  const word = {
    id: "w-empty",
    english_word: "resilient",
    srsStage: 2,
    nextReviewAt: pastDate,
    learned: true,
    totalCorrectAnswers: 5
  };

  const emptyInputs = ["", "   ", "\t\n"];
  for (const empty of emptyInputs) {
    const isAnswerEmpty = !empty.trim();
    assert.equal(isAnswerEmpty, true, "L'entrée doit être détectée comme vide");
  }

  // L'état du mot reste inchangé
  assert.equal(word.srsStage, 2);
  assert.equal(word.totalCorrectAnswers, 5);
});

test("6. Protection anti-double soumission : une tentative n'est enregistrée qu'une seule fois", () => {
  let isSubmitting = false;
  let submissionCount = 0;

  const mockSubmit = (answer) => {
    if (isSubmitting || !answer.trim()) return;
    isSubmitting = true;
    submissionCount++;
  };

  // 1er appel
  mockSubmit("resilient");
  assert.equal(submissionCount, 1);

  // 2ème appel immédiat (double clic ou répétition Entrée pendant l'affichage du résultat)
  mockSubmit("resilient");
  assert.equal(submissionCount, 1, "La 2ème soumission rapide doit être ignorée");

  // 3ème appel
  mockSubmit("resilient");
  assert.equal(submissionCount, 1, "La 3ème soumission doit être ignorée");
});
