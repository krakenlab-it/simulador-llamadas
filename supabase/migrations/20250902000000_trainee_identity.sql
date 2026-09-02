-- Durable trainee identity for the post-login call dashboard (KLM-51).
-- Email is the light gate already on main; keep one trainee row per inbox.

CREATE UNIQUE INDEX IF NOT EXISTS trainees_email_lower_uidx
  ON trainees (lower(email))
  WHERE email IS NOT NULL;

COMMENT ON INDEX trainees_email_lower_uidx IS
  'One trainee per email so call history and persisted scorecards survive refresh.';
