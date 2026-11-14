import { describe, expect, it } from "vitest";
import {
  dueDateIn,
  isValidEvery,
  monthsBetween,
  nextOccurrence,
  occurrencesFor,
  resolutionKey,
  scheduleLabel,
  type Resolutions,
} from "./recurring";

describe("When a Recurring is due", () => {
  it("counts months across years", () => {
    expect(monthsBetween("2026-11", "2026-12")).toBe(1);
    expect(monthsBetween("2026-11", "2027-02")).toBe(3);
    expect(monthsBetween("2026-11", "2026-10")).toBe(-1);
  });

  it("keeps the day of its first date, every N months from it", () => {
    expect(dueDateIn("2026-11-15", 1, "2026-11")).toBe("2026-11-15");
    expect(dueDateIn("2026-11-15", 1, "2027-01")).toBe("2027-01-15");
    expect(dueDateIn("2026-11-15", 1, "2026-10")).toBeNull();
    expect(dueDateIn("2026-11-15", 3, "2027-02")).toBe("2027-02-15");
    expect(dueDateIn("2026-11-15", 3, "2027-01")).toBeNull();
  });

  it("falls on the last day of a shorter month", () => {
    expect(dueDateIn("2026-11-30", 1, "2027-02")).toBe("2027-02-28");
    expect(dueDateIn("2027-01-31", 1, "2028-02")).toBe("2028-02-29");
    expect(dueDateIn("2027-01-31", 1, "2027-04")).toBe("2027-04-30");
  });

  it("repeats every 1 to 12 months", () => {
    expect(isValidEvery(1)).toBe(true);
    expect(isValidEvery(12)).toBe(true);
    expect(isValidEvery(0)).toBe(false);
    expect(isValidEvery(1.5)).toBe(false);
    expect(isValidEvery(13)).toBe(false);
  });

  it("says its schedule in words", () => {
    expect(scheduleLabel("2026-11-15", 1)).toBe("Every month on the 15th");
    expect(scheduleLabel("2026-11-01", 12)).toBe("Every 12 months on the 1st");
    expect(scheduleLabel("2026-11-22", 2)).toBe("Every 2 months on the 22nd");
    expect(scheduleLabel("2026-11-23", 1)).toBe("Every month on the 23rd");
    expect(scheduleLabel("2026-11-11", 1)).toBe("Every month on the 11th");
  });
});

describe("Occurrences of a month", () => {
  const pay = { id: "pay", firstDate: "2026-11-30", everyMonths: 1 };
  const internet = { id: "internet", firstDate: "2026-11-05", everyMonths: 1 };
  const soat = { id: "soat", firstDate: "2027-03-10", everyMonths: 12 };
  const none: Resolutions = new Map();

  it("is pending from its day and upcoming before it", () => {
    const list = occurrencesFor([pay, internet], none, "2026-11", "2026-11-14");
    expect(list.map((o) => [o.recurringId, o.state])).toEqual([
      ["internet", "pending"],
      ["pay", "upcoming"],
    ]);
  });

  it("stays pending in later months until it is settled, the oldest first", () => {
    const list = occurrencesFor([internet], none, "2027-01", "2027-01-03");
    expect(list.map((o) => [o.month, o.state])).toEqual([
      ["2026-11", "pending"],
      ["2026-12", "pending"],
      ["2027-01", "upcoming"],
    ]);
  });

  it("shows the settled ones of the month after the open ones", () => {
    const settled: Resolutions = new Map([
      [resolutionKey("internet", "2026-11"), "movement-1"],
      [resolutionKey("pay", "2026-11"), null],
    ]);
    const list = occurrencesFor([pay, internet], settled, "2026-11", "2026-12-01");
    expect(list).toEqual([
      { recurringId: "internet", month: "2026-11", due: "2026-11-05", state: "confirmed", movementId: "movement-1" },
      { recurringId: "pay", month: "2026-11", due: "2026-11-30", state: "skipped", movementId: null },
    ]);
  });

  it("looking at another month, shows only that month's", () => {
    const list = occurrencesFor([internet], none, "2026-12", "2027-01-03");
    expect(list.map((o) => o.month)).toEqual(["2026-12"]);
  });

  it("leaves out the months it isn't due", () => {
    expect(occurrencesFor([soat], none, "2026-11", "2026-11-14")).toEqual([]);
    expect(occurrencesFor([soat], none, "2027-03", "2027-03-01")[0]).toMatchObject({ due: "2027-03-10", state: "upcoming" });
  });

  it("knows the next one to settle", () => {
    const settled: Resolutions = new Map([[resolutionKey("internet", "2026-11"), "m"]]);
    expect(nextOccurrence(internet, settled)).toEqual({ month: "2026-12", due: "2026-12-05" });
    expect(nextOccurrence(soat, none)).toEqual({ month: "2027-03", due: "2027-03-10" });
  });
});
