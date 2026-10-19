import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  NO_PROJECT,
  checkInvoiceTotals,
  invoiceBreakdown,
  receivableBalanceCents,
  summarize,
  type SummaryInput,
} from "@/lib/admin/finance/calc";
import { fromCents, percentOfCents, sumCents, toCents } from "@/lib/admin/finance/money";

function input(overrides: Partial<SummaryInput> = {}): SummaryInput {
  return {
    projects: [],
    invoices: [],
    payments: [],
    receivables: [],
    expensesRegistered: [],
    expensesPaid: [],
    withholdings: [],
    openWithholdings: [],
    ...overrides,
  };
}

const expense = (
  projectId: string | null,
  amount: string,
  status: "PAID" | "PENDING",
  extra: { payeeKind?: string; categoryName?: string; taxAmount?: string } = {},
) => ({
  projectId,
  amount,
  status,
  taxAmount: extra.taxAmount ?? null,
  payeeKind: extra.payeeKind ?? null,
  categoryName: extra.categoryName ?? null,
});

describe("money", () => {
  it("parses decimal strings into exact cents", () => {
    assert.equal(toCents("1234.56"), 123456);
    assert.equal(toCents("10,5"), 1050);
    assert.equal(toCents("0.005"), 1);
    assert.equal(toCents("-2.345"), -235);
    assert.equal(toCents(null), 0);
    assert.equal(toCents(""), 0);
    assert.equal(toCents({ toString: () => "99.90" }), 9990);
  });

  it("adds without floating point drift", () => {
    assert.equal(0.1 + 0.2 === 0.3, false);
    assert.equal(fromCents(sumCents(["0.1", "0.2"], (v) => v)), "0.30");
  });

  it("formats cents back to a decimal string", () => {
    assert.equal(fromCents(5), "0.05");
    assert.equal(fromCents(-1999), "-19.99");
  });

  it("rounds percentages to the cent", () => {
    assert.equal(percentOfCents(toCents("33.33"), "15"), 500); // 4.9995
    assert.equal(percentOfCents(toCents("100"), "0"), 0);
  });
});

describe("invoiceBreakdown", () => {
  it("computes IVA 15%", () => {
    assert.deepEqual(invoiceBreakdown({ subtotal: "1000", vatRate: "15" }), {
      base: "1000.00",
      iva: "150.00",
      total: "1150.00",
    });
  });

  it("computes IVA 0%", () => {
    assert.deepEqual(invoiceBreakdown({ subtotal: "850.40", vatRate: "0" }), {
      base: "850.40",
      iva: "0.00",
      total: "850.40",
    });
  });

  it("does not invent a rate when none is recorded", () => {
    assert.deepEqual(invoiceBreakdown({ subtotal: "100", vatRate: null }), {
      base: "100.00",
      iva: null,
      total: null,
    });
  });

  it("checks stored totals", () => {
    assert.deepEqual(
      checkInvoiceTotals({ subtotal: "100", taxAmount: "15", total: "115" }),
      { complete: true, difference: "0.00" },
    );
    assert.deepEqual(
      checkInvoiceTotals({ subtotal: "100", taxAmount: "15", total: "114.50" }),
      { complete: true, difference: "-0.50" },
    );
    assert.deepEqual(
      checkInvoiceTotals({ subtotal: null, taxAmount: null, total: "115" }),
      { complete: false, difference: null },
    );
  });
});

describe("receivable balance", () => {
  it("tracks partial payments and never goes negative", () => {
    assert.equal(receivableBalanceCents("500", "0"), 50000);
    assert.equal(receivableBalanceCents("500", "200.50"), 29950);
    assert.equal(receivableBalanceCents("500", "600"), 0);
  });
});

