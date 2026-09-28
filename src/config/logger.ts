import winston from 'winston';
import { env } from './env';

const { combine, timestamp, colorize, printf, json } = winston.format;

const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
  return `${timestamp} [${level}]: ${message}${metaStr}`;
});

// Vercel is a serverless environment — filesystem writes are not allowed.
// We use Console-only transport in production/serverless, and add File transports locally.
const isServerless = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'HH:mm:ss' }),
      consoleFormat
    ),
  }),
];

if (!isServerless) {
  try {
    const fs = require('fs');
    if (!fs.existsSync('logs')) fs.mkdirSync('logs', { recursive: true });

    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
      })
    );
  } catch (error) {
    // Ignore file system errors in serverless/restricted environments
    console.warn('Could not initialize file transports for logger:', error.message);
  }
}

export const logger = winston.createLogger({
  level: env.log.level,
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), json()),
  transports,
});
