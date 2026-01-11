# Fix Voucher Attachment Upload Issue

## Current Problem

- When uploading attachments to vouchers, files are saved with random names without extensions
- The filename should include voucher ID and payee, and preserve the file extension

## Tasks

- [x] Modify attachment upload route in server/routes.ts to generate proper filenames
- [x] Fetch voucher information to get payee name
- [x] Generate filename with format: {voucherId}_{payee}_{originalFilename}
- [x] Ensure file extension is preserved
- [x] Test the fix

## Files to Modify

- server/routes.ts (attachment upload route)

## Summary

Fixed the attachment upload issue by modifying the filename generation logic in server/routes.ts. Now files are saved with the format: {voucherId}_{sanitizedPayee}_{sanitizedBaseName}{extension}, preserving the original file extension and including voucher information in the filename.
