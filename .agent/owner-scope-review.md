# Owner-scope review capability

Use this checklist before changing any authenticated resource route.

1. Confirm the owner comes only from the validated bearer token and local-user
   mapping; never accept `ownerId` from a request body or query.
2. Make every resource lookup include both the resource identifier and the
   authenticated owner identifier in the same Prisma query.
3. Apply the same owner predicate to list, count, filter, relation, update,
   patch, and delete operations.
4. For a bookmark collection reference, resolve the collection with the same
   owner predicate before writing. Return the shared generic 404 on failure.
5. Return the identical generic 404 envelope for missing and other-owner
   resources; do not perform a second unscoped lookup.
6. Check that list responses use the standard pagination metadata and that
   success and error envelopes expose no credentials or internal details.

This is a review aid, not a product requirement. It is invoked for every
backend resource change to keep the assignment's privacy invariant visible in
code review.
