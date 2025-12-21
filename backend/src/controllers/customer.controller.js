import { prisma } from "../utils/prisma.js";

export const getAllCustomers = async (req, res) => {
  try {
    const customers = await prisma.recipients.findMany({
      select: {
        id: true,
        name: true,
        street: true,
        zip: true,
        city: true,
        email: true,
        phone: true,
      },
      orderBy: { name: "asc" },
    });

    res.json(customers);
  } catch (err) {
    console.error("Fehler beim Laden der Kunden:", err);
    res.status(500).json({ error: "Fehler beim Abrufen der Kunden" });
  }
};

export const createCustomer = async (req, res) => {
  const { name, street, zip, city, email, phone } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Name ist erforderlich" });
  }

  try {
    const result = await prisma.recipients.create({
      data: {
        name,
        street,
        zip,
        city,
        email,
        phone,
      },
      select: { id: true },
    });

    res.status(201).json({ id: result.id });
  } catch (err) {
    console.error("Fehler beim Erstellen des Kunden:", err);
    res.status(500).json({ error: "Fehler beim Erstellen des Kunden" });
  }
};

export const updateCustomer = async (req, res) => {
  const id = Number(req.params.id);
  const { name, street, zip, city, email, phone } = req.body;

  if (!id) return res.status(400).json({ message: "Ungültige Kunden-ID" });

  try {
    await prisma.recipients.update({
      where: { id },
      data: {
        name,
        street,
        zip,
        city,
        email,
        phone,
      },
    });

    res.json({ message: "Kunde aktualisiert" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Kunde nicht gefunden." });
    }
    console.error("Fehler beim Aktualisieren des Kunden:", err);
    res.status(500).json({ error: "Fehler beim Aktualisieren des Kunden" });
  }
};

export const deleteCustomer = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Ungültige Kunden-ID" });

  try {
    const invoiceCount = await prisma.invoices.count({
      where: { recipient_id: id },
    });

    if (invoiceCount > 0) {
      return res.status(400).json({
        message: "Kunde kann nicht gelöscht werden, es existieren noch Rechnungen.",
      });
    }

    await prisma.recipients.deleteMany({
      where: { id },
    });

    res.json({ message: "Kunde gelöscht" });
  } catch (err) {
    console.error("Fehler beim Löschen des Kunden:", err);
    res.status(500).json({ error: "Fehler beim Löschen des Kunden" });
  }
};
