// Stable "page load" cache-buster shared across modules.
// Because modules are evaluated once per page load, this value stays constant
// for the lifetime of the app session (until full reload).
export const PAGE_LOAD_CACHE_BUST = Date.now();

