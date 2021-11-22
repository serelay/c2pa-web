/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
import { JumbfContentType } from "./jumbf/jumbfContentType";
import { CAIContentType } from "./jumbf/caiContentType";
import { C2PAContentType } from "./jumbf/c2paContentType";

// generic jumbf box with type & toggle
export type JumbfBox = {
  type: JumbfBoxType;
  toggle: number;
  uuid: Uint8Array;
  label?: string;
};

export type JumbfBoxType = JumbfContentType | CAIContentType | C2PAContentType;

export type CborBox = { 
  type: JumbfContentType.CBOR
  cbor: object
 };

 export type JsonBox = {
  type: JumbfContentType.JSON;
  json: string;
};

 // Simple types
type XmlBox = { type: JumbfContentType.XML };
type UUIDBox = { type: JumbfContentType.UUID };
type CAIClaimContentBox = { type: CAIContentType.cacb };
type CAIStoresBox = { type: CAIContentType.cast };
type CAIAssertionStore = { type: CAIContentType.caas };

type C2PAManifestStore = { type: C2PAContentType.c2pa };
type C2PAManifest = { type: C2PAContentType.c2ma };
type C2PAAssertionStore = { type: C2PAContentType.c2as };
type C2PACredentialsStore = { type: C2PAContentType.c2vc };

export type C2PASignature = { 
  type: C2PAContentType.c2cs,
  signatureData: Uint8Array 
};

// ClaimBox and json box are the same barring type
export type CAIClaimBox = {
  type: CAIContentType.cacl;
  json: string;
};

export type C2PAClaimBox = {
  type: C2PAContentType.c2cl;
  cbor: Uint8Array;
  json: string;
};

export type CodestreamBox = {
  type: JumbfContentType.CODESTREAM;
  start?: number;
  length?: number;
};

export type EmbeddedFileBox = {
  type: JumbfContentType.EMBEDDED_FILE;
  start?: number;
  length?: number;
};

export type SignatureBox = {
  type: CAIContentType.casg;
  signatureData: Uint8Array;
};

// these have no special attributes
type SimpleBox = XmlBox | UUIDBox | CAIClaimContentBox | CAIStoresBox | CAIAssertionStore |
 C2PAManifestStore | C2PAManifest | C2PAAssertionStore | C2PACredentialsStore;

 export type Box = JumbfBox & (JsonBox | CborBox | CodestreamBox | EmbeddedFileBox | 
  SignatureBox | C2PASignature | CAIClaimBox | C2PAClaimBox | SimpleBox);
