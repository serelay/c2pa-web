/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
export default class Utils {
  public static isEqual(o1: Uint8Array, o2: Uint8Array): boolean {
    return (o1.length === o2.length) && o1.every((x, i) => x === o2[i]);
  }

  /* Big endian helpers */
  public static getBigUint64(buffer: ArrayBuffer): bigint {
    return new DataView(buffer, 0).getBigUint64(0, false);
  }

  public static getUint32(buffer: ArrayBuffer): number {
    return new DataView(buffer, 0).getUint32(0, false);
  }

  public static getUint16(buffer: ArrayBuffer): number {
    return new DataView(buffer, 0).getUint16(0, false);
  }

  public static textFrom(arr: Uint8Array): string {
    return new TextDecoder().decode(arr)
  }

  public static fromHexString(hexString: string): Uint8Array {
    return new Uint8Array(hexString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
  }

  public static bufToHex(buffer: ArrayBuffer): string {
    return Array.prototype.map.call(buffer, x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
}