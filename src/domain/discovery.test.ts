import { describe, expect, it } from "vitest";
import {
  answersXml,
  BRIEF_TEMPLATE,
  discoveryMarkdown,
  displayOptions,
  glossaryKeywords,
  handoffMessage,
  HANDOFF_BUTTON,
  interviewStatusLabel,
  maskSensitive,
  nextStage,
  nextTheme,
  stepsDone,
  themeRound,
  themeSteps,
  pdfPageCount,
  quoteFound,
  type Round,
  roundState,
  shuffled,
  slugify,
  stagesFor,
  tidyRound,
  validateAttachment,
  verifyInsights,
} from "./discovery";

const round: Round = {
  intro: "Hola, Mauricio.",
  privacy_note: null,
  questions: [
    {
      id: "n1q1",
      purpose: "fact",
      text: "¿Cada cuánto revisas la mora?",
      hint: null,
      answer: "one",
      options: [
        { id: "a", label: "Todos los días", origin: "scale" },
        { id: "b", label: "Una vez por semana", origin: "scale" },
      ],
    },
    { id: "n1q2", purpose: "story", text: "Cuéntame la última vez.", hint: null, answer: "open", options: [] },
  ],
  understood: [],
  notes: { learned: [], open_threads: [], next: "" },
  wrap_up: false,
};

describe("Discovery addresses", () => {
  it("makes a readable slug", () => {
    expect(slugify("Gestor de cartera v2")).toBe("gestor-de-cartera-v2");
    expect(slugify("  Visión ¡Ñandú! ")).toBe("vision-nandu");
    expect(slugify("¿?")).toBe("discovery");
  });
});

describe("Stages", () => {
  it("goes Needs first, then Vision, as asked", () => {
    expect(stagesFor({ wantsNeeds: true, wantsVision: true })).toEqual(["needs", "vision"]);
    expect(stagesFor({ wantsNeeds: false, wantsVision: true })).toEqual(["vision"]);
    expect(nextStage({ wantsNeeds: true, wantsVision: true }, "needs")).toBe("vision");
    expect(nextStage({ wantsNeeds: true, wantsVision: false }, "needs")).toBeNull();
  });

  it("says where an Interview is", () => {
    expect(interviewStatusLabel(null, ["needs"])).toBe("Not started");
    expect(interviewStatusLabel({ stage: "needs", round: 2, phase: "answering" }, ["needs"])).toBe("round 2/3");
    expect(interviewStatusLabel({ stage: "vision", round: 1, phase: "thinking" }, ["needs", "vision"])).toBe(
      "Vision · round 1/2",
    );
    expect(interviewStatusLabel({ stage: "vision", round: 2, phase: "done" }, ["vision"])).toBe("Done");
  });
});

describe("The Brief's glossary", () => {
  it("takes the terms under How people say things", () => {
    const brief = `## Company\nAlgo: no\n\n## How people say things\n- franja: tramo de días de mora\n- **Corresponsal** — punto de pago\n- comité (los lunes): reunión\n\n## The system today\nX: y`;
    expect(glossaryKeywords(brief)).toEqual(["franja", "Corresponsal", "comité"]);
  });

  it("finds nothing in the empty template", () => {
    expect(glossaryKeywords(BRIEF_TEMPLATE)).toEqual([]);
  });
});

describe("Masking client data", () => {
  it("hides phones and ID numbers", () => {
    const r = maskSensitive("Llamé al 310 555 1234 y su cédula es 1.098.765.432, o 1098765432.");
    expect(r.text).toBe("Llamé al [teléfono] y su cédula es [documento], o [documento].");
    expect(r.masked.sort()).toEqual(["document", "phone"]);
  });

  it("keeps amounts, short numbers and dates", () => {
    const text = "Debe $1.500.000 desde hace 30 días; me tomó 2 horas el 12/11/2026.";
    expect(maskSensitive(text)).toEqual({ text, masked: [] });
  });

  it("hides a number named as a document", () => {
    expect(maskSensitive("CC 12345678").text).toBe("CC [documento]");
    expect(maskSensitive("+57 300-123-4567").text).toBe("[teléfono]");
  });
});

