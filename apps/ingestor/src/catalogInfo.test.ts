import { describe, expect, it } from 'vitest';
import { parseCatalogInfo } from './catalogInfo.js';

const FULL = `
apiVersion: daleelex.io/v1
kind: Service
metadata:
  id: svc-auth-001
  name: Authentication Gateway
  description: |
    OAuth2 / OIDC gateway handling SSO.
spec:
  type: api
  tier: 1
  lifecycle: production
  owner: platform-identity
  language: Go
  repository: platform/auth-gateway
  slo:
    target: "99.95%"
    window: 30d
  tags:
    - critical
    - security
`;

const MINIMAL = `
apiVersion: daleelex.io/v1
kind: Service
metadata:
  id: svc-tiny-001
  name: Tiny
spec:
  type: tool
  tier: 3
  lifecycle: beta
`;

describe('parseCatalogInfo', () => {
  it('reads every supported field', () => {
    const { service, errors, warnings } = parseCatalogInfo(FULL, 'platform/auth-gateway');

    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(service).toEqual({
      id: 'svc-auth-001',
      name: 'Authentication Gateway',
      description: 'OAuth2 / OIDC gateway handling SSO.',
      type: 'api',
      tier: 1,
      lifecycle: 'production',
      ownerRef: 'platform-identity',
      language: 'Go',
      repository: 'platform/auth-gateway',
      sloTarget: '99.95%',
      sloWindow: '30d',
      tags: ['critical', 'security'],
    });
  });

  it('accepts a file with only the required fields', () => {
    const { service, errors } = parseCatalogInfo(MINIMAL, 'acme/tiny');

    expect(errors).toEqual([]);
    expect(service).toMatchObject({
      id: 'svc-tiny-001',
      ownerRef: null,
      sloTarget: null,
      tags: [],
      repository: 'acme/tiny',
    });
  });

  it('rejects a file that is not a daleelex service', () => {
    const { service, errors } = parseCatalogInfo(
      'apiVersion: backstage.io/v1alpha1\nkind: Component\n',
      'acme/other',
    );

    expect(service).toBeNull();
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('apiVersion'),
        expect.stringContaining('kind'),
      ]),
    );
  });

  it('names every invalid required field at once', () => {
    const { service, errors } = parseCatalogInfo(
      `apiVersion: daleelex.io/v1
kind: Service
metadata:
  name: No id
spec:
  type: database
  tier: 7
  lifecycle: retired
`,
      'acme/broken',
    );

    expect(service).toBeNull();
    expect(errors).toHaveLength(4);
    expect(errors.join('\n')).toContain('metadata.id is required');
    expect(errors.join('\n')).toContain('spec.type must be one of');
    expect(errors.join('\n')).toContain('spec.tier must be one of');
    expect(errors.join('\n')).toContain('spec.lifecycle must be one of');
  });

  it('warns about unknown fields but still imports the service', () => {
    const { service, errors, warnings } = parseCatalogInfo(
      `${MINIMAL}  costCentre: ops\n  experiment: true\n`,
      'acme/tiny',
    );

    expect(errors).toEqual([]);
    expect(service).not.toBeNull();
    expect(warnings).toEqual([
      'Unknown field spec.costCentre; ignoring it.',
      'Unknown field spec.experiment; ignoring it.',
    ]);
  });

  it('prefers the repository it was found in over a stale declared one', () => {
    const { service, warnings } = parseCatalogInfo(FULL, 'platform/auth-gateway-renamed');

    expect(service?.repository).toBe('platform/auth-gateway-renamed');
    expect(warnings).toEqual([
      'spec.repository "platform/auth-gateway" does not match platform/auth-gateway-renamed; using platform/auth-gateway-renamed.',
    ]);
  });

  it('reports malformed YAML instead of throwing', () => {
    const { service, errors } = parseCatalogInfo('metadata: [unclosed\n', 'acme/broken');

    expect(service).toBeNull();
    expect(errors[0]).toContain('not valid YAML');
  });

  it('ignores tags that are not a list of strings', () => {
    const { service, warnings } = parseCatalogInfo(`${MINIMAL}  tags: critical\n`, 'acme/tiny');

    expect(service?.tags).toEqual([]);
    expect(warnings).toContain('spec.tags is not a list; ignoring it.');
  });

  it('rejects an id that would not be a stable slug', () => {
    const { service, errors } = parseCatalogInfo(
      MINIMAL.replace('svc-tiny-001', 'Svc Tiny 001'),
      'acme/tiny',
    );

    expect(service).toBeNull();
    expect(errors[0]).toContain('must be lowercase letters, digits and hyphens');
  });
});
