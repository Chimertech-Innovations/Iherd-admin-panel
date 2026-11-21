// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    ((error as any).code === "ECONNRESET" || (error as any).message === "aborted" || String((error as any).message).includes("aborted"))
  ) {
    return;
  }
  lastCapturedError = { error, at: Date.now() };
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

if (typeof process !== "undefined" && typeof process.on === "function") {
  process.on("uncaughtException", (err) => {
    if (err && (err.code === "ECONNRESET" || err.message === "aborted")) return;
    record(err);
  });
  process.on("unhandledRejection", (reason) => {
    if (
      reason &&
      typeof reason === "object" &&
      ((reason as any).code === "ECONNRESET" || (reason as any).message === "aborted")
    ) {
      return;
    }
    record(reason);
  });
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