describe("Quotes", () => {
  const said = "Ayer. Bajé el reporte de cartera a Excel, lo filtré por ejecutivo.\nJairo nunca contesta, toca rogarle.";

  it("finds a literal quote, ignoring case and punctuation", () => {
    expect(quoteFound("bajé el reporte de cartera a excel", said)).toBe(true);
    expect(quoteFound("Bajé el reporte, de cartera a Excel…", said)).toBe(true);
  });

  it("skips the AI's [replacements] but keeps the order", () => {
    expect(quoteFound("[un ejecutivo] nunca contesta, toca rogarle", said)).toBe(true);
    expect(quoteFound("toca rogarle [x] nunca contesta", said)).toBe(false);
  });

  it("does not find words the person never said", () => {
    expect(quoteFound("me falta trazabilidad", said)).toBe(false);
    expect(quoteFound("[nombre]", said)).toBe(false);
  });

  it("marks each own-words quote in the Insights", () => {
    const verified = verifyInsights(
      {
        needs: [
          {
            id: "N1",
            statement: "x",
            inferred: false,
            job_story: null,
            situation: null,
            today: null,
            cost: null,
            frequency: null,
            evidence: [
              { source: "own_words", ref: "n1q2", quote: "lo filtré por ejecutivo" },
              { source: "own_words", ref: "n1q2", quote: "no tengo trazabilidad" },
              { source: "picked_scale", ref: "n1q1", quote: "Todos los días" },
            ],
            strength: "strong",
            strength_why: "",
            perspective: "first_hand",
            against_brief: null,
            not_established: null,
            flags: null,
          },
        ],
        proposals: [],
      },
      said,
    );
    expect(verified.needs[0].evidence.map((e) => e.verified)).toEqual([true, false, true]);
  });
});

describe("A round", () => {
  it("keeps 4 questions at most and turns an option card without options into an open one", () => {
    const many = { ...round, questions: [...round.questions, ...round.questions, ...round.questions] };
    expect(tidyRound(many)?.questions).toHaveLength(4);
    const lone = tidyRound({ ...round, questions: [{ ...round.questions[0], options: [round.questions[0].options[0]] }] });
    expect(lone?.questions[0].answer).toBe("open");
    expect(lone?.questions[0].options).toEqual([]);
  });

  it("never repeats a question id", () => {
    const twice = tidyRound({ ...round, questions: [round.questions[1], round.questions[1]] });
    expect(new Set(twice?.questions.map((q) => q.id)).size).toBe(2);
  });

  it("is null when nothing can be asked", () => {
    expect(tidyRound({ ...round, questions: [] })).toBeNull();
  });

  it("shuffles the same way every time", () => {
    const items = ["a", "b", "c", "d", "e"];
    expect(shuffled(items, "n1q1")).toEqual(shuffled(items, "n1q1"));
    expect(shuffled(items, "n1q1").sort()).toEqual(items);
  });

  it("writes the answers the way the interviewer reads them", () => {
    const text = answersXml(round, {
      masked: [],
      answers: [
        { q: "n1q1", picked: ["a"], text: "", input: "text", seconds: 3.2, skipped: false },
        { q: "n1q2", picked: [], text: "Ayer <bajé> el reporte", input: "voice", seconds: 55, skipped: false },
      ],
    });
    expect(text).toContain('<answer q="n1q1" picked="a" input="text" seconds="3">[Todos los días] </answer>');
    expect(text).toContain('<answer q="n1q2" input="voice" seconds="55">Ayer &lt;bajé&gt; el reporte</answer>');
    expect(roundState("needs", 2)).toBe('<round_state stage="needs" round="2" of="3"/>');
  });
});

describe("Files", () => {
  it("takes PDFs and photos within their limits", () => {
    expect(validateAttachment({ contentType: "application/pdf", size: 1000 })).toBeNull();
    expect(validateAttachment({ contentType: "application/pdf", size: 11 * 1024 * 1024 })).toBe("size");
    expect(validateAttachment({ contentType: "image/heic", size: 1000 })).toBe("type");
  });

  it("counts the pages it can see", () => {
    const pdf = new TextEncoder().encode("<< /Type /Pages /Count 2 >> << /Type /Page >> << /Type/Page >>");
    expect(pdfPageCount(pdf)).toBe(2);
    expect(pdfPageCount(new TextEncoder().encode("compressed"))).toBeNull();
  });
});

describe("Copy as Markdown", () => {
  it("keeps every item with its person and says what Weak means", () => {
    const md = discoveryMarkdown("Gestor de cartera", [
      {
        title: "Seguimiento de mora",
        interviews: [
          {
            stakeholder: "Mauricio",
            role: "líder de cartera",
            files: ["reporte.pdf"],
            insights: {
              needs: [
                {
                  id: "N1",
                  statement: "Saber qué pasó con cada cliente",
                  inferred: false,
                  job_story: null,
                  situation: "Revisión diaria",
                  today: null,
                  cost: null,
                  frequency: null,
                  evidence: [{ source: "own_words", ref: "n1q2", quote: "toca rogarle", verified: true }],
                  strength: "strong",
                  strength_why: "own words",
                  perspective: "first_hand",
                  against_brief: null,
                  not_established: null,
                  flags: null,
                },
              ],
              proposals: [],
            },
          },
        ],
      },
      { title: "Reportes", interviews: [] },
    ]);
    expect(md).toContain("## Seguimiento de mora");
    expect(md).toContain("#### N1 · Mauricio (líder de cartera) · Seguimiento de mora");
    expect(md).toContain('- [own words · n1q2] "toca rogarle"');
    expect(md).toContain("Treat Weak items as hypotheses, not votes.");
    expect(md).toContain("**Files:** reporte.pdf");
    expect(md).toContain("_No Interviews yet._");
  });
});

