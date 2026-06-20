import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { INJECTION_TOKEN } from 'src/common/constants/injection-token.constant';
import { IS_PUBLIC_KEY } from '../decorators';
import { UnauthorizedException } from '../exceptions';
import { ERROR_CODE } from '../constants/error-code.constant';
import { AppConfigService } from 'src/config/config.service';
import { Request } from 'express';
import { AccessTokenPayload, JWT_BLACKLIST_PREFIX } from 'src/modules/auth/auth.service';

export const AUTHORIZATION = "authorization";
export const USER_PAYLOAD = "x-user-payload";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly config: AppConfigService,
    @Inject(INJECTION_TOKEN.REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // Check decorator
    if (this.hasMetadata(ctx, IS_PUBLIC_KEY)) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException(
        ERROR_CODE.UNAUTHORIZED, 
        "Không tìm thấy token"
      );
    } 

    let payload: AccessTokenPayload;
    try {
      payload = this.jwt.verify(token, { secret: this.config.jwt.accessSecret });
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        throw new UnauthorizedException(ERROR_CODE.TOKEN_EXPIRED, "Token hết hạn, hãy refresh");
      }
      throw new UnauthorizedException(ERROR_CODE.UNAUTHORIZED, "Token không hợp lệ");
    }

     // Check blacklist 
    const blacklistKey = `${JWT_BLACKLIST_PREFIX}${payload.jti}`;
    const isBlacklisted = await this.redis.get(blacklistKey);
    if (isBlacklisted) {
      throw new UnauthorizedException(ERROR_CODE.UNAUTHORIZED, "Phiên đã bị thu hồi");
    }
 
    req[USER_PAYLOAD] = payload;
    
    return true;
  }

  private extractToken(req: Request): string | null {
    const authorization: string = req.headers[AUTHORIZATION] || "";
    if(!authorization.startsWith("Bearer ")) return null;
    return authorization.slice(7) || null;
  }

  private hasMetadata(ctx: ExecutionContext, key: string): boolean {
    return this.reflector.getAllAndOverride<boolean>(key, [
      ctx.getHandler(),
      ctx.getClass(),
    ]) === true;
  }
}