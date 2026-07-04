import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

@Injectable()
export class CryptoService implements OnModuleInit {
  private key: Buffer;

  public constructor(private readonly configService: ConfigService) {}

  public onModuleInit(): void {
    const hex = this.configService.get<string>('crypto.encryptionKey') ?? '';
    const buffer = Buffer.from(hex, 'hex');

    if (buffer.length !== 32) {
      throw new Error(
        'DALEELEX_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      );
    }

    this.key = buffer;
  }

  public encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  public decrypt(token: string): string {
    const parts = token.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted token format');

    const [ivHex, tagHex, encHex] = parts;
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') + decipher.final('utf8');
  }
}
