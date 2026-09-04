import { srsService } from "../src/services/srsService.js";
import assert from "node:assert/strict";
import test from "node:test";

test("1. 3 bonnes réponses consécutives au palier 0 font passer au palier 1", () => {
  let word = {
    id: "w1",
    english_word: "boast",
    part_of_speech: "verb",
    french_translations: ["se vanter"],
    srsStage: 0,
    learningSuccessCount: 0,
    learned: false
  };

  // 1ère réussite
  word = srsService.calculateNextState(word, true, "initial-learning");
  assert.equal(word.srsStage, 0);
  assert.equal(word.learningSuccessCount, 1);
  assert.equal(word.learned, false);

  // 2ème réussite
  word = srsService.calculateNextState(word, true, "initial-learning");
  assert.equal(word.srsStage, 0);
  assert.equal(word.learningSuccessCount, 2);
  assert.equal(word.learned, false);

  // 3ème réussite consécutive -> Promotion au Palier 1
  word = srsService.calculateNextState(word, true, "initial-learning");
  assert.equal(word.srsStage, 1);
  assert.equal(word.learningSuccessCount, 3);
  assert.equal(word.learned, true);
  assert.ok(word.nextReviewAt !== null, "nextReviewAt doit être programmé (J+1)");
});

test("2. Une erreur au palier 0 remet le compteur learningSuccessCount à 0", () => {
  let word = {
    id: "w2",
    english_word: "cradle",
    part_of_speech: "noun",
    french_translations: ["berceau"],
    srsStage: 0,
    learningSuccessCount: 2,
    learned: false
  };

  word = srsService.calculateNextState(word, false, "initial-learning");
  assert.equal(word.srsStage, 0);
  assert.equal(word.learningSuccessCount, 0);
  assert.equal(word.learned, false);
});

test("3. Une erreur au palier 1 fait revenir au palier 0 avec compteur à 0", () => {
  let word = {
    id: "w3",
    english_word: "shrewd",
    part_of_speech: "adjective",
    french_translations: ["rusé"],
    srsStage: 1,
    learningSuccessCount: 3,
    learned: true,
    nextReviewAt: "2026-09-01T10:00:00.000Z"
  };

  word = srsService.calculateNextState(word, false, "srs-review");
  assert.equal(word.srsStage, 0);
  assert.equal(word.learningSuccessCount, 0);
  assert.equal(word.learned, false);
  assert.equal(word.isMastered, false);
  assert.equal(word.nextReviewAt, null);
});

test("4. Une erreur entre les paliers 2 et 9 fait perdre exactement un seul palier", () => {
  let word = {
    id: "w4",
    english_word: "palatable",
    part_of_speech: "adjective",
    french_translations: ["savoureux"],
    srsStage: 5,
    learned: true,
    nextReviewAt: "2026-09-01T10:00:00.000Z"
  };

  word = srsService.calculateNextState(word, false, "srs-review");
  assert.equal(word.srsStage, 4);
  assert.equal(word.learned, true);
  assert.equal(word.isMastered, false);
  assert.ok(word.nextReviewAt !== null, "Une consolidation urgente à J+1 doit être programmée");
});

test("5. Une bonne réponse avant échéance ne fait pas avancer la carte en srs-review", () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5);

  let word = {
    id: "w5",
    english_word: "forsake",
    part_of_speech: "verb",
    french_translations: ["abandonner"],
    srsStage: 3,
    learned: true,
    nextReviewAt: futureDate.toISOString() // Échéance future
  };

  const nextState = srsService.calculateNextState(word, true, "srs-review");
  assert.equal(nextState.srsStage, 3, "Le palier ne doit pas avancer avant l'échéance");
  assert.equal(nextState.nextReviewAt, word.nextReviewAt);
});

test("6. L'entraînement libre (free-practice) ne modifie jamais l'état SRS", () => {
  const original = {
    id: "w6",
    english_word: "vivid",
    part_of_speech: "adjective",
    french_translations: ["vif"],
    srsStage: 2,
    learningSuccessCount: 3,
    totalCorrectAnswers: 5,
    learned: true,
    isMastered: false,
    nextReviewAt: "2026-09-10T08:00:00.000Z"
  };

  // Test avec une mauvaise réponse en free-practice
  const afterWrong = srsService.calculateNextState(original, false, "free-practice");
  assert.equal(afterWrong.srsStage, original.srsStage);
  assert.equal(afterWrong.learningSuccessCount, original.learningSuccessCount);
  assert.equal(afterWrong.nextReviewAt, original.nextReviewAt);
  assert.equal(afterWrong.learned, original.learned);
  assert.equal(afterWrong.isMastered, original.isMastered);
  assert.equal(afterWrong.lastCorrect, false);

  // Test avec une bonne réponse en free-practice
  const afterCorrect = srsService.calculateNextState(original, true, "free-practice");
  assert.equal(afterCorrect.srsStage, original.srsStage);
  assert.equal(afterCorrect.learningSuccessCount, original.learningSuccessCount);
  assert.equal(afterCorrect.nextReviewAt, original.nextReviewAt);
  assert.equal(afterCorrect.learned, original.learned);
  assert.equal(afterCorrect.lastCorrect, true);
});

