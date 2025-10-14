import 'dotenv/config';
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

export const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

// Auto-start on import when preloaded via --import/--loader
// Ensures instrumentation is initialized before app modules load
// Note: top-level await is supported in ESM/TSX
// Quick debug to verify envs are visible this early (safe to keep or remove later)
// eslint-disable-next-line no-console
console.log('[otel] env check', {
  lf_public_tail: process.env.LANGFUSE_PUBLIC_KEY ? process.env.LANGFUSE_PUBLIC_KEY.slice(-4) : 'missing',
  lf_base_url: process.env.LANGFUSE_BASE_URL || process.env.LANGFUSE_HOST || 'missing',
});
await sdk.start();

async function shutdown(reason: string) {
  try {
    // eslint-disable-next-line no-console
    console.log(`[otel] shutting down sdk due to ${reason}`);
    await sdk.shutdown();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[otel] shutdown error', err);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('beforeExit', () => void shutdown('beforeExit'));