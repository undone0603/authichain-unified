import pino from 'pino';
import { env } from '../server/config';
const isProduction = env.NODE_ENV === 'production';
export const logger = pino({
    level: isProduction ? 'info' : 'debug',
    transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        },
    base: {
        env: env.NODE_ENV,
    },
});
