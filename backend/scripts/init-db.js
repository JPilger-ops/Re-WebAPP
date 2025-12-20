import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../src/utils/db.js";
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, "../schema.sql");
const migrationsDir = path.join(__dirname, "../migrations");
const MIGRATIONS_TABLE = "schema_migrations";
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || "admin";

const tableExists = async (tableName) => {
  const result = await db.query("SELECT to_regclass($1) AS oid", [`public.${tableName}`]);
  return Boolean(result.rows[0]?.oid);
};

const ensureBaseSchema = async () => {
  const hasRecipients = await tableExists("recipients");
  if (hasRecipients) {
    return;
  }

  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  console.log("Applying base schema from schema.sql ...");
  await db.query("BEGIN");
  try {
    await db.query(schemaSql);
    await db.query("COMMIT");
    console.log("Base schema created.");
  } catch (error) {
    await db.query("ROLLBACK");
    throw new Error(`Failed to apply schema.sql: ${error.message}`);
  }
};

const ensureMigrationsTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const applyPendingMigrations = async () => {
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const filename of migrationFiles) {
    const alreadyApplied = await db.query(
      `SELECT 1 FROM ${MIGRATIONS_TABLE} WHERE filename = $1`,
      [filename]
    );

    if (alreadyApplied.rowCount) {
      continue;
    }

    const migrationSql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
    console.log(`Applying migration ${filename} ...`);
    await db.query("BEGIN");
    try {
      await db.query(migrationSql);
      await db.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES ($1)`,
        [filename]
      );
      await db.query("COMMIT");
      console.log(`Migration ${filename} applied.`);
    } catch (error) {
      await db.query("ROLLBACK");
      throw new Error(`Failed to apply migration ${filename}: ${error.message}`);
    }
  }
};

const ensureUserColumns = async () => {
  await db.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id)
  `);
};

const seedAdmin = async () => {
  // Rollen sicherstellen
  const rolesResult = await db.query(`
    INSERT INTO roles (name, description)
    VALUES ('admin','Voller Zugriff'), ('user','Standardnutzer')
    ON CONFLICT (name) DO NOTHING
    RETURNING id, name
  `);

  const adminRole = await db.query("SELECT id FROM roles WHERE name = 'admin'");
  const adminRoleId = adminRole.rows[0]?.id;

  if (!adminRoleId) {
    throw new Error("admin Rolle konnte nicht ermittelt werden.");
  }

  // Permissions für Admin
  await db.query(`
    INSERT INTO role_permissions (role_id, permission_key)
    SELECT $1, p.perm
    FROM (VALUES
      ('categories.read'),
      ('categories.write'),
      ('categories.delete'),
      ('settings.general'),
      ('stats.view')
    ) AS p(perm)
    ON CONFLICT (role_id, permission_key) DO NOTHING
  `, [adminRoleId]);

  // Admin-User nur anlegen, wenn nicht vorhanden
  const existingAdmin = await db.query("SELECT id FROM users WHERE username = 'admin'");
  if (existingAdmin.rowCount === 0) {
    const hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    await db.query(
      `INSERT INTO users (username, password_hash, role, role_id, is_active)
       VALUES ('admin', $1, 'admin', $2, true)`,
      [hash, adminRoleId]
    );
    console.log("Admin-User angelegt (admin /", DEFAULT_ADMIN_PASSWORD, ")");
  }
};

const main = async () => {
  try {
    await ensureBaseSchema();
    await ensureMigrationsTable();
    await applyPendingMigrations();
    await ensureUserColumns();
    await seedAdmin();
    console.log("Database is up-to-date.");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  } finally {
    await db.end();
  }
};

main();
