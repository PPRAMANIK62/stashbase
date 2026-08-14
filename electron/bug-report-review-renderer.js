'use strict';

const api = window.reportReview;
const artifactsRoot = document.getElementById('artifacts');
const status = document.getElementById('status');
const approveButton = document.getElementById('approve');
const cancelButton = document.getElementById('cancel');
const reviewFlow = document.getElementById('review-flow');
const reportReady = document.getElementById('report-ready');
const reportReadyHeading = document.getElementById('report-ready-heading');
const openGitHubButton = document.getElementById('open-github');
const saveArtifactsButton = document.getElementById('save-artifacts');
const backButton = document.getElementById('back');
const reproductionDisclosure = document.getElementById('reproduction-disclosure');
const fields = Object.freeze({
  problem: document.getElementById('problem'),
  reproduction: document.getElementById('reproduction'),
});
let model = null;
let operation = Promise.resolve();
const previewCache = new Map();
const openPreviews = new Set();

function setStatus(message, kind = '') {
  status.textContent = message;
  status.className = `status${kind ? ` ${kind}` : ''}`;
}

function safeMessage(result, fallback) {
  return result?.error?.message || fallback;
}

function descriptionPayload() {
  return {
    problem: fields.problem.value,
    reproduction: fields.reproduction.value,
  };
}

function setDescription(description) {
  for (const name of Object.keys(fields)) fields[name].value = description?.[name] || '';
  if (fields.reproduction.value.trim()) reproductionDisclosure.open = true;
}

function enqueue(action) {
  operation = operation.then(action, action).catch(() => {
    setStatus('The report could not be updated. Please try again.', 'error');
  });
  return operation;
}

