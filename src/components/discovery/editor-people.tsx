"use client";

import { useState, useTransition } from "react";
import { MAX_ROLE_NOTE } from "@/domain/discovery";
import {
  createStakeholder,
  deleteStakeholder,
  setStakeholderAccess,
  startTestInterview,
  updateStakeholder,
} from "@/server/discovery-actions";
import type { DiscoveryView } from "@/server/discoveries";
import { ConfirmDelete } from "../confirm-delete";

type Person = DiscoveryView["stakeholders"][number];

type Fields = {
  name: string;
  email: string;
  roleNote: string;
  wantsNeeds: boolean;
  wantsVision: boolean;
  themeIds: string[];
};

function seenLabel(date: Date | null) {
  if (!date) return "Never signed in";
  return `Last seen ${new Date(date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
}

export function Stakeholders({ view }: { view: DiscoveryView }) {
  const [adding, setAdding] = useState(false);
  const people = view.stakeholders.filter((p) => !p.isTest);
  const tests = view.stakeholders.filter((p) => p.isTest);
  return (
    <div className="flex flex-col gap-2">
      {people.map((p) => (
        <PersonRow key={p.id} person={p} view={view} />
      ))}
      {tests.map((p) => (
        <div key={p.id} className="flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-sm">
          <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-900">test</span>
          <span className="min-w-0 flex-1 truncate">{p.name}</span>
          <ConfirmDelete action={deleteStakeholder} id={p.id} what="test Stakeholder" title={p.name} />
        </div>
      ))}
      {adding ? (
        <PersonForm
          view={view}
          submit="Invite"
          onCancel={() => setAdding(false)}
          onSave={async (fields) => {
            const result = await createStakeholder({ discoveryId: view.discovery.id, ...fields });
            if (result.ok) setAdding(false);
            return result;
          }}
        />
      ) : (
        <button type="button" className="btn self-start" onClick={() => setAdding(true)}>
          + Invite a Stakeholder
        </button>
      )}
      {view.discovery.status === "draft" && people.length > 0 && (
        <p className="text-xs text-muted">Invited people can sign in once the Discovery is open. No email goes out until they ask for a code.</p>
      )}
    </div>
  );
}

function PersonRow({ person, view }: { person: Person; view: DiscoveryView }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const removed = !!person.removedAt;
  const themes = view.themes.filter((t) => person.themeIds.includes(t.id));

  if (editing) {
    return (
      <PersonForm
        view={view}
        person={person}
        submit="Save"
        onCancel={() => setEditing(false)}
        onSave={async (fields) => {
          const result = await updateStakeholder({ id: person.id, ...fields });
          if (result.ok) setEditing(false);
          return result;
        }}
      />
    );
  }

  return (
    <div className={`flex flex-col gap-1 rounded-lg border border-line p-3 text-sm ${removed ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{person.name}</span>
        {person.wantsNeeds && <span className="rounded-full bg-accent/10 px-1.5 text-[11px] text-accent">Needs</span>}
        {person.wantsVision && <span className="rounded-full bg-accent/10 px-1.5 text-[11px] text-accent">Vision</span>}
        {removed && <span className="rounded-full bg-line px-1.5 text-[11px] text-muted">No access</span>}
      </div>
      <span className="text-xs text-muted">{person.email}</span>
      {person.roleNote && <span className="text-xs">{person.roleNote}</span>}
      <span className="text-xs text-muted">
        {themes.length === view.themes.length ? "Every Theme" : themes.map((t) => t.title).join(", ") || "No Themes"} ·{" "}
        {seenLabel(person.lastSeenAt)}
      </span>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <button type="button" className="btn" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={() => start(() => setStakeholderAccess({ id: person.id, removed: !removed }))}
        >
          {removed ? "Give access back" : "Remove access"}
        </button>
        <ConfirmDelete
          action={deleteStakeholder}
          id={person.id}
          what="Stakeholder"
          title={person.name}
          className="btn text-muted hover:text-red-600"
          buttonTitle="Delete with everything they said"
        >
          Delete
        </ConfirmDelete>
      </div>
    </div>
  );
}

function PersonForm({
  view,
  person,
  submit,
  withEmail = true,
  onSave,
  onCancel,
}: {
  view: DiscoveryView;
  person?: Person;
  submit: string;
  withEmail?: boolean;
  onSave: (fields: Fields) => Promise<{ ok: boolean; error?: string } | void>;
  onCancel?: () => void;
}) {
  const [fields, setFields] = useState<Fields>({
    name: person?.name ?? "",
    email: person?.email ?? "",
    roleNote: person?.roleNote ?? "",
    wantsNeeds: person?.wantsNeeds ?? true,
    wantsVision: person?.wantsVision ?? true,
    themeIds: person?.themeIds ?? view.themes.map((t) => t.id),
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (next: Partial<Fields>) => setFields((f) => ({ ...f, ...next }));

  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-accent/40 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!fields.wantsNeeds && !fields.wantsVision) return setError("Ask for Needs, Vision or both.");
        start(async () => {
          setError(null);
          const result = await onSave(fields);
          if (result && !result.ok) setError(result.error ?? "Couldn't save.");
        });
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="label">Name</span>
          <input value={fields.name} onChange={(e) => set({ name: e.target.value })} required className="input" />
        </label>
        {withEmail && (
          <label className="flex flex-col gap-1">
            <span className="label">Email · where the code goes</span>
            <input
              type="email"
              value={fields.email}
              onChange={(e) => set({ email: e.target.value })}
              required
              autoCapitalize="none"
              className="input"
            />
          </label>
        )}
      </div>
      <label className="flex flex-col gap-1">
        <span className="label">Who they are · hidden, the AI reads it</span>
        <input
          value={fields.roleNote}
          onChange={(e) => set({ roleNote: e.target.value })}
          maxLength={MAX_ROLE_NOTE}
          placeholder="e.g. Portfolio lead, 8 years, runs the Monday committee"
          className="input"
        />
      </label>
      <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
        <legend className="label mb-1">Ask for</legend>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={fields.wantsNeeds} onChange={(e) => set({ wantsNeeds: e.target.checked })} />
          Needs
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={fields.wantsVision} onChange={(e) => set({ wantsVision: e.target.checked })} />
          Vision
        </label>
      </fieldset>
      {view.themes.length > 0 && (
        <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
          <legend className="label mb-1">Themes</legend>
          {view.themes.map((t) => (
            <label key={t.id} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={fields.themeIds.includes(t.id)}
                onChange={(e) =>
                  set({ themeIds: e.target.checked ? [...fields.themeIds, t.id] : fields.themeIds.filter((id) => id !== t.id) })
                }
              />
              {t.title}
            </label>
          ))}
        </fieldset>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "…" : submit}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

/** Ivan plays someone: the real Interview, on this device, wiped when the Discovery opens (Q43). */
export function TryIt({ view }: { view: DiscoveryView }) {
  if (view.themes.length === 0) return <p className="text-sm text-muted">Add a Theme first.</p>;
  return (
    <PersonForm
      view={view}
      submit="Start as this person →"
      withEmail={false}
      onSave={async (fields) => {
        await startTestInterview({
          discoveryId: view.discovery.id,
          name: fields.name,
          roleNote: fields.roleNote,
          wantsNeeds: fields.wantsNeeds,
          wantsVision: fields.wantsVision,
          themeIds: fields.themeIds,
        });
      }}
    />
  );
}
