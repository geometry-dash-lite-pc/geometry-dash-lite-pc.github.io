/* =====================================================================
   PlayPortal — shared game launcher behavior. Identical on every game's
   page (see site/lib/render.js). Nothing here is per-game; per-game
   data lives in games.json and is rendered server-side.
   ===================================================================== */
(function () {
  "use strict";

  /* ---------------- click-to-play game frame ---------------- */
  function initGameFrame() {
    var frame = document.getElementById("gameFrame");
    var poster = document.getElementById("poster");
    var playBtn = document.getElementById("playBtn");
    var loader = document.getElementById("loader");
    var loaderFill = document.getElementById("loaderBarFill");
    if (!frame || !playBtn) return;

    var started = false;

    // Some external hosts want this page's own URL as a query param —
    // GameDistribution's gd_sdk_referrer_url, for instance. The value is
    // only knowable at runtime (it differs per deploy target), so the
    // param NAME is baked into the page and the value is filled in here.
    function gameSrc() {
      var src = frame.dataset.gameSrc;
      var param = frame.dataset.gameReferrerParam;
      if (!param) return src;
      return src + (src.indexOf("?") === -1 ? "?" : "&") +
        encodeURIComponent(param) + "=" + encodeURIComponent(window.location.href);
    }

    // An iframe's `load` fires as soon as the embed's HTML document is in —
    // which for an externally hosted game is just a few-KB shell. The engine
    // payload behind it can be tens of megabytes (some of these Unity builds
    // are 20-40MB) and keeps downloading long after that event, painting
    // nothing but white in the meantime. We can't observe a cross-origin
    // game's real readiness, so hold our own loading UI up for a minimum
    // spell instead, giving the game's own loading screen time to appear.
    var MIN_LOADER_MS = frame.dataset.gameSrc && /^https?:/i.test(frame.dataset.gameSrc) ? 3500 : 400;

    function startGame() {
      if (started) return;
      started = true;

      var startedAt = Date.now();
      poster.classList.add("is-hidden");
      loader.classList.add("is-visible");

      // fake progress for perceived performance while the iframe boots
      var pct = 0;
      var tick = setInterval(function () {
        pct = Math.min(pct + Math.random() * 22, 90);
        loaderFill.style.width = pct + "%";
      }, 180);

      var iframe = document.createElement("iframe");
      iframe.src = gameSrc();
      iframe.title = frame.dataset.gameTitle || "Game";
      iframe.setAttribute("allowfullscreen", "");

      // Externally hosted games often carry their own "more games" cross-
      // promo buttons that hijack the whole tab (window.top navigation) or
      // pop a new one — sending the player off this portal entirely. The
      // sandbox below lets the game run normally (scripts, its own
      // same-origin storage/cookies, pointer lock for FPS-style controls,
      // forms, fullscreen) but withholds the two tokens that would let it
      // navigate the parent tab or open a window: no allow-top-navigation,
      // no allow-popups. Self-hosted games are our own code and already
      // same-origin, so they're left unsandboxed.
      if (/^https?:/i.test(frame.dataset.gameSrc || "")) {
        iframe.setAttribute(
          "sandbox",
          "allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-orientation-lock allow-modals"
        );
      }
      iframe.addEventListener("load", function () {
        var wait = Math.max(200, MIN_LOADER_MS - (Date.now() - startedAt));
        clearInterval(tick);
        loaderFill.style.width = "100%";
        setTimeout(function () {
          loader.classList.remove("is-visible");
          iframe.classList.add("loaded");
        }, wait);
        // move keyboard focus into the game so arrow keys / WASD work
        // immediately in the normal (non-fullscreen) embed too — without
        // this the game only ever receives input once the user happens
        // to click inside it (e.g. right after entering fullscreen).
        iframe.focus();
      });

      frame.querySelector(".game-frame-inner").appendChild(iframe);

      // re-focus the game on any click inside its area, in case focus
      // was lost to the rest of the page (e.g. clicking a button outside).
      frame.addEventListener("click", function () {
        iframe.focus();
      });
    }

    playBtn.addEventListener("click", startGame);

    var fullscreenBtn = document.getElementById("fullscreenBtn");
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener("click", function () {
        startGame();
        if (!document.fullscreenElement) {
          frame.requestFullscreen && frame.requestFullscreen();
        } else {
          document.exitFullscreen && document.exitFullscreen();
        }
      });
      document.addEventListener("fullscreenchange", function () {
        frame.classList.toggle("is-fullscreen", document.fullscreenElement === frame);
      });
    }
  }

  /* ---------------- favorites (persisted per device via localStorage) ---------------- */
  // Wrapped in try/catch throughout: localStorage.setItem throws in Safari
  // private browsing and can throw under strict cookie/storage blocking —
  // a blocked write should never break the button, just fail to persist.
  var FAVORITES_KEY = "gdlp:favorites";

  function readFavorites() {
    try {
      var raw = window.localStorage.getItem(FAVORITES_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function writeFavorites(list) {
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
    } catch (e) {
      // storage unavailable (private mode, quota, disabled) — the toggle
      // still works for the rest of this page view, it just won't persist.
    }
  }

  function initFavorites() {
    var likeBtn = document.getElementById("likeBtn");
    var slug = document.body.getAttribute("data-game-slug");
    if (!likeBtn || !slug) return;

    function setLiked(liked) {
      likeBtn.classList.toggle("liked", liked);
      likeBtn.setAttribute("aria-pressed", liked ? "true" : "false");
      likeBtn.title = liked ? "Remove from favorites" : "Add to favorites";
    }

    setLiked(readFavorites().indexOf(slug) !== -1);

    likeBtn.addEventListener("click", function () {
      var favorites = readFavorites();
      var idx = favorites.indexOf(slug);
      var nowLiked = idx === -1;
      if (nowLiked) {
        favorites.push(slug);
      } else {
        favorites.splice(idx, 1);
      }
      writeFavorites(favorites);
      setLiked(nowLiked);
    });
  }

  /* ---------------- share ---------------- */
  function initActions() {
    var pageUrl = window.location.href;
    var pageTitle = (document.querySelector("h1") && document.querySelector("h1").textContent.trim()) || document.title;
    var encodedUrl = encodeURIComponent(pageUrl);
    var encodedTitle = encodeURIComponent(pageTitle);

    var SHARE_LINKS = {
      x: "https://twitter.com/intent/tweet?url=" + encodedUrl + "&text=" + encodedTitle,
      facebook: "https://www.facebook.com/sharer/sharer.php?u=" + encodedUrl,
      whatsapp: "https://api.whatsapp.com/send?text=" + encodedTitle + "%20" + encodedUrl,
      telegram: "https://t.me/share/url?url=" + encodedUrl + "&text=" + encodedTitle,
      reddit: "https://www.reddit.com/submit?url=" + encodedUrl + "&title=" + encodedTitle,
    };

    // Classic hidden-textarea + execCommand copy trick — used both as the
    // primary method on older browsers / insecure contexts where the
    // Clipboard API doesn't exist at all, and as a fallback when the
    // Clipboard API exists but the call itself rejects (e.g. a permission
    // prompt denied, or the document briefly not focused).
    function legacyCopy() {
      try {
        var ta = document.createElement("textarea");
        ta.value = pageUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch (e) {
        return false;
      }
    }

    function copyLink(onDone) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pageUrl).then(
          function () { onDone && onDone(true); },
          function () { onDone && onDone(legacyCopy()); }
        );
        return;
      }
      onDone && onDone(legacyCopy());
    }

    function flashCopied(btn, copiedLabel) {
      if (!btn) return;
      var original = btn.textContent;
      btn.textContent = copiedLabel;
      btn.classList.add("is-copied");
      setTimeout(function () {
        btn.textContent = original;
        btn.classList.remove("is-copied");
      }, 1800);
    }

    function openShareWindow(url) {
      window.open(url, "_blank", "noopener,noreferrer,width=600,height=500");
    }

    // The icon button in the stage header: on devices/browsers that support
    // the native share sheet (mostly mobile), let the OS show every app the
    // user has installed — the most complete "every platform" option there
    // is. Everywhere else, fall back to copying the link.
    var shareBtn = document.getElementById("shareBtn");
    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        if (navigator.share) {
          navigator.share({ title: pageTitle, url: pageUrl }).catch(function () {
            // AbortError (user dismissed the sheet) or any other failure —
            // no fallback needed, the sheet itself already gave feedback.
          });
          return;
        }
        copyLink(function (ok) {
          if (ok) {
            shareBtn.title = "Copied!";
            setTimeout(function () { shareBtn.title = "Copy link"; }, 1800);
          }
        });
      });
    }

    // The explicit per-platform buttons in the "Share" panel.
    document.querySelectorAll("[data-share]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var type = btn.getAttribute("data-share");
        if (type === "copy") {
          copyLink(function (ok) {
            if (ok) flashCopied(btn, "Copied!");
          });
          return;
        }
        var url = SHARE_LINKS[type];
        if (url) openShareWindow(url);
      });
    });
  }

  /* ---------------- nav toggle (mobile) ---------------- */
  function initNav() {
    var toggle = document.getElementById("navToggle");
    var nav = document.getElementById("mainNav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---------------- scroll reveal ---------------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || !items.length) {
      items.forEach(function (el) { el.classList.add("in-view"); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    items.forEach(function (el) { io.observe(el); });
  }

  function initFooterYear() {
    var year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();
  }

  /* ---------------- game carousel (infinite loop) ---------------- */
  function initCarousel() {
    var carousel = document.querySelector(".game-carousel");
    if (!carousel) return;

    // clone all items to create infinite loop effect
    var items = carousel.querySelectorAll(".carousel-item");
    items.forEach(function(item) {
      carousel.appendChild(item.cloneNode(true));
    });
  }

  /* -------- hide the initials badge once its artwork has loaded -------- */
  function initThumbBadges() {
    document.querySelectorAll(".game-card-image, .carousel-item-image").forEach(function (img) {
      var badge = img.nextElementSibling;
      if (!badge) return;
      function hide() { badge.style.display = "none"; }
      if (img.complete) {
        if (img.naturalWidth > 0) hide();
      } else {
        img.addEventListener("load", hide);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initGameFrame();
    initFavorites();
    initActions();
    initNav();
    initReveal();
    initFooterYear();
    initCarousel();
    initThumbBadges();
  });
})();
