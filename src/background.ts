/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
// NB. Cannot import any module/file that interacts/declares DOM interaction
import { CandidateState } from "./candidateState";
import { MSG } from "./msg";
import { JumbfBoxInfo } from "./jumbf/jumbfBoxInfo";
import { JumbfContentType } from "./jumbf/jumbfContentType";
import { CAIContentType } from "./jumbf/caiContentType";
import Utils from "./utils";
import { JumbfBox, Box, JumbfBoxType } from "./boxType";
import { C2PAContentType } from "./jumbf/c2paContentType";
const cbor = require('cbor-web');

const tabJpegs = new Map<number, string[]>();
const XMP_START = 'http://ns.adobe.com/xap/1.0/';
const PROVENANCE_START = `dcterms:provenance="`;

const JPEG_START = new Uint8Array([0xFF, 0xD8]);
const APP_1_MARKER = new Uint8Array([0xFF, 0xE1]);
const APP_11_MARKER = new Uint8Array([0xFF, 0xEB]);

export type JumbfBoxResult = {
  uuid: Uint8Array,
  toggle: number,
  label: string | undefined
}

/**
 * Keep the badge image count indicator 'live'
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Triggers on page load
  if (!tab.url?.startsWith('chrome://') && changeInfo?.status === 'complete') {
    scanTab(tabId);
  }
});

/**
 * Keep the badge image count indicator 'live' on switch
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
  // Triggers when tab is switched
  if (tabJpegs.get(activeInfo.tabId) === undefined) {
    scanTab(activeInfo.tabId);
  } else {
    chrome.action.setBadgeText({ text: `${tabJpegs.get(activeInfo.tabId)?.length ?? ''}` });
  }
});

/**
 * Clear image url cache for removed tab.
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  // No longer have the tab, so we'll clear our jpeg list
  tabJpegs.delete(tabId);
});

/**
 * Message handler to process events in the background and not lock UI for plugin pages/popups.
 */
chrome.runtime.onMessage.addListener(
  async (
    request: { msg: MSG, data: { tabId: number }, url: string }, sender
  ) => {
    let tabId;
    let jpegs;
    switch (request.msg) {

      /**
       * Now's the time to scan the images for provenance data and report back
       */
      case MSG.POPUP_OPENED:
        tabId = request.data.tabId;
        jpegs = tabJpegs.get(tabId);
        if (!jpegs) {
          // Haven't found any on this tab before
          scanTab(request.data.tabId, (urls: string[]) => {
            chrome.runtime.sendMessage({
              msg: MSG.JPEGS_FOUND,
              jpegs: urls,
            });
          });
        } else {
          // Already scanned so return what was found
          chrome.runtime.sendMessage({
            msg: MSG.JPEGS_FOUND,
            jpegs: jpegs,
          });
        }
        break;

      /**
       * There's an image that should be processed.
       */
      case MSG.PROCESS_IMAGE:
        processImage(request.url);
        break;

      /**
       * There's an image that should be fully parsed and have provenance JUMBF data extracted.
       * Typically this is when the viewer page is opened, to avoid unnecessary processing.
       */
      case MSG.EXTRACT_IMAGE: {
        const tabId = sender.tab?.id
        const url = request.url;
        const response = await fetch(url, {
          credentials: 'include',
          cache: 'default',
        })
        const buffer = await response.arrayBuffer();
        const jumbf = extractProvenanceData(buffer, 2);
        const boxes = parseJumbf(jumbf!.boxes);


        // Return processed image information to whichever is listening
        chrome.runtime.sendMessage({
          msg: MSG.IMAGE_EXTRACTED,
          tabId: tabId, // Important - without this receiving tab will not know intended target
          jumbfL: jumbf?.boxes.length,
          boxes: boxes,
          contentInfo: {
            contentStarts: jumbf?.contentStarts,
            contentLengths: jumbf?.contentLengths
          }
        });
        break;
      }

      default: break;
    }
  },
);

