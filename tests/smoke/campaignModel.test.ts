import { describe, expect, it } from "vitest";
import {
  computeCampaignRoi,
  isCampaignRunning,
  resolveCampaignStatus,
  validateCampaignDefinition,
} from "../../src/shared/campaignModel.js";

describe("campaignModel", () => {
  const now = new Date("2026-06-09T12:00:00Z");

  it("resolves status from flags and schedule", () => {
    expect(resolveCampaignStatus({ active: false, paused: false, startsAt: null, endsAt: null }, now)).toBe("DRAFT");
    expect(resolveCampaignStatus({ active: true, paused: true, startsAt: null, endsAt: null }, now)).toBe("PAUSED");
    expect(resolveCampaignStatus({ active: true, paused: false, startsAt: "2026-06-10T00:00:00Z", endsAt: null }, now)).toBe("SCHEDULED");
    expect(resolveCampaignStatus({ active: true, paused: false, startsAt: null, endsAt: "2026-06-08T00:00:00Z" }, now)).toBe("ENDED");
    expect(resolveCampaignStatus({ active: true, paused: false, startsAt: null, endsAt: null }, now)).toBe("ACTIVE");
  });

  it("detects running campaigns", () => {
    expect(isCampaignRunning({ active: true, paused: false, startsAt: null, endsAt: null }, now)).toBe(true);
    expect(isCampaignRunning({ active: true, paused: true, startsAt: null, endsAt: null }, now)).toBe(false);
  });

  it("computes ROI only with budget", () => {
    expect(computeCampaignRoi(5000, 1000)).toBe(5);
    expect(computeCampaignRoi(5000, 0)).toBeNull();
  });

  it("validates definitions", () => {
    expect(validateCampaignDefinition({ title: "" }).ok).toBe(false);
    expect(validateCampaignDefinition({ title: "x", budgetSom: -1 }).ok).toBe(false);
    expect(validateCampaignDefinition({ title: "x", startsAt: "2026-06-10", endsAt: "2026-06-01" }).ok).toBe(false);
    expect(validateCampaignDefinition({ title: "x", budgetSom: 1000 }).ok).toBe(true);
  });
});
