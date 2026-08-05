import Redis from 'ioredis';

export type PasswordResetOtpResult =
    | { status: 'verified' }
    | { status: 'invalid'; remainingAttempts: number }
    | { status: 'attempts_exceeded' }
    | { status: 'session_not_found' }
    | { status: 'otp_not_found' };

const INCREMENT_RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return { count, redis.call('TTL', KEYS[1]) }
`;

const VERIFY_OTP_AND_ISSUE_GRANT_SCRIPT = `
local sessionRaw = redis.call('GET', KEYS[1])
if not sessionRaw then
    return { 'SESSION_NOT_FOUND', '0' }
end

local otpRaw = redis.call('GET', KEYS[2])
if not otpRaw then
    redis.call('DEL', KEYS[1])
    return { 'OTP_NOT_FOUND', '0' }
end

local sessionOk, sessionData = pcall(cjson.decode, sessionRaw)
local otpOk, otpData = pcall(cjson.decode, otpRaw)
if not sessionOk or not otpOk then
    redis.call('DEL', KEYS[1], KEYS[2])
    return { 'OTP_NOT_FOUND', '0' }
end

local maxAttempts = tonumber(ARGV[2])
local attempts = tonumber(otpData.attempt) or 0
if attempts >= maxAttempts then
    redis.call('DEL', KEYS[1], KEYS[2])
    return { 'ATTEMPTS_EXCEEDED', '0' }
end

if sessionData.decoy == true or otpData.otpHash ~= ARGV[1] then
    attempts = attempts + 1

    if attempts >= maxAttempts then
        redis.call('DEL', KEYS[1], KEYS[2])
        return { 'ATTEMPTS_EXCEEDED', '0' }
    end

    otpData.attempt = attempts
    redis.call('SET', KEYS[2], cjson.encode(otpData), 'KEEPTTL')
    return { 'INVALID', tostring(maxAttempts - attempts) }
end

redis.call(
    'SET',
    KEYS[3],
    cjson.encode({ user_id = sessionData.user_id }),
    'EX',
    tonumber(ARGV[3])
)
redis.call('DEL', KEYS[1], KEYS[2])
return { 'VERIFIED', tostring(maxAttempts - attempts) }
`;

const CONSUME_GRANT_SCRIPT = `
local grant = redis.call('GET', KEYS[1])
if grant then
    redis.call('DEL', KEYS[1])
end
return grant
`;

type RedisEvalClient = Pick<Redis, 'eval'>;

export class PasswordResetStore {
    constructor(private readonly redis: RedisEvalClient) {}

    async incrementRequestCount(key: string, ttlSeconds: number): Promise<{ count: number; ttl: number }> {
        const [count, ttl] = (await this.redis.eval(
            INCREMENT_RATE_LIMIT_SCRIPT,
            1,
            key,
            ttlSeconds.toString(),
        )) as [number, number];

        return { count: Number(count), ttl: Number(ttl) };
    }

    async verifyOtpAndIssueGrant(input: {
        sessionKey: string;
        otpKey: string;
        grantKey: string;
        submittedOtpHash: string;
        maxAttempts: number;
        grantTtlSeconds: number;
    }): Promise<PasswordResetOtpResult> {
        const [status, remainingAttempts] = (await this.redis.eval(
            VERIFY_OTP_AND_ISSUE_GRANT_SCRIPT,
            3,
            input.sessionKey,
            input.otpKey,
            input.grantKey,
            input.submittedOtpHash,
            input.maxAttempts.toString(),
            input.grantTtlSeconds.toString(),
        )) as [string, string];

        switch (status) {
            case 'VERIFIED':
                return { status: 'verified' };
            case 'INVALID':
                return { status: 'invalid', remainingAttempts: Number(remainingAttempts) };
            case 'ATTEMPTS_EXCEEDED':
                return { status: 'attempts_exceeded' };
            case 'SESSION_NOT_FOUND':
                return { status: 'session_not_found' };
            default:
                return { status: 'otp_not_found' };
        }
    }

    async consumeGrant(grantKey: string): Promise<string | null> {
        return this.redis.eval(CONSUME_GRANT_SCRIPT, 1, grantKey) as Promise<string | null>;
    }
}
