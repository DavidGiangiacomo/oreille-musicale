-- Serveur de synchronisation d'Oreille musicale (docs/DESIGN.md §10.8).
-- Il ne garde que des blocs chiffrés : rien de lisible sur les utilisateurs.

-- Un dossier par clé de synchronisation, lié à l'empreinte SHA-256 de son jeton.
CREATE TABLE buckets (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Blocs chiffrés, en ajout seul : un identifiant déjà connu est ignoré, et chaque
-- nouveau bloc reçoit le numéro suivant de son dossier, pour la lecture incrémentale.
CREATE TABLE records (
  bucket TEXT NOT NULL,
  seq INTEGER NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (bucket, seq),
  UNIQUE (bucket, id)
);
