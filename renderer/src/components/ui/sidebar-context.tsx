/** The sidebar's shared state: the flavor vocabulary every part is typed
 *  against, the two contexts those parts read, and the provider that owns
 *  both.
 *
 *  The provider is the one place open/collapsed state, the live rail width,
 *  the drawer breakpoint, cookie persistence and the collapsed-peek intent
 *  timer live. Everything visual — the shell, the rail, the trigger, the
 *  groups and the menu — reads a context instead of taking props down a chain.
 *
 *  There are two of them because the state has two audiences. A consumer of
 *  the sidebar asks whether it is open, opens or closes it, and knows which
 *  edge it sits on: that is `useSidebar`, and it is the whole public surface.
 *  Everything else — the width the rail writes back, the drawer breakpoint the
 *  shell measures against, the side a rendered `<Sidebar/>` reports, the
 *  resolved shortcut, and the six-member peek machinery — exists so the
 *  sidebar's own parts can be built, and lives behind `useSidebarInternals`.
 *  Published together, those twenty-four members read as a public API, and a
 *  consumer reaching for `setIsPeeking` would be reaching into the
 *  implementation without anything saying so. */

'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  forwardRef,
  type CSSProperties,
  type HTMLAttributes,
} from 'react';

import {
  SIDEBAR_KEYBOARD_SHORTCUT,
  SIDEBAR_KEYBOARD_SHORTCUT_RIGHT,
  useSidebarToggleShortcut,
} from '@/components/ui/sidebar-shortcut';
import { useCompactWindow } from '@/lib/local/use-compact-window';
import { mergeRefs } from '@/lib/merge-refs';
import { delayMs } from '@/lib/springs';
import { cn } from '@/lib/utils';

const SIDEBAR_COOKIE_NAME = 'sidebar_state';
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = '16rem';
const SIDEBAR_WIDTH_MOBILE = '18rem';

export type SidebarSide = 'left' | 'right';

/** The sidebar panel is a complementary landmark, so a screen-reader user can
 *  jump to it and skip past it. Two of them on one page need different names,
 *  which is what the side supplies; a caller with a better one passes
 *  `aria-label` and it wins. */
export const sidebarLandmarkLabel = (side: SidebarSide): string =>
  side === 'right' ? 'Secondary sidebar' : 'Sidebar';
export type SidebarVariant = 'sidebar' | 'floating' | 'inset';
export type SidebarCollapsible = 'offcanvas' | 'none';

/** What a consumer of the sidebar reads and calls. */
interface SidebarContextValue {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  openMobile: boolean;
  setOpenMobile: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  toggleSidebar: () => void;
  /** Live rail width — the rail's drag-resize updates it. */
  width: string;
  /** Which edge the rendered Sidebar sits on (registered by <Sidebar/>). */
  side: SidebarSide;
}

/** What the sidebar's own parts are built out of. Not exported from
 *  `sidebar-core`: a member here is machinery, and a consumer that needs one
 *  of them needs a prop on the provider instead. */
interface SidebarInternalsValue {
  /** The rail's drag-resize writes the live width back through this. */
  setWidth: (width: string) => void;
  widthMobile: string;
  mobileBreakpoint: number;
  /** <Sidebar/> reports its side so the provider can resolve the default
   *  shortcut and the rail can mirror. */
  registerSide: (side: SidebarSide) => void;
  /** The resolved toggle key ("[" / "]" / custom / null when disabled). */
  shortcut: string | null;
  /** Collapsed-peek mode: reveal the sidebar as a floating overlay from the
   *  collapsed edge on hover or click, without pinning it open. */
  peek: 'hover' | 'click' | 'none';
  /** True while the collapsed sidebar is peeking as an overlay. */
  isPeeking: boolean;
  setIsPeeking: React.Dispatch<React.SetStateAction<boolean>>;
  /** Shared hover-intent machinery for the peek: ONE timer serves every
   *  affordance that can float the rail out (the edge strip, the trigger),
   *  so crossing between them — or into the peeked card — cancels a pending
   *  dismissal instead of racing a second timer. */
  schedulePeek: () => void;
  scheduleDismissPeek: () => void;
  cancelPeekTimer: () => void;
  /** True while the rail is being drag-resized (disables the width spring so
   *  the panel tracks the pointer 1:1). */
  isResizing: boolean;
  setIsResizing: React.Dispatch<React.SetStateAction<boolean>>;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);
const SidebarInternalsContext = createContext<SidebarInternalsValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within a SidebarProvider');
  return ctx;
}

/** The sidebar's own parts only. */
export function useSidebarInternals(): SidebarInternalsValue {
  const ctx = useContext(SidebarInternalsContext);
  if (!ctx) throw new Error('useSidebarInternals must be used within a SidebarProvider');
  return ctx;
}

/** The tooltips always show the toggle keystroke, falling back to the
 *  side's default key even when the provider's binding is disabled. */
export function useShortcutKey(): string {
  const { side } = useSidebar();
  const { shortcut } = useSidebarInternals();
  return (
    shortcut ?? (side === 'right' ? SIDEBAR_KEYBOARD_SHORTCUT_RIGHT : SIDEBAR_KEYBOARD_SHORTCUT)
  );
}

