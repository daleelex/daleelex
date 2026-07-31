import { describe, expect, it } from 'vitest';
import { normalizeTeamRequest, validateTeamRequest } from './CreateTeamModal';

describe('team creation form validation', () => {
  it('normalizes whitespace and empty optional fields before submission', () => {
    expect(
      normalizeTeamRequest({
        id: ' platform-edge ',
        name: ' Platform Edge ',
        slackChannel: ' #platform-edge ',
        onCallSchedule: '   ',
      }),
    ).toEqual({
      id: 'platform-edge',
      name: 'Platform Edge',
      slackChannel: '#platform-edge',
      onCallSchedule: null,
    });
  });

  it('accepts the API-supported team field shapes', () => {
    expect(
      validateTeamRequest({
        id: 'platform-edge',
        name: 'Platform Edge',
        slackChannel: '#platform_edge-2',
        onCallSchedule: 'PD-SCHED-42',
      }),
    ).toEqual({});
  });

  it('flags invalid IDs, blank names, and Slack channels without a leading hash', () => {
    expect(
      validateTeamRequest({
        id: 'Platform Edge',
        name: '',
        slackChannel: 'platform-edge',
        onCallSchedule: null,
      }),
    ).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      slackChannel: expect.any(String),
    });
  });
});
