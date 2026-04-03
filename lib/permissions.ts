import { Role } from "@prisma/client";

export const can = {
  viewClientInfo: (role: Role) =>
    ["ADMIN", "OPS"].includes(role),
  viewFinancials: (role: Role) => ["ADMIN", "OPS"].includes(role),
  createJob: (role: Role) => ["ADMIN", "OPS"].includes(role),
  editDiagnosis: (role: Role) =>
    ["ADMIN", "TECHNICIAN_INTERNAL", "TECHNICIAN_EXTERNAL"].includes(role),
  manageUsers: (role: Role) => role === "ADMIN",
  approveWork: (role: Role) => ["ADMIN", "OPS"].includes(role),
};
