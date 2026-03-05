import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';

/**
 * Global error handler — emits RFC 7807 Problem Details JSON.
 */
export function registerErrorHandler(app: FastifyInstance): void {
    app.setErrorHandler(async (error: Error, _req: FastifyRequest, reply: FastifyReply) => {
        app.log.error({ err: error }, 'Unhandled error');

        // Zod validation errors → 422 Unprocessable Entity
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

        // Fastify validation errors (schema-based) → 400
        if ((error as any).statusCode === 400 || (error as any).validation) {
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
