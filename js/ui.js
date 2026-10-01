/**
 * A chamfered panel. Three layers, because CSS cannot cut a corner off a
 * box and keep both its 1px edge and its drop shadow in one element:
 *
 *   .cut   — carries the drop shadow (filter follows the cut shape)
 *   .skin  — the seam colour, clipped to the outer octagon, 1px of padding
 *   .body  — the panel itself, clipped to the same octagon one pixel in
 *
 * Callers append content to `body` and style `el`.
 */
export function cut(tag = 'div', className = '') {
  const el = document.createElement(tag);
  el.className = `cut ${className}`.trim();
  const skin = document.createElement('div');
  skin.className = 'skin';
  const body = document.createElement('div');
  body.className = 'body';
  skin.append(body);
  el.append(skin);
  return { el, body };
}
