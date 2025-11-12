function isValidUTF8(buffer) {
  if (!buffer) return true;
  try {
    const view = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    new TextDecoder('utf-8', { fatal: true }).decode(view);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  isValidUTF8,
};

