# Paint Guide owner workflow

Use only an approved, released HTTPS site. Current Preview Paint Guide is
intentionally disabled; this guide is not authorization to enable real clients.

1. Open `/paint-guide` and request the six-digit code using your authorized
   staff email. Enter the code privately. A confirmed Auth identity and matching
   active Owner profile are required; the UI must not create users automatically.
2. Select **New Paint Guide**, enter the residence name and optional scope note,
   and create the guide. It starts as a draft.
3. In **Locations**, add floors/structures, then their rooms/areas. Edit names or
   types as needed. Deleting a parent also deletes its nested locations.
4. In **Colors**, add surface, color, brand/product/code, sheen and notes. Use
   **Manage Locations** to assign each specification to one or more locations.
   Save the record and its locations separately. If location saving fails, review
   the refreshed actual selections before retrying. If refresh fails, reload;
   do not assume the two-request assignment operation was atomic.
5. Review **Preview**, return to **Overview**, and set **Status** to **Published**.
6. Open **Access & QR**. For first access, choose **Issue Access**. If access
   already exists, **Recover Access** reveals the same stable link. Verify the
   availability indicator, then download PNG or SVG and deliver it privately.
   Treat downloaded QR files as bearer credentials, not public marketing assets.
7. Refreshing removes the revealed URL and QR from the staff page's memory.
   Recover again when needed. Do not paste private links into logs or support
   tickets. Copy Link deliberately places the link on your clipboard.
8. Update locations/colors later using the same guide. The homeowner view is
   read-only and shows saved content; ordinary content edits do not rotate access.
9. **Rotate Access** creates a new link and invalidates the previous link and
   sessions. Deliver a replacement QR. **Revoke Access** disables the link and
   sessions. An Owner can restore revoked access by rotating. Supervisor accounts
   cannot rotate or revoke; server authorization remains decisive.

Already downloaded/viewed content cannot be remotely erased. A read authorized
before a committed revocation may finish; future reads and sessions are denied.

## Release and phone checks

Before client delivery, verify hosted Owner OTP delivery/login, HTTPS origin,
secure cookie behavior, fresh hosted synthetic lifecycle tests, and all recovery
and historical Preview containment gates. Test the downloaded QR on a phone
against the approved hosted synthetic guide. A localhost/127.0.0.1 QR points to
the scanning device itself and cannot test another phone against the Windows PC.
Do not weaken the Preview environment guard or relabel Preview as Production.
