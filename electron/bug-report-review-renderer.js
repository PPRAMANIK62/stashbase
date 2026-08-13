'use strict';

const api = window.reportReview;
const artifactsRoot = document.getElementById('artifacts');
const artifactSummary = document.getElementById('artifact-summary');
const artifactSummaryGroups = document.getElementById('artifact-summary-groups');
const status = document.getElementById('status');
const approveButton = document.getElementById('approve');
const cancelButton = document.getElementById('cancel');
const reviewFlow = document.getElementById('review-flow');
const reportReady = document.getElementById('report-ready');
const reportReadyHeading = document.getElementById('report-ready-heading');
const openGitHubButton = document.getElementById('open-github');
const saveArtifactsButton = document.getElementById('save-artifacts');
const fields = Object.freeze({
  happened: document.getElementById('happened'),
  expected: document.getElementById('expected'),
  reproduction: document.getElementById('reproduction'),
});
let model = null;
let operation = Promise.resolve();
const previewCache = new Map();

function setStatus(message, kind = '') {
  status.textContent = message;
  status.className = `status${kind ? ` ${kind}` : ''}`;
}

function safeMessage(result, fallback) {
  return result?.error?.message || fallback;
}

function descriptionPayload() {
  return {
    happened: fields.happened.value,
    expected: fields.expected.value,
    reproduction: fields.reproduction.value,
  };
}

function setDescription(description) {
  for (const name of Object.keys(fields)) fields[name].value = description?.[name] || '';
}

function enqueue(action) {
  operation = operation.then(action, action).catch(() => {
    setStatus('The report could not be updated. Please try again.', 'error');
  });
  return operation;
}

function artifactTitle(kind) {
  if (kind === 'screenshot') return 'Screenshot';
  if (kind === 'log') return 'Recent application log';
  return 'Diagnostics';
}

