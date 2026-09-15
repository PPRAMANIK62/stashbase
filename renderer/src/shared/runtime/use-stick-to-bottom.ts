import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';

const PIN_THRESHOLD_PX = 48;

/** Keeps a scroll container at its end while the reader stays near it. A new
 *  `key` (another conversation) re-pins and jumps to the end. Content growth
 *  follows only while pinned, so scrolling up to read is never undone. */
export function useStickToBottom(ref: RefObject<HTMLElement | null>, key: string) {
  const pinned = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const scrollToBottom = useCallback(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    pinned.current = true;
    setAtBottom(true);
  }, [ref]);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    pinned.current = true;
    setAtBottom(true);
    const scrollToEnd = () => {
      element.scrollTop = element.scrollHeight;
    };
    scrollToEnd();
    const onScroll = () => {
      pinned.current =
        element.scrollHeight - element.scrollTop - element.clientHeight <= PIN_THRESHOLD_PX;
      setAtBottom(pinned.current);
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            if (pinned.current) scrollToEnd();
          });
    observer?.observe(element);
    for (const child of element.children) observer?.observe(child);
    return () => {
      element.removeEventListener('scroll', onScroll);
      observer?.disconnect();
    };
  }, [key, ref]);
  return { atBottom, scrollToBottom };
}
