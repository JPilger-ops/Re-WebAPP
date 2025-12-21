import { prisma } from "../utils/prisma.js";

export const getRoles = async (req, res) => {
  const roles = await prisma.roles.findMany({
    orderBy: { id: "asc" },
  });
  res.json(roles);
};

export const getRolePermissions = async (req, res) => {
  const role_id = Number(req.params.id);

  const perms = await prisma.role_permissions.findMany({
    where: { role_id },
    select: { permission_key: true },
  });

  res.json(perms.map((x) => x.permission_key));
};

export const createRole = async (req, res) => {
  const { name, description, permissions } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    const role = await tx.roles.create({
      data: {
        name,
        description,
      },
    });

    if (Array.isArray(permissions) && permissions.length) {
      await tx.role_permissions.createMany({
        data: permissions.map((perm) => ({
          role_id: role.id,
          permission_key: perm,
        })),
        skipDuplicates: true,
      });
    }

    return role;
  });

  res.json(result);
};

export const updateRole = async (req, res) => {
  const role_id = Number(req.params.id);
  const { name, description, permissions } = req.body;

  await prisma.$transaction(async (tx) => {
    await tx.roles.update({
      where: { id: role_id },
      data: { name, description },
    });

    await tx.role_permissions.deleteMany({
      where: { role_id },
    });

    if (Array.isArray(permissions) && permissions.length) {
      await tx.role_permissions.createMany({
        data: permissions.map((perm) => ({
          role_id,
          permission_key: perm,
        })),
        skipDuplicates: true,
      });
    }
  });

  res.json({ message: "Rolle aktualisiert." });
};

export const deleteRole = async (req, res) => {
  const role_id = Number(req.params.id);

  await prisma.roles.delete({
    where: { id: role_id },
  });

  res.json({ message: "Rolle gelöscht." });
};
