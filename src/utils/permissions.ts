export type PermissionScope = 'global' | 'region' | 'station';
export type PermissionAction = 'read' | 'create' | 'update' | 'delete' | 'approve' | 'export' | 'manage';

export interface PermissionConfig {
  scope?: PermissionScope;
  maxAmount?: number;
}

export type PermissionsMap = {
  [key: string]: boolean | PermissionConfig;
};

export type RolePermissions = {
  [key: string]: PermissionsMap;
};

export const PERMISSIONS: RolePermissions = {
  SUPER_ADMIN: {
    '*': true,
    'stations:*': true,
    'stations:read': true,
    'stations:create': true,
    'stations:update': true,
    'stations:delete': true,
    'stations:manage': true,
    'sales:*': true,
    'sales:read': true,
    'sales:create': true,
    'sales:update': true,
    'sales:delete': true,
    'sales:export': true,
    'sales:reconcile': true,
    'pumps:*': true,
    'pumps:read': true,
    'pumps:create': true,
    'pumps:update': true,
    'pumps:delete': true,
    'pumps:manage': true,
    'pumps:record': true,
    'inventory:*': true,
    'inventory:read': true,
    'inventory:create': true,
    'inventory:update': true,
    'inventory:delete': true,
    'inventory:manage': true,
    'expenses:*': true,
    'expenses:read': true,
    'expenses:create': true,
    'expenses:update': true,
    'expenses:delete': true,
    'expenses:approve': true,
    'expenses:manage': true,
    'users:*': true,
    'users:read': true,
    'users:create': true,
    'users:update': true,
    'users:delete': true,
    'users:manage': true,
    'reports:*': true,
    'reports:read': true,
    'reports:generate': true,
    'reports:export': true,
    'purchases:*': true,
    'purchases:read': true,
    'purchases:create': true,
    'purchases:update': true,
    'purchases:delete': true,
    'purchases:approve': true,
    'purchases:manage': true,
    'logistics:*': true,
    'logistics:read': true,
    'logistics:create': true,
    'logistics:update': true,
    'logistics:delete': true,
    'logistics:manage': true,
    'employees:*': true,
    'employees:read': true,
    'employees:create': true,
    'employees:update': true,
    'employees:delete': true,
    'employees:manage': true,
    'analytics:*': true,
    'analytics:read': true,
    'analytics:create': true,
    'analytics:update': true,
    'analytics:delete': true,
    'settings:*': true,
    'settings:read': true,
    'settings:create': true,
    'settings:update': true,
    'settings:delete': true,
    'support:*': true,
    'support:read': true,
    'support:create': true,
    'support:update': true,
    'support:delete': true,
    'support:manage': true,
    'notifications:*': true,
    'notifications:read': true,
    'notifications:create': true,
    'notifications:update': true,
    'notifications:delete': true,
    'audit:*': true,
    'audit:read': true,
  },

  REGIONAL_MANAGER: {
    // Depot Manager responsibilities merged here
    'stations:*': { scope: 'region' },
  'pumps:create': { scope: 'region' },  // ✅ Add this
  'pumps:update': { scope: 'region' },  // ✅ Add this
  'pumps:delete': { scope: 'region' },  // ✅ Add this
  'pumps:record': { scope: 'region' },  // ✅ Add this
    'pumps:manage': { scope: 'region' },  // ✅ Add this
    'stations:read': { scope: 'region' },
    'stations:view': { scope: 'region' },
    'stations:create': { scope: 'region' },
    'stations:update': { scope: 'region' },
    'stations:delete': { scope: 'region' },
    'stations:manage': { scope: 'region' },
    'sales:read': { scope: 'region' },
    'sales:export': { scope: 'region' },
    'pumps:read': { scope: 'region' },
    'inventory:read': { scope: 'region' },
    'inventory:manage': { scope: 'region' },
    'expenses:read': { scope: 'region' },
    'expenses:approve': { scope: 'region', maxAmount: 500000 },
    'expenses:create': { scope: 'region' },
    'reports:generate': { scope: 'region' },
    'reports:export': { scope: 'region' },
    'users:read': { scope: 'region' },
    'notifications:read': true,
    'purchases:*': { scope: 'region' },
    'purchases:create': { scope: 'region' },
    'purchases:read': { scope: 'region' },
    'purchases:update': { scope: 'region' },
    'purchases:manage': { scope: 'region' },
    'purchases:approve': { scope: 'region' },
    'logistics:*': { scope: 'region' },
    'logistics:read': { scope: 'region' },
    'logistics:create': { scope: 'region' },
    'logistics:update': { scope: 'region' },
    'logistics:manage': { scope: 'region' },
    'employees:read': { scope: 'region' },
    'employees:manage': { scope: 'region' },
    'analytics:read': { scope: 'region' },
    'settings:read': true,
    'settings:update': true,
    'support:read': { scope: 'region' },
    'support:create': { scope: 'region' },
    'support:manage': { scope: 'region' },
    'suppliers:*': { scope: 'region' },
    'suppliers:manage': { scope: 'region' },
  },

  SUPERVISOR: {  // Changed from SUPERVISOR
    'stations:read': { scope: 'station' },
    'stations:view': { scope: 'station' },
    'sales:read': { scope: 'station' },
    'sales:create': { scope: 'station' },
    'sales:reconcile': { scope: 'station' },
    'sales:export': { scope: 'station' },
    'pumps:read': { scope: 'station' },
    'pumps:update': { scope: 'station' },
    'pumps:record': { scope: 'station' },
    'pumps:manage': { scope: 'station' },
    'inventory:read': { scope: 'station' },
    'inventory:manage': { scope: 'station' },
    'expenses:create': { scope: 'station' },
    'expenses:read': { scope: 'station' },
    'expenses:manage': { scope: 'station', maxAmount: 100000 },
    'expenses:approve': { scope: 'station', maxAmount: 50000 },
    'reports:generate': { scope: 'station' },
    'reports:export': { scope: 'station' },
    'users:view': { scope: 'station' },
    'notifications:read': true,
    'purchases:request': { scope: 'station' },
    'purchases:read': { scope: 'station' },
    'purchases:create': { scope: 'station' },
    'purchases:manage': { scope: 'station' },
    'logistics:read': { scope: 'station' },
    'logistics:manage': { scope: 'station' },
    'employees:read': { scope: 'station' },
    'employees:manage': { scope: 'station' },
    'analytics:read': { scope: 'station' },
    'settings:read': true,
    'settings:update': true,
    'support:create': { scope: 'station' },
    'support:read': { scope: 'station' },
  },

  ATTENDANT: {
    'sales:create': { scope: 'station' },
    'sales:read': { scope: 'station' },
    'pumps:read': { scope: 'station' },
    'pumps:record': { scope: 'station' },
    'notifications:read': true,
  },

  ACCOUNTANT: {
    'sales:read': true,
    'sales:export': true,
    'expenses:*': true,
    'expenses:read': true,
    'expenses:approve': true,
    'expenses:create': true,
    'reports:*': true,
    'reports:generate': true,
    'reports:export': true,
    'users:read': true,
    'users:manage': true,
    'purchases:read': true,
    'purchases:approve': true,
    'notifications:read': true,
    'audit:read': true,
    'stations:read': true,
    'analytics:read': true,
  },
};

