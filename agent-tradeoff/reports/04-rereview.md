# 04: Rereview

Independent read-only reviewer inspected `2f50570..065f5e6`. Nine original blockers were addressed. The rumor progression fix improved spread but required preserving second-source evidence. Two Important follow-ups and one Minor were found:

1. `tellings.ts:61` skipped all known claims, removing corroboration and corrective defence; the approach path independently rejected them. Preserve different tellers, allow new first-hand evidence from the same teller, suppress already-known ordinary news and repetitive same-source tellings. Add regressions for all three paths.
2. `whisper.ts:74` disabled submit but left inputs editable during a pending interpretation, allowing a stale selection to apply. Disable selection/text while busy, keeping Close usable and restoring correct input availability on failure.
3. Captured-accusation cloning lost live `lastSpeaker` and `lastClaim` writes. Preserve turn bookkeeping without overwriting a newer accusation's context.

The reviewer independently ran 102 focused tests and confirmed the 295,834-byte bundle check. Verdict at that commit: changes needed. The follow-up implementation and verification are recorded below and in the next review.
