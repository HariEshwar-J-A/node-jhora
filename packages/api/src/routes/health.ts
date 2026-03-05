import { FastifyInstance } from 'fastify';

const START_TIME = Date.now();

export async function healthRoutes(app: FastifyInstance): Promise<void> {
    app.get('/health', async (_req, reply) => {
        return reply.status(200).send({
            status:  'ok',
            version: process.env.npm_package_version ?? '1.5.0',
            uptime:  Math.floor((Date.now() - START_TIME) / 1000),
        });
    });
}
