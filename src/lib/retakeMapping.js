/**
 * src/lib/retakeMapping.js
 *
 * Bidirectional mapping between UI retake rule labels and the
 * database retake_limit value (stored as a string in settings).
 *
 *   DB value  | meaning
 *   ----------|---------------------------------
 *   "1"       | 1 attempt total = No retakes
 *   "2"       | 2 attempts total = One retake
 *   "3"       | 3 attempts total = Two retakes
 *   ""        | unlimited attempts
 */

export const UI_TO_DB = {
  "No retakes":       "1",
  "One retake":       "2",
  "Two retakes":      "3",
  "Unlimited retakes": "",
};

export const DB_TO_UI = {
  "1": "No retakes",
  "2": "One retake",
  "3": "Two retakes",
  "":  "Unlimited retakes",
};

/** Converts a UI label to the DB value string. Falls back to "" (unlimited). */
export function uiToDb(uiLabel) {
  return UI_TO_DB[uiLabel] ?? "";
}

/** Converts a DB value string to a UI label. Falls back to "Unlimited retakes". */
export function dbToUi(dbValue) {
  return DB_TO_UI[String(dbValue ?? "")] ?? "Unlimited retakes";
}
