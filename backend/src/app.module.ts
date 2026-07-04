import { join } from 'lodash';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import config from './config/config';
import { Logger } from './global/logger/logger';
import { PrismaModule } from './lib/prisma/prisma.module';
import { HealthModule } from './lib/health/health.module';
import { PrismaService } from './lib/prisma/prisma.service';
import { LoggerModule } from './global/logger/logger.module';
import { GlobalMiddleware } from './global/global.middleware';
import { IntegrationsModule } from './integrations/integrations.module';

@Module({
  providers: [Logger, PrismaService],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
      ...(config().app.nodeEnv.toLowerCase() === 'integration' ? { envFilePath: join(process.cwd(), `.env.integration`) } : {}),
    }),
    JwtModule.register({ global: true }),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    LoggerModule,
    PrismaModule,
    HealthModule,
    IntegrationsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(GlobalMiddleware).forRoutes({ path: '*splat', method: RequestMethod.ALL });
  }
}