describe("displayOptions", () => {
  const scale = [
    { id: "a", label: "Menos de 10", origin: "scale" as const },
    { id: "b", label: "Entre 10 y 25", origin: "scale" as const },
    { id: "c", label: "Entre 26 y 50", origin: "scale" as const },
    { id: "d", label: "Más de 50", origin: "scale" as const },
  ];
  it("keeps a scale in its order, its none included", () => {
    expect(displayOptions(scale, "n1q1").map((o) => o.id)).toEqual(["a", "b", "c", "d"]);
    const zeroFirst = [{ id: "z", label: "Ninguna", origin: "scale" as const }, ...scale];
    expect(displayOptions(zeroFirst, "n3q1").map((o) => o.id)).toEqual(["z", "a", "b", "c", "d"]);
  });
  it("shuffles suggestions the same way every time and keeps None last", () => {
    const ideas = [
      { id: "a", label: "Una lista diaria", origin: "ai" as const },
      { id: "b", label: "Alertas", origin: "ai" as const },
      { id: "n", label: "Ninguna", origin: "ai" as const },
      { id: "c", label: "Un mapa", origin: "theirs" as const },
      { id: "d", label: "Recordatorios", origin: "ai" as const },
    ];
    const first = displayOptions(ideas, "v1q2").map((o) => o.id);
    expect(displayOptions(ideas, "v1q2").map((o) => o.id)).toEqual(first);
    expect(first.at(-1)).toBe("n");
    expect([...first].sort()).toEqual(["a", "b", "c", "d", "n"]);
  });
});

describe("nextTheme", () => {
  const themes = [
    { id: "a", done: false },
    { id: "b", done: false },
    { id: "c", done: false },
  ];

  it("goes to the following Theme in Ivan's order", () => {
    expect(nextTheme(themes, "a")?.id).toBe("b");
  });

  it("skips the Themes already done", () => {
    expect(nextTheme([{ id: "a", done: true }, { id: "b", done: true }, { id: "c", done: false }], "a")?.id).toBe("c");
  });

  it("wraps around to an earlier Theme left unfinished", () => {
    expect(nextTheme([{ id: "a", done: false }, { id: "b", done: true }, { id: "c", done: true }], "c")?.id).toBe("a");
  });

  it("is null when every other Theme is done", () => {
    expect(nextTheme([{ id: "a", done: true }, { id: "b", done: true }], "b")).toBeNull();
  });

  it("never offers the Theme just finished", () => {
    expect(nextTheme([{ id: "a", done: false }], "a")).toBeNull();
  });
});

describe("Theme progress", () => {
  const both = ["needs", "vision"] as const;

  it("counts each round and each stage's closing as a step", () => {
    expect(themeSteps(both)).toBe(7);
    expect(themeSteps(["needs"])).toBe(4);
    expect(themeSteps(["vision"])).toBe(3);
  });

  it("is zero before the Interview starts, and full once it is done", () => {
    expect(stepsDone(both, null)).toBe(0);
    expect(stepsDone(both, { stage: "vision", round: 2, phase: "done" })).toBe(7);
  });

  it("counts the rounds already answered", () => {
    expect(stepsDone(both, { stage: "needs", round: 1, phase: "answering" })).toBe(0);
    expect(stepsDone(both, { stage: "needs", round: 3, phase: "thinking" })).toBe(2);
    expect(stepsDone(both, { stage: "needs", round: 3, phase: "closing" })).toBe(3);
  });

  it("adds the stages before, closing included", () => {
    expect(stepsDone(both, { stage: "vision", round: 1, phase: "thinking" })).toBe(4);
    expect(stepsDone(both, { stage: "vision", round: 2, phase: "answering" })).toBe(5);
  });

  it("never reaches full before the last closing is sent", () => {
    expect(stepsDone(both, { stage: "vision", round: 2, phase: "closing" })).toBe(6);
  });

  it("numbers rounds across the whole Theme, so Vision doesn't start over", () => {
    expect(themeRound(both, "needs", 3)).toEqual({ n: 3, of: 5 });
    expect(themeRound(both, "vision", 1)).toEqual({ n: 4, of: 5 });
    expect(themeRound(["vision"], "vision", 2)).toEqual({ n: 2, of: 2 });
  });
});

describe("handoffMessage", () => {
  const base = { name: "Mauricio Pérez", url: "https://ivan.example/d/cartera", code: "042917", days: 7 };

  it("greets by first name and names the button the sign-in shows", () => {
    const text = handoffMessage({ ...base, language: "es" });
    expect(text).toContain("¡Hola Mauricio!");
    expect(text).toContain(base.url);
    expect(text).toContain(`"${HANDOFF_BUTTON.es}"`);
    expect(text).toContain("042917");
    expect(text).toContain("7 días");
  });

  it("speaks the Discovery's language", () => {
    const text = handoffMessage({ ...base, language: "en" });
    expect(text).toContain("Hi Mauricio!");
    expect(text).toContain(`"${HANDOFF_BUTTON.en}"`);
    expect(text).not.toContain("Hola");
  });
});
