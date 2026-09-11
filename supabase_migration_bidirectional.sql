-- Migration Supabase pour le support bidirectionnel (Anglais -> Français)
-- Ce script est idempotent et préserve intégralement les données existantes.

ALTER TABLE words
  ADD COLUMN IF NOT EXISTS srs_stage_en_fr integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS success_count_en_fr integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS learned_en_fr boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_mastered_en_fr boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS next_review_at_en_fr timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_reviewed_at_en_fr timestamp with time zone,
  ADD COLUMN IF NOT EXISTS first_learned_at_en_fr timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_answered_en_fr timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_correct_en_fr boolean;

-- Commentaires explicatifs pour documentation
COMMENT ON COLUMN words.srs_stage_en_fr IS 'Palier SRS pour la direction Anglais -> Français (0 à 10)';
COMMENT ON COLUMN words.success_count_en_fr IS 'Nombre de succès consécutifs au palier 0 pour Anglais -> Français';
COMMENT ON COLUMN words.learned_en_fr IS 'Indique si le mot est passé au palier 1 ou plus en Anglais -> Français';
COMMENT ON COLUMN words.is_mastered_en_fr IS 'Indique si le mot a atteint le palier 10 en Anglais -> Français';
COMMENT ON COLUMN words.next_review_at_en_fr IS 'Prochaine date d''échéance de révision en Anglais -> Français';
COMMENT ON COLUMN words.last_reviewed_at_en_fr IS 'Date de dernière révision SRS validée en Anglais -> Français';
COMMENT ON COLUMN words.first_learned_at_en_fr IS 'Date de passage initial au palier 1 en Anglais -> Français';
COMMENT ON COLUMN words.last_answered_en_fr IS 'Date de la dernière tentative en Anglais -> Français';
COMMENT ON COLUMN words.last_correct_en_fr IS 'Résultat de la dernière tentative en Anglais -> Français';

-- Recharger immédiatement le cache de schéma Supabase (PostgREST)
NOTIFY pgrst, 'reload schema';

