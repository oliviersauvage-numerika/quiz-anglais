#!/usr/bin/env python3
"""
Générateur de dossier technique complet et descriptif de l'application "Quiz Anglais".
Format : Document PDF de haute qualité typographique via ReportLab.
Conçu pour servir de document de référence et prompt complet pour d'autres IA (Claude, ChatGPT, etc.).
"""

import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """Canvas à deux passes pour numéroter 'Page X sur Y' et insérer l'en-tête dynamique."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        
        # En-tête (à partir de la page 2)
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#4338ca"))
            self.drawString(45, 842 - 30, "QUIZ ANGLAIS")
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748b"))
            self.drawString(115, 842 - 30, "— Dossier Technique d'Architecture, Modèles & Algorithmes")
            
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.75)
            self.line(45, 842 - 35, 595 - 45, 842 - 35)

        # Pied de page (toutes les pages)
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.75)
        self.line(45, 38, 595 - 45, 38)

        self.setFont("Helvetica", 7.8)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(45, 26, "Document descriptif technique pour audit & diagnostic par IA")
        self.drawRightString(595 - 45, 26, f"Page {self._pageNumber} sur {page_count}")
        
        self.restoreState()


def create_specification_pdf(output_filename="description_technique_application_quiz_anglais.pdf"):
    # Marges à 45pt (environ 16mm) pour maximiser la surface utile A4 (505pt utiles)
    doc = SimpleDocTemplate(
        output_filename,
        pagesize=A4,
        leftMargin=45,
        rightMargin=45,
        topMargin=42,
        bottomMargin=45
    )

    styles = getSampleStyleSheet()

    # Palette
    PRIMARY = colors.HexColor("#4338ca")       # Indigo foncé
    SECONDARY = colors.HexColor("#6366f1")     # Indigo vif
    DARK = colors.HexColor("#0f172a")          # Slate 900
    BODY = colors.HexColor("#334155")          # Slate 700
    MUTED = colors.HexColor("#64748b")         # Slate 500
    BG_LIGHT = colors.HexColor("#f8fafc")      # Slate 50
    BORDER = colors.HexColor("#cbd5e1")        # Slate 300
    EMERALD = colors.HexColor("#047857")       # Vert foncé
    AMBER = colors.HexColor("#b45309")         # Ambre foncé
    ROSE = colors.HexColor("#be123c")          # Rouge foncé

    # Typographie
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=DARK,
        spaceAfter=3
    )

    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=14.5,
        textColor=MUTED,
        spaceAfter=10
    )

    h1_style = ParagraphStyle(
        "SectionH1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=PRIMARY,
        spaceBefore=11,
        spaceAfter=5,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        "SectionH2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13.5,
        textColor=DARK,
        spaceBefore=8,
        spaceAfter=3,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.8,
        leading=12.2,
        textColor=BODY,
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        "BulletText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.6,
        leading=12,
        textColor=BODY,
        leftIndent=10,
        spaceAfter=2.5
    )

    code_style = ParagraphStyle(
        "CodeText",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=7.4,
        leading=9.8,
        textColor=colors.HexColor("#f1f5f9")
    )

    badge_style = ParagraphStyle(
        "BadgeText",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.8,
        leading=9.8,
        textColor=PRIMARY
    )

    story = []

    # ==================== EN-TÊTE / COUVERTURE ====================
    badge_table = Table(
        [[Paragraph("DOCUMENT D'ARCHITECTURE TECHNIQUE & SPÉCIFICATIONS FONCTIONNELLES", badge_style)]],
        colWidths=[505]
    )
    badge_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#e0e7ff")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#c7d2fe")),
    ]))
    story.append(badge_table)
    story.append(Spacer(1, 6))

    story.append(Paragraph("Application Web / PWA « Quiz Anglais »", title_style))
    story.append(Paragraph(
        "Dossier de référence complet : architecture modulaire, modèle de données, algorithme SRS à 10 paliers, synchronisation Supabase temps réel, moteur IA Gemini et guide d'audit pour le débogage.",
        subtitle_style
    ))
    story.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY, spaceBefore=0, spaceAfter=8))

    # Fiche d'identité synthétique
    meta_data = [
        [
            Paragraph("<b>Stack Technique :</b>", body_style),
            Paragraph("React 19, Vite 6, Tailwind CSS v4, Lucide Icons, Canvas Confetti, Web Speech API (STT & TTS)", body_style)
        ],
        [
            Paragraph("<b>Persistance :</b>", body_style),
            Paragraph("Architecture <b>Local-First</b> (LocalStorage synchrone + Cloud Supabase PostgreSQL Realtime via CDC)", body_style)
        ],
        [
            Paragraph("<b>Services & IA :</b>", body_style),
            Paragraph("Google Gemini API (1.5 Flash / 2.0 Flash) + Fallback transparent (Wiktionary & MyMemory API)", body_style)
        ],
        [
            Paragraph("<b>Périphériques cibles :</b>", body_style),
            Paragraph("PWA iPhone autonome (Safari plein écran sans barre d'URL) et Navigateurs Desktop (Mac / PC)", body_style)
        ],
        [
            Paragraph("<b>Objectif du document :</b>", body_style),
            Paragraph("Fournir à une IA (Claude, ChatGPT, Gemini, etc.) ou à un développeur l'ensemble des règles métier, schémas et mécanismes pour diagnostiquer, corriger ou faire évoluer le projet sans régression.", body_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[120, 385])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG_LIGHT),
        ("BOX", (0, 0), (-1, -1), 1, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # ==================== SECTION 1 : VUE D'ENSEMBLE ====================
    story.append(Paragraph("1. Vue d'Ensemble & Architecture Modulaire", h1_style))
    story.append(Paragraph(
        "L'application est construite selon le paradigme <b>Local-First</b> : les opérations de lecture et d'écriture sont instantanées en local sur le navigateur (LocalStorage), garantissant une latence nulle et un fonctionnement hors-ligne total. En arrière-plan, un service de synchronisation réplique chaque modification vers Supabase (PostgreSQL), avec écoute bidirectionnelle en direct via WebSockets.",
        body_style
    ))

    files_data = [
        [Paragraph("<b>Fichier</b>", body_style), Paragraph("<b>Rôle & Responsabilités Clés</b>", body_style)],
        [
            Paragraph("<code>src/App.jsx</code>", body_style),
            Paragraph("Composant racine : pilote l'onglet actif (<code>quiz</code>, <code>list</code>, <code>stats</code>, <code>settings</code>), charge le cache local, écoute les événements Realtime Supabase, affiche les toasts de notification.", body_style)
        ],
        [
            Paragraph("<code>src/components/QuizView.jsx</code>", body_style),
            Paragraph("Moteur d'évaluation du quiz : 3 modes exclusifs (Révisions, Apprentissage, Entraînement Libre), reconnaissance vocale Speech-to-Text (STT), synthèse vocale TTS, célébrations confetti, gestion de file anti-répétition.", body_style)
        ],
        [
            Paragraph("<code>src/components/WordList.jsx</code>", body_style),
            Paragraph("Dictionnaire et consultation : tri alphabétique intelligent (ignorant <code>to</code>, <code>a</code>, <code>the</code>), index rapide A-Z, filtres par statut SRS, écoute audio, suppression et réinitialisation unitaire.", body_style)
        ],
        [
            Paragraph("<code>src/components/AddWordModal.jsx</code>", body_style),
            Paragraph("Ajout de vocabulaire assisté : détection automatique de la nature grammaticale, des traductions équivalentes et des notes de contexte via Gemini API (ou fallback gratuit), contrôle de doublons, édition fine.", body_style)
        ],
        [
            Paragraph("<code>src/components/SettingsView.jsx</code>", body_style),
            Paragraph("Panneau d'administration : clés Supabase et Gemini, QR Code de jumelage iPhone instantané, migration de données par paquets, script SQL, enrichissement par lot des notes de contexte IA, import/export JSON.", body_style)
        ],
        [
            Paragraph("<code>src/components/StatsView.jsx</code>", body_style),
            Paragraph("Tableau de bord statistique : taux de maîtrise globale, répartition des mots par palier SRS, décompte par nature grammaticale, calcul de la série de victoires (streak) et du taux d'exactitude.", body_style)
        ],
        [
            Paragraph("<code>src/services/srsService.js</code>", body_style),
            Paragraph("<b>Cœur algorithmique SRS :</b> gestion des 10 paliers, calcul des dates calendaires, machine à états des transitions (succès/échec), tolérance linguistique poussée, ordonnancement équilibré de la file de round.", body_style)
        ],
        [
            Paragraph("<code>src/services/storageService.js</code>", body_style),
            Paragraph("Couche d'abstraction du stockage : assainissement et validation des données (<code>sanitizeWord</code>), CRUD local synchrone, synchronisation optimiste distante, détection et réconciliation des doublons.", body_style)
        ],
        [
            Paragraph("<code>src/services/syncService.js</code>", body_style),
            Paragraph("Client Supabase & Realtime : transformations Objet JS ↔ Base SQL, gestion des canaux WebSocket, test approfondi des droits RLS (lecture/écriture), jumelage automatique via URL Hash.", body_style)
        ],
        [
            Paragraph("<code>src/services/translationService.js</code>", body_style),
            Paragraph("Moteur bilingue : connecteur multi-modèles Google Gemini (v1/v1beta, flash/pro), prompt d'extraction JSON strict, générateur de notes de contexte, fallback transparent sur Wiktionary & MyMemory.", body_style)
        ],
        [
            Paragraph("<code>tests/srs.test.js</code>", body_style),
            Paragraph("Suite complète de 19 tests unitaires automatisés validant la logique de transition, les paliers, la rétrogradation douce et les tolérances linguistiques (exécutable via <code>node --test tests/srs.test.js</code>).", body_style)
        ]
    ]

    files_table = Table(files_data, colWidths=[140, 365])
    files_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 1, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(files_table)

    story.append(Spacer(1, 10))

    # ==================== SECTION 2 : STRUCTURE DE L'INFORMATION ====================
    story.append(Paragraph("2. Structure de l'Information & Modèle de Données", h1_style))
    story.append(Paragraph(
        "Le modèle de données garantit la cohérence stricte entre le cache local du navigateur et les tables distantes PostgreSQL dans Supabase. Les données sont systématiquement assainies par <code>srsService.sanitizeWord()</code>.",
        body_style
    ))

    story.append(Paragraph("A. Interface de l'Objet JavaScript (<code>Word</code>)", h2_style))
    
    code_schema_js = """interface Word {
  // Identification & Linguistique
  id: string;                     // Clé primaire unique ("word-1725...-abc")
  english_word: string;           // Mot / expression cible en anglais (ex: "To boast", "Rife")
  part_of_speech: string;         // 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'expression'
  french_translations: string[];  // Tableau de 1 à 5 traductions françaises admises
  accepted_answers?: string[];    // Variantes anglaises acceptées comme bonnes réponses au quiz
  exampleSentence?: string;       // Note de contexte ou précision sémantique (indice ambre)
  notes?: string;                 // Alias rétrocompatible de exampleSentence
  frenchPrompt?: string;          // Consigne spécifique affichée au quiz (par défaut: translations[0])
  
  // Compteurs & Progression SRS
  srsStage: number;               // Entier de 0 (apprentissage initial) à 10 (maîtrisé 🏆)
  learningSuccessCount: number;   // 0 à 3 : victoires consécutives requises au Palier 0
  totalCorrectAnswers: number;    // Total cumulatif historique des bonnes réponses
  learned: boolean;               // Cohérence stricte : true si srsStage >= 1
  isMastered: boolean;            // Cohérence stricte : true si srsStage === 10
  
  // Horodatages ISO 8601
  createdAt: string;              // Date de création du mot
  firstLearnedAt?: string;        // Date de première promotion au Palier 1
  nextReviewAt?: string | null;   // Échéance calendaire calculée (null si Palier 0 ou 10)
  lastSrsReviewAt?: string;       // Date de la dernière évaluation comptabilisée
  lastAnsweredAt?: string;        // Date de la dernière réponse (quel que soit le mode)
  lastCorrect?: boolean;          // Résultat booléen de la dernière tentative
}"""

    schema_table = Table([[Paragraph(code_schema_js.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style)]], colWidths=[505])
    schema_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), DARK),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#334155")),
    ]))
    story.append(schema_table)
    story.append(Spacer(1, 6))

    story.append(Paragraph("B. Schéma SQL Supabase (Table <code>public.words</code>)", h2_style))
    story.append(Paragraph(
        "Dans la base PostgreSQL, les colonnes suivent la convention <code>snake_case</code>. La conversion est effectuée de manière bidirectionnelle par <code>toDBWord()</code> et <code>fromDBWord()</code> dans <code>syncService.js</code> :",
        body_style
    ))

    sql_mapping_data = [
        [Paragraph("<b>Colonne SQL (Supabase)</b>", body_style), Paragraph("<b>Type PostgreSQL</b>", body_style), Paragraph("<b>Propriété Objet JS</b>", body_style), Paragraph("<b>Notes & Rôle</b>", body_style)],
        [Paragraph("<code>id</code>", body_style), Paragraph("text PRIMARY KEY", body_style), Paragraph("<code>word.id</code>", body_style), Paragraph("Identifiant unique généré côté client", body_style)],
        [Paragraph("<code>english_word</code>", body_style), Paragraph("text NOT NULL", body_style), Paragraph("<code>word.english_word</code>", body_style), Paragraph("Indexé en minuscules (recherche / dédoublonnage)", body_style)],
        [Paragraph("<code>part_of_speech</code>", body_style), Paragraph("text DEFAULT 'noun'", body_style), Paragraph("<code>word.part_of_speech</code>", body_style), Paragraph("noun, verb, adjective, adverb, preposition, expression", body_style)],
        [Paragraph("<code>french_translations</code>", body_style), Paragraph("jsonb DEFAULT '[]'::jsonb", body_style), Paragraph("<code>word.french_translations</code>", body_style), Paragraph("Tableau de chaînes de caractères (synonymes)", body_style)],
        [Paragraph("<code>example_sentence</code>", body_style), Paragraph("text", body_style), Paragraph("<code>word.exampleSentence</code>", body_style), Paragraph("Note de contexte sémantique (indice en italique)", body_style)],
        [Paragraph("<code>srs_stage</code>", body_style), Paragraph("integer DEFAULT 0", body_style), Paragraph("<code>word.srsStage</code>", body_style), Paragraph("Entier de 0 à 10", body_style)],
        [Paragraph("<code>success_count</code>", body_style), Paragraph("integer DEFAULT 0", body_style), Paragraph("<code>word.learningSuccessCount</code>", body_style), Paragraph("Compteur d'apprentissage initial (0 à 3)", body_style)],
        [Paragraph("<code>learned</code>", body_style), Paragraph("boolean DEFAULT false", body_style), Paragraph("<code>word.learned</code>", body_style), Paragraph("Vrai dès que palier >= 1", body_style)],
        [Paragraph("<code>is_mastered</code>", body_style), Paragraph("boolean DEFAULT false", body_style), Paragraph("<code>word.isMastered</code>", body_style), Paragraph("Vrai lorsque palier == 10", body_style)],
        [Paragraph("<code>next_review_at</code>", body_style), Paragraph("timestamptz", body_style), Paragraph("<code>word.nextReviewAt</code>", body_style), Paragraph("Échéance ISO 8601 ou null", body_style)],
        [Paragraph("<code>last_reviewed_at</code>", body_style), Paragraph("timestamptz", body_style), Paragraph("<code>word.lastSrsReviewAt</code>", body_style), Paragraph("Horodatage de la dernière évaluation SRS", body_style)],
        [Paragraph("<code>last_answered</code>", body_style), Paragraph("timestamptz", body_style), Paragraph("<code>word.lastAnsweredAt</code>", body_style), Paragraph("Dernière réponse (tous modes confondus)", body_style)],
        [Paragraph("<code>last_correct</code>", body_style), Paragraph("boolean", body_style), Paragraph("<code>word.lastCorrect</code>", body_style), Paragraph("Dernier résultat booléen", body_style)],
        [Paragraph("<code>created_at</code> / <code>updated_at</code>", body_style), Paragraph("timestamptz DEFAULT now()", body_style), Paragraph("<code>word.createdAt</code>", body_style), Paragraph("Horodatages de suivi de synchronisation", body_style)]
    ]

    sql_table = Table(sql_mapping_data, colWidths=[120, 95, 125, 165])
    sql_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 1, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(sql_table)

    story.append(Spacer(1, 10))

    # ==================== SECTION 3 : ALGORITHME SRS ====================
    story.append(Paragraph("3. Spécification de l'Algorithme SRS & Moteur de Quiz", h1_style))
    story.append(Paragraph(
        "L'algorithme de Répétition Espacée repose sur 3 modes étanches, une progression initiale géométrique suivie d'une consolidation mensuelle étalée sur 5 mois et demi, ainsi qu'une politique de rétrogradation douce en cas d'erreur.",
        body_style
    ))

    story.append(Paragraph("A. Les 3 Modes de Quiz Explicites", h2_style))
    modes_data = [
        [
            Paragraph("<b>Mode de Quiz</b>", body_style),
            Paragraph("<b>Critère de sélection des mots</b>", body_style),
            Paragraph("<b>Impact sur le SRS & Échéances</b>", body_style)
        ],
        [
            Paragraph("<b>1. Révisions</b><br/>(<code>srs-review</code>)", body_style),
            Paragraph("Cartes au <b>Palier 1 à 9</b> dont la date d'échéance est atteinte :<br/><code>isReviewDue(word) === true</code>", body_style),
            Paragraph("<b>Impact direct :</b> Succès = promotion au palier suivant.<br/>Erreur = rétrogradation douce d'un palier avec revue urgente à J+1.", body_style)
        ],
        [
            Paragraph("<b>2. Apprentissage</b><br/>(<code>initial-learning</code>)", body_style),
            Paragraph("Cartes au <b>Palier 0</b> n'ayant pas encore validé 3 succès consécutifs (<code>learningSuccessCount &lt; 3</code>).", body_style),
            Paragraph("<b>Acquisition initiale :</b> Chaque bonne réponse ajoute +1★.<br/>3★ consécutives = passage immédiat au Palier 1 (J+1). Une erreur remet le compteur à 0★.", body_style)
        ],
        [
            Paragraph("<b>3. Entraînement Libre</b><br/>(<code>free-practice</code>)", body_style),
            Paragraph("<b>Toutes les cartes</b> de la base sans restriction, y compris les mots maîtrisés (Palier 10).", body_style),
            Paragraph("<b>Strictement NEUTRE :</b> Met à jour les stats globales et <code>lastAnswered</code>, mais ne modifie <b>jamais</b> le palier ni la date de révision.", body_style)
        ]
    ]
    modes_table = Table(modes_data, colWidths=[120, 185, 200])
    modes_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 1, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(modes_table)
    story.append(Spacer(1, 6))

    story.append(Paragraph("B. Échelle des 10 Paliers de Répétition Espacée", h2_style))
    srs_stages_data = [
        [Paragraph("<b>Palier</b>", body_style), Paragraph("<b>Nom & Label</b>", body_style), Paragraph("<b>Délai ajouté</b>", body_style), Paragraph("<b>Règle de validation / Condition de sortie</b>", body_style)],
        [Paragraph("<b>0</b>", body_style), Paragraph("En apprentissage", body_style), Paragraph("0 jour", body_style), Paragraph("3 victoires consécutives requises (<code>learningSuccessCount &gt;= 3</code>)", body_style)],
        [Paragraph("<b>1</b>", body_style), Paragraph("Palier 1 (J+1)", body_style), Paragraph("+1 jour", body_style), Paragraph("1ère révision validée le lendemain", body_style)],
        [Paragraph("<b>2</b>", body_style), Paragraph("Palier 2 (J+2)", body_style), Paragraph("+2 jours", body_style), Paragraph("2ème révision validée 2 jours plus tard", body_style)],
        [Paragraph("<b>3</b>", body_style), Paragraph("Palier 3 (J+4)", body_style), Paragraph("+4 jours", body_style), Paragraph("3ème révision validée 4 jours plus tard", body_style)],
        [Paragraph("<b>4</b>", body_style), Paragraph("Palier 4 (1 sem.)", body_style), Paragraph("+7 jours", body_style), Paragraph("4ème révision validée 1 semaine plus tard", body_style)],
        [Paragraph("<b>5</b>", body_style), Paragraph("Palier 5 (1 mois)", body_style), Paragraph("+30 jours", body_style), Paragraph("5ème révision validée 1 mois plus tard", body_style)],
        [Paragraph("<b>6</b>", body_style), Paragraph("Consolidation M2", body_style), Paragraph("+30 jours", body_style), Paragraph("Maintien mensuel (Mois 2 de consolidation)", body_style)],
        [Paragraph("<b>7</b>", body_style), Paragraph("Consolidation M3", body_style), Paragraph("+30 jours", body_style), Paragraph("Maintien mensuel (Mois 3 de consolidation)", body_style)],
        [Paragraph("<b>8</b>", body_style), Paragraph("Consolidation M4", body_style), Paragraph("+30 jours", body_style), Paragraph("Maintien mensuel (Mois 4 de consolidation)", body_style)],
        [Paragraph("<b>9</b>", body_style), Paragraph("Consolidation M5", body_style), Paragraph("+30 jours", body_style), Paragraph("Dernière révision mensuelle avant maîtrise définitive", body_style)],
        [Paragraph("<b>10</b>", body_style), Paragraph("<b>Maîtrisé 🏆</b>", body_style), Paragraph("<code>null</code> (Terminé)", body_style), Paragraph("<b>Cycle validé avec succès (~5 mois et demi) : acquis à vie</b>", body_style)],
    ]
    srs_table = Table(srs_stages_data, colWidths=[45, 120, 80, 260])
    srs_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 1, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(srs_table)
    story.append(Spacer(1, 6))

    story.append(Paragraph("C. Règles de Rétrogradation Douce en Cas d'Erreur (<code>calculateNextState</code>)", h2_style))
    story.append(Paragraph(
        "Pour éviter de décourager l'apprenant en réinitialisant à zéro des mots révisés depuis plusieurs mois, l'application applique la <b>rétrogradation douce (Option B)</b> :",
        body_style
    ))
    story.append(Paragraph("• <b>Erreur au Palier 0 :</b> Remise à zéro du compteur d'acquisition (<code>learningSuccessCount = 0</code>).", bullet_style))
    story.append(Paragraph("• <b>Erreur au Palier 1 :</b> Retour au Palier 0, compteur remis à 0, <code>learned = false</code>, <code>nextReviewAt = null</code>.", bullet_style))
    story.append(Paragraph("• <b>Erreur aux Paliers 2 à 9 :</b> Perte d'un palier unique (Stage N → N-1) avec révision urgente programmée à <b>J+1</b> (dès le lendemain).", bullet_style))
    story.append(Paragraph("• <b>Erreur au Palier 10 :</b> Aucune rétrogradation automatique par le SRS standard (statut de maîtrise définitive préservé).", bullet_style))

    story.append(Spacer(1, 6))
    story.append(Paragraph("D. Ordonnancement & Protection Anti-Répétition (<code>buildRoundQueue</code>)", h2_style))
    story.append(Paragraph(
        "La composition d'un tour de quiz suit 3 règles mathématiques rigoureuses :<br/>"
        "1. <b>Déduplication stricte :</b> Aucun mot ne peut figurer plus d'une fois dans la file active d'un round.<br/>"
        "2. <b>Priorisation :</b> Les révisions échues du jour sont mélangées (Fisher-Yates) et placées en tête de file, suivies des cartes en apprentissage.<br/>"
        "3. <b>Anti-répétition consécutive :</b> Si le premier mot tiré correspond au dernier mot répondu lors de la question précédente (dans un historique de récence à 2 entrées), il est automatiquement échangé avec le deuxième élément de la file (si N ≥ 2).",
        body_style
    ))

    story.append(Spacer(1, 10))

    # ==================== SECTION 4 : TOLÉRANCE LINGUISTIQUE ====================
    story.append(Paragraph("4. Moteur d'Évaluation & Tolérance Linguistique", h1_style))
    story.append(Paragraph(
        "L'évaluation d'une réponse utilisateur (<code>srsService.checkAnswer</code>) ne se contente pas d'un simple test d'égalité textuelle. Elle intègre un moteur de normalisation morphologique et syntaxique complet :",
        body_style
    ))

    tolerance_data = [
        [Paragraph("<b>Règle de Tolérance</b>", body_style), Paragraph("<b>Exemple Cible</b>", body_style), Paragraph("<b>Saisies Utilisateur Acceptées</b>", body_style)],
        [
            Paragraph("<b>Particule 'to' (Verbes)</b>", body_style),
            Paragraph("<code>To boast</code>", body_style),
            Paragraph("<code>boast</code>, <code>to boast</code>, <code>To Boast</code> (insensible casse et préfixe)", body_style)
        ],
        [
            Paragraph("<b>Articles 'a', 'an', 'the' (Noms)</b>", body_style),
            Paragraph("<code>A cradle</code>", body_style),
            Paragraph("<code>cradle</code>, <code>a cradle</code>, <code>the cradle</code> (articles ignorés)", body_style)
        ],
        [
            Paragraph("<b>Expressions avec articles</b>", body_style),
            Paragraph("<code>A piece of cake</code>", body_style),
            Paragraph("<code>piece of cake</code>, <code>a piece of cake</code>, <code>the piece of cake</code>", body_style)
        ],
        [
            Paragraph("<b>Pronoms impersonnels</b>", body_style),
            Paragraph("<code>To make up one's mind</code>", body_style),
            Paragraph("<code>make up your mind</code>, <code>make up one's mind</code>, <code>make up mind</code>", body_style)
        ],
        [
            Paragraph("<b>Pronoms réfléchis</b>", body_style),
            Paragraph("<code>To hurt oneself</code>", body_style),
            Paragraph("<code>hurt oneself</code>, <code>hurt yourself</code>, <code>hurt</code>, <code>to hurt oneself</code>", body_style)
        ],
        [
            Paragraph("<b>Parenthèses optionnelles</b>", body_style),
            Paragraph("<code>Give (someone) a hand</code>", body_style),
            Paragraph("<code>give someone a hand</code>, <code>give a hand</code>, <code>give hand</code>", body_style)
        ],
        [
            Paragraph("<b>Multi-réponses synonymes</b>", body_style),
            Paragraph("<code>Solicitor</code><br/>(accepted: lawyer, attorney)", body_style),
            Paragraph("<code>solicitor</code>, <code>lawyer</code>, <code>a lawyer</code>, <code>attorney</code> sont toutes validées", body_style)
        ]
    ]

    tol_table = Table(tolerance_data, colWidths=[130, 140, 235])
    tol_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 1, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(tol_table)

    story.append(Spacer(1, 10))

    # ==================== SECTION 5 : SYNCHRONISATION SUPABASE ====================
    story.append(Paragraph("5. Synchronisation Supabase & Temps Réel (Realtime)", h1_style))
    story.append(Paragraph(
        "La synchronisation repose sur la bibliothèque officielle Supabase JS (<code>@supabase/supabase-js</code>) couplée à un canal d'écoute WebSocket PostgreSQL Change Data Capture (CDC).",
        body_style
    ))
    story.append(Paragraph("• <b>Chargement optimiste au démarrage :</b> 1. Lecture synchrone LocalStorage (affichage instantané sans spinner). 2. Appel asynchrone <code>refreshFromSupabase()</code>. 3. Fusion non-destructrice si des mots ont été ajoutés hors-ligne.", bullet_style))
    story.append(Paragraph("• <b>Écoute Realtime :</b> Souscription au canal <code>postgres_changes</code> sur la table <code>words</code> (INSERT, UPDATE, DELETE). Chaque modification faite sur Mac est instantanément répercutée sur l'iPhone et inversement.", bullet_style))
    story.append(Paragraph("• <b>Jumelage iPhone en 1 Scan :</b> La méthode <code>syncService.getPairingUrl()</code> sérialise l'URL Supabase, la clé anon et la clé Gemini dans le hash URL : <code>#pair?url=...&key=...&gemini=...</code>. Le composant <code>qrcode.react</code> affiche le QR code dans l'onglet Réglages. L'iPhone scanne, charge l'URL, stocke les identifiants et nettoie l'URL sans exposer les clés dans les logs serveur.", bullet_style))
    story.append(Paragraph("• <b>Politiques de Sécurité (RLS) :</b> Row Level Security est activé sur les tables <code>words</code> et <code>quiz_stats</code> avec une stratégie publique ouverte (<code>for all using (true) with check (true)</code>) adaptée à un usage personnel ou familial sans gestion de comptes utilisateurs complexes.", bullet_style))

    story.append(Spacer(1, 10))

    # ==================== SECTION 6 : MOTEUR IA GEMINI ====================
    story.append(Paragraph("6. Moteur IA Google Gemini & Enrichissement Sémantique", h1_style))
    story.append(Paragraph(
        "L'application propose une intégration native de Google Gemini (gratuit via Google AI Studio) pour deux usages majeurs :",
        body_style
    ))
    story.append(Paragraph("1. <b>Ajout de vocabulaire avec détection intelligente :</b> À partir d'un mot ou d'une expression saisie, Gemini catégorise grammaticalement le terme, fournit de 1 à 4 traductions françaises équivalentes et génère une note explicative concise.", bullet_style))
    story.append(Paragraph("2. <b>Enrichissement par lot (Batch Context) :</b> Depuis l'onglet Réglages, l'utilisateur peut lancer la génération automatique des notes de contexte manquantes pour l'intégralité de sa base Supabase. Une pause de 400ms est injectée entre chaque appel pour respecter les quotas de l'API gratuite (15 RPM).", bullet_style))
    story.append(Paragraph("3. <b>Résilience & Fallback Automatique :</b> Si l'API Gemini est indisponible ou si les quotas sont dépassés, le service bascule instantanément et sans bloquer l'utilisateur sur le dictionnaire intégré gratuit (Wiktionary API + MyMemory).", bullet_style))

    story.append(Spacer(1, 10))

    # ==================== SECTION 7 : GUIDE D'AUDIT POUR L'IA ====================
    story.append(Paragraph("7. Guide d'Audit, Vulnérabilités Connues & Pistes de Correction pour l'IA", h1_style))
    story.append(Paragraph(
        "Cette section détaille les points critiques et faiblesses architecturales à inspecter en priorité lorsqu'un bug est signalé dans l'application :",
        body_style
    ))

    audit_points = [
        ("1. Dérive des colonnes Supabase (Migration SQL)", 
         "Si l'utilisateur a créé sa base avec un ancien script SQL, la colonne 'example_sentence' ou les colonnes SRS ('srs_stage', 'next_review_at', etc.) peuvent manquer. Lors des 'updateWord' ou 'migrateWords', Supabase renvoie une erreur silencieuse ou bloque l'écriture. Vérifier systématiquement que le script SQL de mise à jour a été exécuté dans Supabase."),
        
        ("2. Calcul des Dates d'Échéance & Fuseau Horaire", 
         "Le calcul de 'nextReviewAt' utilise 'date.setDate(date.getDate() + intervalDays)'. Dans 'isReviewDue', la comparaison se fait par 'reviewDate <= now'. Attention : si un utilisateur révise à 23h et qu'un mot passe à J+1, il est programmé pour 23h le lendemain et non à minuit. Pour un SRS calendaire strict, il peut être souhaitable d'aligner 'nextReviewAt' sur le début de journée (00:00:00)."),
        
        ("3. Conflits de Concurrence Local-First", 
         "Si deux appareils (Mac et iPhone) s'exercent simultanément hors-ligne, la synchronisation applique le principe du dernier écrit ('Last Write Wins' ou écrasement lors de refreshFromSupabase). Une fusion plus fine basée sur l'horodatage 'updated_at' au niveau de chaque mot préserverait les victoires acquises sur les deux terminaux."),
        
        ("4. Speech-to-Text sur iOS Safari", 
         "L'API SpeechRecognition sur iPhone nécessite 'webkitSpeechRecognition' et un contexte HTTPS sécurisé. Safari coupe parfois la session vocale si l'utilisateur ne clique pas directement sur le microphone (geste utilisateur requis)."),
        
        ("5. Nettoyage et Assainissement des Mots (Sanitization)", 
         "Certains mots importés de versions antérieures possédaient 'successCount' au lieu de 'learningSuccessCount'. La fonction 'srsService.sanitizeWord' effectue la rétrocompatibilité, mais toute nouvelle fonction manipulant les mots doit obligatoirement appeler 'sanitizeWord' pour garantir la présence de 'srsStage', 'learned' et 'isMastered'.")
    ]

    for title, desc in audit_points:
        callout_data = [[
            Paragraph(f"<b>⚠️ {title}</b>", ParagraphStyle("WTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.8, textColor=colors.HexColor("#991b1b"))),
        ], [
            Paragraph(desc, body_style)
        ]]
        callout_table = Table(callout_data, colWidths=[505])
        callout_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff1f2")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#fecdd3")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(callout_table)
        story.append(Spacer(1, 4))

    story.append(Spacer(1, 8))

    # ==================== SECTION 8 : PROMPT PRÊT À L'EMPLOI POUR L'AUTRE IA ====================
    story.append(Paragraph("8. Modèle de Prompt Prêt à l'Emploi pour Interroger une Autre IA", h1_style))
    story.append(Paragraph(
        "Vous pouvez copier-coller le prompt ci-dessous directement dans l'interface de l'IA (Claude, ChatGPT, etc.) en joignant ce fichier PDF pour poser votre question de diagnostic ou demander un correctif :",
        body_style
    ))

    prompt_template = """« Bonjour, je te fournis en pièce jointe le document de spécification technique de mon application React "Quiz Anglais" (contenant l'architecture complète, le schéma de données JS/Supabase et l'algorithme SRS à 10 paliers).

