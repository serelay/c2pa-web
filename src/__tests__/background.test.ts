/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
import * as path from 'path';
import * as fs from 'fs';
import { 
  extractProvenanceData, 
  findProvenanceData,
  parseUntilAppSegment, 
} from '../background';
import crypto from 'crypto';
import { CandidateState } from '../candidateState';

const FIXTURE = (filename: string) => path.resolve(__dirname, `fixtures/${filename}`);
const APP_1_MARKER = new Uint8Array([0xFF, 0xE1]);
const APP_11_MARKER = new Uint8Array([0xFF, 0xEB]);

function loadFile(filename: string) {
  return fs.readFileSync(FIXTURE(filename));
}

describe('background.js', () => {

  const unverifiedC2PAFile = loadFile('c2pa-unverified-signature.jpg');
  const nonSerelayIamge = loadFile('non_serelay_image.jpg')

  describe('parseUntilAppSegment', () => {
    test('findsAPP1', () => {
      const result = parseUntilAppSegment(APP_1_MARKER, unverifiedC2PAFile, 2);
      expect(result).toBeDefined()
      expect(result?.offset).toEqual(2); // Index of start of marker
    });

    test('parseUntilAppSegment_app11', () => {
      const result = parseUntilAppSegment(APP_11_MARKER, unverifiedC2PAFile, 2);
      expect(result).toBeDefined();
      expect(result?.offset).toEqual(23657);
    });
  });

  describe('extractProvenanceData', () => {
    test('gets data for valid image', () => {
      const result = extractProvenanceData(unverifiedC2PAFile, 2);
      // 184430 is declared as jumbf length, which include 4 bytes for Lbox and 4 bytes for Tbox (and would be 8 more if using XLbox)
      // Useful for debugging:
      //fs.writeFileSync(FIXTURE('out.jumbf'), result!);
      expect(result?.boxes.length).toEqual(184430 - 4); // we ignore the 'lbox' as it's the total length of what we extracted here
      //FFEBFFFD 4A500001 00000001 0002538B 6A756D62 // XT header 1
      //FFEBFFFD 4A500001 00000002 0002538B 6A756D62 // XT header 2
      //FFEB53BF 4A500001 00000003 0002538B 6A756D62 // XT header 3
      //a11 len  jumbf    seq      jlen     'jumb'
      // to 'un-XT' we concatenate the contents of all and prepend the leading `jumb`

      const currentHash = crypto.createHash('sha256').update(result!.boxes).digest('hex');
      const sha256Hash = `46f527d19daf897beb4943c50bb392f7ededdea4053967a10b25a11d9905ca88`;
      expect(currentHash).toBe(sha256Hash);      
    });

    test('gets no data for invalid image', () => {
      const result = extractProvenanceData(nonSerelayIamge, 2);
      expect(result).toBeUndefined();
    });

  });

  describe('findProvenanceData', () => {
    test('should find C2PA in C2PA image', () => {
      const result = findProvenanceData(unverifiedC2PAFile);
      expect(result.state).toBe(CandidateState.C2PA_FOUND);
    });

    test('should not find cai in non CAI image', () => {
      const result = findProvenanceData(nonSerelayIamge);
      expect(result.state).toBe(CandidateState.NONE_FOUND);
    });
  });

});
