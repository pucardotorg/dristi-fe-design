/**
 * Source the design-system gates do not judge: the Provakil demo (`src/provakil/`,
 * `src/app/provakil/`), a stand-in for another company's product served from this app.
 * It keeps that product's own look on purpose, so DRISTI's rules do not apply to it.
 */

import { join, sep } from "node:path";

import { APP_ROOT } from "./resolve-ds.mjs";

const NOT_DRISTI = [join(APP_ROOT, "src", "provakil"), join(APP_ROOT, "src", "app", "provakil")];

/** Whether a directory is one of them. */
export function isNotDristi(dir) {
  return NOT_DRISTI.some((d) => dir === d || dir.startsWith(d + sep));
}