function artifactDescription(artifact) {
  if (!artifact.available) return 'Unavailable for this report.';
  if (artifact.kind === 'screenshot') {
    const size = artifact.summary?.byteLength || 0;
    const width = artifact.summary?.width || 0;
    const height = artifact.summary?.height || 0;
    return `Captured and prepared as a lossless PNG from the StashBase window where reporting began. StashBase does not resize, recompress, or convert it. ${width} × ${height} pixels, ${size.toLocaleString()} bytes.`;
  }
  if (artifact.kind === 'log') {
    const size = artifact.summary?.byteLength || 0;
    const truncated = artifact.summary?.truncated ? ' Bounded to the most recent entries.' : '';
    const redactions = artifact.summary?.redactionCount || 0;
    return `${size.toLocaleString()} bytes after privacy checks.${truncated} ${redactions} redaction${redactions === 1 ? '' : 's'} applied.`;
  }
  return 'A fixed allowlist of application and operating-system versions.';
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

function renderArtifactSelection(artifact) {
  if (!artifact.available) {
    const unavailable = document.createElement('span');
    unavailable.className = 'artifact-unavailable';
    unavailable.textContent = 'Unavailable';
    return unavailable;
  }

  const title = artifactTitle(artifact.kind);
  const selection = document.createElement('div');
  selection.className = `artifact-selection${model.state === 'approved' ? ' is-locked' : ''}`;
  selection.setAttribute('role', 'group');
  selection.setAttribute('aria-label', `${title} inclusion`);

  const options = [
    {
      included: true,
      className: 'include',
      label: artifact.included ? 'Included' : 'Include',
      ariaLabel: artifact.included ? `${title} is included` : `Include ${title}`,
    },
    {
      included: false,
      className: 'exclude',
      label: artifact.included ? 'Exclude' : 'Excluded',
      ariaLabel: artifact.included ? `Exclude ${title}` : `${title} is excluded`,
    },
  ];

  for (const option of options) {
    const button = document.createElement('button');
    const selected = artifact.included === option.included;
    button.type = 'button';
    button.className = `selection-option ${option.className}${selected ? ' is-selected' : ''}`;
    button.textContent = option.label;
    button.disabled = model.state === 'approved';
    button.setAttribute('aria-label', option.ariaLabel);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    button.addEventListener('click', () => {
      if (selected) return;
      enqueue(async () => {
        setStatus('Updating selection…');
        const result = option.included
          ? await api.includeArtifact(artifact.id)
          : await api.excludeArtifact(artifact.id);
        if (!result?.ok) {
          setStatus(safeMessage(result, 'The selection could not be updated.'), 'error');
          return;
        }
        model = result.draft;
        renderArtifacts();
        setStatus(`${title} ${option.included ? 'included' : 'excluded'}.`);
      });
    });
    selection.append(button);
  }

  return selection;
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
  caption.textContent = preview.truncated
    ? 'Sanitized excerpt bounded to the most recent application-log entries.'
    : 'Complete sanitized content of the bounded application-log excerpt.';
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
  caption.textContent = `Exact captured PNG eligible for attachment, without format conversion · ${preview.width} × ${preview.height} pixels. Scroll or pinch to zoom.`;
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

function renderArtifactPreview(artifact) {
  const details = document.createElement('details');
  details.className = `artifact-preview-details ${artifact.kind}`;
  details.open = true;
  const summary = document.createElement('summary');
  summary.textContent = artifact.kind === 'log' ? 'Preview sanitized excerpt' : 'Preview screenshot';
  const container = document.createElement('div');
  container.className = 'artifact-preview-body';
  const loading = document.createElement('p');
  loading.className = 'preview-loading';
  loading.textContent = 'Loading preview…';
  container.append(loading);
  details.append(summary, container);

  void previewResultFor(artifact).then((result) => {
    if (!container.isConnected) return;
    if (!result?.ok) {
      renderPreviewUnavailable(container, result);
      return;
    }
    if (artifact.kind === 'log') renderLogPreview(result.preview, container);
    else renderScreenshotPreview(result.preview, container);
  });
  return details;
}

function renderArtifact(artifact) {
  const item = document.createElement('article');
  item.className = 'artifact';
  const header = document.createElement('div');
  header.className = 'artifact-header';
  const copy = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = artifactTitle(artifact.kind);
  const summary = document.createElement('p');
  summary.textContent = artifactDescription(artifact);
  copy.append(title, summary);
  header.append(copy, renderArtifactSelection(artifact));
  item.append(header);

  if (artifact.available && (artifact.kind === 'screenshot' || artifact.kind === 'log')) {
    item.append(renderArtifactPreview(artifact));
  } else if (artifact.kind === 'diagnostics') {
    const details = document.createElement('div');
    details.className = 'artifact-preview';
    renderDiagnostics(artifact, details);
    if (details.childNodes.length > 0) item.append(details);
  }
  return item;
}

function renderArtifactSummaryGroup(title, artifacts, marker, className) {
  const group = document.createElement('div');
  group.className = `artifact-summary-group ${className}`;
  const heading = document.createElement('h3');
  heading.textContent = title;
  const list = document.createElement('ul');
  if (artifacts.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'artifact-summary-empty';
    empty.textContent = 'None';
    list.append(empty);
  } else {
    for (const artifact of artifacts) {
      const item = document.createElement('li');
      const symbol = document.createElement('span');
      symbol.className = 'artifact-summary-marker';
      symbol.setAttribute('aria-hidden', 'true');
      symbol.textContent = marker;
      const label = document.createElement('span');
      label.textContent = artifactTitle(artifact.kind);
      item.append(symbol, label);
      list.append(item);
    }
  }
  group.append(heading, list);
  return group;
}

function renderArtifactSummary() {
  artifactSummary.hidden = model.state === 'approved';
  if (artifactSummary.hidden) {
    artifactSummaryGroups.replaceChildren();
    return;
  }
  const included = model.artifacts.filter((artifact) => artifact.included);
  const excluded = model.artifacts.filter((artifact) => !artifact.included);
  artifactSummaryGroups.replaceChildren(
    renderArtifactSummaryGroup('Included', included, '✓', 'included'),
    renderArtifactSummaryGroup('Excluded', excluded, '×', 'excluded'),
  );
}

function renderArtifacts() {
  artifactsRoot.replaceChildren(...model.artifacts.map(renderArtifact));
  renderArtifactSummary();
}

function lockApprovedState(report) {
  model.state = 'approved';
  const approvedArtifactIds = new Set((report?.artifacts || []).map((artifact) => artifact.id));
  for (const artifactId of previewCache.keys()) {
    if (!approvedArtifactIds.has(artifactId)) previewCache.delete(artifactId);
  }
  model.artifacts = model.artifacts.filter((artifact) => approvedArtifactIds.has(artifact.id));
  for (const field of Object.values(fields)) field.disabled = true;
  cancelButton.textContent = 'Close';
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

openGitHubButton.addEventListener('click', () => enqueue(async () => {
  openGitHubButton.disabled = true;
  setStatus('Opening the prepared artifacts and GitHubâ€¦');
  const result = await api.openGitHub();
  openGitHubButton.disabled = false;
  if (!result?.ok) {
    setStatus(safeMessage(result, 'StashBase could not open GitHub.'), 'error');
    return;
  }
  setStatus('File Explorer and the prefilled GitHub issue were opened.', 'approved');
}));

saveArtifactsButton.addEventListener('click', () => enqueue(async () => {
  saveArtifactsButton.disabled = true;
  setStatus('Choose where to save the selected artifactsâ€¦');
  const result = await api.saveArtifacts();
  saveArtifactsButton.disabled = false;
  if (!result?.ok) {
    setStatus(safeMessage(result, 'The selected artifacts could not be saved.'), 'error');
    return;
  }
  if (result.canceled) {
    setStatus('Save canceled.');
    return;
  }
  setStatus('The selected artifacts were saved.', 'approved');
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
