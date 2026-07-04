import { createLogger, transports } from 'winston';
import config from '../configs/config';

const createTransports = (applicationLogging: any) => {
  const customTransports = [];

  if (applicationLogging.file) {
    customTransports.push(new transports.File({ filename: applicationLogging.file, level: applicationLogging.level }));
  }

  if (applicationLogging.console) {
    customTransports.push(new transports.Console({ level: applicationLogging.level }));
  }

  return customTransports;
};

export const logger = createLogger({
  transports: createTransports(config.application_logging),
});
