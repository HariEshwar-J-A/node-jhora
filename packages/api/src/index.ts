import { buildServer, initEngine } from './server.js';

const HOST = process.env.HOST ?? '0.0.0.0';
const PORT = parseInt(process.env.PORT ?? '3000', 10);

async function main(): Promise<void> {
    // Initialize WASM engine once before accepting requests
    await initEngine();

    const app = await buildServer();

    try {
        await app.listen({ host: HOST, port: PORT });
        app.log.info(`node-jhora API listening on ${HOST}:${PORT}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

main();
