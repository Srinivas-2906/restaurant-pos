import { SetMetadata } from "@nestjs/common";
import type { AppAccessPermission } from "@kaana/shared-types";

export const APP_ACCESS_KEY = "appAccess";

export const RequireAppAccess = (access: AppAccessPermission) =>
  SetMetadata(APP_ACCESS_KEY, access);
