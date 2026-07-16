-- Add Supabase-compatible local fallback metadata for note attachments.
ALTER TABLE public.note_attachments
  ADD COLUMN IF NOT EXISTS is_local BOOLEAN DEFAULT true NOT NULL;
