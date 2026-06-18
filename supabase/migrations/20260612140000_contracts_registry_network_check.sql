-- Align network CHECK with NexOps publish payloads (chipnet / mainnet / legacy testnet).
ALTER TABLE public.contracts_registry DROP CONSTRAINT IF EXISTS contracts_registry_network_check;

ALTER TABLE public.contracts_registry
  ADD CONSTRAINT contracts_registry_network_check
  CHECK (network IN ('chipnet', 'mainnet', 'testnet'));
