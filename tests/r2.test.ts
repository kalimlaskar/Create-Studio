import { describe, expect, it } from 'vitest';
import { presignUrl } from '@/lib/storage/r2';

describe('R2 presigned URLs', () => {
    it('matches the signature in AWS’s published Signature V4 example', () => {
        const url = presignUrl({
            method: 'GET', host: 'examplebucket.s3.amazonaws.com', path: '/test.txt',
            accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
            region: 'us-east-1', expiresIn: 86400, now: new Date('2013-05-24T00:00:00Z'),
        });
        expect(new URL(url).searchParams.get('X-Amz-Signature')).toBe('aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404');
    });
});
