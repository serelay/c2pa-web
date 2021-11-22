/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
import * as path from 'path';
import * as fs from 'fs';
import Signatures from '../signatures';
import crypto from 'crypto';
import * as asn1js from 'asn1js';

const FIXTURE = (filename: string) => path.resolve(__dirname, `./fixtures/${filename}`);

function loadFile(filename: string) {
  return fs.readFileSync(FIXTURE(filename));
}

const intermediateCert = loadFile('/certificates/USERTrust_RSA_Certification_Authority.der')  // Intermediate DER already (Hex, no header)
const rootCert = loadFile('/certificates/USERTrust RSA Certification Authority.cer') // ROOT, DER format already, (i.e.Hex, no header)
const leaf = leafToDer()

const leafAsn1 = asn1js.fromBER(new Uint8Array(leaf).buffer);
const intermediateAsn1 = asn1js.fromBER(new Uint8Array(intermediateCert).buffer);
const rootAsn1 = asn1js.fromBER(new Uint8Array(rootCert).buffer);

function leafToDer(): Buffer {
  var leaf = loadFile('/certificates/STAR_serelay_co_uk.crt');
  // PEM to DER (likely there's a better way with libs but docs aren't great)
  // This can be hard coded anyway as it'll be 'constant' for the lifetime of the certificate.
  var leafstr = leaf.toString('utf-8')
  leaf = Buffer.from(leafstr.slice(`-----BEGIN CERTIFICATE-----\n`.length, leafstr.length - `-----END CERTIFICATE-----\n`.length), 'base64');
  return leaf
}

describe('signature', () => {
  // We have to set up webcrypto for node here
  const pkijs = require("pkijs");
  const { Crypto } = require("node-webcrypto-ossl");
  const webcrypto = new Crypto();
  pkijs.setEngine("newEngine", webcrypto, new pkijs.CryptoEngine({ name: "", crypto: webcrypto, subtle: webcrypto.subtle }));

  // CAI signature tests have been redacted

  describe('COSE signature', () => {
    // Load the leaf cert, convert from PEM to DER and extract public key information

    const publicKey = Signatures.publicKeyRSAFromDER(leaf);
    const signaturefile = loadFile('/signature/sha256.sig');
    const signatureMessage = loadFile('/signature/plaintext.txt');

    // These are fixed for our impl
    // NB CBOR labels need translating to these values
    const headers = {
      'p' : { 'alg': 'RS256' }, // alg label is `1` then rsa is -257
      'u' : {
        'x5chain': [
          leaf,
          intermediateCert,
          rootCert,
        ],
      }
    };

    const pkijsRootCert = new pkijs.Certificate({ schema: rootAsn1.result });
    const pkijsIntermediateCert = new pkijs.Certificate({ schema: intermediateAsn1.result });
    const pkijsLeafCert = new pkijs.Certificate({ schema: leafAsn1.result });

    // cose-js needs this fully in cbor to verify, so we're not using it here
    // Sha1 is not valid for C2PA (currently, draft 0.6)!
    it('should verify sha256 RSA signature', () => {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(signatureMessage);
      const result = verify.verify(publicKey, signaturefile);
      expect(result).toBeTruthy();
    });

    it ('should package COSE_Sign1', () => {
      const encoded = Signatures.packC2PASignature(headers.u, signaturefile);
      expect(encoded).not.toBeNull()
      expect(encoded).not.toBeUndefined()
      expect(encoded.length).toBeGreaterThan(0);
    })

    it('should extract from COSE_Sign1 structure', () => {
      const encoded = Signatures.packC2PASignature(headers.u, signaturefile);

      // now convert back and verify it
      const result = Signatures.extractC2PASignatureInfo(encoded);
      
      expect(result).toHaveProperty('p');
      expect(result.p).toHaveProperty('alg');
      expect(result.p.alg).toBe('RS256');

      expect(result).toHaveProperty('u');
      expect(result.u).toHaveProperty('x5chain');
      expect(result.u.x5chain).toHaveLength(3);

      expect(result).toHaveProperty('payload');
      expect(result.payload).toBeNull();

      expect(result).toHaveProperty('signature');
      expect(result.signature.length).toBeGreaterThan(0);
      expect(Buffer.from(result.signature).equals(signaturefile)).toBeTruthy();

      const verified = Signatures.verifyC2PA(signatureMessage, result);
      expect(verified).toBeTruthy();
    });

    test('chain verifies when correct', async () => {

      const engine = new pkijs.CertificateChainValidationEngine({
        trustedCerts: [pkijsRootCert],
        certs: [
          pkijsIntermediateCert,
          pkijsLeafCert
        ],
        crls: []
      });

      const result = await engine.verify();
      expect(result.result).toBeTruthy();
    });

    test('chain does not verify when incorrect', async () => {

      const engine = new pkijs.CertificateChainValidationEngine({
        trustedCerts: [pkijsLeafCert],
        certs: [
          pkijsRootCert,
          pkijsIntermediateCert
        ],
        crls: []
      });

      const result = await engine.verify();
      expect(result.result).toBeFalsy();
    });

  });
});