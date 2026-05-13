import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

export const templatePublishPermissions = {
  template: ["publish"] as Array<"publish">,
};

export const organizationAccessControl = createAccessControl({
  ...defaultStatements,
  template: ["publish"],
} as const);

export const organizationRoles = {
  owner: organizationAccessControl.newRole({
    ...ownerAc.statements,
    template: ["publish"],
  }),
  admin: organizationAccessControl.newRole({
    ...adminAc.statements,
    template: ["publish"],
  }),
  member: organizationAccessControl.newRole({
    ...memberAc.statements,
    template: [],
  }),
};
