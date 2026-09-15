'use strict';

const assert = require('node:assert/strict');

// Controlled upstream bytes keep this a deterministic check of the built
// Gallery adapter, production CSP, and native HTTP authorization together.
const screenshots = ['cover', 'hero', 'graph'].map(
  (name) => `https://assets.stashbase.ai/${name}.svg`,
);

function serveGalleryFixture(request, response) {
  const url = new URL(request.url, 'http://fixture');
  if (url.pathname === '/api/gallery/index') {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({
      schemaVersion: 1,
      wikis: [{
        id: 'image-smoke', name: 'Gallery image smoke', category: 'research',
        description: 'Published screenshot fixture.', contents: 'Three screenshots',
        repo: 'https://github.com/owner/repo', screenshots,
      }],
    }));
    return true;
  }
  if (url.pathname !== '/api/gallery/image') return false;
  assert.ok(request.headers['x-stashbase-window-id']);
  assert.ok(screenshots.includes(url.searchParams.get('src')));
  response.setHeader('content-type', 'image/svg+xml');
  response.end('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="18"><rect width="32" height="18" fill="teal"/></svg>');
  return true;
}

async function checkGalleryImages(window, serverOrigin) {
  const images = await window.webContents.executeJavaScript(`(async () => {
    const waitFor = async (read) => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const result = read();
        if (result) return result;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw new Error('Gallery image fixture did not render');
    };
    const card = await waitFor(() => [...document.querySelectorAll('button')]
      .find(button => button.textContent.includes('Gallery image smoke')));
    card.scrollIntoView();
    const cover = card.querySelector('img');
    await cover.decode();
    card.click();
    const hero = await waitFor(() => document.querySelector('img[alt="Gallery image smoke screenshot 1"]'));
    const dialog = hero.closest('[role="dialog"]');
    const pictures = [...dialog.querySelectorAll('img')];
    await Promise.all(pictures.map(image => image.decode()));
    dialog.querySelector('button[aria-label="Screenshot 2"]').click();
    await waitFor(() => hero.alt === 'Gallery image smoke screenshot 2');
    await hero.decode();
    return { count: pictures.length, urls: [cover.src, ...pictures.map(image => image.src)],
      widths: [cover.naturalWidth, ...pictures.map(image => image.naturalWidth)], hero: hero.src };
  })()`);
  assert.equal(images.count, 4);
  assert.ok(images.widths.every(width => width === 32));
  assert.ok(images.urls.every(url => url.startsWith(`${serverOrigin}/api/gallery/image?src=`)));
  assert.equal(new URL(images.hero).searchParams.get('src'), screenshots[1]);
  console.log('real Electron Gallery cover, hero, thumbnails, and selection passed');
}

module.exports = { serveGalleryFixture, checkGalleryImages };
