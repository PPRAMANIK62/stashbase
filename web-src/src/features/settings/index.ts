/**
 * Public surface of the Settings feature.
 *
 * Both components are always-mounted gates that render nothing until
 * opened and then load their own panel body lazily, so they stay eager
 * exports. The appearance pair is the boot-time theme application the
 * shell runs before any panel exists.
 */
export { EmbedderRequireKeyGate } from '@/features/settings/components/EmbedderRequireKeyGate';
export { SettingsPortal } from '@/features/settings/components/SettingsModal';
export { applyAppearance, subscribeToAppearance } from '@/features/settings/lib/appearance';