/**
 * Scan a tab for images and filter result for JPEGs.
 * @param tabId The Chromium tabId.
 * @param callback Return results when the async scan is finished
 */
function scanTab(tabId: number, callback?: (urls: string[]) => void) {
  chrome.scripting.executeScript(
    {
      target: { tabId, allFrames: false },
      function: getImages,
    }, (results) => {
      if (!results) {
        // ignore it, probbaly chrome:
        //, we 'read' the message to prevent a red console error, unavoidable when using onActivated
        chrome.runtime.lastError?.message;
        chrome.action.setBadgeText({ text: '' });
        return;
      }
      const urls: string[] = results[0].result;
      let filteredUrls: string[] = [];
      let count = 0;
      if (urls) {
        // filter for jpeg/jpg files
        filteredUrls = urls.filter((url) => /\.(jpe?g)$/.test(url));
        count = filteredUrls.length;
      }

      if (callback) {
        callback(filteredUrls);
      }

      tabJpegs.set(tabId, filteredUrls);
      chrome.action.setBadgeText({ text: `${count ?? ''}` });
    },
  );
}

/**
 * Collect the img tag url references from within the page.
 * @returns The urls from within img tags on the page.
 */
function getImages(): string[] {
  const images = document.getElementsByTagName('img');
  const imageUrls = new Set<string>();
  if (images) {
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const url = image.currentSrc;
      imageUrls.add(url);
    }
  }
  return Array.from(imageUrls);
}

/**
 * Uses cache to fetch the image itself, credentials supplied to retain current session within the plugin.
 * @param url The url for JPEG to fetch.
 */
async function processImage(url: string) {
  const response = await fetch(url, {
    credentials: 'include',
    cache: 'default',
  })
  const buffer = await response.arrayBuffer()

  const extractedInfo = findProvenanceData(buffer);

  chrome.runtime.sendMessage({
    msg: MSG.IMAGE_PROCESSED,
    url,
    result: {
      state: extractedInfo.state,
    },
  });
}

/*
When https://bugs.chromium.org/p/chromium/issues/detail?id=1166720 is implemented...
- Use `window.fetch('url')` to obtain raw bytes
const arrayBuffer = await (await fetch("img-url")).arrayBuffer();
- needs executing within tab to preserve window session - callback to UI piece
chrome.scripting.executeScript(
    {
      target: { tabId: tabId, allFrames: false },
      arguments: [url],
      function: fetchImage
    },
    results => {

    }
  );

*/

/**
 * Extract region from source array
 * @param buffer Original content
 * @param offset Start of content to extract
 * @param count Number of bytes to extract
 * @returns Extracted region
 */
function readBytes(buffer: ArrayBuffer, offset: number, count: number): Uint8Array {
  return new Uint8Array(buffer.slice(offset, offset + count));
}

/**
 * Scan JPEG header for XMP that contains provenance information.
 * @param fullArray The full image data.
 * @returns The identified provenance type.
 */
export function findProvenanceData(fullArray: ArrayBuffer): {
  state: CandidateState,
  data?: {
    offset: number;
    length: number;
  }
} {
  let currentOffset = 0;
  const headerBytes = readBytes(fullArray, currentOffset, 2);
  currentOffset += 2;
  // only iterative app11 scanning should alter currentOffset from here on

  if (!Utils.isEqual(headerBytes, JPEG_START)) {
    // Not a valid jpeg, so we return that
    return { state: CandidateState.INVALID_JPEG };
  }

  const app1Info = parseUntilAppSegment(APP_1_MARKER, fullArray, currentOffset);
  if (app1Info) {
    // don't include marker + length but go
    // + 4 : skip marker and length, + 2 to continue accomodate index of length bytes
    const app1Segment = fullArray.slice(app1Info.offset + 4, app1Info.offset + app1Info.length + 2);
    const content = new TextDecoder().decode(app1Segment);

    if (content.startsWith(XMP_START)) {
      // a rustic way to extract info from the XMP
      let provenanceStart = content.indexOf(PROVENANCE_START);
      if (provenanceStart === -1) {
        return { state: CandidateState.NONE_FOUND }
      }
      provenanceStart += PROVENANCE_START.length;
      const jumbfStart = "self#jumbf=";
      const provenanceBeginning = content.slice(provenanceStart, provenanceStart + jumbfStart.length + 4);
      const indicator = provenanceBeginning.slice(jumbfStart.length, jumbfStart.length + 4);
      if (indicator.startsWith("cai")) {
        return { state: CandidateState.CAI_FOUND }
      } else if (indicator.startsWith("c2pa")) {
        return { state: CandidateState.C2PA_FOUND }
      }
      // To continue to actually extract info
      // const app11Info = parseUntilAppSegment(APP_11_MARKER, fullArray, currentOffset);

    } else {
      // TODO rescan for another XMP marker (use separate offset) -
    }
  }

  return { state: CandidateState.NONE_FOUND, data: app1Info };
}

