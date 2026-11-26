import assert from "node:assert/strict";
import { test } from "node:test";

import {
  actionCounts,
  adsManagerUrl,
  audienceSummary,
  budgetFromMeta,
  campaignKind,
  deliveryState,
} from "./campaign-kind";
import { buildRecommendations, type RecAd, type RecCampaign } from "./recommendations";

test("campaignKind reads the ad set destination before the objective", () => {
  assert.equal(campaignKind("OUTCOME_LEADS", [{ optimizationGoal: "LEAD_GENERATION", destinationType: "ON_AD" }]), "FORMULARIO");
  assert.equal(campaignKind("OUTCOME_ENGAGEMENT", [{ optimizationGoal: "CONVERSATIONS", destinationType: "WHATSAPP" }]), "WHATSAPP");
  assert.equal(
    campaignKind("OUTCOME_ENGAGEMENT", [{ optimizationGoal: "CONVERSATIONS", destinationType: "MESSAGING_MESSENGER_WHATSAPP" }]),
    "MENSAJES",
  );
  assert.equal(campaignKind("OUTCOME_ENGAGEMENT", [{ optimizationGoal: "POST_ENGAGEMENT", destinationType: "ON_POST" }]), "INTERACCION");
  assert.equal(campaignKind("OUTCOME_TRAFFIC"), "TRAFICO");
  assert.equal(campaignKind(null), "OTRO");
});

test("deliveryState collapses effective_status", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  assert.equal(deliveryState({ effectiveStatus: "ACTIVE", now }), "ACTIVA");
  assert.equal(deliveryState({ effectiveStatus: "CAMPAIGN_PAUSED", now }), "PAUSADA");
  assert.equal(deliveryState({ effectiveStatus: "DISAPPROVED", now }), "PROBLEMAS");
  assert.equal(deliveryState({ effectiveStatus: "ACTIVE", learningStatus: "LEARNING", now }), "APRENDIZAJE");
  assert.equal(deliveryState({ effectiveStatus: "ACTIVE", startTime: "2026-12-01T00:00:00Z", now }), "PROGRAMADA");
  assert.equal(deliveryState({ effectiveStatus: "ACTIVE", stopTime: "2026-11-01T00:00:00Z", now }), "TERMINADA");
});

test("actionCounts picks one alias per metric", () => {
  const counts = actionCounts([
    { action_type: "lead", value: "3" },
    { action_type: "onsite_conversion.lead_grouped", value: "3" },
    { action_type: "link_click", value: "12" },
    { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "2" },
  ]);
  assert.deepEqual(counts, { linkClicks: 12, metaLeads: 3, conversations: 2 });
  assert.deepEqual(actionCounts(undefined), { linkClicks: 0, metaLeads: 0, conversations: 0 });
});

test("budget, audience and ads manager link", () => {
  assert.equal(budgetFromMeta("500"), 5);
  assert.equal(budgetFromMeta("0"), null);
  assert.equal(audienceSummary({ age_min: 18, age_max: 65, geo_locations: { countries: ["EC"] } }), "18–65+ · Ecuador");
  assert.match(adsManagerUrl("act_123", "9"), /act=123&selected_campaign_ids=9/);
});

const base: RecCampaign = {
  id: "c1",
  name: "Leads",
  state: "ACTIVA",
  kind: "FORMULARIO",
  hasBudget: true,
  spendLast2Days: 10,
  spend7: 35,
  leads7: 5,
  spend30: 150,
  leads30: 25,
  frequency7: 1.4,
};

test("recommendations fire on their numbers and stay quiet otherwise", () => {
  assert.deepEqual(buildRecommendations({ campaigns: [base], adSets: [], ads: [], metaLeads30: 25, crmLeads30: 25 }), []);

  const recs = buildRecommendations({
    campaigns: [{ ...base, spendLast2Days: 0, frequency7: 3.4, spend7: 70, leads7: 5 }],
    adSets: [{ id: "s1", name: "S", campaignId: "c1", learningStatus: "FAIL", active: true }],
    ads: [],
    metaLeads30: 30,
    crmLeads30: 25,
  });
  const ids = recs.map((rec) => rec.id);
  assert.ok(ids.includes("no-spend-c1"));
  assert.ok(ids.includes("frequency-c1"));
  assert.ok(ids.includes("cpl-c1"));
  assert.ok(ids.includes("learning-s1"));
  assert.ok(ids.includes("lost-leads"));
  assert.equal(recs[0].level, "alta");
});

test("ad rules: low CTR against siblings, unqualified leads, best ad", () => {
  const ad = (id: string, clicks: number, extra: Partial<RecAd> = {}): RecAd => ({
    id,
    name: id,
    campaignId: "c1",
    adSetId: "s1",
    state: "ACTIVA",
    impressions: 2000,
    clicks,
    spend: 20,
    leads: 0,
    qualified: 0,
    ...extra,
  });
  const recs = buildRecommendations({
    campaigns: [],
    adSets: [],
    ads: [ad("a", 40), ad("b", 38), ad("c", 8, { leads: 6 }), ad("d", 40, { qualified: 3, leads: 4 })],
    metaLeads30: 0,
    crmLeads30: 0,
  });
  const ids = recs.map((rec) => rec.id);
  assert.ok(ids.includes("ctr-c"));
  assert.ok(!ids.includes("ctr-a"));
  assert.ok(ids.includes("quality-c"));
  assert.equal(recs.at(-1)?.id, "winner-d");
});

import { parsePeriod, recentMonths } from "./period";

test("parsePeriod: days, month in progress, free range", () => {
  const today = "2026-11-26";
  const def = parsePeriod({}, today);
  assert.equal(def.since, "2026-10-28");
  assert.equal(def.days, 30);
  assert.deepEqual(def.previous, { since: "2026-09-28", until: "2026-10-27" });

  const month = parsePeriod({ mes: "2026-11" }, today);
  assert.equal(month.since, "2026-11-01");
  assert.equal(month.until, "2026-11-26");
  assert.deepEqual(month.previous, { since: "2026-10-01", until: "2026-10-26" });

  const closed = parsePeriod({ mes: "2026-10" }, today);
  assert.deepEqual([closed.since, closed.until], ["2026-10-01", "2026-10-31"]);
  assert.deepEqual(closed.previous, { since: "2026-09-01", until: "2026-09-30" });

  assert.equal(parsePeriod({ mes: "2027-01" }, today).kind, "dias");
  const custom = parsePeriod({ desde: "2026-11-10", hasta: "2026-12-31" }, today);
  assert.deepEqual([custom.since, custom.until, custom.days], ["2026-11-10", "2026-11-26", 17]);
  assert.deepEqual(recentMonths(today, 3), ["2026-11", "2026-10", "2026-09"]);
});
