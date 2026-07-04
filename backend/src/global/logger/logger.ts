import { createLogger, transports, Logger as WinstonLogger, LoggerOptions, format } from 'winston';
import { Injectable } from '@nestjs/common';
import { LoggerErrorMetadata } from '../global.interfaces';
import config from '../../config/config';

@Injectable()
export class Logger {
  private options: LoggerOptions = {
    format: Logger.getFormat(),
    transports: Logger.createTransport(),
  };

  private logger: WinstonLogger = createLogger(this.options);

  public info = (message: string, labels: any, hideBody?: boolean): void => {
    this.logger.info(message, { label: labels, hide: hideBody });
  };

  public error = (message: string, labels: any, errorMetadata?: LoggerErrorMetadata): void => {
    this.logger.error(message, { label: labels, error: errorMetadata });
  };

  public warn = (message: string, labels: any, errorMetadata?: LoggerErrorMetadata): void => {
    this.logger.warn(message, { label: labels, error: errorMetadata });
  };

  public debug = (message: string, labels: any): void => {
    this.logger.debug(message, { label: labels });
  };

  private static createTransport() {
    const customTransports = [];

    if (config().application_logging.file) {
      customTransports.push(
        new transports.File({
          filename: config().application_logging.file,
          level: config().application_logging.level,
        }),
      );
    }

    if (config().application_logging.console) {
      customTransports.push(new transports.Console({ level: config().application_logging.level }));
    }

    return customTransports;
  }

  private static getFormat() {
    const lokiFormat = format.printf(({ level, message, label, ...meta }) => {
      const safeMeta = { ...(label as object), ...meta };

      if (safeMeta.error && typeof safeMeta.error === 'object') {
        const err = (safeMeta.error as { err?: unknown }).err;
        if (err instanceof Error) {
          safeMeta.error = { ...safeMeta.error, err: { message: err.message, stack: err.stack, name: err.name } };
        }
      }

      const logEntry = { timestamp: new Date(), level, message, label: safeMeta };
      return JSON.stringify(logEntry);
    });
    return lokiFormat;
  }
}
