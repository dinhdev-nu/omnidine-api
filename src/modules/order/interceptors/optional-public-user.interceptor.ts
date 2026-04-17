import {
    CallHandler,
    ExecutionContext,
    Inject,
    Injectable,
    NestInterceptor,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { Types } from "mongoose";
import { Observable } from "rxjs";
import Redis from "ioredis";
import { INJECTION_TOKEN } from "src/common/constants/injection-token.constant";
import { AppConfigService } from "src/config/config.service";
import {
    AccessTokenPayload,
    JWT_BLACKLIST_PREFIX,
} from "src/modules/auth/auth.service.xxx";
import { USER_PAYLOAD } from "src/common/guards/jwt-auth.guard";

@Injectable()
export class OptionalPublicUserInterceptor implements NestInterceptor {
    constructor(
        private readonly jwt: JwtService,
        private readonly config: AppConfigService,

        @Inject(INJECTION_TOKEN.REDIS_CLIENT)
        private readonly redis: Redis,
    ) {}

    async intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Promise<Observable<unknown>> {
        const req = context.switchToHttp().getRequest<Request>();
        req[USER_PAYLOAD] = await this.resolveOptionalUserId(req);
        return next.handle();
    }

    private async resolveOptionalUserId(req: Request): Promise<AccessTokenPayload | null> {
        const authorization = req.headers.authorization;
        if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
            return null;
        }

        const token = authorization.slice(7).trim();
        if (!token) return null;

        try {
            const payload = this.jwt.verify<AccessTokenPayload>(token, {
                secret: this.config.jwt.accessSecret,
            });

            const userIdRaw = payload?.sub;
            if (!userIdRaw || !Types.ObjectId.isValid(userIdRaw)) {
                return null;
            }

            if (payload?.jti) {
                const isBlacklisted = await this.redis.get(
                    `${JWT_BLACKLIST_PREFIX}${payload.jti}`,
                );
                if (isBlacklisted) return null;
            }

            return payload;
        } catch {
            return null;
        }
    }
}
