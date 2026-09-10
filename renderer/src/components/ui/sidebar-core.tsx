/** The flavor-neutral half of the sidebar: everything that is not the
 *  Base UI mobile sheet. This file is deliberately a barrel and nothing else
 *  — `@/components/ui/sidebar-core` is a vendored-kit import path that
 *  `sidebar.tsx` depends on, so it stays stable while the parts behind it
 *  move. The "no pass-through module" rule does not apply to it.
 *
 *  Behind it, one module per concern:
 *  - `sidebar-context`        state, the provider, cookie persistence
 *  - `sidebar-shortcut`       the bare toggle key and who answers it
 *  - `sidebar-shell`          the desktop rail and its width choreography
 *  - `sidebar-peek`           the collapsed-edge reveal
 *  - `sidebar-rail`           the drag-resize / collapse grab strip
 *  - `sidebar-trigger`        the toggle button
 *  - `sidebar-sections`       header, footer, and the inset main element
 *  - `sidebar-group*`         the section family and its header controls
 *  - `sidebar-motion`         the framer-safe prop seam the surfaces share
 */

export {
  SidebarProvider,
  sidebarLandmarkLabel,
  useSidebar,
  type SidebarSide,
  type SidebarVariant,
  type SidebarCollapsible,
} from '@/components/ui/sidebar-context';
export { SidebarShell } from '@/components/ui/sidebar-shell';
export { SidebarTrigger } from '@/components/ui/sidebar-trigger';
export { SidebarHeader, SidebarFooter, SidebarInset } from '@/components/ui/sidebar-sections';
export { SidebarGroup, SidebarGroupContent } from '@/components/ui/sidebar-group';
export { SidebarGroupLabel } from '@/components/ui/sidebar-group-label';
