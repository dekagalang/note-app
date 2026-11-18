const { migrate, loadMigrationFiles } = require('postgres-migrations');
const path = require('path');
const { pool } = require('./db');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const LEGACY_SCHEMA_VERSION = 16;

async function prepareMigrationTracking(client) {
  const { rows: [schema] } = await client.query(`
    SELECT
      to_regclass('public.migrations') IS NOT NULL AS has_public_tracking,
      to_regclass('storage.migrations') IS NOT NULL AS has_storage_tracking,
      to_regclass('public.notes') IS NOT NULL AS has_notes,
      (
        to_regclass('public.note_files') IS NOT NULL AND
        to_regclass('public.note_sketches') IS NOT NULL AND
        to_regclass('public.pending_mirror_deletes') IS NOT NULL AND
        to_regclass('public.note_links_note_id_url_uidx') IS NOT NULL AND
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'note_sketches' AND column_name = 'thumbnail_dark') AND
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'note_links' AND column_name = 'fetched_at') AND
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'note_attachments' AND column_name = 'is_local') AND
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'note_images' AND column_name = 'storage_path')
      ) AS has_legacy_schema
  `);

  if (schema.has_public_tracking) return;
  if (!schema.has_storage_tracking && !schema.has_notes) return;
  if (schema.has_notes && !schema.has_legacy_schema) {
    throw new Error('Existing notes schema is not at the known migration baseline; refusing to replay old migrations.');
  }

  await client.query(`
    CREATE TABLE public.migrations (
      id integer PRIMARY KEY,
      name varchar(100) UNIQUE NOT NULL,
      hash varchar(40) NOT NULL,
      executed_at timestamp DEFAULT current_timestamp
    )
  `);

  if (!schema.has_notes) return;

  // Supabase's storage.migrations table shadows the app's missing tracker. The
  // schema markers above confirm the restored dump already includes migrations 1-16.
  const migrations = await loadMigrationFiles(MIGRATIONS_DIR);
  for (const migration of migrations.filter(({ id }) => id <= LEGACY_SCHEMA_VERSION)) {
    await client.query(
      'INSERT INTO public.migrations (id, name, hash) VALUES ($1, $2, $3)',
      [migration.id, migration.name, migration.hash]
    );
  }
}

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO public, extensions');
    await prepareMigrationTracking(client);
    console.log('[migrations] Running pending migrations...');
    const results = await migrate({ client }, MIGRATIONS_DIR);
    if (results.length === 0) {
      console.log('[migrations] No pending migrations.');
    } else {
      results.forEach(r => console.log(`[migrations] Applied: ${r.fileName}`));
    }
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