/**
 * Reads through source until the provided App segment is located, or App segements are exhausted.
 * @param marker JPEG APP segment to find
 * @param source The full image data
 * @param currentOffset Where we currently are in the file
 * @returns The new offset for the start of the marker's content and how long the segment is found, undefined if nothing.
 */
export function parseUntilAppSegment(
  marker: Uint8Array,
  source: ArrayBuffer,
  currentOffset: number,
): { offset: number, length: number } | undefined {
  let offset = currentOffset;
  let markerBytes: Uint8Array;
  let lengthBytes: Uint8Array;
  do {
    markerBytes = readBytes(source, offset, 2);
    lengthBytes = readBytes(source, offset + 2, 2);
    const length = Utils.getUint16(lengthBytes.buffer);
    if (Utils.isEqual(markerBytes, marker)) {
      return { offset, length };
    }
    offset += (2 + length); // 2 marker + length (which includes length indicator's 2 bytes)
  } while (offset < source.byteLength && (markerBytes[1] >= 0xE0 && markerBytes[1] <= 0xEB));

  return undefined;
}

/**
 * Extract any provenance JUMBF data if it exists, in a more manageable format.
 * @param fullArray The JPEG to parse through content for provenance data.
 * @param currentOffset Where to start looking from in the fullArray.
 * @returns 
 */
