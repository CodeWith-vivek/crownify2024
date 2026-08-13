const { resolveReportRange, describeRange } = require("../../src/shared/utils/reportRange");

describe("resolveReportRange", () => {
  test("monthly range includes the entire last day of the month (regression)", () => {
    // Historically this excluded orders placed on the last day of the
    // month because the end boundary was midnight on that day, not 23:59:59.
    const now = new Date(2026, 1, 15); // Feb 2026 (28 days, non-leap)
    const range = resolveReportRange("monthly", null, null, now);
    expect(range.end.getDate()).toBe(28);
    expect(range.end.getHours()).toBe(23);
    expect(range.end.getMinutes()).toBe(59);
  });

  test("yearly range includes all of Dec 31 (regression)", () => {
    const now = new Date(2026, 5, 1);
    const range = resolveReportRange("yearly", null, null, now);
    expect(range.end.getMonth()).toBe(11);
    expect(range.end.getDate()).toBe(31);
    expect(range.end.getHours()).toBe(23);
  });

  test("daily range covers the whole day regardless of current time", () => {
    const now = new Date(2026, 5, 10, 14, 32, 7);
    const range = resolveReportRange("daily", null, null, now);
    expect(range.start.getHours()).toBe(0);
    expect(range.end.getHours()).toBe(23);
    expect(range.start.getDate()).toBe(10);
  });

  test("custom range requires both dates", () => {
    const range = resolveReportRange("custom", null, "2026-01-31");
    expect(range.error).toMatch(/required/i);
  });

  test("custom range rejects start after end", () => {
    const range = resolveReportRange("custom", "2026-02-01", "2026-01-01");
    expect(range.error).toMatch(/before/i);
  });

  test("custom range end boundary includes the whole selected end day", () => {
    const range = resolveReportRange("custom", "2026-01-01", "2026-01-15");
    expect(range.end.getDate()).toBe(15);
    expect(range.end.getHours()).toBe(23);
  });

  test("unknown type returns an error", () => {
    const range = resolveReportRange("nonsense");
    expect(range.error).toMatch(/invalid/i);
  });
});

describe("describeRange", () => {
  test("formats a label with the capitalized type and both dates", () => {
    const now = new Date(2026, 0, 15);
    const range = resolveReportRange("monthly", null, null, now);
    const label = describeRange("monthly", range);
    expect(label).toMatch(/^Monthly:/);
    expect(label).toContain("Jan");
  });
});
