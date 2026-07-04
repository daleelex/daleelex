import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  public constructor(private readonly configService: ConfigService) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const configuredToken = this.configService.get<string>('admin.apiToken');

    if (!configuredToken) {
      throw new ForbiddenException({
        code: 'admin_auth_not_configured',
        message: 'Admin API token is not configured; catalog mutations are disabled.',
      });
    }

    const token = this.readBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException({
        code: 'missing_admin_token',
        message: 'Catalog mutations require an admin bearer token.',
      });
    }

    if (!this.tokensMatch(token, configuredToken)) {
      throw new ForbiddenException({
        code: 'admin_forbidden',
        message: 'The supplied token is not authorized to mutate the catalog.',
      });
    }

    return true;
  }

  private readBearerToken(header: string | undefined): string | null {
    const [scheme, token] = header?.split(' ') ?? [];
    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }

  private tokensMatch(candidate: string, expected: string): boolean {
    const candidateBuffer = Buffer.from(candidate);
    const expectedBuffer = Buffer.from(expected);
    return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
  }
}
