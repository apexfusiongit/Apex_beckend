export type AuthTokenPayload = {
  sub: string;
  email: string;
  role: string;
  exp: number;
};

function encode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  return atob(padded);
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return encode(String.fromCharCode(...new Uint8Array(signature)));
}

export async function createToken(payload: AuthTokenPayload, secret: string): Promise<string> {
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = encode(JSON.stringify(payload));
  return `${header}.${body}.${await sign(`${header}.${body}`, secret)}`;
}

export async function verifyToken(token: string, secret: string): Promise<AuthTokenPayload | null> {
  try {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;
    const expected = await sign(`${header}.${body}`, secret);
    if (signature.length !== expected.length) return null;

    let mismatch = 0;
    for (let index = 0; index < signature.length; index++) {
      mismatch |= signature.charCodeAt(index) ^ expected.charCodeAt(index);
    }
    if (mismatch !== 0) return null;

    const payload = JSON.parse(decode(body)) as AuthTokenPayload;
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}
