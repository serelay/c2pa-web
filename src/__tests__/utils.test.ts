/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
import Utils from "../utils";

describe('utils.ts', () => {
  
  describe('isEqual', () => {
    test('should be true if equal', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3]);
      const result = Utils.isEqual(a, b);
      expect(result).toBe(true);
    });
    
    test('should be false if false', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 4]);
      const result = Utils.isEqual(a, b);
      expect(result).toBe(false);
    });
  });

  describe('textFrom', () => {
    test('shouldRetrieve UTF-8', () => {
      const a = new Uint8Array([65, 66, 67]);
      const result = Utils.textFrom(a);
      expect(result).toBe('ABC');
    })
  });

  describe('fromHexString', () => {
    const a = 'AABBFF';
    const expectation = new Uint8Array([170, 187, 255]);
    const result = Utils.fromHexString(a);
    expect(result.length).toBe(expectation.length);
    for (let i = 0; i < expectation.length; i++) {
      expect(result[i]).toBe(expectation[i]);
    }
  });

  describe('bufToHex', () => {
    const a = new Uint8Array([170, 187, 255]);
    const expectation = 'AABBFF';
    const result = Utils.bufToHex(a);
    expect(result).toBe(expectation);
  });

});