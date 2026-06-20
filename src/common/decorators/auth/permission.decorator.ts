import { SetMetadata } from "@nestjs/common";
import { StaffPermissionKey } from "src/modules/restaurant/staff/schemas/staff.schema";


export const REQUIRE_PERMISSION_KEY = "requirePermission";
export const RequirePermission = (...perms: StaffPermissionKey[]) => SetMetadata(REQUIRE_PERMISSION_KEY, perms);