// Helper to check if user has permission
export const hasPermission = (role: string, permission: string): boolean => {
  const rolePermissions = PERMISSIONS[role];
  if (!rolePermissions) return false;

  // Check for wildcard permission
  if (rolePermissions['*'] === true) return true;

  const perm = rolePermissions[permission];
  if (perm === undefined) {
    // Check domain wildcard (e.g., "stations:*")
    const [domain] = permission.split(':');
    if (domain && rolePermissions[`${domain}:*`]) return true;
    return false;
  }
  if (perm === true) return true;
  if (typeof perm === 'object') return true;

  return false;
};

// Get permission configuration for scope checking
export const getPermissionConfig = (role: string, permission: string): PermissionConfig | null => {
  const rolePermissions = PERMISSIONS[role];
  if (!rolePermissions) return null;

  const perm = rolePermissions[permission];
  if (perm && typeof perm === 'object') {
    return perm;
  }

  // Check domain wildcard (e.g., "stations:*")
  const [domain] = permission.split(':');
  if (domain) {
    const domainWildcard = rolePermissions[`${domain}:*`];
    if (domainWildcard && typeof domainWildcard === 'object') {
      return domainWildcard;
    }
  }

  // Check global wildcard
  const globalWildcard = rolePermissions['*'];
  if (globalWildcard && typeof globalWildcard === 'object') {
    return globalWildcard;
  }

  return null;
};

// Get all permissions for a role
export const getRolePermissions = (role: string): PermissionsMap | null => {
  return PERMISSIONS[role] || null;
};

// Check if user has any of the given permissions
export const hasAnyPermission = (role: string, permissions: string[]): boolean => {
  return permissions.some(permission => hasPermission(role, permission));
};

// Check if user has all of the given permissions
export const hasAllPermissions = (role: string, permissions: string[]): boolean => {
  return permissions.every(permission => hasPermission(role, permission));
};