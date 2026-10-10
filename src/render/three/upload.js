/* upload only the live head of a dynamic buffer; at count 0 upload nothing (a
   0-length range or a bare needsUpdate would send the whole array) and let the
   draw count hide the stale tail */
export function live(attr, n) {
  if (!attr || !(n > 0)) return;
  attr.clearUpdateRanges();
  attr.addUpdateRange(0, n * attr.itemSize);
  attr.needsUpdate = true;
}
