import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JenkinsRepository } from './jenkins.repository';
import { CryptoService } from '../../global/crypto/crypto.service';
import { HttpClientService } from '../../global/http/http-client.service';
import { JenkinsConfigDto } from './jenkins.dto';
import { ResolvedJenkinsConfig, JenkinsRootResponse, JenkinsConfigResponse, JenkinsTestResponse, JenkinsHealthResponse } from './jenkins.interface';

@Injectable()
export class JenkinsService {
  public constructor(
    private readonly jenkinsRepository: JenkinsRepository,
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
    private readonly httpClient: HttpClientService,
  ) {}

  /**
   * @function getConfig - Returns the effective Jenkins config (db > env) without the secret.
   */
  public async getConfig(): Promise<JenkinsConfigResponse> {
    const resolved = await this.resolveConfig();
    return {
      baseUrl: resolved.baseUrl,
      username: resolved.username,
      tokenSet: Boolean(resolved.apiToken),
      source: resolved.source,
    };
  }

  /**
   * @function saveConfig - Persists the Jenkins connection settings.
   * @param {JenkinsConfigDto} dto
   */
  public async saveConfig(dto: JenkinsConfigDto): Promise<void> {
    const baseUrl = this.normalizeBaseUrl(dto.baseUrl);
    const username = this.normalizeOptional(dto.username);

    if (!baseUrl) throw new BadRequestException('Valid Jenkins URL is required.');
    if (!username) throw new BadRequestException('Username is required for saved Jenkins connections.');

    const existing = await this.jenkinsRepository.findConfig();
    const envToken = this.normalizeOptional(this.configService.get<string>('jenkins.apiToken'));
    const tokenToEncrypt = this.normalizeOptional(dto.token) ?? (!existing?.encryptedToken ? envToken : null);

    if (!existing?.encryptedToken && !tokenToEncrypt) {
      throw new BadRequestException('API token is required for the first saved Jenkins connection.');
    }

    await this.jenkinsRepository.upsertConfig({
      baseUrl,
      username,
      encryptedToken: tokenToEncrypt ? this.cryptoService.encrypt(tokenToEncrypt) : undefined,
    });
  }

  /**
   * @function testConnection - Tests a Jenkins connection with supplied or stored credentials.
   * @param {JenkinsConfigDto} dto
   */
  public async testConnection(dto: JenkinsConfigDto): Promise<JenkinsTestResponse> {
    const baseUrl = this.normalizeBaseUrl(dto.baseUrl);
    const existing = await this.resolveConfig();
    const matchesStored = baseUrl === existing.baseUrl;
    const username = this.normalizeOptional(dto.username) ?? (matchesStored ? existing.username : null);
    const token = this.normalizeOptional(dto.token) ?? (matchesStored ? existing.apiToken : null);

    const url = this.buildApiUrl(baseUrl);
    if (!url) return { ok: false, message: 'Invalid URL.', version: null };

    try {
      const response = await this.requestJenkins(url, username, token);
      const version = response.headers.get('x-jenkins') ?? null;

      if (this.isAuthFailure(response.status)) {
        return {
          ok: false,
          message: username && token ? 'Jenkins rejected the credentials. Check your username and API token.' : 'Jenkins requires credentials.',
          version,
        };
      }
      if (!response.ok) {
        return { ok: false, message: `Jenkins returned HTTP ${response.status}.`, version };
      }

      const body = (await response.json()) as JenkinsRootResponse;
      return { ok: true, message: 'Connection successful.', version: version ?? body.version ?? null };
    } catch (error) {
      return { ok: false, message: this.errorMessage(error, 'Connection failed.'), version: null };
    }
  }

