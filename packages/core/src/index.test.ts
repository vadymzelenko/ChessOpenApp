import { SUPPORTED_PACK_FORMAT } from './index';

describe('@chess-open/core', () => {
  it('exposes the supported pack format version', () => {
    expect(SUPPORTED_PACK_FORMAT).toBe(1);
  });
});
