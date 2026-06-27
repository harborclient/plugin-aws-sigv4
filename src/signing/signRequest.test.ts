import { describe, expect, it, vi, afterEach } from 'vitest';
import { signRequest } from './signRequest';

describe('signRequest', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('signs a GET request with a known test vector', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2015-08-30T12:36:00Z'));

    const result = await signRequest(
      {
        method: 'GET',
        url: 'https://example.amazonaws.com/',
        headers: {},
        body: ''
      },
      {
        accessKeyId: 'AKIDEXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
        service: 'iam'
      }
    );

    expect(result.errors).toBeUndefined();
    expect(result.headers.Authorization ?? result.headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=/
    );
    expect(result.headers['x-amz-date'] ?? result.headers['X-Amz-Date']).toBe('20150830T123600Z');
  });

  it('returns validation errors when credentials are missing', async () => {
    const result = await signRequest(
      {
        method: 'GET',
        url: 'https://example.amazonaws.com/',
        headers: {},
        body: ''
      },
      {
        accessKeyId: '',
        secretAccessKey: '',
        region: '',
        service: ''
      }
    );

    expect(result.headers).toEqual({});
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('includes session token headers when configured', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2015-08-30T12:36:00Z'));

    const result = await signRequest(
      {
        method: 'GET',
        url: 'https://example.amazonaws.com/',
        headers: {},
        body: ''
      },
      {
        accessKeyId: 'AKIDEXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
        service: 'iam',
        sessionToken: 'SESSIONTOKEN'
      }
    );

    expect(result.errors).toBeUndefined();
    expect(result.headers['x-amz-security-token'] ?? result.headers['X-Amz-Security-Token']).toBe(
      'SESSIONTOKEN'
    );
  });
});
