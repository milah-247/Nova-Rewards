'use strict';

const { createLogger, format, transports } = require('winston');

const SERVICE_NAME = process.env.SERVICE_NAME || 'nova-rewards-backend';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Base structured JSON format with required fields from #627
const jsonFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.printf(({ timestamp, level, message, correlationId, stack, ...meta }) => {
    const entry = {
      timestamp,
      level,
      service: SERVICE_NAME,
      correlationId: correlationId || undefined,
      message,
      ...meta,
    };
    if (stack) entry.stack = stack;
    return JSON.stringify(entry);
  })
);

const loggerTransports = [
  new transports.Console({
    format: process.env.NODE_ENV === 'development'
      ? format.combine(format.colorize(), format.simple())
      : jsonFormat,
  }),
];

// CloudWatch transport — only enabled when CW vars are present
if (
  process.env.CLOUDWATCH_LOG_GROUP &&
  process.env.AWS_REGION &&
  process.env.NODE_ENV !== 'test'
) {
  const WinstonCloudWatch = require('winston-cloudwatch');
  loggerTransports.push(
    new WinstonCloudWatch({
      logGroupName: process.env.CLOUDWATCH_LOG_GROUP,
      logStreamName: process.env.CLOUDWATCH_LOG_STREAM || `${SERVICE_NAME}-${process.env.NODE_ENV || 'production'}`,
      awsRegion: process.env.AWS_REGION,
      jsonMessage: true,
      retentionInDays: 30, // info-level default; error/warn retention managed via CW policy
    })
  );
}

const logger = createLogger({
  level: LOG_LEVEL,
  format: jsonFormat,
  transports: loggerTransports,
  // Don't crash the process on unhandled logger errors
  exitOnError: false,
});

/**
 * Returns a child logger with the correlationId bound to every log entry.
 * @param {string} correlationId
 */
logger.withCorrelationId = (correlationId) =>
  logger.child({ correlationId });

module.exports = logger;
