/**
 * Security Rules Specification & Verification Matrix for AutoCut AI Firestore
 * Covers Positive & Negative access cases across all Eight Pillars.
 */
export const SECURITY_RULES_TEST_MATRIX = [
  {
    name: "Unauthenticated user cannot read or write /users/{userId}/projects/{projectId}",
    auth: null,
    operation: "list",
    path: "/users/uid_alice/projects",
    expected: "DENY",
  },
  {
    name: "Authenticated user Alice can create her own project with server timestamps and valid schema",
    auth: { uid: "uid_alice", email_verified: true },
    operation: "create",
    path: "/users/uid_alice/projects/proj_123",
    expected: "ALLOW",
  },
  {
    name: "Authenticated user Alice cannot create project for Bob",
    auth: { uid: "uid_alice", email_verified: true },
    operation: "create",
    path: "/users/uid_bob/projects/proj_123",
    expected: "DENY",
  },
  {
    name: "Authenticated user Alice cannot elevate role to admin in /users/uid_alice/private/account",
    auth: { uid: "uid_alice", email_verified: true },
    operation: "create",
    path: "/users/uid_alice/private/account",
    payload: { role: "admin" },
    expected: "DENY",
  },
  {
    name: "Authenticated user Alice cannot mutate ownerUid or createdAt on project update",
    auth: { uid: "uid_alice", email_verified: true },
    operation: "update",
    path: "/users/uid_alice/projects/proj_123",
    payload: { ownerUid: "uid_bob" },
    expected: "DENY",
  },
  {
    name: "Boot-time connection check /test/connection allows get only",
    auth: null,
    operation: "get",
    path: "/test/connection",
    expected: "ALLOW",
  },
];
