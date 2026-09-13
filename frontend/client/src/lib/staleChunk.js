/**
 * Did this error come from a route chunk that no longer exists?
 *
 * Vite names each on-demand chunk with a content hash, so a deploy replaces
 * every name. A tab that was already open then asks for a file that is gone
 * the moment somebody navigates, and the import rejects. Reloading is the
 * fix; nothing about the code is wrong.
 */
export const isStaleChunk = (error) =>
  /dynamically imported module|Importing a module script failed|ChunkLoadError/i
    .test(error?.message || '')