Voici le problème que je rencontre :
[DÉCRIS ICI LE PROBLÈME OU LE COMPORTEMENT INATTENDU, EXEMPLE :]
- Lorsqu'une carte au palier 3 reçoit une mauvaise réponse, elle devrait passer au palier 2 avec révision à J+1, mais j'observe [comportement observé].
- OU : Les notes de contexte générées par Gemini ne semblent pas enregistrées dans Supabase.
- OU : Le compteur de victoires consécutives au palier 0 ne s'incrémente pas correctement.

En t'appuyant strictement sur les règles et le modèle décrits dans le PDF :
1. Identifie la cause probable du problème dans le code (fichiers concernés : srsService.js, storageService.js, syncService.js ou QuizView.jsx).
2. Fournis le correctif de code exact et minimal à apporter.
3. Indique comment tester ou vérifier la correction (par ex. via un test unitaire dans tests/srs.test.js). »"""

    prompt_table = Table([[Paragraph(prompt_template.replace("\n", "<br/>").replace(" ", "&nbsp;"), code_style)]], colWidths=[505])
    prompt_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1e1b4b")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("BOX", (0, 0), (-1, -1), 1, SECONDARY),
    ]))
    story.append(prompt_table)

    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceBefore=2, spaceAfter=6))
    story.append(Paragraph(
        "<b>Fin du dossier technique d'architecture.</b> Document généré pour servir de spécification de référence pour l'application Quiz Anglais.",
        ParagraphStyle("EndDoc", parent=styles["Normal"], fontName="Helvetica-Oblique", fontSize=8, textColor=MUTED, alignment=1)
    ))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF généré avec succès : {output_filename}")


if __name__ == "__main__":
    out_pdf = "description_technique_application_quiz_anglais.pdf"
    if len(sys.argv) > 1:
        out_pdf = sys.argv[1]
    create_specification_pdf(out_pdf)
