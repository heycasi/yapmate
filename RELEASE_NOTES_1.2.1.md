# Release Notes - v1.2.1

**Date:** 2026-01-18  
**Type:** Bug Fix

## Changes

### Signup Flow - Fixed Misleading Email Confirmation Message

**Problem:**  
The app showed "Check your email to confirm your account" after signup, even though email confirmation is disabled in Supabase. This confused users who could log in immediately.

**Solution:**  
Updated the signup flow to detect whether email confirmation is required based on the Supabase response:

- **When confirmation is disabled (current setup):**
  - Shows: "Account Created. Your account has been created. You can log in now."
  - User can proceed to login immediately

- **When confirmation is enabled (future-proof):**
  - Shows: "Check Your Email. We've sent you a confirmation link. Check your email to verify your account, then log in."
  - User must confirm email before logging in

**Technical Changes:**
- Updated `app/signup/page.tsx` to check `data.session` from Supabase signup response
- Removed misleading "check your inbox" message when confirmation is disabled
- Added proper handling for both confirmation states
- Improved error messaging for existing accounts (routes to login)
- Added analytics tracking for signup events

**User-Facing Text:**
- Success (no confirmation): "Account Created. Your account has been created. You can log in now."
- Success (needs confirmation): "Check Your Email. We've sent you a confirmation link. Check your email to verify your account, then log in."
- Error (existing account): "An account with this email already exists. Please log in instead."

## Version Numbers

- **Package:** 1.2.0 → 1.2.1
- **iOS Marketing Version:** 1.2 → 1.2.1
- **iOS Build Number:** 1 (unchanged)

## Testing Checklist

- [x] New signup with confirmation OFF → Shows "Account Created" message
- [x] New signup with confirmation OFF → Can log in immediately
- [x] New signup with confirmation ON (simulated) → Shows confirmation message
- [x] Existing user tries to sign up → Shows helpful error and routes to login
- [x] No misleading "check your inbox" when confirmation is disabled

## Files Changed

- `app/signup/page.tsx` - Updated signup flow and messaging
- `package.json` - Version bump to 1.2.1
- `ios/App/App.xcodeproj/project.pbxproj` - iOS version bump to 1.2.1

---

**Summary:** Improved signup messaging. After creating an account you can log in immediately (when email confirmation is disabled).
