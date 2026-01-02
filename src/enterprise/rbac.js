/**
 * Phase 11: Role-Based Access Control (RBAC)
 * Enforce permission checks for enterprise features
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const RBAC_DIR = path.join(os.homedir(), '.odavl-guardian', 'rbac');
const USERS_FILE = path.join(RBAC_DIR, 'users.json');

// Role definitions
const ROLES = {
  ADMIN: {
    name: 'ADMIN',
    permissions: [
      'scan:run',
      'scan:view',
      'live:run',
      'site:add',
      'site:remove',
      'site:view',
      'plan:view',
      'plan:upgrade',
      'user:add',
      'user:remove',
      'user:view',
      'audit:view',
      'export:pdf',
      'recipe:manage',
    ],
  },
  OPERATOR: {
    name: 'OPERATOR',
    permissions: [
      'scan:run',
      'scan:view',
      'live:run',
      'site:view',
      'plan:view',
      'export:pdf',
    ],
  },
  VIEWER: {
    name: 'VIEWER',
    permissions: [
      'scan:view',
      'site:view',
      'plan:view',
      'audit:view',
    ],
  },
};

/**
 * Ensure RBAC directory exists
 */
function ensureRbacDir() {
  if (!fs.existsSync(RBAC_DIR)) {
    fs.mkdirSync(RBAC_DIR, { recursive: true });
  }
}

/**
 * Get all users
 */
function getUsers() {
  ensureRbacDir();
  
  if (!fs.existsSync(USERS_FILE)) {
    // Default: current user is ADMIN
    const defaultUser = {
      username: os.userInfo().username || 'admin',
      role: 'ADMIN',
      addedAt: new Date().toISOString(),
    };
    return { users: [defaultUser] };
  }
  
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch (_error) {
    const defaultUser = {
      username: os.userInfo().username || 'admin',
      role: 'ADMIN',
      addedAt: new Date().toISOString(),
    };
    return { users: [defaultUser] };
  }
}

/**
 * Save users
 */
function saveUsers(data) {
  ensureRbacDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Add a user
 */
function addUser(username, role = 'VIEWER') {
  if (!ROLES[role]) {
    throw new Error(`Invalid role: ${role}. Must be ADMIN, OPERATOR, or VIEWER`);
  }
  
  const data = getUsers();
  
  // Check if user already exists
  const existing = data.users.find(u => u.username === username);
  if (existing) {
    throw new Error(`User '${username}' already exists`);
  }
  
  const user = {
    username,
    role,
    addedAt: new Date().toISOString(),
  };
  
  data.users.push(user);
  saveUsers(data);
  
  return user;
}

/**
 * Remove a user
 */
function removeUser(username) {
  const data = getUsers();
  
  const index = data.users.findIndex(u => u.username === username);
  if (index === -1) {
    throw new Error(`User '${username}' not found`);
  }
  
  // Prevent removing last ADMIN
  const user = data.users[index];
  if (user.role === 'ADMIN') {
    const adminCount = data.users.filter(u => u.role === 'ADMIN').length;
    if (adminCount === 1) {
      throw new Error('Cannot remove last ADMIN user');
    }
  }
  
  data.users.splice(index, 1);
  saveUsers(data);
  
  return user;
}

/**
 * Get current user
 */
function getCurrentUser() {
  const currentUsername = os.userInfo().username || 'admin';
  const data = getUsers();
  
  let user = data.users.find(u => u.username === currentUsername);
  
  // If user doesn't exist, create as ADMIN
  if (!user) {
    user = {
      username: currentUsername,
      role: 'ADMIN',
      addedAt: new Date().toISOString(),
    };
    data.users.push(user);
    saveUsers(data);
  }
  
  return user;
}

/**
 * Check if user has permission
 */
function hasPermission(permission) {
  const user = getCurrentUser();
  const role = ROLES[user.role];
  
  if (!role) {
    return false;
  }
  
  return role.permissions.includes(permission);
}

/**
 * Require permission (throws if denied)
 */
function requirePermission(permission, action = null) {
  if (!hasPermission(permission)) {
    const user = getCurrentUser();
    const actionMsg = action ? ` to ${action}` : '';
    throw new Error(
      `Permission denied${actionMsg}. Required: ${permission}. Your role: ${user.role}`
    );
  }
}

/**
 * Get role details
 */
function getRole(roleName) {
  return ROLES[roleName];
}

/**
 * List all roles
 */
function listRoles() {
  return Object.values(ROLES);
}

/**
 * Reset users (for testing)
 */
function resetUsers() {
  if (fs.existsSync(USERS_FILE)) {
    fs.unlinkSync(USERS_FILE);
  }
}

module.exports = {
  ROLES,
  addUser,
  removeUser,
  getUsers,
  getCurrentUser,
  hasPermission,
  requirePermission,
  getRole,
  listRoles,
  resetUsers,
};