test("7. Une carte au palier 10 n'est pas modifiée par le SRS standard", () => {
  const mastered = {
    id: "w7",
    english_word: "mingle",
    part_of_speech: "verb",
    french_translations: ["se mêler"],
    srsStage: 10,
    learned: true,
    isMastered: true,
    nextReviewAt: null
  };

  const afterError = srsService.calculateNextState(mastered, false, "srs-review");
  assert.equal(afterError.srsStage, 10);
  assert.equal(afterError.isMastered, true);
  assert.equal(afterError.nextReviewAt, null);
});

test("8. Une date absente ou invalide ne transforme pas une carte en révision échue", () => {
  const invalidWord1 = { id: "w8_1", srsStage: 2, nextReviewAt: null };
  const invalidWord2 = { id: "w8_2", srsStage: 3, nextReviewAt: "date-invalide" };
  const invalidWord3 = { id: "w8_3", srsStage: 0, nextReviewAt: null };

  assert.equal(srsService.isReviewDue(invalidWord1), false);
  assert.equal(srsService.isReviewDue(invalidWord2), false);
  assert.equal(srsService.isReviewDue(invalidWord3), false);
});

test("9. 'to' n'est retiré que pour les verbes", () => {
  // Pour un verbe
  assert.equal(srsService.normalize("to boast", "verb"), "boast");
  assert.equal(srsService.normalize("boast", "verb"), "boast");

  // Pour un nom ou adjectif ne devant pas être tronqué
  assert.equal(srsService.normalize("toad", "noun"), "toad");
  assert.equal(srsService.normalize("to the point", "adjective"), "to the point");
});

test("10. Les articles anglais (a, an, the) ne sont retirés que pour les noms", () => {
  // Pour un nom
  assert.equal(srsService.normalize("a cradle", "noun"), "cradle");
  assert.equal(srsService.normalize("an apple", "noun"), "apple");
  assert.equal(srsService.normalize("the bugles", "noun"), "bugles");

  // Pour un adjectif ou verbe
  assert.equal(srsService.normalize("a bit fast", "adverb"), "a bit fast");
});

test("11. Toutes les entrées de accepted_answers sont reconnues", () => {
  const word = {
    english_word: "solicitor",
    part_of_speech: "noun",
    accepted_answers: ["lawyer", "attorney", "counsel"]
  };

  assert.equal(srsService.checkAnswer("solicitor", word), true);
  assert.equal(srsService.checkAnswer("a lawyer", word), true); // article ignoré car noun
  assert.equal(srsService.checkAnswer("attorney", word), true);
  assert.equal(srsService.checkAnswer("counsel", word), true);
  assert.equal(srsService.checkAnswer("judge", word), false);
});

test("12. L'anti-répétition fonctionne sans crash avec 0, 1, 2 et plusieurs cartes", () => {
  // 0 carte
  assert.deepEqual(srsService.buildRoundQueue([]), []);

  // 1 carte
  const single = [{ id: "c1", srsStage: 0 }];
  assert.deepEqual(srsService.buildRoundQueue(single, ["c1"]), ["c1"]);

  // 2 cartes avec récence
  const two = [{ id: "c1", srsStage: 0 }, { id: "c2", srsStage: 0 }];
  const queueTwo = srsService.buildRoundQueue(two, ["c1"]);
  assert.equal(queueTwo[0], "c2", "La carte différente de la précédente doit être placée en premier");

  // Plusieurs cartes
  const multi = [{ id: "c1" }, { id: "c2" }, { id: "c3" }, { id: "c4" }];
  const queueMulti = srsService.buildRoundQueue(multi, ["c1"]);
  assert.notEqual(queueMulti[0], "c1");
});

test("13. Une carte ne figure pas plusieurs fois dans la file à cause d'une duplication", () => {
  const duplicated = [
    { id: "c1", srsStage: 0 },
    { id: "c1", srsStage: 0 },
    { id: "c2", srsStage: 0 },
    { id: "c2", srsStage: 0 }
  ];

  const queue = srsService.buildRoundQueue(duplicated);
  assert.equal(queue.length, 2);
  assert.equal(new Set(queue).size, 2);
});

test("14. learned et isMastered restent strictement cohérents avec srsStage", () => {
  const word0 = srsService.sanitizeWord({ srsStage: 0 });
  assert.equal(word0.learned, false);
  assert.equal(word0.isMastered, false);
  assert.equal(word0.nextReviewAt, null);

  const word1 = srsService.sanitizeWord({ srsStage: 1, nextReviewAt: "2026-09-02T00:00:00.000Z" });
  assert.equal(word1.learned, true);
  assert.equal(word1.isMastered, false);

  const word10 = srsService.sanitizeWord({ srsStage: 10 });
  assert.equal(word10.learned, true);
  assert.equal(word10.isMastered, true);
  assert.equal(word10.nextReviewAt, null);
});
