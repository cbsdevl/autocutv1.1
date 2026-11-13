# Security Specification — AutoCut AI Firestore

## Collections & Access Matrix

1. `/users/{userId}` (`UserPublicProfile`)
   - **Read (`get`)**: Authenticated user for their own doc (`isOwner(userId)`) or Admin (`isAdmin()`). `list` denied to prevent enumeration.
   - **Create**: `isOwner(userId)`, validates `isValidId(userId)`, `isValidUserProfile(request.resource.data)`, `uid == userId`, `createdAt == request.time`, `updatedAt == request.time`.
   - **Update**: `isOwner(userId)`, `uid` & `createdAt` immutable, validates updated fields and `updatedAt == request.time`.
   - **Delete**: Denied from client (only admins).

2. `/users/{userId}/private/account` (`UserPrivateAccount` - PII Isolation)
   - **Read (`get`, `list`)**: Strictly `isOwner(userId)` or `isAdmin()`.
   - **Create**: `isOwner(userId)`, validates `isValidPrivateAccount`, `role == 'user'` (prevents client self-promotion to admin), `uid == userId`, `updatedAt == request.time`.
   - **Update**: `isOwner(userId)`, `role` & `uid` immutable unless `isAdmin()`, validates `isValidPrivateAccount` & `updatedAt == request.time`.
   - **Delete**: Denied.

3. `/users/{userId}/projects/{projectId}` (`ProjectDocument`)
   - **Read (`get`)**: `isOwner(userId)` or `isAdmin()`.
   - **Query (`list`)**: `isOwner(userId)` and `resource.data.ownerUid == request.auth.uid`, or `isAdmin()`.
   - **Create**: `isOwner(userId)`, validates `isValidId(projectId)`, `isValidProjectDocument(request.resource.data)`, `ownerUid == userId`, `id == projectId`, `createdAt == request.time`, `updatedAt == request.time`.
   - **Update**: `isOwner(userId)`, `ownerUid`, `id`, and `createdAt` immutable; validates `isValidProjectDocument(request.resource.data)`, `updatedAt == request.time`, and `affectedKeys().hasOnly(['name', 'aspectRatio', 'resolution', 'frameRate', 'mediaCount', 'thumbnail', 'snapshotJson', 'updatedAt'])`.
   - **Delete**: `isOwner(userId)` or `isAdmin()`.

4. `/admins/{userId}` (`AdminEntry`)
   - **Read**: `isOwner(userId)` or `isAdmin()`.
   - **Write**: `isAdmin()` (or bootstrap check denied from untrusted clients; default admin email `nizeyimanaplacide2@gmail.com` allowed only when `email_verified == true` to bootstrap admin collection if needed, otherwise deny client escalation).

5. `/test/connection`
   - **Read (`get`)**: Allowed so boot-time connectivity check (`getDocFromServer`) verifies Firestore availability cleanly; `list` and `write` denied.
