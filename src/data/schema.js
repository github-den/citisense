/*
 * Citisense — Data Schemas
 * Shape of every object returned from Supabase.
 * These are reference definitions only; no hardcoded data lives here.
 * All live data is fetched via hooks in src/hooks/.
 * All UI config (statuses, types, colors) lives in src/constants/.
 *
 * ── POST ────────────────────────────────────────────────────
 * {
 *   id:           string   uuid
 *   user_id:      string   uuid — references auth.users
 *   initials:     string   derived from profile.username
 *   bg:           string   avatar image path — from profiles.avatar
 *   user:         string   username — from profiles.username
 *   handle:       string   @username — from profiles.username
 *   location:     string
 *   time:         string   relative label via formatTime()
 *   content:      string
 *   raises:       number   raises_count from DB
 *   discuss:      number   discuss_count from DB
 *   reacts:       number   reacts_count from DB
 *   shares:       number   shares_count from DB
 *   status:       'Under Review'|'In Progress'|'On hold'|'Resolved'|'Dismissed'|'Invalid'
 *   type:         'complaint'|'suggestion'|'compliment'
 *   feedbackNo:   string   e.g. '#2026-201' — from feedback_no column
 *   service:      string|null
 *   feedbox:      string|null
 * }
 *
 * ── FEEDBOX ─────────────────────────────────────────────────
 * {
 *   id:             string   uuid
 *   topic:          string
 *   feedback_count: number
 *   is_hot:         boolean
 *   service:        string|null
 * }
 *
 * ── TRENDING (from feedboxes, ordered by raises_count) ──────
 * {
 *   id:             string   uuid
 *   topic:          string
 *   raises_count:   number
 *   feedback_count: number
 * }
 *
 * ── PROFILE ─────────────────────────────────────────────────
 * {
 *   id:              string   uuid — matches auth.users.id
 *   username:        string
 *   avatar:          string   /avatars/*.png path
 *   location:        string|null
 *   created_at:      string   ISO timestamp
 * }
 *
 * ── DISCUSSION ──────────────────────────────────────────────
 * {
 *   id:         string   uuid
 *   post_id:    string   uuid
 *   user_id:    string   uuid
 *   body:       string
 *   created_at: string   ISO timestamp
 * }
 */
