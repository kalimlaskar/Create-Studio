import 'server-only';
import crypto from 'node:crypto';

// Cloudflare R2 through its S3-compatible API, using presigned URLs
// (AWS Signature Version 4, query-string auth). The browser uploads and plays
// files straight from R2 with these short-lived URLs, so video bytes never pass
// through this server.
//
// R2 setup: a private bucket, an API token with Object Read & Write on it, and a
// CORS rule allowing PUT and GET from the app's origin (see README).

const REGION = 'auto';
const SERVICE = 's3';

interface R2Config {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
}

export function getR2Config(): R2Config | null {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET;
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
    return { accountId, accessKeyId, secretAccessKey, bucket };
}

export const isR2Configured = () => getR2Config() !== null;

/** RFC 3986 encoding, as SigV4 requires (encodeURIComponent leaves !'()* alone). */
const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

const hmac = (key: crypto.BinaryLike, data: string) => crypto.createHmac('sha256', key).update(data).digest();
const sha256Hex = (data: string) => crypto.createHash('sha256').update(data).digest('hex');

export interface PresignInput {
    method: 'GET' | 'PUT' | 'HEAD' | 'DELETE';
    /** Host and path-style object path, e.g. "<account>.r2.cloudflarestorage.com" and "/bucket/key". */
    host: string;
    path: string;
    accessKeyId: string;
    secretAccessKey: string;
    region?: string;
    expiresIn: number;
    now?: Date;
    /** Extra signed query parameters, such as response-content-disposition. */
    query?: Record<string, string>;
}

/** Builds a SigV4 presigned URL. Exported separately so it can be checked against AWS's published example. */
export function presignUrl(input: PresignInput) {
    const region = input.region ?? REGION;
    const now = input.now ?? new Date();
    const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const day = amzDate.slice(0, 8);
    const scope = `${day}/${region}/${SERVICE}/aws4_request`;

    const params: Record<string, string> = {
        ...input.query,
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': `${input.accessKeyId}/${scope}`,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': String(Math.max(1, Math.min(604800, Math.round(input.expiresIn)))),
        'X-Amz-SignedHeaders': 'host',
    };
    const canonicalQuery = Object.keys(params)
        .sort()
        .map((key) => `${encode(key)}=${encode(params[key])}`)
        .join('&');
    const canonicalPath = input.path.split('/').map(encode).join('/');
    const canonicalRequest = [input.method, canonicalPath, canonicalQuery, `host:${input.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

    const signingKey = hmac(hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, day), region), SERVICE), 'aws4_request');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    return `https://${input.host}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** A presigned URL for one object in the configured R2 bucket. */
export function r2Url(method: PresignInput['method'], key: string, expiresIn: number, query?: Record<string, string>) {
    const config = getR2Config();
    if (!config) throw new Error('R2 storage is not configured.');
    return presignUrl({
        method,
        host: `${config.accountId}.r2.cloudflarestorage.com`,
        path: `/${config.bucket}/${key}`,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        expiresIn,
        query,
    });
}

/** Size of an object, or null when it doesn't exist. */
export async function headObject(key: string): Promise<{ size: number; contentType: string | null } | null> {
    const response = await fetch(r2Url('HEAD', key, 60), { method: 'HEAD', cache: 'no-store' });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`R2 returned ${response.status} for HEAD.`);
    return { size: Number(response.headers.get('content-length') ?? 0), contentType: response.headers.get('content-type') };
}

export async function deleteObject(key: string) {
    const response = await fetch(r2Url('DELETE', key, 60), { method: 'DELETE', cache: 'no-store' });
    if (!response.ok && response.status !== 404) throw new Error(`R2 returned ${response.status} for DELETE.`);
}

/** Reads part of an object, e.g. "bytes=0-262143" or the last 1 MB with "bytes=-1048576". */
export async function readObjectRange(key: string, range: string): Promise<Uint8Array> {
    const response = await fetch(r2Url('GET', key, 120), { headers: { Range: range }, cache: 'no-store' });
    if (!response.ok && response.status !== 206) throw new Error(`R2 returned ${response.status} for a ranged read.`);
    return new Uint8Array(await response.arrayBuffer());
}
