/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
import * as path from 'path';
import * as fs from 'fs';
import { 
  extractProvenanceData,
  parseJumbf,
} from '../background';
import C2PAValidation from '../jumbf/c2paValidation';
import { AssertionResult } from '../viewerC2pa';

const FIXTURE = (filename: string) => path.resolve(__dirname, `fixtures/${filename}`);

function loadFile(filename: string) {
  return fs.readFileSync(FIXTURE(filename));
}

describe.skip('local test', () => {
  const pkijs = require("pkijs");
  const { Crypto } = require("node-webcrypto-ossl");
  const webcrypto = new Crypto();
  pkijs.setEngine("newEngine", webcrypto, new pkijs.CryptoEngine({ name: "", crypto: webcrypto, subtle: webcrypto.subtle }));

  it('runs validation on provided file', async () => {
    // Put your file into fixtures directory, then add name here and remove `.skip` above
    const buff = loadFile('c2pa-unverified-signature.jpg');
    const jumbf = extractProvenanceData(buff, 2)!;
    const boxes = parseJumbf(jumbf.boxes);

    const res = await C2PAValidation.performValidations(buff, boxes, jumbf.contentStarts, jumbf.contentLengths);
    // console.log(res)

    const signatureValid = res.signature;

    const assertions = res.assertions?.map((assertionResult: AssertionResult) => assertionResult.valid);

    const fullResults = [];
    fullResults.push(Object.values(assertions));
    fullResults.push(signatureValid);

    const overall = fullResults.every(Boolean);
    console.log(`Fully Verified: ${overall}`);

    if (!overall) {
      console.log(`Signature verfied ${signatureValid}`);
      res.assertions.forEach((assertion: AssertionResult) => {
        console.log(`Assertion: ${assertion.url}, valid: ${assertion.valid}`);
      });
    }

    expect(overall).toBe(false);
    
  });
});