export function extractProvenanceData(fullArray: ArrayBuffer, currentOffset: number): {
  boxes: Uint8Array;
  contentStarts: number[];
  contentLengths: number[];
} | undefined {
  // We should store the full content of the jumbf box with the sequence number (to reorder later)
  const jumbfContent = new Array<Uint8Array>();

  let app11Info = parseUntilAppSegment(APP_11_MARKER, fullArray, currentOffset);
  let continuationIdentifier;
  const contentStarts = [];
  const contentLengths = [];

  while (app11Info !== undefined) {
    let offset = app11Info.offset; // the actual APP11 marker index

    // xt starts with:
    // 2 bytes - CI 0x4A50 `JP`
    // 2 bytes - EN (box instance number (for concatenation))
    // 4 bytes - Z (packet sequence number)
    // 4 bytes `jumb`
    const commonId = readBytes(fullArray, offset + 4, 2); // CI - skipping APP11(2) and length(2) bytes to get to jumbf start
    // TODO - Accounts for always having XT splits, what about a single entry (non XT)?
    if (Utils.textFrom(commonId) === 'JP') { // if this isn't 'JP' It's not jumbf XT so we'll skip the entire APP11
      offset += 4; // APP11+len

      const boxIdentifiers = retrieveJumbfXTIdentifiers(fullArray, offset)
      const continuationId = boxIdentifiers.boxInstanceNumber;

      // we need to keep using the same one until we reach the end of it
      continuationIdentifier = continuationIdentifier ?? continuationId;

      if (!Utils.isEqual(continuationId, continuationIdentifier)) {
        // We've hit a different continuationId, so it's not an APP11/Jumbf we're processing at the moment
        offset += app11Info.length - 2;
        app11Info = parseUntilAppSegment(APP_11_MARKER, fullArray, offset);
        continue;
      }

      const offsetDiff = app11Info.length - (boxIdentifiers.currentOffset - offset) - 2; // -2 to not include APP11 len bytes
      const content = readBytes(fullArray, boxIdentifiers.currentOffset, offsetDiff);

      // 65516 is maximum jumbf content length if no XLBox (extendend length, which would lose 8 bytes)
      // Sequence numbers start at 1, but our index at 0
      const index = Utils.getUint32(boxIdentifiers.packetSequenceNumber.buffer) - 1;
      contentStarts.push(boxIdentifiers.currentOffset);
      contentLengths.push(offsetDiff);
      jumbfContent[index] = content;
    }
    offset += app11Info.length - 2;
    app11Info = parseUntilAppSegment(APP_11_MARKER, fullArray, offset);
  }

  let contentLength = jumbfContent.reduce((acc, next) => acc + next.length, 0)
  contentLength = contentLength > 0 ? contentLength + 4 : 0; // + 4 allows to prepend `jumb`
  const result = new Uint8Array(contentLength);
  if (jumbfContent.length) {
    result.set([0x6A, 0x75, 0x6D, 0x62], 0); // `jumb`
  }
  let cumulator = 4;
  jumbfContent.forEach((i) => { result.set(i, cumulator); cumulator += i.length; } );
  // Technically needs 8 bytes more prefix - lbox and tbox 'jumb' e.g. `0002538B 6A756D62`, but we don't require these values further
  return result.length == 0 ? undefined : { boxes: result, contentStarts: contentStarts, contentLengths: contentLengths };
}

/**
 * Fetch the information for the jumbf itself
 * @param fullArray The whole image
 * @param currentOffset Where we've got to so far
 * @returns Information for the Jumbf box from the header.
 */
function retrieveJumbfXTIdentifiers(fullArray: ArrayBuffer, currentOffset: number): JumbfBoxInfo {
  // const ci = readBytes(fullArray, currentOffset, 2); // it's checked elsewhere `JP`
  currentOffset += 2; // skip CI
  const boxInstanceNumber = readBytes(fullArray, currentOffset, 2); // EN
  currentOffset += 2;
  const packetSequenceNumber = readBytes(fullArray, currentOffset, 4); // Z
  currentOffset += 4;
  // We don't need to convert tto actual ints we can just do array comparisons here

  /**
   * Jumpbf data
   * lbox - 4byte big endian
   * tbox - 4byte big endian
   * xlbox - extendedlength if lbox is 1
   * data -...
   */
  const content = readBytes(fullArray, currentOffset + 2, 4 + 4) // 4 to get to jumbf box
  const lbox = content.slice(0, 4)
  currentOffset += 4;
  const tbox = content.slice(4, 8)
  currentOffset += 4;
  // We need to know the real length here.
  const lboxLength = Utils.getUint32(lbox.buffer)
  let xlbox = undefined;
  if (lboxLength == 1)  {
    // next 8 bytes are length
    xlbox = content.slice(8, 8 + 8)
    currentOffset += 8;
  }
  return {
    boxInstanceNumber: boxInstanceNumber,
    packetSequenceNumber: packetSequenceNumber,
    currentOffset: currentOffset,
    lbox: lbox,
    tbox: tbox,
    xlbox: xlbox
  }
}

const typeL = 16; // uuid + `00389B71`

/**
 * Currently this parses sequentially not recursively, so we cannot 'look up' a jumbf link correctly
 * when we have multiple boxes.
 * However, this can be worked around by parsing over boxes in order until the filter is matched
 * Supposing the path was x/y/z and there was another, x/y2/z
 *
 * Can parse sequentially:
 * - find first x, then y, then z
 * - find first x, then not y2 by finding second x, then y2, then z
 *
 * But nesting would make this more efficient and easier.
 *
 * @param data Jumbf content
 * @returns
 */
