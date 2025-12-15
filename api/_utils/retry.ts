type RetryOptions = {
  attempts?: number;
  delayMs?: number;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const delayMs = options.delayMs ?? 120;

  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await wait(delayMs * (i + 1));
      }
    }
  }
  throw lastError;
}
