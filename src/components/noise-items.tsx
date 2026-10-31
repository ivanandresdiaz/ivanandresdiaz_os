"use client";

import { useState } from "react";
import { addNoiseItem, deleteNoiseItem } from "@/server/actions";
import { AddIconButton, Hidden } from "./ui";

export function NoiseItems({ date, items }: { date: string; items: { id: string; title: string }[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">
            Eliminate <span className="text-sm font-normal text-muted">(the noise for today)</span>
          </h2>
          <p className="text-xs text-muted">Low ROI. Doesn’t move the needle. Pulls me away from my goals. Irrelevant.</p>
        </div>
        {!adding && <AddIconButton label="Add Noise item" onClick={() => setAdding(true)} />}
      </div>

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-2 rounded-md border border-line px-2 py-1.5 text-sm"
            >
              <span className="min-w-0 flex-1">{item.title}</span>
              <button
                type="button"
                className="text-muted hover:text-red-600"
                onClick={() => deleteNoiseItem({ id: item.id })}
                title="Delete Noise item"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <form action={addNoiseItem} className="flex gap-2">
          <Hidden date={date} />
          <input
            name="title"
            required
            autoFocus
            placeholder="What noise do I eliminate today?"
            className="input min-w-0 flex-1"
            onKeyDown={(event) => event.key === "Escape" && setAdding(false)}
          />
          <button className="btn">Add</button>
          <button type="button" className="text-sm text-muted hover:underline" onClick={() => setAdding(false)}>
            Done
          </button>
        </form>
      )}
    </section>
  );
}
