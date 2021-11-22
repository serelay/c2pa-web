/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
export enum C2PAContentType {
  c2pa = '6332706100110010800000AA00389B71', // Manifest store. label: c2pa.v1
  c2ma = '63326D6100110010800000AA00389B71', // manifest,
  c2as = '6332617300110010800000AA00389B71', // assertion store. label: c2pa.assertions
  c2cl = '6332636C00110010800000AA00389B71', // claim. label: c2pa.claim
  c2cs = '6332637300110010800000AA00389B71', // signature. label: c2pa.signature
  c2vc = '6332766300110010800000AA00389B71', // credentials store. Label: c2pa.credentials
}