/**
 * Which Long text tools have their key set, decided when the app is built
 * (see `env` in next.config.ts). A missing key disables its button, never the app.
 */
export const aiTools = {
  dictation: process.env.AI_DICTATION === "on",
  coach: process.env.AI_COACH === "on",
};