function artifactTitle(kind) {
  if (kind === 'screenshot') return 'Screenshot';
  if (kind === 'log') return 'Application log';
  return 'System info';
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function artifactMeta(artifact) {
  if (!artifact.available) return 'Unavailable for this report';
  if (artifact.kind === 'screenshot') {
    const size = artifact.summary?.byteLength || 0;
    const width = artifact.summary?.width || 0;
    const height = artifact.summary?.height || 0;
    return `${width} × ${height} px · ${formatBytes(size)}`;
  }
  if (artifact.kind === 'log') {
    const size = artifact.summary?.byteLength || 0;
    const truncated = artifact.summary?.truncated ? ' · most recent entries' : '';
    const redactions = artifact.summary?.redactionCount || 0;
    return `${formatBytes(size)}${truncated} · ${redactions} redaction${redactions === 1 ? '' : 's'}`;
  }
  return 'App and OS versions';
}

function renderDiagnostics(artifact, container) {
  if (!artifact.available || !artifact.details) return;
  const labels = [
    ['Captured', 'capturedAt'],
    ['Application', 'appName'],
    ['Version', 'appVersion'],
    ['Mode', 'mode'],
    ['Electron', 'electronVersion'],
    ['Platform', 'platform'],
    ['OS release', 'platformRelease'],
    ['Architecture', 'architecture'],
  ];
  const list = document.createElement('dl');
  list.className = 'diagnostics';
  for (const [label, key] of labels) {
    const term = document.createElement('dt');
    term.textContent = label;
    const value = document.createElement('dd');
    value.textContent = String(artifact.details[key] || 'Unavailable');
    list.append(term, value);
  }
  container.append(list);
}

function renderArtifactToggle(artifact) {
  const title = artifactTitle(artifact.kind);
  const label = document.createElement('label');
  label.className = 'artifact-check';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = Boolean(artifact.available && artifact.included);
  checkbox.disabled = !artifact.available || model.state === 'approved';
  checkbox.setAttribute('aria-label', `Include ${title} in the report`);
  checkbox.addEventListener('change', () => {
    const include = checkbox.checked;
    enqueue(async () => {
      setStatus('Updating selection…');
      const result = include
        ? await api.includeArtifact(artifact.id)
        : await api.excludeArtifact(artifact.id);
      if (!result?.ok) {
        setStatus(safeMessage(result, 'The selection could not be updated.'), 'error');
        renderArtifacts();
        return;
      }
      model = result.draft;
      renderArtifacts();
      setStatus(`${title} ${include ? 'included' : 'excluded'}.`);
    });
  });
  const name = document.createElement('span');
  name.className = 'artifact-name';
  name.textContent = title;
  label.append(checkbox, name);
  return label;
}

function previewResultFor(artifact) {
  if (!previewCache.has(artifact.id)) {
    const request = Promise.resolve(api.getArtifactPreview(artifact.id)).catch(() => ({
      ok: false,
      error: { message: 'This preview could not be loaded.' },
    }));
    previewCache.set(artifact.id, request);
  }
  return previewCache.get(artifact.id);
}

function renderPreviewUnavailable(container, result) {
  const message = document.createElement('p');
  message.className = 'preview-unavailable';
  message.textContent = safeMessage(result, 'This preview is unavailable.');
  container.replaceChildren(message);
}

function renderLogPreview(preview, container) {
  if (preview?.kind !== 'log' || typeof preview.text !== 'string') {
    renderPreviewUnavailable(container, null);
    return;
  }
  const caption = document.createElement('p');
  caption.className = 'preview-caption';
  caption.textContent = 'The exact sanitized excerpt that will be attached.';
  const content = document.createElement('pre');
  content.className = 'log-preview';
  content.tabIndex = 0;
  content.setAttribute('aria-label', 'Sanitized bounded application-log excerpt');
  content.textContent = preview.text;
  container.replaceChildren(caption, content);
}

function renderScreenshotPreview(preview, container) {
  if (
    preview?.kind !== 'screenshot'
    || preview.mimeType !== 'image/png'
    || typeof preview.dataUrl !== 'string'
    || !preview.dataUrl.startsWith('data:image/png;base64,')
    || !Number.isSafeInteger(preview.width)
    || !Number.isSafeInteger(preview.height)
  ) {
    renderPreviewUnavailable(container, null);
    return;
  }

  const caption = document.createElement('p');
  caption.className = 'preview-caption';
  caption.textContent = 'The exact capture that will be attached. Scroll or pinch to zoom.';
  const frame = document.createElement('div');
  frame.className = 'screenshot-frame';
  frame.tabIndex = 0;
  frame.setAttribute('aria-label', 'Zoomable screenshot preview');
  const stage = document.createElement('div');
  stage.className = 'screenshot-stage';
  const image = document.createElement('img');
  image.alt = 'Exact screenshot of the StashBase window where reporting began';
  image.width = preview.width;
  image.height = preview.height;
  image.addEventListener('error', () => renderPreviewUnavailable(container, null), { once: true });
  stage.append(image);
  frame.append(stage);

  const controls = document.createElement('div');
  controls.className = 'screenshot-zoom-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Screenshot zoom controls');
  const zoomOut = document.createElement('button');
  zoomOut.type = 'button';
  zoomOut.className = 'preview-action zoom-step';
  zoomOut.textContent = '−';
  zoomOut.setAttribute('aria-label', 'Zoom out');
  const zoomLevel = document.createElement('output');
  zoomLevel.className = 'screenshot-zoom-level';
  zoomLevel.setAttribute('aria-live', 'polite');
  const zoomIn = document.createElement('button');
  zoomIn.type = 'button';
  zoomIn.className = 'preview-action zoom-step';
  zoomIn.textContent = '+';
  zoomIn.setAttribute('aria-label', 'Zoom in');
  const fullSize = document.createElement('button');
  fullSize.type = 'button';
  fullSize.className = 'preview-action';
  fullSize.textContent = 'View full size';
  const fit = document.createElement('button');
  fit.type = 'button';
  fit.className = 'preview-action';
  fit.textContent = 'Fit to view';
  controls.append(zoomOut, zoomLevel, zoomIn, fullSize, fit);

  let fitScale = 1;
  let zoomFromFit = 1;
  const pointers = new Map();
  let pinchDistance = null;

  function calculateFitScale() {
    const availableWidth = Math.max(1, frame.clientWidth - 2);
    const availableHeight = Math.min(418, Math.max(1, window.innerHeight * 0.7));
    return Math.min(1, availableWidth / preview.width, availableHeight / preview.height);
  }

  function maximumZoomFromFit() {
    return Math.max(4, 1 / fitScale);
  }

  function applyZoom(nextZoom, clientX, clientY) {
    const previousZoom = zoomFromFit;
    const previousWidth = preview.width * fitScale * previousZoom;
    const previousHeight = preview.height * fitScale * previousZoom;
    zoomFromFit = Math.min(maximumZoomFromFit(), Math.max(1, nextZoom));
    const displayWidth = Math.max(1, Math.round(preview.width * fitScale * zoomFromFit));
    const displayHeight = Math.max(1, Math.round(preview.height * fitScale * zoomFromFit));
    const rect = frame.getBoundingClientRect();
    const viewportX = Number.isFinite(clientX) ? clientX - rect.left : frame.clientWidth / 2;
    const viewportY = Number.isFinite(clientY) ? clientY - rect.top : frame.clientHeight / 2;
    const contentX = frame.scrollLeft + viewportX;
    const contentY = frame.scrollTop + viewportY;

    image.style.width = `${displayWidth}px`;
    image.style.height = `${displayHeight}px`;
    stage.style.width = `${displayWidth}px`;
    stage.style.height = `${displayHeight}px`;
    frame.classList.toggle('is-zoomed', zoomFromFit > 1.001);
    zoomLevel.value = `${Math.round(fitScale * zoomFromFit * 100)}%`;
    zoomLevel.textContent = zoomLevel.value;
    zoomOut.disabled = zoomFromFit <= 1.001;
    fit.disabled = zoomFromFit <= 1.001;
    fullSize.disabled = Math.abs(fitScale * zoomFromFit - 1) < 0.01;

    if (previousWidth > 0 && previousHeight > 0) {
      frame.scrollLeft = (contentX / previousWidth) * displayWidth - viewportX;
      frame.scrollTop = (contentY / previousHeight) * displayHeight - viewportY;
    }
    return Math.abs(previousZoom - zoomFromFit) > 0.001;
  }

  function zoomBy(factor, clientX, clientY) {
    return applyZoom(zoomFromFit * factor, clientX, clientY);
  }

  zoomOut.addEventListener('click', () => zoomBy(1 / 1.25));
  zoomIn.addEventListener('click', () => zoomBy(1.25));
  fullSize.addEventListener('click', () => applyZoom(1 / fitScale));
  function fitToView() {
    fitScale = calculateFitScale();
    applyZoom(1);
  }

  fit.addEventListener('click', fitToView);
  frame.addEventListener('wheel', (event) => {
    const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
    if (zoomBy(Math.exp(-delta * 0.002), event.clientX, event.clientY)) event.preventDefault();
  }, { passive: false });
  frame.addEventListener('keydown', (event) => {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomBy(1.25);
    } else if (event.key === '-') {
      event.preventDefault();
      zoomBy(1 / 1.25);
    } else if (event.key === '0') {
      event.preventDefault();
      applyZoom(1);
    }
  });

  function pointerDistanceAndCenter() {
    const active = [...pointers.values()];
    if (active.length !== 2) return null;
    return {
      distance: Math.hypot(active[0].x - active[1].x, active[0].y - active[1].y),
      x: (active[0].x + active[1].x) / 2,
      y: (active[0].y + active[1].y) / 2,
    };
  }

  frame.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    frame.setPointerCapture(event.pointerId);
    const pinch = pointerDistanceAndCenter();
    pinchDistance = pinch?.distance || null;
  });
  frame.addEventListener('pointermove', (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pinch = pointerDistanceAndCenter();
    if (pinch && pinchDistance) {
      event.preventDefault();
      zoomBy(pinch.distance / pinchDistance, pinch.x, pinch.y);
      pinchDistance = pinch.distance;
    } else if (pointers.size === 1 && zoomFromFit > 1.001) {
      event.preventDefault();
      frame.scrollLeft -= event.clientX - previous.x;
      frame.scrollTop -= event.clientY - previous.y;
    }
  });
  function releasePointer(event) {
    pointers.delete(event.pointerId);
    pinchDistance = pointerDistanceAndCenter()?.distance || null;
  }
  frame.addEventListener('pointerup', releasePointer);
  frame.addEventListener('pointercancel', releasePointer);

  image.addEventListener('load', () => {
    fitToView();
  }, { once: true });
  container.replaceChildren(caption, frame, controls);
  const resizeObserver = new ResizeObserver(() => {
    if (!frame.isConnected) {
      resizeObserver.disconnect();
      return;
    }
    if (zoomFromFit <= 1.001) fitToView();
  });
  resizeObserver.observe(frame);
  image.src = preview.dataUrl;
}

