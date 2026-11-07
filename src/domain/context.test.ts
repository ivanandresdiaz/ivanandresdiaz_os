import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import {
  categoryState,
  contextSize,
  defaultSelection,
  isPicked,
  parseSelection,
  renderContext,
  searchContext,
  toggleCategory,
  toggleItem,
  visibleItems,
  type ContextCampaign,
  type ContextSelection,
  type ContextSource,
} from "./context";

const campaign = (id: string, status: ContextCampaign["status"], title: string): ContextCampaign => ({
  id,
  title,
  status,
  quarter: status === "candidate" ? null : "Q4 2026",
  seasonGoal: "Make 30,000",
  blockType: "Side hustle",
  games: ["Craft", "Wealth"],
  goal: `${title} goal`,
  why: "Because it frees my time",
  antiGoal: "",
  moves: [
    {
      title: `${title} first Move`,
      done: false,
      weekOf: "2026-11-02",
      description: "Start with the login.\nThen the roles.",
      links: [{ title: "Docs", url: "https://example.com/docs" }],
      tasks: [
        {
          id: `${id}-t`,
          title: "Configure Google provider",
          done: true,
          description: "",
          steps: [{ title: "Create the client id", done: true }],
          links: [],
          games: [],
        },
      ],
    },
  ],
});

/** 40 written Journals, newest first: 2026-11-07 back to 2026-09-29. */
const journals = Array.from({ length: 40 }, (_, i) => ({ date: addDays("2026-11-07", -i), text: `Journal number ${i}` }));

const source: ContextSource = {
  today: "2026-11-07",
  quarter: { label: "Q4 2026", title: "Ship", body: "Ship Ivan OS and the side hustle." },
  season: { title: "Faithful to me", body: "Working in microfinance.", startedOn: "2026-11-01", goals: ["Make 30,000"] },
  principles: [
    { id: "p1", title: "From the inside out", expansion: "Change starts within." },
    { id: "p2", title: "Play for inputs", expansion: "" },
  ],
  campaigns: [
    campaign("c1", "active", "Build Ivan OS"),
    campaign("c2", "candidate", "Learn to sail"),
    campaign("c3", "done", "Deploy Mi Tierra"),
  ],
  looseTasks: [
    { id: "lt1", title: "Renew passport", done: false, description: "", steps: [], links: [], games: ["Soul"] },
  ],
  week: {
    weekOf: "2026-11-02",
    moves: [{ title: "SSO login", done: false, campaign: "Build Ivan OS" }],
    highlights: [{ date: "2026-11-07", title: "Define the roles table", why: "It unblocks the API.", done: false }],
  },
  journals,
  learning: [
    { id: "l1", date: "2026-11-07", title: "Roles before permissions", expansion: "The model comes first." },
    { id: "l2", date: "2026-09-01", title: "A forgotten idea about sailing schools", expansion: "" },
  ],
  reviews: [{ weekOf: "2026-11-02", feltScore: 7, notes: "Good focus.", moves: ["SSO login"] }],
  structure: [{ weekday: 1, startMin: 480, endMin: 720, type: "Deep work for the company", kind: "container" }],
};

const take = (selection: ContextSelection, key: Parameters<typeof toggleCategory>[2]) =>
  toggleCategory(source, selection, key);