export function parseJumbf(data: Uint8Array): (JumbfBox | Box)[] {
  const length = data.length; // this is our superbox length
  // console.log(data.slice(0, 4));
  // let tbox = readBytes(data.buffer, 0, 4); // jumb
  // first 4 bytes are the length (29 in the test)
  let lbox = Utils.getUint32(readBytes(data.buffer, 4, 4).buffer);
  let boxContent = readBytes(data.buffer, 8, lbox);
  let offset = 8;

  const claimContentBlock = parseJumbfBox(boxContent);
  const results: (JumbfBox | Box)[] = [claimContentBlock]; // the first box is the superbox.

  while (offset < length) {
    offset += lbox;
    // tbox = readBytes(data.buffer, offset, 4);
    offset += 4;
    lbox = Utils.getUint32(readBytes(data.buffer, offset, 4).buffer);
    offset += 4;
    boxContent = readBytes(data.buffer, offset, lbox);
    const parsedBox = parseJumbfBox(boxContent); // generic jumbf
    let box: Box;
    let nextLength;

    switch (parsedBox.type) {
      case JumbfContentType.JSON:
      case CAIContentType.cacl: {
        nextLength = Utils.getUint32(readBytes(data.buffer, lbox + offset - 4, 4).buffer);
        // + 4 to skip initial `json`, -8 to accomodate for the skip ,and to exclude 'next length' info at the end
        const json = Utils.textFrom(readBytes(data.buffer, offset + lbox + 4, nextLength - 8));
        offset += nextLength;
        box = {
          type: parsedBox.type,
          uuid: parsedBox.uuid,
          label: parsedBox.label,
          toggle: parsedBox.toggle,
          json: json,
        };
        break;
      }

      case JumbfContentType.CBOR:
      case C2PAContentType.c2cl: {
        nextLength = Utils.getUint32(readBytes(data.buffer, lbox + offset - 4, 4).buffer);
        // + 4 to skip initial `cbor`, -8 to accomodate for the skip ,and to exclude 'next length' info at the end
        const boxCbor = readBytes(data.buffer, offset + lbox + 4, nextLength - 8);
        const json = JSON.stringify(cbor.decodeFirstSync(boxCbor));
        offset += nextLength;
        box = {
          type: parsedBox.type,
          uuid: parsedBox.uuid,
          label: parsedBox.label,
          toggle: parsedBox.toggle,
          cbor: boxCbor, 
          json: json,
        };
        break;
      }

      case JumbfContentType.CODESTREAM:
      case JumbfContentType.EMBEDDED_FILE:
      {
        nextLength = Utils.getUint32(readBytes(data.buffer, lbox + offset - 4, 4).buffer);
        const thumbstart = offset + lbox;
        // const start = thumbstart;
        const length = nextLength - 8; // -8 accomodate for the skip ,and to exclude 'next length' info at the end
        // cannot save to local storage - too large to json serialize/store
        // cannot send as message for same reason
        // should send info to extract from full original source instead.
        offset += nextLength;
        box = {
          type: parsedBox.type,
          uuid: parsedBox.uuid,
          label: parsedBox.label,
          toggle: parsedBox.toggle,
          start: thumbstart,
          length: length,
        };
        break;
      }

      case CAIContentType.casg: {
        nextLength = Utils.getUint32(readBytes(data.buffer, lbox + offset - 4, 4).buffer);
        // literal `uuid` then a full UUID this internal uuid(16) is also in quesiton on server
        const signatureData = readBytes(data.buffer, lbox + offset + 4 + 16, nextLength - 4 - 16);
        // technically this has a null byte 0x00 at the end but not sure how/why it isn't included here
        offset += nextLength + lbox - 4;
        box = {
          type: parsedBox.type,
          uuid: parsedBox.uuid,
          label: parsedBox.label,
          toggle: parsedBox.toggle,
          signatureData: signatureData,
        }
        break;
      }

      case C2PAContentType.c2cs: {
        nextLength = Utils.getUint32(readBytes(data.buffer, lbox + offset - 4, 4).buffer);
        const signatureData = readBytes(data.buffer, lbox + offset + 4, nextLength - 4);
        // technically this has a null byte 0x00 at the end but not sure how/why it isn't included here
        offset += nextLength + lbox - 4;
        box = {
          type: parsedBox.type,
          uuid: parsedBox.uuid,
          label: parsedBox.label,
          toggle: parsedBox.toggle,
          signatureData: signatureData,
        }
        break;
      }

      default: {
        box = {
          type: parsedBox.type,
          uuid: parsedBox.uuid,
          label: parsedBox.label,
          toggle: parsedBox.toggle,
        }
        break;
      }
    }

    results.push(box);
  }
  return results;
}

