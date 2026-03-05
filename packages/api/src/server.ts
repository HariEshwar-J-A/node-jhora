import Fastify, { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import cors from '@fastify/cors';
import { EphemerisEngine } from '@node-jhora/core';
import { registerErrorHandler } from './plugins/error-handler.js';
import { healthRoutes } from './routes/health.js';
import { chartRoutes } from './routes/chart.js';
import { panchangaRoutes } from './routes/panchanga.js';
import { dashaRoutes } from './routes/dasha.js';
import { shadbalaRoutes } from './routes/shadbala.js';
import { kpRoutes } from './routes/kp.js';
import { matchRoutes } from './routes/match.js';

// ---------------------------------------------------------------------------
// Singleton WASM engine — initialized once at startup.
// ---------------------------------------------------------------------------

let _engine: EphemerisEngine | null = null;

export function getEngine(): EphemerisEngine {
    if (!_engine) {
        throw new Error('EphemerisEngine not initialized. Call initEngine() first.');
    }
    return _engine;
}

export async function initEngine(): Promise<void> {
    if (_engine) return;
    _engine = EphemerisEngine.getInstance();
    await _engine.initialize();
}

// ---------------------------------------------------------------------------
// Fastify factory
// ---------------------------------------------------------------------------

export async function buildServer(opts: {
    logger?: boolean | object;
    trustProxy?: boolean;
} = {}): Promise<FastifyInstance> {
    const app = Fastify({
        logger: opts.logger ?? {
            level: process.env.LOG_LEVEL ?? 'info',
            transport: process.env.NODE_ENV === 'development'
                ? { target: 'pino-pretty' }
                : undefined,
        },
        trustProxy: opts.trustProxy ?? false,
    });

    // Register Zod type provider for schema-level validation and serialization
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    // ---------------------------------------------------------------------------
    // Plugins
    // ---------------------------------------------------------------------------

    await app.register(cors, {
        origin: process.env.CORS_ORIGIN ?? true,
        methods: ['GET', 'POST', 'OPTIONS'],
    });

    registerErrorHandler(app);

    // ---------------------------------------------------------------------------
    // Routes
    // ---------------------------------------------------------------------------

    await app.register(healthRoutes, { prefix: '/' });
    await app.register(chartRoutes,     { prefix: '/v1' });
    await app.register(panchangaRoutes, { prefix: '/v1' });
    await app.register(dashaRoutes,     { prefix: '/v1' });
    await app.register(shadbalaRoutes,  { prefix: '/v1' });
    await app.register(kpRoutes,        { prefix: '/v1' });
    await app.register(matchRoutes,     { prefix: '/v1' });

    return app;
}
