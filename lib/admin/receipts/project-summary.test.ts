import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type SummaryMilestoneInput,
  summarizeProjectMilestones,
} from "@/lib/admin/receipts/project-summary";

const CUTOFF = new Date("2026-11-27T00:00:00.000Z");
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

const base: SummaryMilestoneInput = {
  id: "x",
  title: "Hito",
  description: null,
  status: "PLANNED",
  amount: "0",
  paidAmount: "0",
  withheldAmount: "0",
  dueDate: null,
  invoice: null,
};

describe("project statement summary", () => {
  const summary = summarizeProjectMilestones(
    [
      { ...base, id: "a", title: "Anticipo", status: "PAID", amount: "500.00", paidAmount: "490.00", withheldAmount: "10.00", dueDate: day("2026-09-01"), invoice: { invoiceNumber: "001-001-000000001" } },
      { ...base, id: "b", title: "Entrega 1", status: "PARTIALLY_PAID", amount: "300.00", paidAmount: "100.00", dueDate: day("2026-11-20") },
      { ...base, id: "c", title: "Entrega 2", status: "INVOICED", amount: "200.00", paidAmount: "50.00", dueDate: day("2026-12-15") },
      { ...base, id: "d", title: "Cierre", amount: "150.50" },
      { ...base, id: "e", title: "Extra cancelado", status: "CANCELLED", amount: "999.00", paidAmount: "0" },
    ],
    CUTOFF,
  );

  it("adds up the project leaving cancelled milestones out", () => {
    assert.equal(summary.milestones.length, 4);
    assert.equal(summary.valueCents, 115050);
    assert.equal(summary.paidCents, 64000);
    assert.equal(summary.withheldCents, 1000);
    assert.equal(summary.balanceCents, 115050 - 64000 - 1000);
  });

  it("reads each milestone's standing at the cutoff, not its stored status", () => {
    assert.deepEqual(
      summary.milestones.map((m) => [m.id, m.standing]),
      [
        ["a", "PAID"],
        ["b", "OVERDUE"],
        ["c", "PARTIAL"],
        ["d", "PENDING"],
      ],
    );
    assert.equal(summary.milestones[1].daysOverdue, 7);
    assert.equal(summary.milestones[2].daysOverdue, -18);
    assert.equal(summary.milestones[0].invoiceNumber, "001-001-000000001");
  });

  it("counts as overdue only the open balance past its due date", () => {
    assert.equal(summary.overdueCents, 20000);
  });

  it("treats withholdings as covering the milestone", () => {
    assert.equal(summary.milestones[0].balanceCents, 0);
  });

  it("handles a project with no milestones", () => {
    const empty = summarizeProjectMilestones([], CUTOFF);
    assert.equal(empty.valueCents, 0);
    assert.equal(empty.milestones.length, 0);
  });
});
