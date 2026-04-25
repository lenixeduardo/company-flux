export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  FINANCEIRO = 'FINANCEIRO',
  LEITURA = 'LEITURA',
}

export const ROLE_HIERARCHY = {
  [UserRole.OWNER]: 4,
  [UserRole.ADMIN]: 3,
  [UserRole.FINANCEIRO]: 2,
  [UserRole.LEITURA]: 1,
};

export const ROLES_WITH_WRITE = [UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCEIRO];
export const ROLES_WITH_ADMIN = [UserRole.OWNER, UserRole.ADMIN];
export const ROLES_OWNER_ONLY = [UserRole.OWNER];
