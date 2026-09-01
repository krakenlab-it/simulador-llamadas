-- Round numbers used to be computed in the app as COUNT(turns) + 1 and then
-- inserted, so two POSTs for the same call raced and the loser hit
-- call_turns_call_attempt_id_round_number_key. Allocation now happens inside
-- one statement that locks the parent call_attempt, so the round number is
-- assigned atomically and a repeated submit is answered instead of rejected.

-- ---------------------------------------------------------------------------
-- Idempotency key: one id per user submit action, reused on retry
-- ---------------------------------------------------------------------------
ALTER TABLE call_turns ADD COLUMN IF NOT EXISTS client_turn_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_call_turns_attempt_client_turn
  ON call_turns (call_attempt_id, client_turn_id)
  WHERE client_turn_id IS NOT NULL;

COMMENT ON COLUMN call_turns.client_turn_id IS
  'Client-generated idempotency key; a retried submit returns the same turn.';

-- ---------------------------------------------------------------------------
-- Persist what the simulated client answered, so replaying a submitted turn
-- returns the same reply the trainee already heard.
-- ---------------------------------------------------------------------------
ALTER TABLE turn_scores
  ADD COLUMN IF NOT EXISTS client_reply TEXT,
  ADD COLUMN IF NOT EXISTS won BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN turn_scores.client_reply IS
  'Line the simulated client answered with; spoken back to the trainee.';

-- ---------------------------------------------------------------------------
-- Atomic round allocation
-- ---------------------------------------------------------------------------
-- Returns one row:
--   allocation_status = 'reserved'         -> turn_id/round_number are the slot to score
--                     | 'replay'           -> turn already scored, return it as-is
--                     | 'not_found'
--                     | 'not_in_progress'
--                     | 'rounds_exhausted'
-- A reserved turn has no turn_scores row yet. The caller scores it and then
-- fills in the round metadata, or deletes the reservation if scoring fails.
CREATE OR REPLACE FUNCTION allocate_call_turn(
  p_call_attempt_id UUID,
  p_utterance TEXT,
  p_client_turn_id UUID DEFAULT NULL,
  p_max_rounds INT DEFAULT 5,
  p_stale_after INTERVAL DEFAULT INTERVAL '90 seconds'
)
RETURNS TABLE (allocation_status TEXT, turn_id UUID, round_number SMALLINT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_attempt_status call_status;
  v_turn_id UUID;
  v_round SMALLINT;
  v_scored BOOLEAN;
  v_created_at TIMESTAMPTZ;
  v_next SMALLINT;
BEGIN
  -- Serializes concurrent submits for the same call; the lock is released at
  -- statement end, so no network call ever runs while it is held.
  SELECT ca.status INTO v_attempt_status
  FROM call_attempts ca
  WHERE ca.id = p_call_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::TEXT, NULL::UUID, NULL::SMALLINT;
    RETURN;
  END IF;

  IF v_attempt_status <> 'in_progress' THEN
    RETURN QUERY SELECT 'not_in_progress'::TEXT, NULL::UUID, NULL::SMALLINT;
    RETURN;
  END IF;

  IF p_client_turn_id IS NOT NULL THEN
    SELECT ct.id, ct.round_number, (ts.turn_id IS NOT NULL)
      INTO v_turn_id, v_round, v_scored
    FROM call_turns ct
    LEFT JOIN turn_scores ts ON ts.turn_id = ct.id
    WHERE ct.call_attempt_id = p_call_attempt_id
      AND ct.client_turn_id = p_client_turn_id;

    IF FOUND THEN
      IF v_scored THEN
        RETURN QUERY SELECT 'replay'::TEXT, v_turn_id, v_round;
      ELSE
        UPDATE call_turns ct
        SET trainee_utterance = p_utterance
        WHERE ct.id = v_turn_id;
        RETURN QUERY SELECT 'reserved'::TEXT, v_turn_id, v_round;
      END IF;
      RETURN;
    END IF;
  END IF;

  SELECT ct.id, ct.round_number, (ts.turn_id IS NOT NULL), ct.created_at
    INTO v_turn_id, v_round, v_scored, v_created_at
  FROM call_turns ct
  LEFT JOIN turn_scores ts ON ts.turn_id = ct.id
  WHERE ct.call_attempt_id = p_call_attempt_id
  ORDER BY ct.round_number DESC
  LIMIT 1;

  -- An unscored turn older than p_stale_after belongs to a request that died
  -- mid-scoring: reuse the slot so the abandoned row never burns a round.
  IF FOUND AND NOT v_scored AND v_created_at < now() - p_stale_after THEN
    UPDATE call_turns ct
    SET trainee_utterance = p_utterance,
        client_turn_id = COALESCE(p_client_turn_id, ct.client_turn_id),
        created_at = now()
    WHERE ct.id = v_turn_id;
    RETURN QUERY SELECT 'reserved'::TEXT, v_turn_id, v_round;
    RETURN;
  END IF;

  v_next := COALESCE(v_round, 0::SMALLINT) + 1;

  IF v_next > p_max_rounds THEN
    RETURN QUERY SELECT 'rounds_exhausted'::TEXT, NULL::UUID, NULL::SMALLINT;
    RETURN;
  END IF;

  INSERT INTO call_turns (call_attempt_id, round_number, trainee_utterance, client_turn_id)
  VALUES (p_call_attempt_id, v_next, p_utterance, p_client_turn_id)
  RETURNING id INTO v_turn_id;

  RETURN QUERY SELECT 'reserved'::TEXT, v_turn_id, v_next;
END;
$$;

COMMENT ON FUNCTION allocate_call_turn IS
  'Atomically reserves the next round_number for a call attempt, or replays an already scored turn.';
