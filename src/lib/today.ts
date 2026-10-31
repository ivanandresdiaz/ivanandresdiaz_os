import "server-only";
import { todayIn, type IsoDate } from "@/domain/dates";

export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "America/Bogota";

export function today(): IsoDate {
  return todayIn(APP_TIMEZONE);
}
