/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
export type JumbfBoxInfo = { 
  boxInstanceNumber: Uint8Array,
  packetSequenceNumber: Uint8Array,
  currentOffset: number,
  lbox: Uint8Array,
  tbox: Uint8Array,
  xlbox: Uint8Array | undefined
}