import { ServiceType, ServiceTier, ServiceLifecycle, LinkType } from '../common/enums/catalog.enums';
import { Service as ServiceModel, Team, Link } from '../lib/prisma/generated/client';

export type ServiceWithRelations = ServiceModel & { owner?: Team | null; links?: Link[] };

export interface ServiceOwner {
  id: string;
  name: string;
  slackChannel: string | null;
  onCallSchedule: string | null;
}

export interface ServiceLink {
  id: number;
  url: string;
  title: string | null;
  type: LinkType;
}

export interface ServiceResponse {
  id: string;
  name: string;
  description: string | null;
  type: ServiceType;
  tier: ServiceTier;
  lifecycle: ServiceLifecycle;
  ownerTeamId: string | null;
  owner: ServiceOwner | null;
  language: string | null;
  repository: string | null;
  sloTarget: string | null;
  sloWindow: string | null;
  tags: string[];
  links: ServiceLink[];
  createdAt: string;
  updatedAt: string;
}

export interface ServiceListResponse {
  data: ServiceResponse[];
  total: number;
}
