import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../constants/role.constant';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../decorators';
import { ForbiddenException, UnauthorizedException } from '../exceptions';
import { ERROR_CODE } from '../constants/error-code.constant';
import { AccessTokenPayload } from 'src/modules/auth/auth.service.xxx';
import { USER_PAYLOAD } from './jwt-auth.guard';
import { Request } from 'express';


export const SYSTEM_ROLE_GUARD = 'system-roles';

@Injectable()
export class SystemRoleGuard implements CanActivate {

  constructor(private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.hasMetadata(ctx, IS_PUBLIC_KEY);
    if (isPublic) return true;

    const requiredRoles = this.requiredRoles(ctx);
    if (requiredRoles.length === 0) return true;

    const user = this.getUser(ctx);
    if (!user) {
      throw new UnauthorizedException(
        ERROR_CODE.UNAUTHORIZED,
        "Chưa xác thực"
      )
    }

    const hasRole = requiredRoles.includes(user?.system_role as Role);
    this.isThrowForbidden(hasRole, "Bạn không có quyền truy cập tài nguyên này");

    return true;
  }

  private hasMetadata(ctx: ExecutionContext, key: string): boolean {
    return this.reflector.getAllAndOverride<boolean>(key, [
      ctx.getHandler(),
      ctx.getClass(),
    ]) === true;
  }

  private requiredRoles(ctx: ExecutionContext): Role[] {
    return this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]) || [];
  }

  private getUser(ctx: ExecutionContext): AccessTokenPayload | null {
    const req = ctx.switchToHttp().getRequest<Request>();
    const user = req[USER_PAYLOAD] as AccessTokenPayload | undefined;
    return user || null;
  }

  private isThrowForbidden(value: boolean, message: string = "Bạn không có quyền truy cập tài nguyên này"): void {
    if (!value) {
      throw new ForbiddenException(
        ERROR_CODE.FORBIDDEN, 
        message
      );
    }
  }
}
