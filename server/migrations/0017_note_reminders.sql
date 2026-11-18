ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_notes_active_reminders
  ON public.notes (reminder_at)
  WHERE reminder_enabled = TRUE AND is_deleted = FALSE AND reminder_at IS NOT NULL;