import { NestFactory } from '@nestjs/core';
import { ValidationPipe, NestApplicationOptions } from '@nestjs/common';
import config from './config/config';
import { AppModule } from './app.module';
import { Logger } from './global/logger/logger';
import { initMiddleware } from './main-utils';
import { HttpExceptionFilter } from './global/exceptions/exceptions-filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

class App {
  public static async bootstrap(): Promise<void> {
    const appOptions: NestApplicationOptions = { cors: true, logger: false, bodyParser: true };
    const app = await NestFactory.create(AppModule, appOptions);
    const logger = app.get(Logger);

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api/v1');
    app.enableShutdownHooks();

    if (config().app.nodeEnv !== 'production') {
      const swaggerConfig = new DocumentBuilder()
        .setTitle('DaleelEx API')
        .setDescription('Core API DaleelEx backend')
        .setVersion('2.0')
        .addBearerAuth()
        .build();

      const document = SwaggerModule.createDocument(app, swaggerConfig);
      SwaggerModule.setup('api/v1/docs', app, document);
    }

    initMiddleware(app);

    const port = config().app.port;
    await app.listen(port);
    logger.info(`Application Listening on Port: ${port}`, { origin: 'system' });
  }

  public static async main(): Promise<void> {
    try {
      await App.bootstrap();
    } catch (err: any) {
      const logger = new Logger();
      logger.error('Fatal error during application bootstrap', { origin: 'system' }, { err });
      process.exit(1);
    }
  }
}

App.main();
