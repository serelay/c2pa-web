/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
const pkijs = require("pkijs"); // @types/pkijs isn't mature enough for use yet.
import { fromBER } from "asn1js";
const cbor = require('cbor-web');
import * as asn1js from 'asn1js';
const jwkToPem = require('jwk-to-pem');
import crypto from 'crypto';

// Placeholder is due in C2PA Draft 0.8
const X5CHAIN_PLACEHOLDER = 'x5chain'; // when RFC is fixed up with a real value we can use this c2pa spec issue #485 

enum Algs {
  ES256 = 'ES256',
  ES384 = 'ES384',
  ES512 = 'ES512',
  RS256 = 'RS256',
  RS384 = 'RS384',
  RS512 = 'RS512'
}

const AlgFromTags: Record<number, {sign: Algs, digest: string}> = {
  [-7]: { 'sign': Algs.ES256, 'digest': 'SHA-256' },
  [-35]: { 'sign': Algs.ES384, 'digest': 'SHA-384' },
  [-36]: { 'sign': Algs.ES512, 'digest': 'SHA-512' },
  [-257]: { 'sign': Algs.RS256, 'digest': 'SHA-256' },
  [-258]: { 'sign': Algs.RS384, 'digest': 'SHA-384' },
  [-259]: { 'sign': Algs.RS512, 'digest': 'SHA-512' }
}

type AlgorithmSpec = {
  sign: string;
  digest?: string;
}

const COSEAlgToNodeAlg: Record<Algs, AlgorithmSpec> = {
  'ES256': { 'sign': 'p256', 'digest': 'sha256' },
  'ES384': { 'sign': 'p384', 'digest': 'sha384' },
  'ES512': { 'sign': 'p521', 'digest': 'sha512' },
  'RS256': { 'sign': 'RSA-SHA256' },
  'RS384': { 'sign': 'RSA-SHA384' },
  'RS512': { 'sign': 'RSA-SHA512' }
};

// NB: This should also use some Certificate to check org's allow-list
export default class Signatures {
  public static verifyDetatchedCAISignature(messageRaw: ArrayBuffer, signatureInfo: ArrayBuffer): Promise<boolean> {
    const asn1 = fromBER(signatureInfo);
    const cmsContentSimpl = new pkijs.ContentInfo({ schema: asn1.result });
		const cmsSignedSimpl = new pkijs.SignedData({ schema: cmsContentSimpl.content });
    // cmsSignedSimpl.certificates[j].issuer.typesAndValues[i].value.valueBlock.value
    // result.signerCertificate
    const verificationParameters: any = {
			signer: 0,
      checkChain: false,
      extendedMode: false, // true for debugging
      data: messageRaw,
		};
		return cmsSignedSimpl.verify(verificationParameters);
  }

  // hard-coded to alg RS256
  public static packC2PASignature(u: any, signature: any) {
    // payload is a null containing bstr
    // COSE structure: tagged with 18.
    // 18([p: {1: -257}, ])
    // 18([headers.p, headers.u, payload, signature])
    const cose_sign1_tag = 18;
    return cbor.encodeCanonical(new cbor.Tagged(cose_sign1_tag, [{ 1: -257 }, { [X5CHAIN_PLACEHOLDER]: u.x5chain}, Buffer.alloc(0), signature]));
  }

  public static publicKeyRSAFromDER(der: Buffer): any {
    const pkijs = require("pkijs");
    const asn1 = asn1js.fromBER(new Uint8Array(der).buffer); // der alone doesn't work > Object's schema was not verified against input data for Certificate
    const info = new pkijs.Certificate({ schema: asn1.result });
    const pubKey = info.subjectPublicKeyInfo.parsedKey;
    const modulus = pubKey.modulus.valueBlock.valueHex;
    const exponent = pubKey.publicExponent.valueBlock.valueHex;

    // This is extra info for if the key info was in part of the signature 'unprotected' block, rather than the x5chain
    return jwkToPem({
      // label: 1, Key type
      'kty': 'RSA',
      // label: -1, Modulus
      'n': Buffer.from(modulus, 'hex').toString('base64'),
      // label: -2, Public Exponent (in hex usually '010001', 65537)
      'e': Buffer.from(exponent, 'hex').toString('base64')
    })
  }

  public static extractC2PASignatureInfo(raw: ArrayBuffer) {
    // Subject to change as we find out more about structure
    const cose_Sign1 = cbor.decodeFirstSync(raw);
    if (cose_Sign1.tag != 18) {
      throw new Error('Not a COSE_Sign1 structure');
    }
    if (cose_Sign1.value.length < 4) {
      throw new Error('Sign1 structure is not the correct length')
    }
    if (!Buffer.from(cose_Sign1.value[2]).equals(Buffer.alloc(0))) {
      throw new Error('Payload is attached, and should not be in C2PA');
    }
    const p = cose_Sign1.value[0];
    const alg = AlgFromTags[p['1']].sign; // 1 is `alg`s label
    const u = cose_Sign1.value[1];
    const signature = cose_Sign1.value[3];
    return {
      p: { alg: alg },
      u: { x5chain: u[X5CHAIN_PLACEHOLDER] },  // when RFC https://github.com/cose-wg/X509 is finalised
      payload: null,
      // is this encoded incorrectly to need this conversion? signature is a buffer/ (cbor bstr), but sending it as an obj
      // changes it to [0: x, 1: y ...] instead of just [x,y]
      signature: Object.values(signature as ArrayBuffer) 
    };
  }

  // NB. Currently will only work for RSA keys
  public static verifyC2PA(message: Buffer, signInfo: { p: { alg: string }, u: { x5chain: Array<Buffer> }, signature: any[] }): boolean {
    if (!this.isValidAlg(signInfo.p.alg)) {
      throw new Error('Invalid signing algorithm provided');
    }
    const alg = Algs[signInfo.p.alg as keyof typeof Algs]; // this is safe after the above
    const nodeAlg = COSEAlgToNodeAlg[alg].sign;
    const leaf = signInfo.u.x5chain[0];
    const publicKey = Signatures.publicKeyRSAFromDER(leaf);
    const verify = crypto.createVerify(nodeAlg);
    verify.update(message);
    return verify.verify(publicKey, Buffer.from(signInfo.signature));
  }

  private static isValidAlg(alg: string): alg is Algs {
    return Object.values(Algs).includes(alg as any);
  }
}