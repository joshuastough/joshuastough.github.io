// The image lab on index.html: operations, the before/after wipe and the controls.
// Runs at the end of <body>, after pictures.js has defined LAB_PICTURES and the inline
// script in the figure has picked this visit's photo. After changing this file, bump
// ?v= on its <script> in index.html.
(function () {
  var BOOK = 'https://profstough.github.io/imageprocessing-awesome/';
  // Dither fineness 1..11 as [dot size in pixels, gray levels]: big black-and-white dots first,
  // then single-pixel dots with more and more gray levels.
  var DITHER = [[12, 2], [8, 2], [6, 2], [4, 2], [3, 2], [2, 2], [1, 2], [1, 3], [1, 4], [1, 6], [1, 8]];
  var OPS = [
    {
      id: 'original', label: 'Original',
      text: 'The photograph before any processing, pixel-aligned with your screen.'
    },
    {
      id: 'sampling', label: 'Sampling', name: 'Block', min: 2, max: 40, step: 1, value: 12, unit: ' px',
      text: 'One sample per block, repeated to fill it. Fewer samples, less spatial resolution.',
      slug: 'spatial-resolution', chapter: 'Sampling and Spatial Resolution'
    },
    {
      id: 'quantize', label: 'Quantize', name: 'Levels', min: 2, max: 16, step: 1, value: 4, unit: '',
      text: 'Every pixel rounded to one of a few gray levels; an 8-bit image has 256. Watch the shadow band.',
      slug: 'color-quantization', chapter: 'Color Quantization'
    },
    {
      id: 'blur', label: 'Blur', name: 'Radius', min: 0, max: 16, step: 1, value: 5, unit: ' px',
      text: 'Each pixel averaged with its neighbors (three box passes, close to a Gaussian): a low-pass filter.',
      slug: 'imfilter-lowpass-demo', chapter: 'Spatial filtering, low pass'
    },
    {
      id: 'edges', label: 'Edges', name: 'Gain', min: 1, max: 8, step: 0.5, value: 3, unit: '×',
      text: 'Sobel gradient magnitude: bright where brightness changes quickly, dark where it is flat.',
      slug: 'edge-detection', chapter: 'Gradient Maps and Edge Detection'
    },
    {
      id: 'hue', label: 'Hue shift', name: 'Hue', min: 0, max: 359, step: 1, value: 180, unit: '°',
      text: 'Every hue rotated around the HSV color wheel, while saturation and value stay put.',
      slug: 'color-hsv', chapter: 'HSV color space'
    },
    {
      id: 'saturation', label: 'Saturation', name: 'Scale', min: 0, max: 3, step: 0.1, value: 2, unit: '\u00d7',
      text: 'Every pixel\u2019s saturation scaled in HSV space: 0\u00d7 is gray, 1\u00d7 the original, more is more vivid. Hue and value stay put.',
      slug: 'color-hsv', chapter: 'HSV color space'
    },
    {
      id: 'dither', label: 'Dither', name: 'Fineness', min: 1, max: 11, step: 1, value: 6, unit: '',
      text: 'Floyd\u2013Steinberg error diffusion: few gray levels, but each rounding error is pushed onto the neighbors, so the tones survive. Slide right for smaller dots, then more levels.',
      detail: function (f) {
        var d = DITHER[f - 1];
        return 'Now: ' + (d[0] > 1 ? d[0] + '-pixel dots' : 'single-pixel dots') + ', ' + d[1] + ' gray levels.';
      },
      slug: 'color-quantization', chapter: 'Color Quantization'
    }
  ];

  var stage = document.getElementById('stage');
  var photo = document.getElementById('photo');
  var canvas = document.getElementById('canvas');
  var wipeEl = document.getElementById('wipe');
  var tagLeft = document.getElementById('tag-left');
  var tagRight = document.getElementById('tag-right');
  var opsEl = document.getElementById('ops');
  var paramRow = document.getElementById('param-row');
  var paramName = document.getElementById('param-name');
  var slider = document.getElementById('param');
  var paramOut = document.getElementById('param-out');
  var caption = document.getElementById('caption');
  var figtext = document.getElementById('figtext');

  var query = new URLSearchParams(location.search);
  var pick = window.LAB_PICK;
  if (pick) figtext.textContent = pick.caption; // the page's text is the butterfly's, for no-JS visitors
  var W, H, N, ctx, src, out, lum, smooth, bufA, bufB, err;
  var op = OPS[4], value = op.value, wipe = 0.5, pending = 0, dragging = false;

  /* ---------- Image operations: read src / lum, write out ---------- */

  function gray(o, p, v) {
    o[p] = o[p + 1] = o[p + 2] = v;
    o[p + 3] = 255;
  }

  var RUN = {
    original: function () { out.data.set(src.data); },

    sampling: function (b) {
      var s = src.data, o = out.data;
      for (var by = 0; by < H; by += b) {
        for (var bx = 0; bx < W; bx += b) {
          var sp = (Math.min(by + (b >> 1), H - 1) * W + Math.min(bx + (b >> 1), W - 1)) * 4;
          for (var y = by; y < Math.min(by + b, H); y++) {
            for (var x = bx, p = (y * W + bx) * 4; x < Math.min(bx + b, W); x++, p += 4) {
              o[p] = s[sp]; o[p + 1] = s[sp + 1]; o[p + 2] = s[sp + 2]; o[p + 3] = 255;
            }
          }
        }
      }
    },

    quantize: function (k) {
      var o = out.data, step = 255 / (k - 1);
      for (var i = 0, p = 0; i < N; i++, p += 4) gray(o, p, Math.round(lum[i] / step) * step);
    },

    blur: function (r) {
      var s = src.data, o = out.data, i, p;
      if (r === 0) { o.set(s); return; } // radius 0: each pixel is its own average
      for (i = 0, p = 0; i < N; i++, p += 4) {
        bufA[i * 3] = s[p]; bufA[i * 3 + 1] = s[p + 1]; bufA[i * 3 + 2] = s[p + 2];
      }
      for (var pass = 0; pass < 3; pass++) {
        boxH(bufA, bufB, r);
        boxV(bufB, bufA, r);
      }
      for (i = 0, p = 0; i < N; i++, p += 4) {
        o[p] = bufA[i * 3]; o[p + 1] = bufA[i * 3 + 1]; o[p + 2] = bufA[i * 3 + 2]; o[p + 3] = 255;
      }
    },

    edges: function (gain) {
      var o = out.data, L = smooth, scale = gain / 8;
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
          var i = y * W + x, v = 0;
          if (x > 0 && y > 0 && x < W - 1 && y < H - 1) {
            var gx = (L[i - W + 1] + 2 * L[i + 1] + L[i + W + 1]) - (L[i - W - 1] + 2 * L[i - 1] + L[i + W - 1]);
            var gy = (L[i + W - 1] + 2 * L[i + W] + L[i + W + 1]) - (L[i - W - 1] + 2 * L[i - W] + L[i - W + 1]);
            v = Math.sqrt(gx * gx + gy * gy) * scale;
          }
          gray(o, i * 4, v);
        }
      }
    },

    hue: function (deg) {
      var s = src.data, o = out.data, shift = deg / 60;
      for (var p = 0; p < s.length; p += 4) {
        var r = s[p] / 255, g = s[p + 1] / 255, b = s[p + 2] / 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
        o[p + 3] = 255;
        if (d === 0) { o[p] = s[p]; o[p + 1] = s[p + 1]; o[p + 2] = s[p + 2]; continue; }
        var h = max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h = ((h + shift) % 6 + 6) % 6;
        var sat = d / max, v = max, k = Math.floor(h), f = h - k;
        var pp = v * (1 - sat), q = v * (1 - sat * f), t = v * (1 - sat * (1 - f));
        var rgb = [[v, t, pp], [q, v, pp], [pp, v, t], [pp, q, v], [t, pp, v], [v, pp, q]][k];
        o[p] = rgb[0] * 255; o[p + 1] = rgb[1] * 255; o[p + 2] = rgb[2] * 255;
      }
    },

    saturation: function (k) {
      // In HSV, a channel's distance below the max channel is proportional to saturation,
      // so scaling that distance scales saturation while hue and value stay fixed.
      var s = src.data, o = out.data;
      for (var p = 0; p < s.length; p += 4) {
        var r = s[p], g = s[p + 1], b = s[p + 2];
        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        var ratio = 1;
        if (max > min) {
          var sat = (max - min) / max;
          ratio = Math.min(1, sat * k) / sat;
        }
        o[p] = max - (max - r) * ratio;
        o[p + 1] = max - (max - g) * ratio;
        o[p + 2] = max - (max - b) * ratio;
        o[p + 3] = 255;
      }
    },

    dither: function (f) {
      var d = DITHER[f - 1], dot = d[0], step = 255 / (d[1] - 1), o = out.data;
      var gw = Math.ceil(W / dot), gh = Math.ceil(H / dot), x, y, i;
      // Average brightness over each dot-sized block (just the pixels when dot is 1).
      for (i = 0; i < gw * gh; i++) err[i] = 0;
      for (y = 0; y < H; y++) {
        var row = ((y / dot) | 0) * gw;
        for (x = 0; x < W; x++) err[row + ((x / dot) | 0)] += lum[y * W + x];
      }
      for (y = 0; y < gh; y++) {
        var bh = Math.min(dot, H - y * dot);
        for (x = 0; x < gw; x++) err[y * gw + x] /= bh * Math.min(dot, W - x * dot);
      }
      // Floyd-Steinberg on the block grid; each cell keeps its final level.
      for (y = 0; y < gh; y++) {
        for (x = 0; x < gw; x++) {
          i = y * gw + x;
          var old = err[i];
          var nv = Math.min(255, Math.max(0, Math.round(old / step) * step));
          var e = old - nv;
          err[i] = nv;
          if (x + 1 < gw) err[i + 1] += e * 7 / 16;
          if (y + 1 < gh) {
            if (x > 0) err[i + gw - 1] += e * 3 / 16;
            err[i + gw] += e * 5 / 16;
            if (x + 1 < gw) err[i + gw + 1] += e / 16;
          }
        }
      }
      // Paint each cell as a dot-sized square.
      for (y = 0; y < H; y++) {
        var cells = ((y / dot) | 0) * gw;
        for (x = 0; x < W; x++) gray(o, (y * W + x) * 4, err[cells + ((x / dot) | 0)]);
      }
    }
  };

  // Sliding-window box filters on 3-channel float buffers, edges clamped.
  function boxH(a, b, r) {
    var n = 2 * r + 1;
    for (var y = 0; y < H; y++) {
      var row = y * W * 3;
      for (var c = 0; c < 3; c++) {
        var sum = 0, k;
        for (k = -r; k <= r; k++) sum += a[row + Math.min(Math.max(k, 0), W - 1) * 3 + c];
        for (var x = 0; x < W; x++) {
          b[row + x * 3 + c] = sum / n;
          sum += a[row + Math.min(x + r + 1, W - 1) * 3 + c] - a[row + Math.max(x - r, 0) * 3 + c];
        }
      }
    }
  }

  function boxV(a, b, r) {
    var n = 2 * r + 1, stride = W * 3;
    for (var x = 0; x < W; x++) {
      for (var c = 0; c < 3; c++) {
        var col = x * 3 + c, sum = 0, k;
        for (k = -r; k <= r; k++) sum += a[Math.min(Math.max(k, 0), H - 1) * stride + col];
        for (var y = 0; y < H; y++) {
          b[y * stride + col] = sum / n;
          sum += a[Math.min(y + r + 1, H - 1) * stride + col] - a[Math.max(y - r, 0) * stride + col];
        }
      }
    }
  }

  /* ---------- Drawing ---------- */

  function composite() {
    if (op.id === 'original') {
      ctx.putImageData(src, 0, 0);
      return;
    }
    ctx.putImageData(out, 0, 0);
    var sx = Math.round(wipe * W);
    if (sx > 0) ctx.putImageData(src, 0, 0, 0, 0, sx, H); // original on the left of the divider
  }

  function schedule(what) {
    if (!pending) requestAnimationFrame(flush);
    pending |= what;
  }

  function flush() {
    if (pending & 1) RUN[op.id](value);
    composite();
    pending = 0;
  }

  /* ---------- Controls ---------- */

  function describe() {
    caption.textContent = op.text + ' ' +
      (op.detail ? op.detail(value) + ' ' : '');
    if (op.slug) {
      var a = document.createElement('a');
      a.href = BOOK + op.slug + '/';
      a.textContent = op.chapter + ' \u2192';
      caption.appendChild(a);
    }
  }

  function fmt(v) {
    return (op.step < 1 ? v.toFixed(1) : String(v)) + op.unit;
  }

  function select(id, v) {
    op = OPS.filter(function (o) { return o.id === id; })[0] || OPS[4];
    value = v != null && !isNaN(v) ? Math.min(op.max, Math.max(op.min, v)) : op.value;
    Array.prototype.forEach.call(opsEl.children, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.op === op.id));
    });
    var plain = op.id === 'original';
    stage.classList.toggle('plain', plain);
    paramRow.hidden = plain;
    if (!plain) {
      paramName.textContent = op.name;
      slider.min = op.min; slider.max = op.max; slider.step = op.step; slider.value = value;
      paramOut.textContent = fmt(value);
      tagRight.textContent = op.label;
    }
    describe();
    figtext.textContent = pick.caption + (plain ? '' :
      ' Left of the divider: the original. Right: ' + op.label.toLowerCase() + '.');
    canvas.setAttribute('aria-label', plain ? pick.alt :
      pick.alt + ', with ' + op.label.toLowerCase() + ' applied right of a divider at ' +
      Math.round(wipe * 100) + ' percent');
    schedule(1);
  }

  function setWipe(f) {
    wipe = Math.min(1, Math.max(0, f));
    wipeEl.style.left = wipe * 100 + '%';
    wipeEl.setAttribute('aria-valuenow', Math.round(wipe * 100));
    tagLeft.classList.toggle('hidden', wipe < 0.16);
    tagRight.classList.toggle('hidden', wipe > 0.84);
    schedule(2);
  }

  function pointTo(ev) {
    var r = canvas.getBoundingClientRect();
    setWipe((ev.clientX - r.left) / r.width);
  }

  OPS.forEach(function (o) {
    var b = document.createElement('button');
    b.type = 'button';
    b.dataset.op = o.id;
    b.textContent = o.label;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () { select(o.id); });
    opsEl.appendChild(b);
  });

  slider.addEventListener('input', function () {
    value = +slider.value;
    paramOut.textContent = fmt(value);
    if (op.detail) describe();
    schedule(1);
  });

  stage.addEventListener('pointerdown', function (ev) {
    if (op.id === 'original' || ev.button > 0) return;
    dragging = true;
    stage.setPointerCapture(ev.pointerId);
    pointTo(ev);
  });
  stage.addEventListener('pointermove', function (ev) { if (dragging) pointTo(ev); });
  ['pointerup', 'pointercancel'].forEach(function (t) {
    stage.addEventListener(t, function () { dragging = false; });
  });

  wipeEl.addEventListener('keydown', function (ev) {
    var step = ev.shiftKey ? 0.1 : 0.02;
    var moves = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step };
    if (ev.key in moves) setWipe(wipe + moves[ev.key]);
    else if (ev.key === 'Home') setWipe(0);
    else if (ev.key === 'End') setWipe(1);
    else return;
    ev.preventDefault();
  });

  /* ---------- Start once the photo has loaded ---------- */

  /* ---------- Working image: one pixel per screen pixel ---------- */

  // The picture is processed at the size it is shown, in device pixels, so each processed
  // pixel lands on exactly one screen pixel. Letting the browser shrink a larger result would
  // resample dither dots, edge lines and block borders into moire.
  var frame = stage.parentNode, fitted = '', refit = 0, MAX_WORK = 1600;

  function fit() {
    var dpr = window.devicePixelRatio || 1;
    var cs = getComputedStyle(frame);
    // Exact (fractional) content width: clientWidth rounds, and a canvas even 0.2px too wide gets squeezed.
    var availW = frame.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) -
      parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    var availH = Math.min(innerHeight * 0.78, 720);
    var nw = photo.naturalWidth, nh = photo.naturalHeight;
    var cssW = Math.min(availW, nw, availH * nw / nh);
    var w = Math.max(1, Math.min(MAX_WORK, Math.floor(cssW * dpr)));
    var h = Math.max(1, Math.floor(w * nh / nw));
    var key = w + 'x' + h + '@' + dpr;
    if (key === fitted) return false;

    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w / dpr + 'px';
    canvas.style.height = h / dpr + 'px';
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(photo, 0, 0, w, h);
    try {
      src = ctx.getImageData(0, 0, w, h);
    } catch (e) {
      return false; // e.g. opened from file://; keep the plain picture
    }
    W = w; H = h; N = w * h;
    fitted = key;
    out = ctx.createImageData(W, H);
    lum = new Float32Array(N);
    err = new Float32Array(N);
    bufA = new Float32Array(N * 3);
    bufB = new Float32Array(N * 3);
    var s = src.data, i, p;
    for (i = 0, p = 0; i < N; i++, p += 4) lum[i] = 0.299 * s[p] + 0.587 * s[p + 1] + 0.114 * s[p + 2];
    // A 3x3 mean takes the sensor noise out of the edge map.
    smooth = new Float32Array(N);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var sum = 0;
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            sum += lum[Math.min(H - 1, Math.max(0, y + dy)) * W + Math.min(W - 1, Math.max(0, x + dx))];
          }
        }
        smooth[y * W + x] = sum / 9;
      }
    }
    return true;
  }

  // Window resizes, zoom and rotation change the shown size: re-fit and reprocess.
  function onResize() {
    clearTimeout(refit);
    refit = setTimeout(function () {
      if (stage.classList.contains('ready') && fit()) schedule(1);
    }, 120);
  }

  function init() {
    if (!fit()) return;
    addEventListener('resize', onResize);
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(frame);
    stage.classList.add('ready');
    document.getElementById('controls').hidden = false;
    var w = parseFloat(query.get('wipe'));
    setWipe(isNaN(w) ? wipe : w);
    // Start with the operation the address asks for, else the picture's pinned one, else a random one.
    var qop = query.get('op'), qv = parseFloat(query.get('v'));
    var processed = OPS.filter(function (o) { return o.id !== 'original'; });
    if (qop) select(qop, qv);
    else if (pick.op) select(pick.op, isNaN(qv) ? pick.v : qv);
    else select(processed[Math.floor(Math.random() * processed.length)].id);
  }

  if (photo.complete && photo.naturalWidth) init();
  else photo.addEventListener('load', init);
})();
