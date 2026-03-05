import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { CityNotFoundError, AmbiguousCityError } from '../services/geocoder.js';

/**
 * Global error handler — emits RFC 7807 Problem Details JSON.
 */
export function registerErrorHandler(app: FastifyInstance): void {
    app.setErrorHandler(async (error: Error, _req: FastifyRequest, reply: FastifyReply) => {
        app.log.error({ err: error }, 'Unhandled error');

        // City not found (geocoder) → 404
        if (error instanceof CityNotFoundError) {
            return reply.status(404).send({
                type:   'city_not_found',
                title:  error.message,
                status: 404,
            });
        }

        // Ambiguous city (geocoder) → 400 with suggestions
        if (error instanceof AmbiguousCityError) {
            return reply.status(400).send({
                type:        'ambiguous_city',
                title:       error.message,
                status:      400,
                suggestions: error.suggestions,
            });
        }

        // Zod validation errors from direct .parse() calls → 422
        if (error instanceof ZodError) {
            return reply.status(422).send({
                type:    'https://httpstatuses.com/422',
                title:   'Validation Error',
                status:  422,
                detail:  'Input validation failed',
                errors:  error.errors.map(e => ({
                    path:    e.path.join('.'),
                    message: e.message,
                })),
            });
        }

        // Fastify schema validation errors (from fastify-type-provider-zod) → 422
        // These carry a .validation array of ZodIssue-like objects.
        if ((error as any).validation) {
            const issues = (error as any).validation as Array<{ instancePath?: string; message?: string; path?: string | string[] }>;
            return reply.status(422).send({
                type:   'https://httpstatuses.com/422',
                title:  'Validation Error',
                status: 422,
                detail: 'Input validation failed',
                errors: issues.map(e => ({
                    path:    e.instancePath ?? (Array.isArray(e.path) ? e.path.join('.') : (e.path ?? '')),
                    message: e.message ?? '',
                })),
            });
        }

        // Other Fastify errors with explicit 400 status → 400
        if ((error as any).statusCode === 400) {
            return reply.status(400).send({
                type:   'https://httpstatuses.com/400',
                title:  'Bad Request',
                status: 400,
                detail: error.message,
            });
        }

        // All other errors → 500
        return reply.status(500).send({
            type:   'https://httpstatuses.com/500',
            title:  'Internal Server Error',
            status: 500,
            detail: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
        });
    });
}
