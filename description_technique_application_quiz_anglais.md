# Dossier Technique d'Architecture & Spécifications — Application « Quiz Anglais »

> **Document de référence pour diagnostic et assistance IA**  
> Ce document décrit de manière exhaustive l'architecture, la structure des données, les règles métier, l'algorithme SRS, la synchronisation Supabase temps réel et l'intégration IA de l'application **Quiz Anglais**.

---

## 1. Vue d'Ensemble & Stack Technique

- **Type d'application** : Progressive Web App (PWA) bilingue Anglais-Français, conçue selon l'approche **Local-First**.
- **Frontend** : React 19, Vite 6, Tailwind CSS v4, Lucide React (`lucide-react`), Canvas Confetti (`canvas-confetti`).
- **Persistance & Données** : 
  - Cache local synchrone : `localStorage` (`quiz_anglais_vocab_v2`, `quiz_anglais_stats_v2`, `quiz_anglais_pairing_token`).
  - Base de données Cloud temps réel : **Supabase PostgreSQL** via `@supabase/supabase-js` avec Change Data Capture (CDC / WebSocket).
- **Services IA & Traduction** :
  - **Google Gemini API** (1.5 Flash / 2.0 Flash) pour la classification grammaticale, les synonymes et la génération de notes de contexte.
  - **Moteur Hybride Gratuit** (Fallback automatique) : Free Dictionary API / Wiktionary + MyMemory Translation API.
- **Audio & Reconnaissance Vocale** : Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition` pour la saisie vocale, `speechSynthesis` pour l'écoute).
- **Cibles d'exécution** : iPhone (PWA autonome plein écran installée via Safari « Sur l'écran d'accueil ») et Navigateurs Desktop (Mac / PC).

---

## 2. Cartographie des Fichiers & Composants

| Fichier | Rôle & Responsabilité principale |
| :--- | :--- |
| `src/App.jsx` | Composant racine. Gère la navigation par onglets (`quiz`, `list`, `stats`, `settings`), charge le cache local, écoute Supabase Realtime, orchestre les toasts de notification. |
| `src/components/QuizView.jsx` | Moteur interactif de quiz. Gère les 3 modes (Révisions, Apprentissage, Libre), la reconnaissance vocale, l'audio TTS, la file de questions anti-répétition et les célébrations. |
| `src/components/WordList.jsx` | Liste du vocabulaire. Tri alphabétique ignorant articles/prépositions (`to`, `a`, `the`), index rapide A-Z, filtres par palier SRS, suppression et réinitialisation unitaire. |
| `src/components/AddWordModal.jsx` | Modal d'ajout de mot. Recherche automatique par Gemini ou fallback gratuit, détection des doublons, édition fine des variantes acceptées et notes d'usage. |
| `src/components/SettingsView.jsx` | Écran de réglages. Configuration Supabase, QR code de jumelage iPhone en 1 scan, batch enrichissement des notes contextuelles IA, import/export JSON, script SQL. |
| `src/components/StatsView.jsx` | Tableau de bord de progression. % de maîtrise globale, répartition par paliers SRS et catégories grammaticales, séries de victoires (streak). |
| `src/services/srsService.js` | **Cœur algorithmique.** Échelle des 10 paliers SRS, calcul des échéances calendaires, machine à états (`calculateNextState`), normalisation tolérante (`checkAnswer`). |
| `src/services/storageService.js` | Persistance locale synchrone, CRUD, sanitization stricte (`sanitizeWord`), réconciliation et dédoublonnage. |
| `src/services/syncService.js` | Client Supabase, souscription PostgreSQL CDC, mappings bidirectionnels `toDBWord`/`fromDBWord`, test des droits RLS, génération URL de jumelage QR code. |
| `src/services/translationService.js` | Connecteur Google Gemini (v1beta/v1), requêtes d'enrichissement sémantique, fallback dictionnaire gratuit. |
| `tests/srs.test.js` | Suite de 19 tests unitaires automatisés validant l'ensemble des règles de transition et tolérances linguistiques (`node --test tests/srs.test.js`). |

---

## 3. Structure de l'Information & Schémas de Données

### A. Modèle Objet JavaScript (`Word`)

```typescript
interface Word {
  // Identification & Linguistique
  id: string;                     // Identifiant unique ("word-1725...-abc")
  english_word: string;           // Mot / expression en anglais (ex: "To boast", "Rife")
  part_of_speech: string;         // 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'expression'
  french_translations: string[];  // 1 à 5 traductions françaises valides
  accepted_answers?: string[];    // Variantes anglaises acceptées comme bonnes réponses au quiz
  exampleSentence?: string;       // Note de contexte ou précision sémantique (indice ambre en italique)
  notes?: string;                 // Alias rétrocompatible de exampleSentence
  frenchPrompt?: string;          // Consigne spécifique affichée au quiz (par défaut: translations[0])
  
