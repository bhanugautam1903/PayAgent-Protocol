const { parse } = require("csv-parse/sync");

const analyzeSalesCsv = (fileBuffer) => {
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new Error("A valid, non-empty CSV file is required");
  }

  let records;

  try {
    records = parse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (error) {
    throw new Error(`Invalid CSV file: ${error.message}`);
  }

  if (!records.length) {
    throw new Error("The CSV file contains no sales records");
  }

  const requiredColumns = ["date", "product", "quantity", "unitPrice"];
  const availableColumns = Object.keys(records[0]);

  const missingColumns = requiredColumns.filter(
    (column) => !availableColumns.includes(column)
  );

  if (missingColumns.length) {
    throw new Error(
      `Missing required CSV columns: ${missingColumns.join(", ")}`
    );
  }

  let totalRevenue = 0;
  let totalQuantity = 0;

  const productStats = {};
  const monthlyStats = {};

  records.forEach((record, index) => {
    const rowNumber = index + 2;

    const date = record.date;
    const product = record.product;
    const quantity = Number(record.quantity);
    const unitPrice = Number(record.unitPrice);

    if (
      !date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
    ) {
      throw new Error(
        `Invalid date at CSV row ${rowNumber}. Use YYYY-MM-DD.`
      );
    }

    if (!product || !product.trim()) {
      throw new Error(`Missing product name at CSV row ${rowNumber}`);
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Invalid quantity at CSV row ${rowNumber}`);
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Invalid unitPrice at CSV row ${rowNumber}`);
    }

    const revenue = quantity * unitPrice;
    const month = date.slice(0, 7);

    totalRevenue += revenue;
    totalQuantity += quantity;

    if (!productStats[product]) {
      productStats[product] = {
        product,
        quantitySold: 0,
        revenue: 0,
      };
    }

    productStats[product].quantitySold += quantity;
    productStats[product].revenue += revenue;

    if (!monthlyStats[month]) {
      monthlyStats[month] = {
        month,
        revenue: 0,
        quantitySold: 0,
      };
    }

    monthlyStats[month].revenue += revenue;
    monthlyStats[month].quantitySold += quantity;
  });

  const topProducts = Object.values(productStats)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((item) => ({
      ...item,
      revenue: Number(item.revenue.toFixed(2)),
    }));

  const monthlyTrends = Object.values(monthlyStats)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((item, index, array) => {
      const previousMonth = array[index - 1];

      const growthPercentage =
        previousMonth && previousMonth.revenue > 0
          ? Number(
              (
                ((item.revenue - previousMonth.revenue) /
                  previousMonth.revenue) *
                100
              ).toFixed(2)
            )
          : null;

      return {
        ...item,
        revenue: Number(item.revenue.toFixed(2)),
        growthPercentage,
      };
    });

  const insights = [];
  const recommendations = [];

  const bestProduct = topProducts[0];

  if (bestProduct) {
    insights.push(
      `${bestProduct.product} is the highest-revenue product, generating $${bestProduct.revenue.toFixed(2)}.`
    );

    recommendations.push(
      `Focus marketing efforts on ${bestProduct.product} because it generates the highest revenue.`
    );
  }

  const bestMonth = [...monthlyTrends].sort(
    (a, b) => b.revenue - a.revenue
  )[0];

  if (bestMonth) {
    insights.push(
      `${bestMonth.month} recorded the highest monthly revenue of $${bestMonth.revenue.toFixed(2)}.`
    );
  }

  const increasingMonths = monthlyTrends.filter(
    (month) =>
      month.growthPercentage !== null &&
      month.growthPercentage > 0
  ).length;

  const decreasingMonths = monthlyTrends.filter(
    (month) =>
      month.growthPercentage !== null &&
      month.growthPercentage < 0
  ).length;

  if (increasingMonths > decreasingMonths) {
    insights.push(
      "Revenue increased in more months than it decreased."
    );

    recommendations.push(
      "Study the factors behind revenue growth and repeat successful sales strategies."
    );
  } else if (decreasingMonths > increasingMonths) {
    insights.push(
      "Revenue decreased in more months than it increased."
    );

    recommendations.push(
      "Investigate declining monthly revenue and review pricing, demand, and marketing strategies."
    );
  }

  if (topProducts.length > 1) {
    recommendations.push(
      "Review the performance of lower-revenue products to identify opportunities for improvement."
    );
  }

  const report = [
    "SALES DATA ANALYSIS REPORT",
    "==========================",
    `Total Revenue: $${totalRevenue.toFixed(2)}`,
    `Total Units Sold: ${totalQuantity}`,
    `Products Analyzed: ${Object.keys(productStats).length}`,
    `Sales Records Analyzed: ${records.length}`,
    "",
    "TOP-SELLING PRODUCTS",
    ...topProducts.map(
      (item, index) =>
        `${index + 1}. ${item.product}: ${item.quantitySold} units, $${item.revenue.toFixed(2)} revenue`
    ),
    "",
    "MONTHLY SALES TRENDS",
    ...monthlyTrends.map(
      (item) =>
        `${item.month}: $${item.revenue.toFixed(2)} revenue, ${item.quantitySold} units sold`
    ),
    "",
    "KEY INSIGHTS",
    ...insights.map((item) => `- ${item}`),
    "",
    "RECOMMENDATIONS",
    ...recommendations.map((item) => `- ${item}`),
  ].join("\n");

  return {
    summary: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalQuantity,
      totalProducts: Object.keys(productStats).length,
      totalRecords: records.length,
      currency: "USD",
    },
    topProducts,
    monthlyTrends,
    insights,
    recommendations,
    report,
  };
};

module.exports = { analyzeSalesCsv };

