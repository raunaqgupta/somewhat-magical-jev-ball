// iOS Safari zooms the whole page in when a text field whose text is under 16px is focused, and
// the question box's text is the design's 14px. Capping the scale at 1 stops that zoom without
// touching the type. iOS still lets people pinch-zoom (it has ignored the cap for that since
// iOS 10), so this costs nothing there; it is set only on iOS because other browsers do honour
// the cap for pinch-zooming, and they do not zoom on focus.

/** Whether this is iOS Safari: an iPhone or iPod, or an iPad, which reports itself as a Mac. */
export function zoomsOnFocus({ userAgent = "", platform = "", maxTouchPoints = 0 } = {}) {
  return /iP(hone|ad|od)/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
}

/** The viewport's content with the scale capped at 1. */
export function capScale(content) {
  return /maximum-scale/.test(content) ? content : `${content}, maximum-scale=1`;
}

if (typeof document !== "undefined" && zoomsOnFocus(navigator)) {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) viewport.content = capScale(viewport.content);
}