describe("A Context", () => {
  it("starts with only the opening line and How my OS works", () => {
    const md = renderContext(source, defaultSelection());
    expect(md).toContain("# Context about me");
    expect(md).toContain("Today is Saturday, 2026-11-07.");
    expect(md).toContain('the Season "Faithful to me", Q4 2026, the week of 2026-11-02');
    expect(md).toContain("## How my OS works");
    expect(md).not.toContain("## Season:");
    expect(md).not.toContain("## Journals");
  });

  it("takes a whole category, with every detail of its Campaigns", () => {
    const md = renderContext(source, take(defaultSelection(), "quarter"));
    expect(md).toContain("## This Quarter: Q4 2026 — Ship");
    expect(md).toContain("### Build Ivan OS");
    expect(md).toContain('serves the Season Goal "Make 30,000"');
    expect(md).toContain("**Goal:** Build Ivan OS goal");
    expect(md).toContain("- [ ] **Build Ivan OS first Move** (week of 2026-11-02)");
    expect(md).toContain("  Start with the login.\n  Then the roles.");
    expect(md).toContain("  - Link: [Docs](https://example.com/docs)");
    expect(md).toContain("  - [x] Configure Google provider");
    expect(md).toContain("    - [x] Create the client id");
    expect(md).not.toContain("Learn to sail");
  });

  it("keeps candidates in the Backlog and done or dropped ones in Past Campaigns", () => {
    let selection = take(defaultSelection(), "backlog");
    selection = take(selection, "past");
    const md = renderContext(source, selection);
    expect(md).toContain("### Candidate Campaigns");
    expect(md).toContain("#### Learn to sail");
    expect(md).toContain("- [ ] Renew passport (Soul)");
    expect(md).toContain("## Past Campaigns\n\n### Deploy Mi Tierra");
  });

  it("takes only the last N written Journals", () => {
    let selection = take(defaultSelection(), "journals");
    selection = { ...selection, counts: { ...selection.counts, journals: 21 } };
    expect(visibleItems(source, selection, "journals")).toHaveLength(21);
    const md = renderContext(source, selection);
    expect(md.match(/^### .*\d{4}-\d{2}-\d{2}$/gm)).toHaveLength(21);
    expect(md).toContain("### Saturday, 2026-11-07\n\nJournal number 0");
    expect(md).not.toContain("Journal number 21");
  });

  it("picks one piece alone, and the category shows half-picked", () => {
    const selection = toggleItem(source, defaultSelection(), "learning", "l2");
    expect(categoryState(source, selection, "learning")).toBe("some");
    const md = renderContext(source, selection);
    expect(md).toContain("### A forgotten idea about sailing schools (2026-09-01)");
    expect(md).not.toContain("Roles before permissions");
  });

  it("drops one piece from a whole category", () => {
    let selection = take(defaultSelection(), "principles");
    expect(categoryState(source, selection, "principles")).toBe("on");
    selection = toggleItem(source, selection, "principles", "p2");
    expect(categoryState(source, selection, "principles")).toBe("some");
    expect(isPicked(source, selection, "principles", "p2")).toBe(false);
    const md = renderContext(source, selection);
    expect(md).toContain("### 1. From the inside out\n\nChange starts within.");
    expect(md).not.toContain("Play for inputs");
    // Checking a half-picked category takes all of it; checking it again empties it.
    selection = take(selection, "principles");
    expect(categoryState(source, selection, "principles")).toBe("on");
    selection = take(selection, "principles");
    expect(categoryState(source, selection, "principles")).toBe("off");
  });

  it("adds an older Journal found by search on top of the last N", () => {
    let selection = take(defaultSelection(), "journals");
    selection = { ...selection, counts: { ...selection.counts, journals: 3 } };
    const old = source.journals[30];
    const found = searchContext(source, old.text);
    expect(found.map((f) => f.item.id)).toContain(old.date);
    selection = toggleItem(source, selection, "journals", old.date);
    expect(visibleItems(source, selection, "journals")).toHaveLength(4);
    expect(isPicked(source, selection, "journals", old.date)).toBe(true);
    // Unpicking it takes it out without touching the last N.
    selection = toggleItem(source, selection, "journals", old.date);
    expect(visibleItems(source, selection, "journals")).toHaveLength(3);
    expect(categoryState(source, selection, "journals")).toBe("on");
  });

  it("searches every category by all the words of the query", () => {
    const found = searchContext(source, "sailing forgotten");
    expect(found.map((f) => [f.key, f.item.id])).toEqual([["learning", "l2"]]);
    expect(searchContext(source, "  ")).toEqual([]);
  });

  it("ends with what Ivan wants to talk about", () => {
    const md = renderContext(source, { ...defaultSelection(), topic: "  Help me revive this idea  " });
    expect(md.trimEnd().endsWith("## What I want to talk about\n\nHelp me revive this idea")).toBe(true);
  });

  it("writes the week, the Reviews, the Season and the Structure", () => {
    let selection = defaultSelection();
    for (const key of ["season", "week", "reviews", "structure"] as const) selection = take(selection, key);
    const md = renderContext(source, selection);
    expect(md).toContain("## Season: Faithful to me\n\nStarted on 2026-11-01.\n\nWorking in microfinance.");
    expect(md).toContain("- [ ] SSO login (Build Ivan OS)");
    expect(md).toContain("- 2026-11-07: [ ] Define the roles table\n  It unblocks the API.");
    expect(md).toContain("### Week of 2026-11-02: felt 7/10");
    expect(md).toContain("Moves chosen for the week of 2026-11-09: SSO login");
    expect(md).toContain("### Monday\n\n- 08:00–12:00 Deep work for the company (Container)");
  });

  it("reads back a remembered selection, and falls back on anything broken", () => {
    const selection = toggleItem(source, take(defaultSelection(), "season"), "learning", "l1");
    const back = parseSelection(JSON.stringify({ ...selection, counts: { journals: 21, learning: "x", reviews: 0 } }));
    expect(back.categories.season.all).toBe(true);
    expect(back.categories.learning.only).toEqual(["l1"]);
    expect(back.counts).toEqual({ journals: 21, learning: 30, reviews: 1 });
    expect(parseSelection("{not json")).toEqual(defaultSelection());
    expect(parseSelection("")).toEqual(defaultSelection());
  });

  it("leaves out a category turned on with nothing in it", () => {
    const empty: ContextSource = { ...source, journals: [], campaigns: source.campaigns.filter((c) => c.status !== "done") };
    let selection = take(defaultSelection(), "journals");
    selection = take(selection, "past");
    const md = renderContext(empty, selection);
    expect(md).not.toContain("## Journals");
    expect(md).not.toContain("## Past Campaigns");
  });

  it("nests the headings of Ivan's own text below the section they sit in", () => {
    const withHeadings: ContextSource = {
      ...source,
      journals: [{ date: "2026-11-07", text: "# Morning\nCalm.\n```\n# a comment\n```" }],
    };
    const md = renderContext(withHeadings, { ...take(defaultSelection(), "journals"), topic: "## Plan\nHelp" });
    expect(md).toContain("### Saturday, 2026-11-07\n\n#### Morning\nCalm.\n```\n# a comment\n```");
    expect(md).toContain("## What I want to talk about\n\n#### Plan\nHelp");
  });

  it("counts its words and roughly its tokens", () => {
    expect(contextSize("one two  three\nfour")).toEqual({ words: 4, tokens: 5 });
  });

  it("leaves out a category with nothing to give", () => {
    const empty = { ...source, journals: [], campaigns: [] };
    let selection = toggleCategory(empty, defaultSelection(), "journals");
    selection = toggleCategory(empty, selection, "past");
    selection = toggleCategory(empty, selection, "quarter");
    const md = renderContext(empty, selection);
    expect(md).not.toContain("## Journals");
    expect(md).not.toContain("## Past Campaigns");
    expect(md).toContain("## This Quarter: Q4 2026 — Ship\n\nShip Ivan OS and the side hustle.\n\nNo active Campaign picked.");
  });
});
