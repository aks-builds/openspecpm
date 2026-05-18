import { readFile } from 'node:fs/promises';

/**
 * Read a UTF-8 text file, returning `null` if the file doesn't exist.
 *
 * Replaces the `existsSync(path) ? await readFile(path) : ''` idiom that
 * accumulated across the codebase: that pair has a TOCTOU race window —
 * between the check and the read, the file can be deleted (e.g. by `watch`
 * firing on an unrelated change, or by a parallel `ship --all-ready` run),
 * leaving the consumer to crash with a deep `ENOENT` and an absolute path
 * in the stack trace.
 *
 * One readFile call, ENOENT caught inline, null returned. All other errors
 * propagate.
 */
export async function safeReadFile(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}