function renderArtifactExpander(artifact) {
  const details = document.createElement('details');
  details.className = `artifact-preview-details ${artifact.kind}`;
  const summary = document.createElement('summary');
  summary.textContent = artifact.kind === 'diagnostics' ? 'Details' : 'Preview';
  const container = document.createElement('div');
  container.className = 'artifact-preview-body';
  details.append(summary, container);

  if (artifact.kind === 'diagnostics') {
    renderDiagnostics(artifact, container);
  } else {
    const loading = document.createElement('p');
    loading.className = 'preview-loading';
    loading.textContent = 'Loading preview…';
    container.append(loading);
    details.addEventListener('toggle', () => {
      if (!details.open || container.dataset.loaded) return;
      container.dataset.loaded = 'true';
      void previewResultFor(artifact).then((result) => {
        if (!container.isConnected) return;
        if (!result?.ok) {
          renderPreviewUnavailable(container, result);
          return;
        }
        if (artifact.kind === 'log') renderLogPreview(result.preview, container);
        else renderScreenshotPreview(result.preview, container);
      });
    });
  }

  details.addEventListener('toggle', () => {
    if (details.open) openPreviews.add(artifact.id);
    else openPreviews.delete(artifact.id);
  });
  details.open = openPreviews.has(artifact.id);
  return details;
}