  // Compteurs & Progression SRS
  srsStage: number;               // Entier de 0 (apprentissage initial) à 10 (maîtrisé 🏆)
  learningSuccessCount: number;   // 0 à 3 : victoires consécutives requises au Palier 0
  totalCorrectAnswers: number;    // Historique cumulatif de bonnes réponses
  learned: boolean;               // Vrai si srsStage >= 1
  isMastered: boolean;            // Vrai si srsStage === 10
  
  // Horodatages ISO 8601
  createdAt: string;              // Date de création
  firstLearnedAt?: string;        // Date de première promotion au Palier 1
  nextReviewAt?: string | null;   // Échéance calendaire calculée (null si Palier 0 ou 10)
  lastSrsReviewAt?: string;       // Date de la dernière évaluation SRS comptabilisée
  lastAnsweredAt?: string;        // Date de la dernière réponse (tous modes confondus)
  lastCorrect?: boolean;          // Résultat booléen de la dernière tentative
}
```

### B. Schéma Relationnel PostgreSQL (Supabase `public.words`)

```sql
create table if not exists public.words (
  id text primary key,
  english_word text not null,
  part_of_speech text default 'noun',
  french_translations jsonb not null default '[]'::jsonb,
  example_sentence text,
  success_count integer default 0,
  learned boolean default false,
  srs_stage integer default 0,
  first_learned_at timestamptz,
  next_review_at timestamptz,
  last_reviewed_at timestamptz,
  is_mastered boolean default false,
  last_answered timestamptz,
  last_correct boolean,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### C. Statistiques Globales (`public.quiz_stats`)

```sql
create table if not exists public.quiz_stats (
  id text primary key default 'global_stats',
  total_answered integer default 0,
  correct_answers integer default 0,
  streak integer default 0,
  max_streak integer default 0,
  updated_at timestamptz default now()
);
```

---

## 4. Algorithme SRS & Règles Métier du Quiz

### A. Les 3 Modes de Quiz

1. **Mode Révisions (`srs-review`)** :
   - Sélectionne les cartes aux **Paliers 1 à 9** arrivées à échéance : `isReviewDue(word) === true` (`nextReviewAt <= now`).
   - Impact : promotion au palier supérieur si succès, rétrogradation douce d'un palier à J+1 si erreur.
2. **Mode Apprentissage (`initial-learning`)** :
   - Sélectionne les cartes au **Palier 0** n'ayant pas encore atteint 3 succès consécutifs (`learningSuccessCount < 3`).
   - Impact : chaque succès donne +1★. À 3★ consécutives, la carte est promue au **Palier 1 (J+1)**. Toute erreur remet le compteur à **0★**.
3. **Mode Entraînement Libre (`free-practice`)** :
   - Sélectionne n'importe quelle carte de la base, y compris les cartes maîtrisées (Palier 10).
   - Impact : **Strictement neutre sur le SRS**. Met à jour les stats globales et `lastAnswered`, mais ne modifie **jamais** `srsStage` ni `nextReviewAt`.

### B. Échelle des 10 Paliers SRS

| Palier | Label | Délai ajouté | Condition de validation |
| :---: | :--- | :---: | :--- |
| **0** | En apprentissage | 0 jour | 3 victoires consécutives requises (`learningSuccessCount >= 3`) |
| **1** | Palier 1 (J+1) | +1 jour | 1ère révision validée le lendemain |
| **2** | Palier 2 (J+2) | +2 jours | 2ème révision validée 2 jours plus tard |
| **3** | Palier 3 (J+4) | +4 jours | 3ème révision validée 4 jours plus tard |
| **4** | Palier 4 (1 sem.) | +7 jours | 4ème révision validée 1 semaine plus tard |
| **5** | Palier 5 (1 mois) | +30 jours | 5ème révision validée 1 mois plus tard |
| **6** | Consolidation M2 | +30 jours | Maintien mensuel (Mois 2 de consolidation) |
| **7** | Consolidation M3 | +30 jours | Maintien mensuel (Mois 3 de consolidation) |
| **8** | Consolidation M4 | +30 jours | Maintien mensuel (Mois 4 de consolidation) |
| **9** | Consolidation M5 | +30 jours | Dernière révision mensuelle avant maîtrise définitive |
| **10** | **Maîtrisé 🏆** | `null` | **Cycle de 5 mois et demi validé : mot acquis à vie** |

### C. Règles de Rétrogradation Douce en Cas d'Erreur

- **Erreur au Palier 0** : Compteur d'étoiles remis à zéro (`learningSuccessCount = 0`).
- **Erreur au Palier 1** : Rétrograde au Palier 0, compteur à 0, `learned = false`, `nextReviewAt = null`.
- **Erreur aux Paliers 2 à 9** : Rétrograde d'**un seul palier** (Stage N → N-1) avec révision urgente programmée à **J+1**.
- **Erreur au Palier 10** : Statut de maîtrise définitive préservé (immuable).

### D. File de Round & Anti-Répétition

- Déduplication par identifiant unique (`id`).
- Tri prioritaire : révisions échues en tête de file (mélangées), suivies des cartes en apprentissage (mélangées).
- Si la première carte tirée correspond à la dernière carte répondue (historique de récence), un échange immédiat avec la 2ème carte est effectué.

---

## 5. Tolérance Linguistique & Évaluation (`checkAnswer`)

Le moteur de vérification applique une tolérance sémantique et syntaxique intelligente :
1. **Verbes** : la particule `to` est optionnelle (ex: `"boast"`, `"to boast"` ou `"To Boast"` sont équivalents).
2. **Noms** : les articles `a`, `an`, `the` sont ignorés (ex: `"cradle"`, `"a cradle"`, `"the cradle"` sont acceptés).
3. **Expressions** : tolérance sur les articles (`"piece of cake"` = `"a piece of cake"`).
4. **Pronoms impersonnels/réfléchis** : `"one's"`, `"oneself"`, `"someone"`, `"yourself"` sont tolérés (`"make up your mind"` = `"make up one's mind"`).
5. **Parenthèses optionnelles** : `"give (someone) a hand"` valide `"give someone a hand"`, `"give a hand"` et `"give hand"`.
6. **Multi-réponses** : si `accepted_answers` est renseigné (ex: `["lawyer", "attorney"]`), chaque alternative valide la question.

---

## 6. Synchronisation Supabase & Temps Réel

- **Local-First** : lecture/écriture instantanée dans le LocalStorage.
- **WebSocket PostgreSQL (CDC)** : souscription au canal `supabase_realtime` pour la table `words`. Tout ajout/modification/suppression sur Mac est répercuté instantanément sur l'iPhone.
- **Jumelage QR Code en 1 scan** : l'URL `#pair?url=...&key=...&gemini=...` est encodée dans un QR code SVG affiché dans l'onglet Réglages. Le scan par l'appareil photo de l'iPhone configure l'application sans saisie manuelle.
- **Sécurité (RLS)** : tables configurées avec `row level security` et politique publique ouverte pour la clé `anon`.

---

## 7. Moteur IA Gemini & Enrichissement Sémantique

- **Intégration** : appels HTTP vers Google Gemini via Google AI Studio.
- **Détection automatique de modèles** : test dynamique de `gemini-1.5-flash`, `gemini-2.0-flash`, `gemini-1.5-pro`.
- **Enrichissement de lot** : bouton dans les Réglages pour générer les notes de contexte manquantes sur toute la base avec temporisation de 400ms contre le rate-limiting.
- **Fallback transparent** : bascule automatique sans erreur vers Wiktionary & MyMemory en cas d'absence de clé ou quota épuisé.

---

## 8. Guide de Débogage & Points de Vigilance pour l'IA

Lorsqu'un problème est signalé sur l'application, voici les points critiques à inspecter :

1. **Dérive du Schéma SQL Supabase** : vérifier que la colonne `example_sentence` et les colonnes SRS existent bien dans la table `public.words`. Si elles manquent, les requêtes d'update échouent silencieusement.
2. **Gestion des Heures vs Dates Calendaires** : `nextReviewAt` est calculé avec `date.setDate(date.getDate() + interval)`. Si un mot est validé à 23h30, son échéance J+1 est le lendemain à 23h30. Pour un comportement journalier strict, aligner sur `00:00:00`.
3. **Concurrence Hors-Ligne (Race Conditions)** : la résolution actuelle applique le dernier écrit (« Last Write Wins »). Une fusion fine basée sur `updated_at` évite l'écrasement de sessions croisées.
4. **Reconnaissance Vocale iOS Safari** : nécessite impérativement `webkitSpeechRecognition`, un contexte HTTPS et un déclenchement explicite par tap utilisateur.
5. **Sanitization des Données** : s'assurer que tout nouvel objet mot passe par `srsService.sanitizeWord()` pour éviter des champs manquants (`learned`, `isMastered`, `srsStage`).

---

## 9. Modèle de Prompt pour Interroger une Autre IA

```text
« Bonjour, je te fournis en pièce jointe le document descriptif technique de mon application React "Quiz Anglais" (contenant l'architecture complète, le schéma de données JS/Supabase et l'algorithme SRS à 10 paliers).

Voici le problème que je rencontre :
[DÉCRIS ICI TON PROBLÈME PRÉCISÉMENT]

En t'appuyant strictement sur les règles et le modèle décrits dans ce document :
1. Identifie la cause probable du problème dans le code (fichiers concernés : srsService.js, storageService.js, syncService.js ou QuizView.jsx).
2. Fournis le correctif de code exact et minimal à apporter.
3. Indique comment tester ou vérifier la correction (par ex. via un test unitaire dans tests/srs.test.js). »
```
