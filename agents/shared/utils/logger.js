const winston = require('winston');
const path = require('path');
const fs = require('fs');

function createLogger(agentName) {
  const logDir = path.join(__dirname, '../../logs', agentName);
  fs.mkdirSync(logDir, { recursive: true });

  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { agent: agentName },
    transports: [
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        maxsize: 5242880,
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        maxsize: 10485760,
        maxFiles: 10,
      }),
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, agent, message }) => {
            return `${timestamp} [${agent}] ${level}: ${message}`;
          })
        ),
      }),
    ],
  });
}

module.exports = { createLogger };
