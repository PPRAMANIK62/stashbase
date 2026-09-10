import { z } from 'zod';

/** A one-time notice records the revision the user answered, so raising a
 *  revision re-offers it deliberately instead of reusing a dismissed flag. */
const noticeVersionSchema = z.number().int().nonnegative().max(1_000_000);

/** `GET /api/onboarding` and the `PUT /api/onboarding` echo. Unknown keys are
 *  dropped rather than refused: a newer renderer may record a notice this one
 *  has no reader for, and that must not fail the read. */
export const onboardingPreferencesSchema = z
  .object({
    searchSetupInvitationVersion: noticeVersionSchema.optional(),
    sourceCodeNoticeVersion: noticeVersionSchema.optional(),
  })
  .strip();

/** The write is strict. It reaches durable configuration, so an unknown key is
 *  a caller mistake to refuse, not a value to persist. */
export const onboardingPreferencesRequestSchema = onboardingPreferencesSchema
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'at least one preference is required',
  });

export type OnboardingPreferencesWire = z.infer<typeof onboardingPreferencesSchema>;
