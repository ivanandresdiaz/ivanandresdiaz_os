"use client";

import { useState, useTransition } from "react";
import { createDiscovery } from "@/server/discovery-actions";

/** A new Discovery: its title and the language everything speaks (Q34). Spanish by default. */
export function NewDiscovery() {
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("es");
  const [pending, start] = useTransition();
  return (
    <form
      className="card flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim()) start(() => createDiscovery({ title, language }));
      }}
    >
      <label className="flex flex-1 flex-col gap-1">
        <span className="label">New Discovery</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Gestor de cartera"
          required
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Language</span>
        <select value={language} onChange={(event) => setLanguage(event.target.value)} className="input">
          <option value="es">Spanish</option>
          <option value="en">English</option>
        </select>
      </label>
      <button type="submit" className="btn-primary min-h-8" disabled={pending || !title.trim()}>
        {pending ? "Creating…" : "Create"}
      </button>
    </form>
  );
}