/**
 *  Things we need:
 *  tracking the length of the current box,
 *  offset to start looking for the next box
 *  content of the next box
 *  therefore need:
 *  Data structure for each box
 *  Minimal memory footprint (so thumbnail data can be start + length, instead of a Uint8Array)
 *  Boxes are recursive.
 * @param boxData The bytes of content from the jumbf box
*/
export function parseJumbfBox(boxData: Uint8Array): JumbfBox {
  let offset = 0;
  // first 4 bytes are jumbd
  offset += 4;
  // Type - UUID 4,2,2,2,6 // 16 bytes
  const uuid = readBytes(boxData, offset, typeL);
  offset += typeL;

  // we have a toggle and label
  const toggle = boxData[offset];
  offset += 1;
  if (toggle == 0) {
    // it's an error/not CAI
    // return undefined;
  }

  if ((toggle & 0x2) === 0x2) { // 0000 0010
    // Label, should be CAI for this box uuid
    const label = readBytesUntilNull(boxData, offset);
    offset += label.null + 1;
    return {
      type: getTypeFrom(uuid),
      toggle: toggle,
      uuid: uuid,
      label: label.text
    };
  }

  return {
    type: getTypeFrom(uuid),
    toggle: toggle,
    uuid: uuid,
    label: undefined
  };
  // next 8 bytes length of next block
}

/**
 * From the offset within data read until a null byte is encountered.
 * @param data The haystack to parse through.
 * @param offset The offset to start reading from.
 * @returns Text content from offset until null encountered, and index of the null.
 */
function readBytesUntilNull(data: Uint8Array, offset: number): { text: string, null: number} {
  const _null = 0x00
  // Doesn't reinstantiate array, equivalent to:
  // let index = data.slice(offset, data.length - 1).indexOf(_null)
  // readBytes(data.buffer, offset, offset + index);
  let index = 0;
  for (let i = offset; i < data.length; i++) {
    if (data[i] == _null) {
      index = i;
      break;
    }
  }
  return {
    text: Utils.textFrom(readBytes(data.buffer, offset, index - offset)),
    null: index
  };
}

/**
 * Type inference based on uuid. NB this method is not exhaustive.
 * @param uuid uuid to infer type for.
 * @returns The type of the jumbf box.
 */
function getTypeFrom(uuid: Uint8Array): JumbfBoxType {
  const uuidString = Utils.bufToHex(uuid);
  switch (uuidString) {
    case CAIContentType.cacb:
    case CAIContentType.cast:
    case CAIContentType.cacl:
    case CAIContentType.caas:
    case CAIContentType.casg:
    case JumbfContentType.CBOR:
    case JumbfContentType.JSON:
    case JumbfContentType.CODESTREAM:
    case JumbfContentType.EMBEDDED_FILE:
    case JumbfContentType.UUID:
    case JumbfContentType.XML:
    case C2PAContentType.c2as:
    case C2PAContentType.c2cl:
    case C2PAContentType.c2cs:
    case C2PAContentType.c2ma:
    case C2PAContentType.c2pa:
    case C2PAContentType.c2vc: 
      return uuidString;
    default:
      throw new Error(`unknown box type ${uuidString}`);
  }
}