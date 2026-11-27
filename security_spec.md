# Automator AI — Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Master Gate Ownership**: All subcollection documents (`/projects/{projectId}/testCases/*`, `runs/*`, `sqaPlans/*`, `sqaSuites/*`, `sqaDefects/*`, `sqaRequirements/*`, `sqaReleases/*`) MUST belong to an existing parent `/projects/{projectId}` document whose `ownerUid == request.auth.uid`, verified via `get()`.
2. **Verified Identity & Zero Self-Promotion**: Every write requires `request.auth != null && request.auth.token.email_verified == true`. Users cannot assign `admin` role in `/users/{userId}` and cannot write `/admins/{userId}`.
3. **PII Isolation**: User email addresses reside exclusively in `/users/{userId}/private/info` and are strictly readable/writable only by `request.auth.uid == userId`.
4. **Immutable Ownership & Timestamps**: `ownerUid`, `projectId`, `uid`, and `createdAt` cannot be modified after creation. `createdAt == request.time` on create; `updatedAt == request.time` on update.
5. **Terminal State Locking**: Completed test plans (`Completed`), closed defects (`Closed`), terminal test runs (`completed` / `failed` / `cancelled`), and approved/rejected releases (`Approved` / `Rejected`) cannot be modified by standard owners once locked (admin override only).
6. **Strict Keys & Bounded Types**: Every `create` checks `hasAll()` + `hasOnly()`, and every `update` uses action-based `affectedKeys().hasOnly(...)` combined with `isValid[Entity](incoming())`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Project Create**: `{ id: "p1", ownerUid: "anon", name: "Hack" }` without auth -> `PERMISSION_DENIED`.
2. **Unverified Email Spoofing**: User with `email_verified: false` claiming admin email `rajpoot311210@gmail.com` -> `PERMISSION_DENIED`.
3. **OwnerUid Spoofing**: Authenticated user `u1` creating `/projects/p1` with `ownerUid: "u2"` -> `PERMISSION_DENIED`.
4. **Shadow Ghost Field**: Valid project payload with extra `{ isAdmin: true }` or `{ isVerified: true }` -> `PERMISSION_DENIED` (`hasOnly` rejects).
5. **ID Poisoning**: Creating `/projects/` with a 500-char or invalid-character ID `../bad$id` -> `PERMISSION_DENIED` (`isValidId` rejects).
6. **Value Poisoning / Denial of Wallet**: Updating `name` with a 10,000-character string -> `PERMISSION_DENIED` (`isValidProject` checks `size() <= 120`).
7. **Orphaned Subcollection Record**: Creating `/projects/nonexistent/sqaDefects/d1` -> `PERMISSION_DENIED` (Master Gate `get()` fails).
8. **Cross-Tenant Subcollection Write**: `u1` creating `/projects/p2_owned_by_u2/testCases/tc1` -> `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: Creating project with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> `PERMISSION_DENIED`.
10. **Terminal State Bypass**: Owner trying to modify a `Closed` defect or `Approved` release -> `PERMISSION_DENIED`.
11. **PII Read Leak**: `u1` attempting `get(/users/u2/private/info)` -> `PERMISSION_DENIED`.
12. **Blanket Collection Scrape**: `u1` issuing `list(/projects)` without `where('ownerUid', '==', 'u1')` -> `PERMISSION_DENIED`.
