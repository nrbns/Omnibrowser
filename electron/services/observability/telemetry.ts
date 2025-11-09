/**
 * OpenTelemetry Observability Setup
 * Distributed tracing, metrics, and logging
 * 
 * Note: OpenTelemetry packages are optional dependencies.
 * The service will gracefully degrade if packages are not available.
 */

// @ts-nocheck

// Optional OpenTelemetry imports - will gracefully fail if not installed
let Resource: any;
let SemanticResourceAttributes: any;
let NodeSDK: any;
let getNodeAutoInstrumentations: any;
let OTLPTraceExporter: any;
let OTLPMetricExporter: any;
let PeriodicExportingMetricReader: any;
let ConsoleSpanExporter: any;
let SimpleSpanProcessor: any;

try {
  Resource = require('@opentelemetry/resources').Resource;
  SemanticResourceAttributes = require('@opentelemetry/semantic-conventions').SemanticResourceAttributes;
  NodeSDK = require('@opentelemetry/sdk-node').NodeSDK;
  getNodeAutoInstrumentations = require('@opentelemetry/auto-instrumentations-node').getNodeAutoInstrumentations;
  OTLPTraceExporter = require('@opentelemetry/exporter-trace-otlp-http').OTLPTraceExporter;
  OTLPMetricExporter = require('@opentelemetry/exporter-metrics-otlp-http').OTLPMetricExporter;
  PeriodicExportingMetricReader = require('@opentelemetry/sdk-metrics').PeriodicExportingMetricReader;
  ConsoleSpanExporter = require('@opentelemetry/sdk-trace-base').ConsoleSpanExporter;
  SimpleSpanProcessor = require('@opentelemetry/sdk-trace-base').SimpleSpanProcessor;
} catch {
  // OpenTelemetry packages not installed - service will use no-op mode
}

export interface TelemetryConfig {
  enabled: boolean;
  serviceName?: string;
  serviceVersion?: string;
  otlpEndpoint?: string;
  consoleExporter?: boolean;
  autoInstrumentation?: boolean;
  metricsInterval?: number;
}

class TelemetryService {
  private sdk: NodeSDK | null = null;
  private config: TelemetryConfig = {
    enabled: false,
    serviceName: 'omnibrowser',
    serviceVersion: process.env.npm_package_version || '1.0.0',
    consoleExporter: true,
    autoInstrumentation: true,
    metricsInterval: 60000, // 1 minute
  };

  /**
   * Initialize OpenTelemetry
   */
  initialize(config?: Partial<TelemetryConfig>): void {
    this.config = { ...this.config, ...config };

    if (!this.config.enabled) {
      console.log('[Telemetry] Observability disabled');
      return;
    }

    // Check if OpenTelemetry packages are available
    if (!NodeSDK) {
      console.log('[Telemetry] OpenTelemetry packages not installed. Install with: npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http');
      return;
    }

    try {
      // Resource definition
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      });

      // Trace exporter
      const traceExporter = this.config.otlpEndpoint
        ? new OTLPTraceExporter({
            url: `${this.config.otlpEndpoint}/v1/traces`,
          })
        : new ConsoleSpanExporter();

      // Metric exporter
      const metricExporter = this.config.otlpEndpoint
        ? new OTLPMetricExporter({
            url: `${this.config.otlpEndpoint}/v1/metrics`,
          })
        : undefined;

      // SDK configuration
      this.sdk = new NodeSDK({
        resource,
        traceExporter,
        spanProcessors: [new SimpleSpanProcessor(traceExporter)],
        metricReader: metricExporter
          ? new PeriodicExportingMetricReader({
              exporter: metricExporter,
              exportIntervalMillis: this.config.metricsInterval || 60000,
            })
          : undefined,
        instrumentations: this.config.autoInstrumentation
          ? [getNodeAutoInstrumentations()]
          : [],
      });

      // Initialize SDK
      this.sdk.start();

      console.log('[Telemetry] OpenTelemetry initialized');
    } catch (error) {
      console.error('[Telemetry] Failed to initialize:', error);
    }
  }

  /**
   * Shutdown telemetry
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      this.sdk = null;
    }
  }

  /**
   * Check if telemetry is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && this.sdk !== null;
  }
}

// Singleton instance
let telemetryInstance: TelemetryService | null = null;

export function getTelemetryService(): TelemetryService {
  if (!telemetryInstance) {
    telemetryInstance = new TelemetryService();
  }
  return telemetryInstance;
}

/**
 * Initialize telemetry (call from main process startup)
 */
export function initializeTelemetry(config?: Partial<TelemetryConfig>): void {
  const service = getTelemetryService();
  service.initialize(config);
}

/**
 * Shutdown telemetry (call on app quit)
 */
export async function shutdownTelemetry(): Promise<void> {
  const service = getTelemetryService();
  await service.shutdown();
}

