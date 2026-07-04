import { Injectable } from '@nestjs/common';

export interface TimedRequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

@Injectable()
export class HttpClientService {
  private static readonly DEFAULT_TIMEOUT_MS = 5000;

  public async get(url: string, options: TimedRequestOptions = {}): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? HttpClientService.DEFAULT_TIMEOUT_MS);
    try {
      return await fetch(url, { headers: options.headers, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }
}
