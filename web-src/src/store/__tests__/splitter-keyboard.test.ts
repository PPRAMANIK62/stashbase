import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHAT_MAX_WIDTH,
  CHAT_MIN_WIDTH,
  clampOutlineHeight,
  isOutlineSplitterKey,
  isSplitterKey,
  OUTLINE_MIN_HEIGHT,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  resizeChatByKeyboard,
  resizeOutlineByKeyboard,
  resizeSidebarByKeyboard,
} from '@/store/state/stateHelpers';

test('splitter key guard accepts only the supported cross-platform keys', () => {
  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
    assert.equal(isSplitterKey(key), true);
  }
  for (const key of ['ArrowUp', 'PageUp', 'Enter', '']) {
    assert.equal(isSplitterKey(key), false);
  }
});

test('sidebar separator supports platform-neutral arrow, Home, and End keys', () => {
  assert.deepEqual(
    resizeSidebarByKeyboard(280, false, 'ArrowLeft'),
    { width: 264, collapsed: false },
  );
  assert.deepEqual(
    resizeSidebarByKeyboard(SIDEBAR_MIN_WIDTH, false, 'ArrowLeft'),
    { width: SIDEBAR_MIN_WIDTH, collapsed: true },
  );
  assert.deepEqual(
    resizeSidebarByKeyboard(320, true, 'ArrowRight'),
    { width: 320, collapsed: false },
  );
  assert.deepEqual(
    resizeSidebarByKeyboard(320, false, 'Home'),
    { width: 320, collapsed: true },
  );
  assert.deepEqual(
    resizeSidebarByKeyboard(320, true, 'End'),
    { width: SIDEBAR_MAX_WIDTH, collapsed: false },
  );
});

test('chat separator follows its visual direction and clamps at both bounds', () => {
  assert.equal(resizeChatByKeyboard(480, 'ArrowLeft'), 496);
  assert.equal(resizeChatByKeyboard(480, 'ArrowRight'), 464);
  assert.equal(resizeChatByKeyboard(CHAT_MAX_WIDTH, 'ArrowLeft'), CHAT_MAX_WIDTH);
  assert.equal(resizeChatByKeyboard(CHAT_MIN_WIDTH, 'ArrowRight'), CHAT_MIN_WIDTH);
  assert.equal(resizeChatByKeyboard(480, 'Home'), CHAT_MIN_WIDTH);
  assert.equal(resizeChatByKeyboard(480, 'End'), CHAT_MAX_WIDTH);
});

test('outline separator key guard answers the vertical arrows, not the column handles’ keys', () => {
  for (const key of ['ArrowUp', 'ArrowDown', 'Home', 'End']) {
    assert.equal(isOutlineSplitterKey(key), true);
  }
  for (const key of ['ArrowLeft', 'ArrowRight', 'PageUp', 'Enter', '']) {
    assert.equal(isOutlineSplitterKey(key), false);
  }
});

test('outline separator grows toward the live ceiling and never drops below its floor', () => {
  // Up grows the outline (the seam moves up), Down shrinks it, by the
  // step every splitter shares.
  assert.equal(resizeOutlineByKeyboard(180, 400, 'ArrowUp'), 196);
  assert.equal(resizeOutlineByKeyboard(180, 400, 'ArrowDown'), 164);
  // The ceiling is whatever the tree leaves right now, not a constant:
  // a step past it lands ON it, and End goes straight there.
  assert.equal(resizeOutlineByKeyboard(390, 400, 'ArrowUp'), 400);
  assert.equal(resizeOutlineByKeyboard(180, 400, 'End'), 400);
  assert.equal(resizeOutlineByKeyboard(180, 400, 'Home'), OUTLINE_MIN_HEIGHT);
  assert.equal(resizeOutlineByKeyboard(OUTLINE_MIN_HEIGHT + 4, 400, 'ArrowDown'), OUTLINE_MIN_HEIGHT);
  // A window too short for both floors: the outline's floor wins and the
  // flex layout clips from there, so no key can produce a strip.
  assert.equal(resizeOutlineByKeyboard(180, 40, 'End'), OUTLINE_MIN_HEIGHT);
  assert.equal(clampOutlineHeight(500, 40), OUTLINE_MIN_HEIGHT);
  assert.equal(clampOutlineHeight(500, 400), 400);
});
