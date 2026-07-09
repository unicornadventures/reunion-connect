# Planned Features

## 1. Comment Editing and Deletion by Author

Allow a logged-in user to edit or delete a comment they left on someone else's profile.

- Edit and delete controls appear on a comment only when the viewer is the comment's author
- Editing a comment immediately sets it back to pending (unpublished) so it goes through moderation again before reappearing
- Deletion removes the comment permanently
- Backend: new `PUT /comments/:id` and `DELETE /comments/:id` endpoints that verify the requesting user is the comment author (not just class admin)

---

## 2. Personal Photo Gallery

Allow a user to add additional photos to their own profile beyond the existing "then" and "now" photos.

- Maximum of 9 photos in the gallery
- Gallery displays in rows of 3
- Clicking a photo opens a full-screen lightbox with a close button
- Photos stored in S3 under the user's existing folder prefix
- Backend: new endpoints to upload, list, and delete gallery photos
- Frontend: gallery section on the user profile page with upload controls (visible only to the profile owner)

---

## 3. Static Help Page

A protected help page describing how to use the site.

- Accessible only to logged-in users
- Link in the top navigation bar labeled "Help"
- Static content — no backend required
- Covers key features: editing your profile, the directory, leaving comments, events, photo uploads, and the gallery

---

## 4. Download Comments as Text

Allow a user to download the approved comments left on their own profile as a plain text document.

- Download button on the user's own profile page
- Generates a `.txt` file with each comment, the commenter's name, and the date
- Client-side generation — no new backend endpoint required

---

## 5. Profile Tags

Allow a user to enter free-form tags on their profile (e.g., sports played, dorm hall, clubs).

- Maximum of 10 tags
- Tags are stored in a `jsonb` column on the `profiles` table (e.g., `tags jsonb DEFAULT '[]'`)
- Column is indexed with a GIN index for native JSON search
- Tags are displayed on the user's profile and visible in the directory
- Tags are searchable — the directory or a search page can filter users by tag
- Frontend: tag input with add/remove controls on the profile edit page
