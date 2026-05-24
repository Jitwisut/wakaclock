/**
 * Instrumentation for OpenTelemetry
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 * @see https://vercel.com/docs/observability/otel-overview
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only load OpenTelemetry in Node.js runtime
    const { registerOTel } = await import('@vercel/otel');

    registerOTel({
      serviceName: process.env.OTEL_SERVICE_NAME || 'next-app',
      // Optional: Configure exporters
      // traceExporter: 'auto', // Uses OTEL_EXPORTER_OTLP_ENDPOINT
    });
  }
}
