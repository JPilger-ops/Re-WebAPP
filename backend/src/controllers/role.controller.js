import { db } from "../utils/db.js";

export const getRoles = async (req, res) => {
  const roles = await db.query("SELECT * FROM roles ORDER BY id ASC");
  res.json(roles.rows);
};

export const getRolePermissions = async (req, res) => {
  const role_id = req.params.id;

  const perms = await db.query(
    "SELECT permission_key FROM role_permissions WHERE role_id = $1",
    [role_id]
  );

  res.json(perms.rows.map(x => x.permission_key));
};

export const createRole = async (req, res) => {
  const { name, description, permissions } = req.body;

  const role = await db.query(
    "INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *",
    [name, description]
  );

  for (const perm of permissions) {
    await db.query(
      "INSERT INTO role_permissions (role_id, permission_key) VALUES ($1, $2)",
      [role.rows[0].id, perm]
    );
  }

  res.json(role.rows[0]);
};

export const updateRole = async (req, res) => {
  const role_id = req.params.id;
  const { name, description, permissions } = req.body;

  await db.query(
    "UPDATE roles SET name = $1, description = $2 WHERE id = $3",
    [name, description, role_id]
  );

  await db.query("DELETE FROM role_permissions WHERE role_id = $1", [role_id]);

  for (const perm of permissions) {
    await db.query(
      "INSERT INTO role_permissions (role_id, permission_key) VALUES ($1, $2)",
      [role_id, perm]
    );
  }

  res.json({ message: "Rolle aktualisiert." });
};

export const deleteRole = async (req, res) => {
  const role_id = req.params.id;

  await db.query("DELETE FROM roles WHERE id = $1", [role_id]);

  res.json({ message: "Rolle gelöscht." });
};