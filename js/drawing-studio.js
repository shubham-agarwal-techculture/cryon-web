(function () {
  'use strict';

  const STUDIO_COLORS = [
    '#1a2744', '#6A5ACD', '#008080', '#FFB399', '#FF6B6B',
    '#BADA55', '#1A237E', '#87CEEB', '#FF8A80', '#2F4F4F',
    '#FFFBD1', '#fff78c', '#ff9980', '#f0f8ff', '#ffffff',
  ];

  const studio = document.getElementById('drawing-studio');
  if (!studio) return;

  const paperCanvas = studio.querySelector('#paper-canvas');
  const drawCanvas = studio.querySelector('#draw-canvas');
  const canvasWrap = studio.querySelector('.canvas-wrap');
  const toolButtons = studio.querySelectorAll('[data-tool]');
  const colorSwatches = studio.querySelector('#color-palette');
  const colorPicker = studio.querySelector('#color-picker');
  const sizeSlider = studio.querySelector('#brush-size');
  const sizeLabel = studio.querySelector('#brush-size-label');
  const opacitySlider = studio.querySelector('#brush-opacity');
  const opacityLabel = studio.querySelector('#brush-opacity-label');
  const undoBtn = studio.querySelector('#undo-btn');
  const redoBtn = studio.querySelector('#redo-btn');
  const clearBtn = studio.querySelector('#clear-btn');
  const downloadBtn = studio.querySelector('#download-btn');

  const paperCtx = paperCanvas.getContext('2d');
  const drawCtx = drawCanvas.getContext('2d', { willReadFrequently: true });

  let activeTool = 'brush';
  let activeColor = STUDIO_COLORS[0];
  let brushSize = 8;
  let brushOpacity = 1;
  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let snapshot = null;
  const history = [];
  const redoStack = [];
  const maxHistory = 40;

  function buildColorPalette() {
    STUDIO_COLORS.forEach((color) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-swatch' + (color === activeColor ? ' is-active' : '');
      btn.style.backgroundColor = color;
      btn.setAttribute('aria-label', 'Color ' + color);
      btn.dataset.color = color;
      if (color.toLowerCase() === '#ffffff' || color.toLowerCase() === '#fffbd1' || color.toLowerCase() === '#f0f8ff' || color.toLowerCase() === '#fff78c') {
        btn.classList.add('color-swatch--light');
      }
      btn.addEventListener('click', () => selectColor(color));
      colorSwatches.appendChild(btn);
    });
  }

  function selectColor(color) {
    activeColor = color;
    colorPicker.value = color;
    colorSwatches.querySelectorAll('.color-swatch').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.color === color);
    });
    if (activeTool === 'eraser') setTool('brush');
  }

  function setTool(tool) {
    activeTool = tool;
    toolButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tool === tool);
      btn.setAttribute('aria-pressed', btn.dataset.tool === tool ? 'true' : 'false');
    });
    drawCanvas.classList.toggle('tool-eraser', tool === 'eraser');
    drawCanvas.classList.toggle('tool-fill', tool === 'fill');
    drawCanvas.classList.toggle('tool-shape', tool === 'line' || tool === 'rect' || tool === 'circle');
  }

  function resizeCanvases() {
    const rect = canvasWrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);

    if (width <= 0 || height <= 0) return;

    const tempCanvas = document.createElement('canvas');
    if (drawCanvas.width > 0 && drawCanvas.height > 0) {
      tempCanvas.width = drawCanvas.width;
      tempCanvas.height = drawCanvas.height;
      tempCanvas.getContext('2d').drawImage(drawCanvas, 0, 0);
    }

    [paperCanvas, drawCanvas].forEach((canvas) => {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });

    renderPaperTexture(width, height);

    if (tempCanvas.width > 0) {
      drawCtx.drawImage(tempCanvas, 0, 0, width, height);
    }

    if (history.length === 0) saveState();
  }

  function renderPaperTexture(width, height) {
    paperCtx.clearRect(0, 0, width, height);

    paperCtx.fillStyle = '#FFF4D6';
    paperCtx.fillRect(0, 0, width, height);

    const grain = paperCtx.createImageData(width, height);
    const data = grain.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 18;
      data[i] = 255 + n;
      data[i + 1] = 244 + n;
      data[i + 2] = 214 + n;
      data[i + 3] = 255;
    }
    paperCtx.putImageData(grain, 0, 0);

    paperCtx.globalAlpha = 0.04;
    paperCtx.strokeStyle = '#8B6914';
    for (let i = 0; i < width * height / 800; i++) {
      paperCtx.lineWidth = Math.random() * 1.2 + 0.3;
      paperCtx.beginPath();
      const x = Math.random() * width;
      const y = Math.random() * height;
      const angle = Math.random() * Math.PI;
      const len = Math.random() * 30 + 8;
      paperCtx.moveTo(x, y);
      paperCtx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      paperCtx.stroke();
    }

    paperCtx.globalAlpha = 0.06;
    for (let y = 0; y < height; y += 3) {
      paperCtx.fillStyle = y % 6 === 0 ? 'rgba(139, 105, 20, 0.15)' : 'rgba(255, 255, 255, 0.08)';
      paperCtx.fillRect(0, y, width, 1);
    }

    paperCtx.globalAlpha = 1;
    const vignette = paperCtx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.2,
      width / 2, height / 2, Math.max(width, height) * 0.75
    );
    vignette.addColorStop(0, 'rgba(255, 255, 255, 0)');
    vignette.addColorStop(1, 'rgba(210, 190, 150, 0.12)');
    paperCtx.fillStyle = vignette;
    paperCtx.fillRect(0, 0, width, height);
  }

  function getPointerPos(e) {
    const rect = drawCanvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function saveState() {
    const data = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
    history.push(data);
    if (history.length > maxHistory) history.shift();
    redoStack.length = 0;
    updateHistoryButtons();
  }

  function restoreState(data) {
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    drawCtx.putImageData(data, 0, 0);
  }

  function updateHistoryButtons() {
    undoBtn.disabled = history.length <= 1;
    redoBtn.disabled = redoStack.length === 0;
  }

  function undo() {
    if (history.length <= 1) return;
    redoStack.push(history.pop());
    restoreState(history[history.length - 1]);
    updateHistoryButtons();
  }

  function redo() {
    if (!redoStack.length) return;
    const state = redoStack.pop();
    history.push(state);
    restoreState(state);
    updateHistoryButtons();
  }

  function clearDrawing() {
    if (!confirm('Clear the whole drawing? This cannot be undone.')) return;
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    saveState();
  }

  function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function applyStrokeStyle(ctx) {
    if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else if (activeTool === 'pencil') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = hexToRgba(activeColor, Math.min(brushOpacity, 0.85));
      ctx.fillStyle = hexToRgba(activeColor, Math.min(brushOpacity, 0.85));
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = hexToRgba(activeColor, brushOpacity);
      ctx.fillStyle = hexToRgba(activeColor, brushOpacity * 0.35);
    }
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function drawDot(x, y) {
    applyStrokeStyle(drawCtx);
    drawCtx.beginPath();
    const radius = brushSize / 2;
    if (activeTool === 'eraser') {
      drawCtx.arc(x, y, radius, 0, Math.PI * 2);
      drawCtx.fill();
    } else {
      drawCtx.arc(x, y, radius, 0, Math.PI * 2);
      drawCtx.fill();
    }
    drawCtx.globalCompositeOperation = 'source-over';
  }

  function drawLine(x1, y1, x2, y2) {
    applyStrokeStyle(drawCtx);
    drawCtx.beginPath();
    drawCtx.moveTo(x1, y1);
    drawCtx.lineTo(x2, y2);
    drawCtx.stroke();
    drawCtx.globalCompositeOperation = 'source-over';
  }

  function floodFill(startX, startY) {
    const w = drawCanvas.width;
    const h = drawCanvas.height;
    const imageData = drawCtx.getImageData(0, 0, w, h);
    const data = imageData.data;

    const sx = Math.floor(startX * (w / drawCanvas.clientWidth));
    const sy = Math.floor(startY * (h / drawCanvas.clientHeight));
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;

    const startIdx = (sy * w + sx) * 4;
    const startR = data[startIdx];
    const startG = data[startIdx + 1];
    const startB = data[startIdx + 2];
    const startA = data[startIdx + 3];

    const fill = hexToRgba(activeColor, brushOpacity);
    const m = fill.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    const fillR = +m[1];
    const fillG = +m[2];
    const fillB = +m[3];
    const fillA = Math.round((m[4] !== undefined ? +m[4] : 1) * 255);

    if (startR === fillR && startG === fillG && startB === fillB && startA === fillA) return;

    const tolerance = 32;
    const matches = (idx) =>
      Math.abs(data[idx] - startR) <= tolerance &&
      Math.abs(data[idx + 1] - startG) <= tolerance &&
      Math.abs(data[idx + 2] - startB) <= tolerance &&
      Math.abs(data[idx + 3] - startA) <= tolerance;

    const stack = [[sx, sy]];
    const visited = new Uint8Array(w * h);

    while (stack.length) {
      const [x, y] = stack.pop();
      const pi = y * w + x;
      if (visited[pi]) continue;
      const idx = pi * 4;
      if (!matches(idx)) continue;
      visited[pi] = 1;
      data[idx] = fillR;
      data[idx + 1] = fillG;
      data[idx + 2] = fillB;
      data[idx + 3] = fillA;
      if (x > 0) stack.push([x - 1, y]);
      if (x < w - 1) stack.push([x + 1, y]);
      if (y > 0) stack.push([x, y - 1]);
      if (y < h - 1) stack.push([x, y + 1]);
    }

    drawCtx.putImageData(imageData, 0, 0);
  }

  function previewShape(x, y) {
    if (!snapshot) return;
    drawCtx.putImageData(snapshot, 0, 0);
    applyStrokeStyle(drawCtx);
    const x1 = startX;
    const y1 = startY;
    const x2 = x;
    const y2 = y;

    if (activeTool === 'line') {
      drawCtx.beginPath();
      drawCtx.moveTo(x1, y1);
      drawCtx.lineTo(x2, y2);
      drawCtx.stroke();
    } else if (activeTool === 'rect') {
      drawCtx.beginPath();
      drawCtx.rect(x1, y1, x2 - x1, y2 - y1);
      drawCtx.fill();
      drawCtx.stroke();
    } else if (activeTool === 'circle') {
      const rx = Math.abs(x2 - x1) / 2;
      const ry = Math.abs(y2 - y1) / 2;
      const cx = x1 + (x2 - x1) / 2;
      const cy = y1 + (y2 - y1) / 2;
      drawCtx.beginPath();
      drawCtx.ellipse(cx, cy, rx || 1, ry || 1, 0, 0, Math.PI * 2);
      drawCtx.fill();
      drawCtx.stroke();
    }
    drawCtx.globalCompositeOperation = 'source-over';
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    drawCanvas.setPointerCapture(e.pointerId);
    const pos = getPointerPos(e);
    isDrawing = true;
    startX = pos.x;
    startY = pos.y;

    if (activeTool === 'fill') {
      floodFill(pos.x, pos.y);
      saveState();
      isDrawing = false;
      return;
    }

    if (activeTool === 'line' || activeTool === 'rect' || activeTool === 'circle') {
      snapshot = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
      return;
    }

    drawDot(pos.x, pos.y);
  }

  function onPointerMove(e) {
    if (!isDrawing) return;
    const pos = getPointerPos(e);

    if (activeTool === 'line' || activeTool === 'rect' || activeTool === 'circle') {
      previewShape(pos.x, pos.y);
      return;
    }

    drawLine(startX, startY, pos.x, pos.y);
    startX = pos.x;
    startY = pos.y;
  }

  function onPointerUp(e) {
    if (!isDrawing) return;
    isDrawing = false;
    drawCanvas.releasePointerCapture(e.pointerId);

    if (activeTool === 'line' || activeTool === 'rect' || activeTool === 'circle') {
      const pos = getPointerPos(e);
      previewShape(pos.x, pos.y);
      snapshot = null;
    }

    saveState();
  }

  function downloadArtwork() {
    const exportCanvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    exportCanvas.width = drawCanvas.width;
    exportCanvas.height = drawCanvas.height;
    const ctx = exportCanvas.getContext('2d');
    ctx.drawImage(paperCanvas, 0, 0);
    ctx.drawImage(drawCanvas, 0, 0);

    const link = document.createElement('a');
    link.download = 'cryon-studio-drawing.png';
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  }

  buildColorPalette();
  colorPicker.value = activeColor;

  toolButtons.forEach((btn) => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  colorPicker.addEventListener('input', (e) => selectColor(e.target.value));

  sizeSlider.addEventListener('input', (e) => {
    brushSize = +e.target.value;
    sizeLabel.textContent = brushSize + 'px';
  });

  opacitySlider.addEventListener('input', (e) => {
    brushOpacity = +e.target.value / 100;
    opacityLabel.textContent = e.target.value + '%';
  });

  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);
  clearBtn.addEventListener('click', clearDrawing);
  downloadBtn.addEventListener('click', downloadArtwork);

  drawCanvas.addEventListener('pointerdown', onPointerDown);
  drawCanvas.addEventListener('pointermove', onPointerMove);
  drawCanvas.addEventListener('pointerup', onPointerUp);
  drawCanvas.addEventListener('pointercancel', onPointerUp);
  drawCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('resize', resizeCanvases);
  window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvases, 150);
  });

  const resizeObserver = new ResizeObserver(resizeCanvases);
  resizeObserver.observe(canvasWrap);

  setTool('brush');
  resizeCanvases();
})();
