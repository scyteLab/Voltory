/**
 * notify-new-submission  —  DEPRECATED alias of notify-event.js
 *
 * Existing Supabase Database Webhooks may still point here. Repoint
 * them to /.netlify/functions/notify-event, then delete this file.
 */
export { handler } from "./notify-event.js";
