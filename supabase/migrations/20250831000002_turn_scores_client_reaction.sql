-- Add client reaction tier to turn scores (bien | medio | mal)
ALTER TABLE turn_scores
ADD COLUMN client_reaction TEXT CHECK (client_reaction IN ('bien', 'medio', 'mal'));

COMMENT ON COLUMN turn_scores.client_reaction IS 'Client reply tier from scenario reactions based on round score.';
