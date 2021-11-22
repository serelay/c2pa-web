/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
import crypto from 'crypto';
import { JumbfContentType } from '../jumbf/jumbfContentType';
import {
  JumbfBox,
  Box,
  C2PAClaimBox,
  C2PASignature,
  EmbeddedFileBox,
} from '../boxType';
import Signatures from '../signatures';
import ProvenanceValidation from './provenanceValidation';

export default class C2PAValidation extends ProvenanceValidation {

  // Padding isn't used within the hash at all. But serves as a string to adjust for start/length values as bytes
  // if unknown start may be 0 then populated after calculating the hash (e.g. 1234), then it is 4 bytes longer.
  // Need to clarify this behaviour though: It should only be adjusted by the length of the int value in bytes when CBOR encoded (final data representation in binary form). 
  // e.g. 255 is in 2 bytes, not the representation of '2, 5, 5' as json number-characters individually.
  /**
   * 
   * @param file The file with XMP stripped
   * @param exclusions Exclusion ranges. Rather than stripping XMP the length/exclusion can be included here to save memory.
   * @param alg e.g. 'sha256'. Should be compatible with crypto directly from deserialized CBOR.
   * @returns 
   */
  static calculateHash(file: Buffer, exclusions: Array<{start: number, length: number}>, alg: string): string {
    const hash = crypto.createHash(alg);
    var read = 0;
    exclusions.forEach((exclusion) => {
      const content = file.slice(read, exclusion.start); 
      hash.update(content);
      read = exclusion.start + exclusion.length;
    });
    if (read != file.length) {
      // read the rest
      const content = file.slice(read, file.length);
      hash.update(content);
      read += (file.length - read);
    }
    return hash.digest('base64');
  }

  public static validateClaim(
      assertion: { url: string, hash: string, alg: string },
      boxes: (JumbfBox | Box)[], 
      thumbnail: Uint8Array | undefined = undefined
    ): boolean | undefined {

    const hashed = assertion.hash;      
    
    if (assertion.url.indexOf('c2pa.thumbnail.claim.jpeg') != -1) {
      if (thumbnail) {
        const hash = crypto.createHash(assertion.alg).update(thumbnail!).digest('base64');
        return hashed == hash;
      } else {
        return undefined;
      } 
    }

    const path = this.extractPath(assertion.url);
    const box = this.retrieveClaimByPath(boxes, path) as Box;
    
    if (box.type == JumbfContentType.CBOR) {
      return this.validateHash(hashed, Buffer.from(Object.values(box.cbor)));
    } else if (box.type == JumbfContentType.JSON) {
      // ClaimReviews are JSON
      return this.validateHash(hashed, Buffer.from(box.json));
    }
  }

  public static performValidations(buffer: ArrayBuffer, boxes: (JumbfBox | Box)[], contentStarts: number[], contentLengths: number[]): Promise<any> {
    return new Promise((resolve) => {
      const claimBox = boxes.filter((box) => box.label == 'c2pa.claim')[0] as C2PAClaimBox
      const claimBoxObj = JSON.parse(claimBox.json)
      const thumbnailBox = boxes.filter((box) => box.label == 'c2pa.thumbnail.claim.jpeg')[0] as EmbeddedFileBox;
      const thumbStart = thumbnailBox.start!;
      const thumbLen = thumbnailBox.length!;
      const thumbnail = this.extractThumbnail(buffer, contentStarts, contentLengths, thumbStart, thumbLen);

      const signatureBox = boxes.filter((box: any) => box.label == 'c2pa.signature')[0] as C2PASignature;

      const sigData = new Uint8Array(Object.values(signatureBox.signatureData)).buffer;
      const extractedSigInfo = Signatures.extractC2PASignatureInfo(sigData)
      // cbor doesn't translate over messaging well so we have to values from the object to reform the uint8array/buffer
      const message = Buffer.from(Object.values(claimBox.cbor));
      const validSig = Signatures.verifyC2PA(message, extractedSigInfo);

      const assertions = claimBoxObj.assertions;
      const assertionResults = new Array<{ url: string, hash: string, alg: string, valid: boolean | undefined}>();
      assertions.forEach((assertion: {url: string, hash: string, alg: string}) => {
          let result = undefined;
          if (assertion.url.indexOf('c2pa.thumbnail.claim.jpeg') != -1) {
            result = this.validateClaim(assertion, boxes, thumbnail);
          } else {
            result = this.validateClaim(assertion, boxes);
          }
          assertionResults.push({...assertion, valid: result });
      });

      resolve({
        thumbnail: thumbnail,
        signature: validSig,
        assertions: assertionResults,
      });
    });
  }

  public static validateHash(hashed: string, message: Uint8Array): boolean {
    const hash = crypto.createHash('sha256').update(message).digest('base64');
    return hashed == hash;
  }
}

