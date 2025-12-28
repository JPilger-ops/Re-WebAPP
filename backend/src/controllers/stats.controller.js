import { db } from "../utils/db.js";

const toNumber = (val) => (val === null || val === undefined ? 0 : Number(val));

export const getInvoiceStats = async (req, res) => {
  try {
    const yearParam = req.query.year ? Number.parseInt(req.query.year, 10) : null;
    if (req.query.year && (Number.isNaN(yearParam) || yearParam < 1900 || yearParam > 9999)) {
      return res.status(400).json({ message: "Ungültiger year-Parameter." });
    }

    const categoryParam = typeof req.query.category === "string" ? req.query.category : null;
    const categoryList = categoryParam
      ? Array.from(new Set(
        categoryParam
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      ))
      : null;

    const filters = [];
    const values = [];

    if (yearParam) {
      values.push(yearParam);
      filters.push(`EXTRACT(YEAR FROM i.date)::int = $${values.length}`);
    }

    if (categoryList && categoryList.length) {
      values.push(categoryList);
      filters.push(`i.category = ANY($${values.length})`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const overallResult = await db.query(
      `
      SELECT
        COUNT(*) AS count_invoices,
        SUM(COALESCE(gross_total, 0)) AS sum_total_gross,
        SUM(COALESCE(net_19, 0) + COALESCE(net_7, 0)) AS sum_total_net,
        SUM(COALESCE(vat_19, 0) + COALESCE(vat_7, 0)) AS sum_tax,
        COUNT(*) FILTER (WHERE status_paid_at IS NOT NULL) AS paid_count,
        COUNT(*) FILTER (WHERE status_paid_at IS NULL) AS unpaid_count,
        COUNT(*) FILTER (WHERE status_sent IS TRUE AND status_paid_at IS NULL) AS sent_unpaid_count,
        SUM(COALESCE(gross_total, 0)) FILTER (WHERE status_paid_at IS NOT NULL) AS paid_sum,
        SUM(COALESCE(gross_total, 0)) FILTER (WHERE status_paid_at IS NULL) AS unpaid_sum,
        SUM(COALESCE(gross_total, 0)) FILTER (WHERE status_paid_at IS NULL) AS outstanding_sum,
        SUM(COALESCE(gross_total, 0)) FILTER (WHERE status_sent IS TRUE AND status_paid_at IS NULL) AS sent_unpaid_sum,
        AVG(COALESCE(gross_total, 0)) AS avg_invoice_value
      FROM invoices i
      ${whereClause}
      `,
      values
    );

    const byYearResult = await db.query(
      `
      SELECT
        EXTRACT(YEAR FROM i.date)::int AS year,
        COUNT(*) AS count,
        SUM(COALESCE(gross_total, 0)) AS sum_total,
        SUM(COALESCE(gross_total, 0)) FILTER (WHERE status_paid_at IS NOT NULL) AS paid_sum,
        SUM(COALESCE(gross_total, 0)) FILTER (WHERE status_paid_at IS NULL) AS unpaid_sum,
        SUM(COALESCE(gross_total, 0)) FILTER (WHERE status_paid_at IS NULL) AS outstanding_sum,
        SUM(COALESCE(gross_total, 0)) FILTER (WHERE status_sent IS TRUE AND status_paid_at IS NULL) AS sent_unpaid_sum,
        AVG(COALESCE(gross_total, 0)) AS avg_value,
        SUM(COALESCE(net_19, 0) + COALESCE(net_7, 0)) AS sum_net,
        SUM(COALESCE(vat_19, 0) + COALESCE(vat_7, 0)) AS sum_tax,
        COUNT(*) FILTER (WHERE status_paid_at IS NOT NULL) AS paid_count,
        COUNT(*) FILTER (WHERE status_paid_at IS NULL) AS unpaid_count
      FROM invoices i
      ${whereClause}
      GROUP BY year
      ORDER BY year DESC
      `,
      values
    );

    const byMonthResult = await db.query(
      `
      SELECT
        EXTRACT(YEAR FROM i.date)::int AS year,
        EXTRACT(MONTH FROM i.date)::int AS month,
        COUNT(*) AS count,
        SUM(COALESCE(gross_total, 0)) AS sum_total,
        SUM(COALESCE(gross_total, 0)) FILTER (WHERE status_paid_at IS NOT NULL) AS paid_sum,
        SUM(COALESCE(gross_total, 0)) FILTER (WHERE status_paid_at IS NULL) AS unpaid_sum,
        SUM(COALESCE(gross_total, 0)) FILTER (WHERE status_sent IS TRUE AND status_paid_at IS NULL) AS sent_unpaid_sum
      FROM invoices i
      ${whereClause}
      GROUP BY year, month
      ORDER BY year DESC, month DESC
      `,
      values
    );

    const categoriesResult = await db.query(`
      SELECT DISTINCT
        i.category AS key,
        COALESCE(c.label, i.category) AS label
      FROM invoices i
      LEFT JOIN invoice_categories c ON c.key = i.category
      WHERE i.category IS NOT NULL
      ORDER BY label ASC
    `);

    const topCustomersResult = await db.query(
      `
      SELECT
        r.name AS name,
        SUM(COALESCE(i.gross_total, 0)) AS sum_total,
        COUNT(*) AS count
      FROM invoices i
      LEFT JOIN recipients r ON r.id = i.recipient_id
      ${whereClause ? whereClause.replace("WHERE", "WHERE") : ""}
      GROUP BY r.name
      ORDER BY sum_total DESC NULLS LAST
      LIMIT 5
      `,
      values
    );

    const topCategoriesResult = await db.query(
      `
      SELECT
        COALESCE(c.label, i.category) AS label,
        i.category AS key,
        SUM(COALESCE(i.gross_total, 0)) AS sum_total,
        COUNT(*) AS count
      FROM invoices i
      LEFT JOIN invoice_categories c ON c.key = i.category
      ${whereClause ? whereClause.replace("WHERE", "WHERE") : ""}
      GROUP BY i.category, c.label
      ORDER BY sum_total DESC NULLS LAST
      LIMIT 5
      `,
      values
    );

    const overallRow = overallResult.rows[0] || {};
    const overall = {
      count: Number(overallRow.count_invoices) || 0,
      sum_total: toNumber(overallRow.sum_total_gross),
      sum_net: toNumber(overallRow.sum_total_net),
      sum_tax: toNumber(overallRow.sum_tax),
      paid_count: Number(overallRow.paid_count) || 0,
      unpaid_count: Number(overallRow.unpaid_count) || 0,
      sent_unpaid_count: Number(overallRow.sent_unpaid_count) || 0,
      paid_sum: toNumber(overallRow.paid_sum),
      unpaid_sum: toNumber(overallRow.unpaid_sum),
      outstanding_sum: toNumber(overallRow.outstanding_sum),
      sent_unpaid_sum: toNumber(overallRow.sent_unpaid_sum),
      avg_value: toNumber(overallRow.avg_invoice_value),
      currency: "EUR",
    };

    const byYear = byYearResult.rows.map((row) => ({
      year: row.year,
      count: Number(row.count) || 0,
      sum_total: toNumber(row.sum_total),
      sum_net: toNumber(row.sum_net),
      sum_tax: toNumber(row.sum_tax),
      paid_sum: toNumber(row.paid_sum),
      unpaid_sum: toNumber(row.unpaid_sum),
      outstanding_sum: toNumber(row.outstanding_sum),
      sent_unpaid_sum: toNumber(row.sent_unpaid_sum),
      paid_count: Number(row.paid_count) || 0,
      unpaid_count: Number(row.unpaid_count) || 0,
      avg_value: toNumber(row.avg_value),
      currency: "EUR",
    }));

    const byMonth = byMonthResult.rows.map((row) => ({
      year: Number(row.year),
      month: Number(row.month),
      count: Number(row.count) || 0,
      sum_total: toNumber(row.sum_total),
      paid_sum: toNumber(row.paid_sum),
      unpaid_sum: toNumber(row.unpaid_sum),
      sent_unpaid_sum: toNumber(row.sent_unpaid_sum),
    }));

    const categories = categoriesResult.rows.map((row) => ({
      key: row.key,
      label: row.label || row.key
    }));

    const topCustomers = topCustomersResult.rows.map((row) => ({
      name: row.name || "Unbekannt",
      sum_total: toNumber(row.sum_total),
      count: Number(row.count) || 0,
    }));

    const topCategories = topCategoriesResult.rows.map((row) => ({
      key: row.key,
      label: row.label || row.key,
      sum_total: toNumber(row.sum_total),
      count: Number(row.count) || 0,
    }));

    return res.json({ overall, byYear, byMonth, categories, topCustomers, topCategories });
  } catch (err) {
    console.error("Fehler beim Berechnen der Rechnungsstatistik:", err);
    return res.status(500).json({ message: "Fehler beim Berechnen der Statistik." });
  }
};
