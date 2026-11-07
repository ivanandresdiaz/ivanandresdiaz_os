"use client";

import { useRef, useState, useTransition } from "react";
import { deleteCampaign, setCampaignStatus, updateCampaign } from "@/server/actions";
import { LongText } from "./long-text";
import { ConfirmDelete } from "./confirm-delete";
import { Markdown } from "./markdown";
import { DrawerFrame, ReadButton, SaveForm, useEditMode } from "./plan-drawers";
import { GamesPicker, GameTags, Hidden } from "./ui";

export type CampaignText = {
  id: string;
  title: string;
  status: "candidate" | "active" | "done" | "dropped";
  goal: string;
  why: string;
  antiGoal: string;
  seasonGoalId: string | null;
  blockTypeId: string | null;
  games: string[];
};

type Options = {
  goals: { id: string; title: string }[];
  containers: { id: string; name: string }[];
  /** "2026-Q4": where "Activate" puts a candidate. */
  currentQuarter: string;
};

const GPS = [
  { key: "goal", label: "Goal", empty: "What this Campaign gets done." },
  { key: "why", label: "Why", empty: "Why it matters now." },
  { key: "antiGoal", label: "Anti-goal / constraints", empty: "What I avoid, and the limits." },
] as const;

type Text = Pick<CampaignText, "title" | "goal" | "why" | "antiGoal">;

/** "Read" opens the whole Campaign: its GPS, what it serves and where it is played, and its status. */
export function CampaignReader({ campaign, ...options }: { campaign: CampaignText } & Options) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ReadButton label={`Read ${campaign.title}`} onClick={() => setOpen(true)} />
      {open && <CampaignDrawer campaign={campaign} {...options} onClose={() => setOpen(false)} />}
    </>
  );
}

function CampaignDrawer({
  campaign,
  goals,
  containers,
  currentQuarter,
  onClose,
}: { campaign: CampaignText; onClose: () => void } & Options) {
  const saved: Text = { title: campaign.title, goal: campaign.goal, why: campaign.why, antiGoal: campaign.antiGoal };
  const [text, setText] = useState<Text>(saved);
  // Season Goal, Block and Infinite Games: uncontrolled, so only "something changed" is tracked.
  const [choicesChanged, setChoicesChanged] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [saving, startSaving] = useTransition();
  const dirty = choicesChanged || (Object.keys(saved) as (keyof Text)[]).some((k) => text[k] !== saved[k]);
  const { mode, setMode, switchTo, confirmDiscard } = useEditMode(dirty, () => {
    setText(saved);
    setChoicesChanged(false);
  });

  function save() {
    if (!dirty || text.title.trim() === "" || !form.current) return;
    const fd = new FormData(form.current);
    fd.set("id", campaign.id);
    for (const [key, value] of Object.entries(text)) fd.set(key, value);
    startSaving(async () => {
      await updateCampaign(fd);
      // The server trims; so does the local copy, or it would look unsaved.
      setText({ title: text.title.trim(), goal: text.goal.trim(), why: text.why.trim(), antiGoal: text.antiGoal.trim() });
      setChoicesChanged(false);
      setMode("preview");
    });
  }

  const serves = goals.find((g) => g.id === campaign.seasonGoalId)?.title;
  const playedIn = containers.find((t) => t.id === campaign.blockTypeId)?.name;

  return (
    <DrawerFrame
      heading={text.title.trim() || campaign.title}
      subheading={`Campaign · ${campaign.status}`}
      mode={mode}
      onSwitch={switchTo}
      onRequestClose={() => confirmDiscard() && onClose()}
      onClose={onClose}
    >
      {mode === "preview" ? (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>{serves ? `Serves: ${serves}` : "No Season Goal"}</span>
            <span>{playedIn ? `Played in: ${playedIn}` : "No Container Block"}</span>
            <GameTags games={campaign.games} />
          </div>
          {GPS.map(({ key, label, empty }) => (
            <div key={key}>
              <div className="label mb-1">{label}</div>
              {text[key].trim() ? <Markdown>{text[key]}</Markdown> : <p className="text-sm text-muted">{empty}</p>}
            </div>
          ))}
        </>
      ) : (
        <SaveForm
          formRef={form}
          onSave={save}
          dirty={dirty}
          saving={saving}
          canSave={text.title.trim() !== ""}
        >
          <div
            className="contents"
            onChange={(event) => {
              const target = event.target as HTMLElement;
              if (target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && target.type === "checkbox")) {
                setChoicesChanged(true);
              }
            }}
          >
            <input
              value={text.title}
              onChange={(event) => setText({ ...text, title: event.target.value })}
              required
              aria-label="Campaign title"
              className="input font-medium"
            />
            {GPS.map(({ key, label, empty }) => (
              <div key={key} className="flex flex-col gap-1">
                <span className="label">{label}</span>
                <LongText
                  value={text[key]}
                  onValueChange={(value) => setText((t) => ({ ...t, [key]: value }))}
                  markdown
                  aria-label={label}
                  placeholder={empty}
                  className="input min-h-24 leading-relaxed"
                />
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <select name="seasonGoalId" className="input w-auto" defaultValue={campaign.seasonGoalId ?? ""}>
                <option value="">No Season Goal</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    Serves: {g.title}
                  </option>
                ))}
              </select>
              <select name="blockTypeId" className="input w-auto" defaultValue={campaign.blockTypeId ?? ""}>
                <option value="">No Container Block</option>
                {containers.map((t) => (
                  <option key={t.id} value={t.id}>
                    Played in: {t.name}
                  </option>
                ))}
              </select>
            </div>
            <GamesPicker selected={campaign.games} />
          </div>
        </SaveForm>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {campaign.status === "candidate" && (
          <form action={setCampaignStatus}>
            <Hidden id={campaign.id} status="active" quarter={currentQuarter} />
            <button className="btn">Activate in current Quarter</button>
          </form>
        )}
        {campaign.status === "active" && (
          <>
            <form action={setCampaignStatus}>
              <Hidden id={campaign.id} status="done" />
              <button className="btn">Mark done</button>
            </form>
            <form action={setCampaignStatus}>
              <Hidden id={campaign.id} status="dropped" />
              <button className="btn">Drop</button>
            </form>
          </>
        )}
        {(campaign.status === "done" || campaign.status === "dropped") && (
          <form action={setCampaignStatus}>
            <Hidden id={campaign.id} status="active" />
            <button className="btn">Reactivate</button>
          </form>
        )}
        <details className="ml-auto text-sm">
          <summary className="cursor-pointer text-muted">Danger zone</summary>
          <div className="mt-2">
            <ConfirmDelete
              action={deleteCampaign}
              id={campaign.id}
              what="Campaign"
              title={campaign.title}
              counts="campaign"
              className="btn text-red-600"
            >
              Delete Campaign and all its Moves
            </ConfirmDelete>
          </div>
        </details>
      </div>
    </DrawerFrame>
  );
}
