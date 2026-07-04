import { Response } from 'express';
import values from '../../config/default-values';
import { ExceptionFilter, Catch, ArgumentsHost, HttpException as NestHttpException } from '@nestjs/common';
import { HttpException as CustomHttpException } from './exception';
import { HttpRequest, Message } from '../global.interfaces';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  public catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<HttpRequest>();
    const lang = (request?.headers['accept-language'] as string) || 'en';

    const { status, message } = HttpExceptionFilter.handleExceptionType(exception, request, lang);

    response.status(status).send({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request?.url,
      message: message,
    });
  }

  private static handleExceptionType(exception: any, request: HttpRequest, lang = 'en') {
    let status: any = 500;
    let message: string[] | string = 'Internal Server Error';

    const langKey = !values().allowedLanguages.includes(lang) ? 'en' : lang;

    if (exception instanceof CustomHttpException) {
      status = exception.getStatus();
      const errorMessage: Message = exception.getErrorMessage();
      message = [errorMessage[langKey]];
    } else if (exception instanceof NestHttpException) {
      status = exception.getStatus();
      const responseResponse = exception.getResponse();
      message = typeof responseResponse === 'object' ? (responseResponse as any).message : responseResponse;
    } else if (exception instanceof Error) {
      status = exception['status'] || 400;
      const obj = exception['response'] ?? {};

      if (obj && typeof obj === 'object' && Object.keys(obj).length > 0) {
        message = obj['message'] || exception.message;
      } else {
        message = Array.isArray(exception.message) ? exception.message : [exception.message];
      }
    }

    return { status, message };
  }
}
