/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
import C2PAValidation from '../../jumbf/c2paValidation';
import crypto from 'crypto';

describe('asset hash assertion', () => {
  it('should calculate the same hash', () => {
    const file = Buffer.from('abcde', 'utf-8');
    const exclusions = [{start: 2, length: 1}]; // c
    // const target = 'e4krSmSTVWhcar53J+zGpRkicEKwx8Wcb7aGM+5J3gw=';
    const target = crypto.createHash('sha256').update(Buffer.from('abde', 'utf-8')).digest('base64');
    const result = C2PAValidation.calculateHash(file, exclusions, 'sha256');
    expect(result).toBe(target);
  });

  it('should calculate the same hash with multiple exclusions', () => {
    const file = Buffer.from('abcde', 'utf-8');
    const exclusions = [
      {start: 2, length: 1},// c
      {start: 3, length: 1},// d
    ];
    // const target = '2Bplwd4C4X2c/YjWiodo/R4yYvXi+4WTgv4zc0s/PKg=';
    const target = crypto.createHash('sha256').update(Buffer.from('abe', 'utf-8')).digest('base64');
    const result = C2PAValidation.calculateHash(file, exclusions, 'sha256');
    expect(result).toBe(target);
  });

  it('should calculate the same hash with multiple exclusions including end regions', () => {
    const file = Buffer.from('abcde', 'utf-8');
    const exclusions = [
      {start: 2, length: 1},// c
      {start: 4, length: 1},// e
    ];
    // const target = 'pS0VnyYrLG3bckphhAvvw26zDIiHekAwtly+himESck=';
    const target = crypto.createHash('sha256').update(Buffer.from('abd', 'utf-8')).digest('base64');
    const result = C2PAValidation.calculateHash(file, exclusions, 'sha256');
    expect(result).toBe(target);
  });
});