interface SidebarProviderProps extends HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Reports live desktop drag-resize changes. */
  onWidthChange?: (width: string) => void;
  /** Persist the desktop open state to the `sidebar_state` cookie so a server
   *  layout can read it back into `defaultOpen`. Mobile state never persists. */
  persist?: boolean;
  /** Bare-key toggle shortcut. Defaults to "[" for a left sidebar and "]"
   *  for a right one; `null` disables it. */
  shortcut?: string | null;
  /** Viewport width (px) below which the sidebar renders as a drawer. */
  mobileBreakpoint?: number;
  /** While collapsed, reveal the sidebar as a floating overlay from the
   *  edge — on hover (with intent delay) or on click of the edge strip.
   *  Peeking never pins the sidebar or writes the cookie. @default "none" */
  peek?: 'hover' | 'click' | 'none';
  width?: string;
  widthMobile?: string;
}

const SidebarProvider = forwardRef<HTMLDivElement, SidebarProviderProps>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange,
      onWidthChange,
      persist = true,
      shortcut: shortcutProp,
      mobileBreakpoint = 768,
      peek = 'none',
      width: widthProp = SIDEBAR_WIDTH,
      widthMobile = SIDEBAR_WIDTH_MOBILE,
      className,
      style,
      children,
      ...props
    },
    ref,
  ) => {
    // The drawer split is a live window-width question, and the one hook that
    // answers it lives in lib — the sidebar had grown its own copy.
    const isMobile = useCompactWindow(mobileBreakpoint);
    const [openMobile, setOpenMobile] = useState(false);
    const [side, setSide] = useState<SidebarSide>('left');
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const registerSide = useCallback((next: SidebarSide) => setSide(next), []);

    // Live width: the prop is the starting point, the rail's drag-resize
    // updates it at runtime.
    const [width, setInternalWidth] = useState(widthProp);
    useEffect(() => setInternalWidth(widthProp), [widthProp]);
    const setWidth = useCallback(
      (nextWidth: string) => {
        setInternalWidth(nextWidth);
        onWidthChange?.(nextWidth);
      },
      [onWidthChange],
    );
    const [isResizing, setIsResizing] = useState(false);

    // Default shortcut mirrors the sidebar's edge: "[" left, "]" right.
    const shortcut =
      shortcutProp === undefined
        ? side === 'right'
          ? SIDEBAR_KEYBOARD_SHORTCUT_RIGHT
          : SIDEBAR_KEYBOARD_SHORTCUT
        : shortcutProp;

    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const open = openProp ?? internalOpen;
    const openRef = useRef(open);
    openRef.current = open;

    const setOpen = useCallback(
      (value: boolean | ((prev: boolean) => boolean)) => {
        const next = typeof value === 'function' ? value(openRef.current) : value;
        if (onOpenChange) onOpenChange(next);
        else setInternalOpen(next);
        if (persist) {
          document.cookie = `${SIDEBAR_COOKIE_NAME}=${next}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
        }
      },
      [onOpenChange, persist],
    );

    const toggleSidebar = useCallback(() => {
      if (isMobile) setOpenMobile((prev) => !prev);
      else setOpen((prev) => !prev);
    }, [isMobile, setOpen]);

    // Collapsed-peek overlay state. Pinning the sidebar open (or disabling
    // the mode) always dismisses the peek — including a PENDING intent
    // timer, or a hover armed just before the pin would fire setIsPeeking on
    // an open sidebar (the effect's deps never re-run for the late timer).
    const [isPeeking, setIsPeeking] = useState(false);
    const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
      if (open || peek === 'none') {
        if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
        peekTimerRef.current = null;
        setIsPeeking(false);
      }
    }, [open, peek]);
    const cancelPeekTimer = useCallback(() => {
      if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }, []);
    const schedulePeek = useCallback(() => {
      cancelPeekTimer();
      peekTimerRef.current = setTimeout(() => setIsPeeking(true), delayMs.intent);
    }, [cancelPeekTimer]);
    const scheduleDismissPeek = useCallback(() => {
      cancelPeekTimer();
      peekTimerRef.current = setTimeout(() => setIsPeeking(false), delayMs.dismissIntent);
    }, [cancelPeekTimer]);
    useEffect(() => cancelPeekTimer, [cancelPeekTimer]);

    useSidebarToggleShortcut(wrapperRef, shortcut, toggleSidebar);

    const value = useMemo<SidebarContextValue>(
      () => ({
        state: open ? 'expanded' : 'collapsed',
        open,
        setOpen,
        openMobile,
        setOpenMobile,
        isMobile,
        toggleSidebar,
        width,
        side,
      }),
      [open, setOpen, openMobile, isMobile, toggleSidebar, width, side],
    );

    const internals = useMemo<SidebarInternalsValue>(
      () => ({
        setWidth,
        widthMobile,
        mobileBreakpoint,
        registerSide,
        shortcut,
        peek,
        isPeeking,
        setIsPeeking,
        schedulePeek,
        scheduleDismissPeek,
        cancelPeekTimer,
        isResizing,
        setIsResizing,
      }),
      [
        setWidth,
        widthMobile,
        mobileBreakpoint,
        registerSide,
        shortcut,
        peek,
        isPeeking,
        schedulePeek,
        scheduleDismissPeek,
        cancelPeekTimer,
        isResizing,
      ],
    );

    return (
      <SidebarContext.Provider value={value}>
        <SidebarInternalsContext.Provider value={internals}>
          <div
            ref={mergeRefs(wrapperRef, ref)}
            data-slot="sidebar-wrapper"
            className={cn('group/sidebar-wrapper relative flex min-h-svh w-full', className)}
            style={
              {
                '--sidebar-width': width,
                '--sidebar-width-mobile': widthMobile,
                ...style,
              } as CSSProperties
            }
            {...props}
          >
            {children}
          </div>
        </SidebarInternalsContext.Provider>
      </SidebarContext.Provider>
    );
  },
);
SidebarProvider.displayName = 'SidebarProvider';

export { SidebarProvider };
