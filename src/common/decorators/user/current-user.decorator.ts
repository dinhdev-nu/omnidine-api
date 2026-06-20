import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";
import { USER_PAYLOAD } from "src/common/guards/jwt-auth.guard";
import { AccessTokenPayload } from "src/modules/auth/auth.service"


type UserParamKey = keyof AccessTokenPayload;

export const CurrentUser = createParamDecorator(
    (data: UserParamKey | undefined, ctx: ExecutionContext) => {
        const req = ctx.switchToHttp().getRequest<Request>();
        const user = req[USER_PAYLOAD] as AccessTokenPayload;

        if (!user) return null;

        if (!data) return user;

        return user[data];
    }
)