  /**
   * @function checkHealth - Full health report on the configured Jenkins instance.
   */
  public async checkHealth(): Promise<JenkinsHealthResponse> {
    const config = await this.resolveConfig();
    const checkedAt = new Date().toISOString();

    if (!config.baseUrl) {
      return this.healthResult({
        configured: false,
        reachable: false,
        authenticated: false,
        baseUrl: null,
        mode: 'not_configured',
        status: 'not_configured',
        version: null,
        message: 'Jenkins is not configured. Add a connection in Settings.',
        checkedAt,
      });
    }

    const mode = config.username && config.apiToken ? 'basic_auth' : 'anonymous';
    const url = this.buildApiUrl(config.baseUrl);

    if (!url) {
      return this.healthResult({
        configured: true,
        reachable: false,
        authenticated: false,
        baseUrl: config.baseUrl,
        mode,
        status: 'unreachable',
        version: null,
        message: 'Stored Jenkins URL is invalid.',
        checkedAt,
      });
    }

    try {
      const response = await this.requestJenkins(url, config.username, config.apiToken);
      const version = response.headers.get('x-jenkins') ?? null;

      if (this.isAuthFailure(response.status)) {
        return this.healthResult({
          configured: true,
          reachable: true,
          authenticated: false,
          baseUrl: config.baseUrl,
          mode,
          status: 'auth_required',
          version,
          message:
            mode === 'basic_auth' ? 'Jenkins rejected the configured username or API token.' : 'Jenkins is reachable but requires credentials.',
          checkedAt,
        });
      }
      if (!response.ok) {
        return this.healthResult({
          configured: true,
          reachable: false,
          authenticated: false,
          baseUrl: config.baseUrl,
          mode,
          status: 'unreachable',
          version,
          message: `Jenkins returned HTTP ${response.status}.`,
          checkedAt,
        });
      }

      const body = (await response.json()) as JenkinsRootResponse;
      return this.healthResult({
        configured: true,
        reachable: true,
        authenticated: mode === 'basic_auth' || body.useSecurity === false,
        baseUrl: config.baseUrl,
        mode,
        status: 'ok',
        version: version ?? body.version ?? null,
        message: 'Jenkins is reachable.',
        checkedAt,
      });
    } catch (error) {
      return this.healthResult({
        configured: true,
        reachable: false,
        authenticated: false,
        baseUrl: config.baseUrl,
        mode,
        status: 'unreachable',
        version: null,
        message: this.errorMessage(error, 'Jenkins health check failed.'),
        checkedAt,
      });
    }
  }

  // ---------- private helpers ----------

  private async resolveConfig(): Promise<ResolvedJenkinsConfig> {
    try {
      const row = await this.jenkinsRepository.findConfig();
      if (row?.baseUrl) {
        const apiToken = row.encryptedToken ? this.tryDecrypt(row.encryptedToken) : null;
        return { baseUrl: row.baseUrl, username: row.username, apiToken, source: 'db' };
      }
    } catch {
      // DB unavailable — fall through to env config.
    }

    const baseUrl = this.normalizeBaseUrl(this.configService.get<string>('jenkins.baseUrl'));
    if (baseUrl) {
      return {
        baseUrl,
        username: this.normalizeOptional(this.configService.get<string>('jenkins.username')),
        apiToken: this.normalizeOptional(this.configService.get<string>('jenkins.apiToken')),
        source: 'env',
      };
    }
    return { baseUrl: null, username: null, apiToken: null, source: 'none' };
  }

  private requestJenkins(url: string, username: string | null, token: string | null): Promise<Response> {
    const authHeader = this.buildAuthHeader(username, token);
    return this.httpClient.get(url, { headers: authHeader ? { Authorization: authHeader } : undefined });
  }

  private buildApiUrl(baseUrl: string | null): string | null {
    if (!baseUrl) return null;
    try {
      return new URL('/api/json', baseUrl).toString(); // URL validates + joins safely; we expose a plain string
    } catch {
      return null;
    }
  }

  private buildAuthHeader(username: string | null, apiToken: string | null): string | null {
    if (!username || !apiToken) return null;
    return `Basic ${Buffer.from(`${username}:${apiToken}`).toString('base64')}`;
  }

  private isAuthFailure(status: number): boolean {
    return status === 401 || status === 403;
  }

  private tryDecrypt(token: string): string | null {
    try {
      return this.cryptoService.decrypt(token);
    } catch {
      return null;
    }
  }

  private normalizeBaseUrl(value: string | undefined | null): string | null {
    const trimmed = this.normalizeOptional(value);
    return trimmed ? trimmed.replace(/\/+$/, '') : null;
  }

  private normalizeOptional(value: string | undefined | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }

  private healthResult(fields: Omit<JenkinsHealthResponse, 'provider'>): JenkinsHealthResponse {
    return { provider: 'jenkins', ...fields };
  }
}
