'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const { CHANNEL } = require('./bug-report-review-ipc.cjs');

// This is intentionally a separate bridge from the workspace preload. The
// review renderer cannot choose a draft, window identity, filesystem path, or
// screenshot source; the main process derives its session from IPC sender.
contextBridge.exposeInMainWorld('reportReview', Object.freeze({
  get: () => ipcRenderer.invoke(CHANNEL.GET),
  getArtifactPreview: (artifactId) => ipcRenderer.invoke(CHANNEL.GET_ARTIFACT_PREVIEW, artifactId),
  updateDescription: (description) => ipcRenderer.invoke(CHANNEL.UPDATE_DESCRIPTION, description),
  includeArtifact: (artifactId) => ipcRenderer.invoke(CHANNEL.INCLUDE_ARTIFACT, artifactId),
  excludeArtifact: (artifactId) => ipcRenderer.invoke(CHANNEL.EXCLUDE_ARTIFACT, artifactId),
  prepare: () => ipcRenderer.invoke(CHANNEL.PREPARE),
  reopen: () => ipcRenderer.invoke(CHANNEL.REOPEN),
  openGitHub: () => ipcRenderer.invoke(CHANNEL.OPEN_GITHUB),
  saveArtifacts: () => ipcRenderer.invoke(CHANNEL.SAVE_ARTIFACTS),
  discard: () => ipcRenderer.invoke(CHANNEL.DISCARD),
}));
