/** Where DRISTI is, and how this workspace is reached from it. */
export const DRISTI_URL = (process.env.DRISTI_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const DRISTI_API_KEY = process.env.DRISTI_API_KEY ?? "dristi-demo-key";
export const PROVAKIL_URL = (process.env.PROVAKIL_URL ?? "http://localhost:3100").replace(/\/$/, "");
