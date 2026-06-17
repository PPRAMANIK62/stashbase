function isCompatibleServerHealth(body, expected) {
  if (!body || typeof body !== 'object') return false;
  if (body.app !== 'stashbase') return false;
  if (body.ok !== true) return false;
  if (body.protocolVersion !== expected.protocolVersion) return false;
  if (body.appRoot !== expected.appRoot) return false;
  if (body.resourcesPath !== expected.resourcesPath) return false;
  return true;
}

module.exports = {
  isCompatibleServerHealth,
};
