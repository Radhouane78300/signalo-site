// Layout audit for the Signalo landing page. Run it in the browser console on the
// local site (python serve.py), at each screen size to check:
//
//   const { audit } = await import('./tools/layout-audit.js'); console.table(await audit());
//
// It reports text that overlaps other text, text covered by the 3D object on the
// stage chapters, text under the header or off screen, text clipped by a container,
// and horizontal scrolling. An empty list means nothing was found.
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function overlaps(a, b, margin) {
    return Math.min(a.right, b.right) - Math.max(a.left, b.left) > margin
        && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > margin;
}

function visible(el) {
    let opacity = 1;
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        opacity *= parseFloat(style.opacity);
    }
    return opacity > 0.05;
}

function textBoxes(root) {
    const boxes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT,
        { acceptNode: node => (node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const el = node.parentElement;
        if (el.closest('svg, script, style, [hidden], .menu, .demo-confirm, .loader, .commune-suggestions')) continue;
        if (!visible(el)) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        // The font's content box is taller than the ink; tight display titles (line-height
        // below 1) would otherwise "collide" line to line. Keep about 0.92em around the centre.
        const half = parseFloat(getComputedStyle(el).fontSize) * 0.46;
        for (const r of range.getClientRects()) {
            if (r.width <= 1 || r.height <= 1) continue;
            const centre = (r.top + r.bottom) / 2, h = Math.min(r.height / 2, half);
            const rect = { left: r.left, right: r.right, top: centre - h, bottom: centre + h };
            boxes.push({ el, rect, text: node.textContent.trim().slice(0, 36) });
        }
    }
    return boxes;
}

function clippingAncestors(el) {
    const list = [];
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (/hidden|clip|auto|scroll/.test(style.overflowX + style.overflowY)) list.push(node);
    }
    return list;
}

function textCollisions(boxes, where, issues) {
    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i], b = boxes[j];
            if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
            if (overlaps(a.rect, b.rect, 2)) issues.push({ where, issue: 'text on text', a: a.text, b: b.text });
        }
    }
}

export async function audit({ stage = [0.02, 0.36, 0.8] } = {}) {
    const issues = [];
    const vw = window.innerWidth, vh = window.innerHeight;
    const site = window.__glassSite;
    const headerBottom = document.querySelector('.main-header').getBoundingClientRect().bottom;
    // Measure end states: no transition in flight, frames computed on demand.
    const freeze = document.createElement('style');
    freeze.textContent = '*, *::before, *::after { transition: none !important; }';
    document.head.appendChild(freeze);
    // A background tab never finishes the preloader animation: skip it.
    document.body.classList.remove('is-loading');
    document.getElementById('loader')?.remove();

    // 1. The three chapters drawn over the 3D object
    for (const [index, position] of stage.entries()) {
        site.snap(position);
        site.tick(4);
        await wait(60);
        const where = `stage ${index + 1} @${position}`;
        const slide = document.getElementById(`slide-${index + 1}`);
        if (!slide.classList.contains('active')) issues.push({ where, issue: 'chapter not shown' });
        const boxes = textBoxes(slide);
        const pieces = site.objectRects();
        const blocks = [...slide.querySelectorAll('.btn, .badge-ai, .problem-cloud li, .solution-steps li')].map(el => el.getBoundingClientRect());
        for (const box of boxes) {
            if (box.rect.top < headerBottom - 1) issues.push({ where, issue: 'under the header', a: box.text });
            if (box.rect.bottom > vh + 1 || box.rect.right > vw + 1 || box.rect.left < -1) issues.push({ where, issue: 'off screen', a: box.text });
            if (pieces.some(piece => overlaps(box.rect, piece, 4))) issues.push({ where, issue: '3D object over text', a: box.text });
        }
        for (const rect of blocks) {
            if (pieces.some(piece => overlaps(rect, piece, 4))) issues.push({ where, issue: '3D object over a button / chip' });
        }
        const city = document.querySelector('.hero-city');
        if (index === 0 && city && getComputedStyle(city).display !== 'none') {
            const cityRect = city.getBoundingClientRect();
            for (const box of boxes) if (overlaps(box.rect, cityRect, 2)) issues.push({ where, issue: 'city over text', a: box.text });
        }
        textCollisions(boxes, where, issues);
    }

    // 2. The page flow, with every reveal and sequence played
    const story = document.getElementById('story');
    story.scrollIntoView();
    site.tick(2);
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-in'));
    document.querySelectorAll('[data-play]').forEach(el => el.classList.add('is-playing'));
    await wait(60);
    const boxes = textBoxes(story);
    textCollisions(boxes, 'page', issues);
    for (const box of boxes) {
        if (box.rect.right > vw + 1 || box.rect.left < -1) issues.push({ where: 'page', issue: 'off screen', a: box.text });
        for (const clip of clippingAncestors(box.el)) {
            const r = clip.getBoundingClientRect();
            if (box.rect.left < r.left - 1 || box.rect.right > r.right + 1 || box.rect.top < r.top - 1 || box.rect.bottom > r.bottom + 1) {
                issues.push({ where: 'page', issue: 'clipped', a: box.text, b: clip.className });
                break;
            }
        }
    }
    if (document.documentElement.scrollWidth > vw + 1) {
        issues.push({ where: 'page', issue: `horizontal scroll (${document.documentElement.scrollWidth}px > ${vw}px)` });
    }
    freeze.remove();
    return issues;
}
