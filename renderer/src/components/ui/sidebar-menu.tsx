/** The menu family's public entry. This file is deliberately a barrel and
 *  nothing else: `@/components/ui/sidebar-menu` is a vendored-kit import path
 *  that product code and `sidebar.tsx` both depend on, so it stays stable
 *  while the parts behind it move. The "no pass-through module" rule does not
 *  apply to it.
 *
 *  Behind it, one module per concern:
 *  - `sidebar-menu-scope`   the menu <ul>, the scope, keyboard navigation
 *  - `sidebar-menu-rows`    which rows exist, in what order, which are lit
 *  - `sidebar-menu-overlays` the traveling hover/active/focus backgrounds
 *  - `sidebar-menu-row`     the <li>s, the row context, the gutter math
 *  - `sidebar-menu-label`   a row's leading icon and its label
 *  - `sidebar-menu-button`  the row's main button
 *  - `sidebar-menu-action`  a row's trailing control
 *  - `sidebar-menu-sub`     the nested, collapsible level
 *  - `sidebar-menu-sub-button` the shorter row button inside it
 */

export { SidebarMenu } from '@/components/ui/sidebar-menu-scope';
export { SidebarMenuItem, SidebarMenuSubItem } from '@/components/ui/sidebar-menu-row';
export { SidebarMenuButton } from '@/components/ui/sidebar-menu-button';
export { SidebarMenuAction } from '@/components/ui/sidebar-menu-action';
export { SidebarMenuSub } from '@/components/ui/sidebar-menu-sub';
export { SidebarMenuSubButton } from '@/components/ui/sidebar-menu-sub-button';
