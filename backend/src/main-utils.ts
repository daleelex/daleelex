import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

export const initMiddleware = (app: INestApplication) => {
  app.use(helmet());
};