describe("summarize", () => {
  const projects = [
    { id: "p1", name: "Web", clientName: "ACME", budget: "2000" },
    { id: "p2", name: "App", clientName: "Beta", budget: null },
  ];

  const data = input({
    projects,
    invoices: [
      { projectId: "p1", status: "SENT", subtotal: "1000", taxAmount: "150", total: "1150" },
      { projectId: "p1", status: "CANCELLED", subtotal: "500", taxAmount: "75", total: "575" },
      { projectId: "p2", status: "PAID", subtotal: null, taxAmount: null, total: "300" },
    ],
    payments: [
      { projectId: "p1", amount: "400" },
      { projectId: "p1", amount: "200.25" },
      { projectId: "p2", amount: "300" },
    ],
    receivables: [
      { projectId: "p1", amount: "1150", paidAmount: "600.25", status: "PARTIALLY_PAID" },
      { projectId: "p2", amount: "300", paidAmount: "300", status: "PAID" },
      { projectId: "p1", amount: "999", paidAmount: "0", status: "CANCELLED" },
    ],
    expensesRegistered: [
      expense("p1", "100", "PAID", { payeeKind: "COLLABORATOR", categoryName: "Pagos a colaboradores" }),
      expense("p1", "50", "PENDING", { categoryName: "Servicios", taxAmount: "6.52" }),
      expense(null, "20", "PAID", { categoryName: "Herramientas de software" }),
    ],
    expensesPaid: [
      expense("p1", "100", "PAID", { payeeKind: "COLLABORATOR" }),
      expense(null, "20", "PAID"),
      // Registered last period, paid in this one.
      expense("p2", "30", "PAID"),
    ],
    withholdings: [
      { projectId: "p1", kind: "VAT", amount: "45" },
      { projectId: "p1", kind: "INCOME", amount: "27.50" },
    ],
    openWithholdings: [{ projectId: "p1", kind: "VAT", amount: "45" }],
  });

  const result = summarize(data);

  it("keeps contracted, invoiced and collected apart", () => {
    assert.equal(result.overall.contracted, "2000.00");
    assert.equal(result.overall.invoiced, "1450.00"); // cancelled excluded
    assert.equal(result.overall.collected, "900.25");
    assert.equal(result.overall.receivableBalance, "549.75"); // paid/cancelled excluded
  });

  it("does not count withholdings as money received", () => {
    assert.equal(result.overall.withheld, "72.50");
    assert.equal(result.overall.withheldVat, "45.00");
    assert.equal(result.overall.withheldIncome, "27.50");
    assert.equal(result.overall.collected, "900.25");
    assert.equal(result.overall.receivableBalanceNetOfWithholdings, "504.75");
  });

  it("separates pending expenses from paid ones", () => {
    assert.equal(result.overall.expensesRegistered, "170.00");
    assert.equal(result.overall.expensesRegisteredPaid, "120.00");
    assert.equal(result.overall.expensesPending, "50.00");
    assert.equal(result.overall.collaboratorPayments, "100.00");
    assert.equal(result.overall.expensesTax, "6.52");
  });

  it("computes net cash flow from effective movements only", () => {
    assert.equal(result.overall.expensesPaidInPeriod, "150.00");
    assert.equal(result.overall.netCashFlow, "750.25");
  });

  it("flags the margin when an invoice has no base", () => {
    assert.equal(result.overall.invoicesWithoutBreakdown, 1);
    assert.equal(result.overall.marginIncomplete, true);
    assert.equal(result.overall.invoicedBase, "1300.00");
    assert.equal(result.overall.marginEstimate, "1130.00");

    const p1 = result.rows.find((r) => r.key === "p1")!;
    assert.equal(p1.figures.marginIncomplete, false);
    assert.equal(p1.figures.marginEstimate, "850.00");
  });

  it("never double counts between project rows and the overall total", () => {
    const keys = [
      "invoiced",
      "collected",
      "receivableBalance",
      "expensesRegistered",
      "expensesPending",
      "expensesPaidInPeriod",
      "withheld",
      "netCashFlow",
    ] as const;

    for (const key of keys) {
      const fromRows = result.rows.reduce((s, r) => s + toCents(r.figures[key]), 0);
      assert.equal(fromCents(fromRows), result.overall[key], key);
    }

    const none = result.rows.find((r) => r.key === NO_PROJECT)!;
    assert.equal(none.figures.expensesRegistered, "20.00");
  });

  it("groups registered expenses by category", () => {
    assert.deepEqual(result.byCategory, [
      { name: "Pagos a colaboradores", amount: "100.00" },
      { name: "Servicios", amount: "50.00" },
      { name: "Herramientas de software", amount: "20.00" },
    ]);
  });

  it("returns zeros for an empty selection", () => {
    const empty = summarize(input());
    assert.equal(empty.overall.netCashFlow, "0.00");
    assert.equal(empty.overall.marginIncomplete, false);
  });
});
