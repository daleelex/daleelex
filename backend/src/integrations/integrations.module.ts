import { Module } from '@nestjs/common';
import { JenkinsController } from './jenkins/jenkins.controller';
import { JenkinsService } from './jenkins/jenkins.service';
import { JenkinsRepository } from './jenkins/jenkins.repository';
import { CryptoService } from '../global/crypto/crypto.service';
import { HttpClientService } from '../global/http/http-client.service';
import { Logger } from '../global/logger/logger';

@Module({
  controllers: [JenkinsController],
  providers: [JenkinsService, JenkinsRepository, CryptoService, HttpClientService, Logger],
})
export class IntegrationsModule {}