function renderArtifact(artifact) {
  const item = document.createElement('article');
  item.className = `artifact${artifact.available ? '' : ' is-unavailable'}`;
  const row = document.createElement('div');
  row.className = 'artifact-row';
  const meta = document.createElement('span');
  meta.className = 'artifact-meta';
  meta.textContent = artifactMeta(artifact);
  row.append(renderArtifactToggle(artifact), meta);
  item.append(row);
  if (artifact.available) item.append(renderArtifactExpander(artifact));
  return item;
}

function renderArtifacts() {
  artifactsRoot.replaceChildren(...model.artifacts.map(renderArtifact));
}

function lockApprovedState(report) {
  model.state = 'approved';
  const approvedArtifactIds = new Set((report?.artifacts || []).map((artifact) => artifact.id));
  for (const artifactId of previewCache.keys()) {
    if (!approvedArtifactIds.has(artifactId)) previewCache.delete(artifactId);
  }
  for (const artifactId of openPreviews) {
    if (!approvedArtifactIds.has(artifactId)) openPreviews.delete(artifactId);
  }
  model.artifacts = model.artifacts.filter((artifact) => approvedArtifactIds.has(artifact.id));
  for (const field of Object.values(fields)) field.disabled = true;
  cancelButton.textContent = 'Close';
  backButton.hidden = false;
  renderArtifacts();
}

function setPreparedState(report) {
  lockApprovedState(report);
  approveButton.disabled = true;
  approveButton.hidden = true;
  reviewFlow.hidden = true;
  reportReady.hidden = false;
  cancelButton.textContent = 'Close';
  setStatus('');
  reportReadyHeading.focus();
}

