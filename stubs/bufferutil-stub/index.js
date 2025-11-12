function mask(source, maskBytes, output, offset, length) {
  offset = offset ?? 0;
  length = length ?? source.length;

  for (let i = 0; i < length; i += 1) {
    // eslint-disable-next-line no-bitwise
    output[offset + i] = source[i] ^ maskBytes[i % 4];
  }
}

function unmask(buffer, maskBytes) {
  const length = buffer?.length ?? 0;
  for (let i = 0; i < length; i += 1) {
    // eslint-disable-next-line no-bitwise
    buffer[i] ^= maskBytes[i % 4];
  }
}

function isValidUTF8() {
  return true;
}

module.exports = {
  mask,
  unmask,
  isValidUTF8,
};

