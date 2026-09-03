import type { ViewerFormat } from '@shared/file-formats';

/** Per-format file glyph, from Phosphor's REGULAR (outline) weight.
 *
 *  Regular, not fill: the tree is a light, flat surface now, and a column
 *  of solid silhouettes read as the darkest thing in the sidebar. At the
 *  tree's 16px glyph size the outlined letterforms (PDF, DOC, MD) stay
 *  readable, which is what once justified the fill weight at 14px.
 *
 *  Colour is `currentColor`, so the tree's `--muted` applies and a column of
 *  files reads as one quiet list. They were brand-coloured (PDF red, docx
 *  blue) and it made the sidebar the loudest surface in the app — a hue per
 *  row is exactly the repeated-element case the colour budget rules out.
 *  The page outline and its letterform carry the format instead. */
export type FileGlyphFormat = ViewerFormat;

export function FileTypeIcon({ format }: { format: FileGlyphFormat }) {
  /* Unknown bytes get the BLANK page — the one silhouette in the set with
   * nothing written on it, which is the whole statement. Sharing the
   * ruled-page glyph with `text` said "this is a text file" about a file
   * StashBase could not decode. */
  if (format === 'generic') {
    return (
      <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z"/></svg>
    );
  }
  if (format === 'image') {
    return (
      <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M110.66,147.56a8,8,0,0,0-13.32,0L76.49,178.85l-9.76-15.18a8,8,0,0,0-13.46,0l-36,56A8,8,0,0,0,24,232H152a8,8,0,0,0,6.66-12.44ZM38.65,216,60,182.79l9.63,15a8,8,0,0,0,13.39.11l21-31.47L137.05,216Zm175-133.66-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40v88a8,8,0,0,0,16,0V40h88V88a8,8,0,0,0,8,8h48V216h-8a8,8,0,0,0,0,16h8a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160Z"/></svg>
    );
  }
  if (format === 'pdf') {
    return (
      <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224,152a8,8,0,0,1-8,8H192v16h16a8,8,0,0,1,0,16H192v16a8,8,0,0,1-16,0V152a8,8,0,0,1,8-8h32A8,8,0,0,1,224,152ZM92,172a28,28,0,0,1-28,28H56v8a8,8,0,0,1-16,0V152a8,8,0,0,1,8-8H64A28,28,0,0,1,92,172Zm-16,0a12,12,0,0,0-12-12H56v24h8A12,12,0,0,0,76,172Zm88,8a36,36,0,0,1-36,36H112a8,8,0,0,1-8-8V152a8,8,0,0,1,8-8h16A36,36,0,0,1,164,180Zm-16,0a20,20,0,0,0-20-20h-8v40h8A20,20,0,0,0,148,180ZM40,112V40A16,16,0,0,1,56,24h96a8,8,0,0,1,5.66,2.34l56,56A8,8,0,0,1,216,88v24a8,8,0,0,1-16,0V96H152a8,8,0,0,1-8-8V40H56v72a8,8,0,0,1-16,0ZM160,80h28.69L160,51.31Z"/></svg>
    );
  }
  if (format === 'html') {
    return (
      <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M216,120V88a8,8,0,0,0-2.34-5.66l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40v80a8,8,0,0,0,16,0V40h88V88a8,8,0,0,0,8,8h48v24a8,8,0,0,0,16,0ZM160,51.31,188.69,80H160ZM68,160v48a8,8,0,0,1-16,0V192H32v16a8,8,0,0,1-16,0V160a8,8,0,0,1,16,0v16H52V160a8,8,0,0,1,16,0Zm56,0a8,8,0,0,1-8,8h-8v40a8,8,0,0,1-16,0V168H84a8,8,0,0,1,0-16h32A8,8,0,0,1,124,160Zm72,0v48a8,8,0,0,1-16,0V184l-9.6,12.8a8,8,0,0,1-12.8,0L148,184v24a8,8,0,0,1-16,0V160a8,8,0,0,1,14.4-4.8L164,178.67l17.6-23.47A8,8,0,0,1,196,160Zm56,48a8,8,0,0,1-8,8H216a8,8,0,0,1-8-8V160a8,8,0,0,1,16,0v40h20A8,8,0,0,1,252,208Z"/></svg>
    );
  }
  if (format === 'txt') {
    return (
      <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M48,120a8,8,0,0,0,8-8V40h88V88a8,8,0,0,0,8,8h48v16a8,8,0,0,0,16,0V88a8,8,0,0,0-2.34-5.66l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40v72A8,8,0,0,0,48,120ZM160,51.31,188.69,80H160Zm-5.49,105.34L137.83,180l16.68,23.35a8,8,0,0,1-13,9.3L128,193.76l-13.49,18.89a8,8,0,1,1-13-9.3L118.17,180l-16.68-23.35a8,8,0,1,1,13-9.3L128,166.24l13.49-18.89a8,8,0,0,1,13,9.3ZM92,152a8,8,0,0,1-8,8H72v48a8,8,0,0,1-16,0V160H44a8,8,0,0,1,0-16H84A8,8,0,0,1,92,152Zm128,0a8,8,0,0,1-8,8H200v48a8,8,0,0,1-16,0V160H172a8,8,0,0,1,0-16h40A8,8,0,0,1,220,152Z"/></svg>
    );
  }
  if (format === 'json') {
    return (
      <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M181.66,146.34a8,8,0,0,1,0,11.32l-24,24a8,8,0,0,1-11.32-11.32L164.69,152l-18.35-18.34a8,8,0,0,1,11.32-11.32Zm-72-24a8,8,0,0,0-11.32,0l-24,24a8,8,0,0,0,0,11.32l24,24a8,8,0,0,0,11.32-11.32L91.31,152l18.35-18.34A8,8,0,0,0,109.66,122.34ZM216,88V216a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V40A16,16,0,0,1,56,24h96a8,8,0,0,1,5.66,2.34l56,56A8,8,0,0,1,216,88Zm-56-8h28.69L160,51.31Zm40,136V96H152a8,8,0,0,1-8-8V40H56V216H200Z"/></svg>
    );
  }
  if (format === 'docx') {
    return (
      <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M52,144H36a8,8,0,0,0-8,8v56a8,8,0,0,0,8,8H52a36,36,0,0,0,0-72Zm0,56H44V160h8a20,20,0,0,1,0,40Zm169.53-4.91a8,8,0,0,1,.25,11.31A30.06,30.06,0,0,1,200,216c-17.65,0-32-16.15-32-36s14.35-36,32-36a30.06,30.06,0,0,1,21.78,9.6,8,8,0,0,1-11.56,11.06A14.24,14.24,0,0,0,200,160c-8.82,0-16,9-16,20s7.18,20,16,20a14.24,14.24,0,0,0,10.22-4.66A8,8,0,0,1,221.53,195.09ZM128,144c-17.65,0-32,16.15-32,36s14.35,36,32,36,32-16.15,32-36S145.65,144,128,144Zm0,56c-8.82,0-16-9-16-20s7.18-20,16-20,16,9,16,20S136.82,200,128,200ZM48,120a8,8,0,0,0,8-8V40h88V88a8,8,0,0,0,8,8h48v16a8,8,0,0,0,16,0V88a8,8,0,0,0-2.34-5.66l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40v72A8,8,0,0,0,48,120ZM160,51.31,188.69,80H160Z"/></svg>
    );
  }
  if (format === 'audio') {
    return (
      <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M99.06,128.61a8,8,0,0,0-8.72,1.73L68.69,152H48a8,8,0,0,0-8,8v40a8,8,0,0,0,8,8H68.69l21.65,21.66A8,8,0,0,0,104,224V136A8,8,0,0,0,99.06,128.61ZM88,204.69,77.66,194.34A8,8,0,0,0,72,192H56V168H72a8,8,0,0,0,5.66-2.34L88,155.31ZM152,180a40.55,40.55,0,0,1-20,34.91A8,8,0,0,1,124,201.09a24.49,24.49,0,0,0,0-42.18A8,8,0,0,1,132,145.09,40.55,40.55,0,0,1,152,180Zm61.66-97.66-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40v80a8,8,0,0,0,16,0V40h88V88a8,8,0,0,0,8,8h48V216H168a8,8,0,0,0,0,16h32a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160Z"/></svg>
    );
  }
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40v72a8,8,0,0,0,16,0V40h88V88a8,8,0,0,0,8,8h48V224a8,8,0,0,0,16,0V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM144,144H128a8,8,0,0,0-8,8v56a8,8,0,0,0,8,8h16a36,36,0,0,0,0-72Zm0,56h-8V160h8a20,20,0,0,1,0,40Zm-40-48v56a8,8,0,0,1-16,0V177.38L74.55,196.59a8,8,0,0,1-13.1,0L48,177.38V208a8,8,0,0,1-16,0V152a8,8,0,0,1,14.55-4.59L68,178.05l21.45-30.64A8,8,0,0,1,104,152Z"/></svg>
  );
}