function setApprovedRetryState(report, message) {
  lockApprovedState(report);
  approveButton.disabled = false;
  approveButton.textContent = 'Try Again';
  setStatus(message, 'error');
}

function setReviewState() {
  reportReady.hidden = true;
  reviewFlow.hidden = false;
  backButton.hidden = true;
  approveButton.hidden = false;
  approveButton.disabled = false;
  approveButton.textContent = 'Prepare Report';
  cancelButton.textContent = 'Cancel';
  for (const field of Object.values(fields)) field.disabled = false;
  setDescription(model.description);
  renderArtifacts();
  setStatus('');
}

async function persistDescription() {
  const result = await api.updateDescription(descriptionPayload());
  if (!result?.ok) {
    setStatus(safeMessage(result, 'The report details could not be updated.'), 'error');
    return false;
  }
  model = result.draft;
  setDescription(model.description);
  setStatus('Report details updated.');
  return true;
}

for (const field of Object.values(fields)) {
  field.addEventListener('change', () => enqueue(persistDescription));
}

approveButton.addEventListener('click', () => enqueue(async () => {
  approveButton.disabled = true;
  setStatus('Checking and preparing the report…');
  if (model?.state !== 'approved' && !(await persistDescription())) {
    approveButton.disabled = false;
    return;
  }
  const result = await api.prepare();
  if (!result?.ok) {
    const message = safeMessage(result, 'The report could not be prepared. Please try again.');
    if (result?.report) setApprovedRetryState(result.report, message);
    else {
      approveButton.disabled = false;
      setStatus(message, 'error');
    }
    return;
  }
  setPreparedState(result.report);
}));

backButton.addEventListener('click', () => enqueue(async () => {
  backButton.disabled = true;
  const result = await api.reopen();
  backButton.disabled = false;
  if (!result?.ok) {
    setStatus(safeMessage(result, 'The review could not be reopened.'), 'error');
    return;
  }
  model = result.draft;
  setReviewState();
}));

openGitHubButton.addEventListener('click', () => enqueue(async () => {
  openGitHubButton.disabled = true;
  setStatus('Saving the files to Downloads and opening GitHub…');
  const result = await api.openGitHub();
  openGitHubButton.disabled = false;
  if (!result?.ok) {
    setStatus(safeMessage(result, 'StashBase could not open GitHub.'), 'error');
    return;
  }
  setStatus('Files are in your Downloads folder — attach them to the GitHub issue.', 'approved');
}));

saveArtifactsButton.addEventListener('click', () => enqueue(async () => {
  saveArtifactsButton.disabled = true;
  setStatus('Saving the files to Downloads…');
  const result = await api.saveArtifacts();
  saveArtifactsButton.disabled = false;
  if (!result?.ok) {
    setStatus(safeMessage(result, 'The files could not be saved to Downloads.'), 'error');
    return;
  }
  setStatus('Files are in your Downloads folder.', 'approved');
}));

cancelButton.addEventListener('click', () => enqueue(async () => {
  if (model?.state === 'approved') {
    window.close();
    return;
  }
  cancelButton.disabled = true;
  const result = await api.discard();
  if (!result?.ok && result?.error?.code !== 'NOT_FOUND') {
    cancelButton.disabled = false;
    setStatus(safeMessage(result, 'The report could not be discarded.'), 'error');
    return;
  }
  window.close();
}));

async function initialize() {
  if (!api) {
    setStatus('The secure report review bridge is unavailable.', 'error');
    approveButton.disabled = true;
    return;
  }
  const result = await api.get();
  if (!result?.ok) {
    setStatus(safeMessage(result, 'This report is no longer available.'), 'error');
    approveButton.disabled = true;
    return;
  }
  model = result.draft;
  setDescription(model.description);
  renderArtifacts();
  if (model.state === 'approved') {
    setApprovedRetryState(model.approval, 'The report is approved. Select Try Again to prepare its attachments and open GitHub.');
  }
}

void initialize();
