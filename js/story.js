/* Signalo — the page around the 3D stage: navigation through the twelve chapters,
   scroll reveals, and the small scenes that explain the product (citizen phone,
   AI pipeline, workflow, before / after). Plain script, no dependency. */
(function () {
    'use strict';

    var SECTIONS = ['hero', 'probleme', 'solution', 'citoyen', 'ia', 'mairie', 'workflow',
        'resolution', 'ecosysteme', 'manifeste', 'versions', 'contact'];
    var stage = document.querySelector('.scroll-stage');
    var story = document.getElementById('story');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---- Anchors: smooth scroll for every in-page link ---- */
    function scrollToTarget(id) {
        var target = document.getElementById(id);
        if (!target) return;
        var offset = target.classList.contains('cta-panel') ? 90 : 0;
        var top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    document.addEventListener('click', function (event) {
        var link = event.target.closest('a[href^="#"]');
        if (!link) return;
        var id = link.getAttribute('href').slice(1);
        event.preventDefault();               // "#" placeholders (store badges) stay inert
        if (!id) return;
        closeMenu();
        scrollToTarget(id);
        if (history.replaceState) history.replaceState(null, '', '#' + id);
    });

    /* ---- Full menu ---- */
    var menu = document.getElementById('menu');
    var menuButton = document.querySelector('.menu-btn');
    function openMenu() {
        if (!menu) return;
        menu.hidden = false;
        document.documentElement.style.overflow = 'hidden';
        void menu.offsetWidth;                // commit the hidden state so the fade runs
        menu.classList.add('is-open');
        menuButton.setAttribute('aria-expanded', 'true');
        var first = menu.querySelector('a, button');
        if (first) first.focus();
    }
    function closeMenu() {
        if (!menu || menu.hidden) return;
        menu.classList.remove('is-open');
        document.documentElement.style.overflow = '';
        menuButton.setAttribute('aria-expanded', 'false');
        setTimeout(function () { menu.hidden = true; }, 300);
    }
    if (menu && menuButton) {
        menuButton.addEventListener('click', function () { menu.hidden ? openMenu() : closeMenu(); });
        menu.querySelector('.menu-close').addEventListener('click', function () { closeMenu(); menuButton.focus(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
    }

    /* ---- Active chapter: header counter, nav links, progress rail ---- */
    var counter = document.getElementById('brand-chapter');
    var navLinks = document.querySelectorAll('.header-nav .nav-link');
    var railLinks = document.querySelectorAll('.rail a');
    var current = -1;
    function activeIndex() {
        var vh = window.innerHeight;
        if (story && story.getBoundingClientRect().top > vh * 0.5) {
            var end = Math.max(1, stage.offsetHeight - vh);
            var f = window.scrollY / end;
            return f < 0.205 ? 0 : f < 0.53 ? 1 : 2;
        }
        var index = 3;
        for (var i = 3; i < SECTIONS.length; i++) {
            var el = document.getElementById(SECTIONS[i]);
            if (el && el.getBoundingClientRect().top <= vh * 0.5) index = i;
        }
        return index;
    }
    function updateActive() {
        var index = activeIndex();
        if (index === current) return;
        current = index;
        var id = SECTIONS[index];
        if (counter) counter.textContent = String(index + 1).padStart(2, '0');
        navLinks.forEach(function (link) { link.classList.toggle('is-active', link.dataset.target === id); });
        railLinks.forEach(function (link, i) {
            link.classList.toggle('is-active', i === index);
            if (i === index) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
        });
    }

    /* ---- Citizen journey: the phone follows the step being read ---- */
    var phone = document.querySelector('.phone');
    var steps = Array.prototype.slice.call(document.querySelectorAll('.journey-step'));
    var wideJourney = window.matchMedia('(min-width: 1001px)');
    var phoneTimer = 0;
    function setPhoneStep(n) { if (phone) phone.setAttribute('data-step', String(n)); }
    function updateJourney() {
        if (!steps.length) return;
        var mid = window.innerHeight * 0.5, best = -1, bestDistance = Infinity;
        steps.forEach(function (step, i) {
            var r = step.getBoundingClientRect();
            if (r.bottom < 0 || r.top > window.innerHeight) return;
            var d = Math.abs(r.top + r.height / 2 - mid);
            if (d < bestDistance) { bestDistance = d; best = i; }
        });
        steps.forEach(function (step, i) { step.classList.toggle('is-active', i === best); });
        if (best >= 0 && wideJourney.matches) setPhoneStep(best + 1);
    }
    function playPhone() {                     // small screens: the phone plays the five steps once
        clearInterval(phoneTimer);
        var n = 1;
        setPhoneStep(n);
        phoneTimer = setInterval(function () {
            n += 1;
            setPhoneStep(n);
            if (n >= 5) clearInterval(phoneTimer);
        }, reduceMotion ? 300 : 1500);
    }

    /* ---- Scroll loop ---- */
    var ticking = false;
    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
            ticking = false;
            updateActive();
            updateJourney();
        });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    /* ---- Reveals and one-shot scenes ---- */
    if ('IntersectionObserver' in window) {
        var revealer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-in');
                revealer.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
        document.querySelectorAll('.reveal').forEach(function (el) { revealer.observe(el); });

        // Sequences play when a third of them is visible, and replay after leaving the screen.
        var player = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.intersectionRatio >= 0.3) entry.target.classList.add('is-playing');
                else if (!entry.isIntersecting) entry.target.classList.remove('is-playing');
            });
        }, { threshold: [0, 0.3] });
        document.querySelectorAll('[data-play]').forEach(function (el) { player.observe(el); });

        if (phone) {
            var phoneWatcher = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (wideJourney.matches) return;
                    if (entry.intersectionRatio >= 0.45) playPhone();
                    else if (!entry.isIntersecting) { clearInterval(phoneTimer); setPhoneStep(1); }
                });
            }, { threshold: [0, 0.45] });
            phoneWatcher.observe(phone);
        }
    } else {
        document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('is-in'); });
        document.querySelectorAll('[data-play]').forEach(function (el) { el.classList.add('is-playing'); });
    }

    /* ---- Before / after ---- */
    var compare = document.querySelector('.compare');
    if (compare) {
        var range = compare.querySelector('.compare-range');
        var touched = false;
        var setPos = function (v) { compare.style.setProperty('--pos', v + '%'); };
        range.addEventListener('input', function () { touched = true; setPos(range.value); });
        if ('IntersectionObserver' in window && !reduceMotion) {
            // A short hint, once: the line sweeps so visitors see they can drag it.
            var hinted = false;
            new IntersectionObserver(function (entries, observer) {
                if (hinted || !entries[0].isIntersecting || entries[0].intersectionRatio < 0.5) return;
                hinted = true;
                observer.disconnect();
                var keys = [[0, 50], [700, 84], [1500, 16], [2200, 50]];
                var start = performance.now();
                (function frame(now) {
                    if (touched) return;
                    var t = now - start, value = 50;
                    for (var k = 1; k < keys.length; k++) {
                        if (t <= keys[k][0]) {
                            var a = keys[k - 1], b = keys[k], u = (t - a[0]) / (b[0] - a[0]);
                            u = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
                            value = a[1] + (b[1] - a[1]) * u;
                            break;
                        }
                    }
                    setPos(value.toFixed(2));
                    range.value = Math.round(value);
                    if (t < keys[keys.length - 1][0]) requestAnimationFrame(frame);
                })(start);
            }, { threshold: [0, 0.5] }).observe(compare);
        }
    }

    /* ---- Videos (for future clips): load when near, play only while visible ---- */
    var videos = document.querySelectorAll('video[data-src]');
    if (videos.length && 'IntersectionObserver' in window) {
        var videoWatcher = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                var video = entry.target;
                if (entry.isIntersecting) {
                    if (!video.src) { video.src = video.dataset.src; video.load(); }
                    if (!reduceMotion) video.play().catch(function () {});
                } else if (!video.paused) {
                    video.pause();
                }
            });
        }, { rootMargin: '200px 0px', threshold: 0.01 });
        videos.forEach(function (video) { videoWatcher.observe(video); });
    }

    var year = document.getElementById('currentYear');
    if (year) year.textContent = new Date().getFullYear();
    updateActive();
    updateJourney();
})();
