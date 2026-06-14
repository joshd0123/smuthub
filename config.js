// ════════════════════════════════════════════════════════
//  smutHub shared config — PASTE YOUR KEYS HERE **ONCE**.
//  Every page reads from this file. No more multi-file pasting.
// ════════════════════════════════════════════════════════
window.SMUTHUB_CONFIG = {
  SUPABASE_URL:  "https://kufpvbmwrtcciamdomhp.supabase.co",        // e.g. https://abcde.supabase.co
  SUPABASE_KEY:  "sb_publishable_IeaoS9XI27fCrgtKNq1X5g_dfIHo9OZ",    // sb_publishable_...
  WEB3FORMS_KEY: "0303543f-0d8c-4cdf-9af6-ab83bb966b72",      // for the landing-page signup + feedback
  GOOGLE_BOOKS_KEY: "AIzaSyBlONCuuEIUHPIevEjt8OAkVZZg-MUuTPY"   // optional: paste a Google Books API key for good search (see themes/README or below)
};
// Google Books key (free): https://console.cloud.google.com → create/select a project →
// "APIs & Services" → enable "Books API" → "Credentials" → "Create credentials" → "API key".
// Paste it above between the quotes. Without it, search falls back to Open Library.
