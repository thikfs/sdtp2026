import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpApi } from '../../src/app/api/http';
import { ApiError } from '../../src/app/api/errors';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(res: Response | Error) {
  const fn = vi.fn(async () => {
    if (res instanceof Error) throw res;
    return res;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('http api client', () => {
  it('sends the version as If-Match and the token as a bearer header', async () => {
    const fetch = stubFetch(new Response(JSON.stringify({ id: 'a1', version: 4 }), { status: 200 }));
    const api = httpApi('https://api.test/', () => 'tok');
    await api.updateAppointment('a1', { start: '2026-11-04T10:00:00.000Z' }, 3);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/api/appointments/a1');
    expect(init.method).toBe('PATCH');
    expect(init.headers).toMatchObject({ 'If-Match': '"3"', Authorization: 'Bearer tok', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ start: '2026-11-04T10:00:00.000Z' });
  });

  it('turns a 409 into an ApiError the UI can recognise', async () => {
    stubFetch(new Response('changed by someone else', { status: 409 }));
    await expect(httpApi('https://api.test').deleteAppointment('a1', 1)).rejects.toMatchObject({ status: 409, message: 'changed by someone else' });
  });

  it('reports network failures as status 0', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    const err = await httpApi('https://api.test').listRequests().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
  });

  it('accepts 204 No Content', async () => {
    stubFetch(new Response(null, { status: 204 }));
    await expect(httpApi('https://api.test').deleteAppointment('a1', 1)).resolves.toBeUndefined();
  });
});
