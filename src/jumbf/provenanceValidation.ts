/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
import {
  JumbfBox,
  Box,
} from '../boxType';

export default class ProvenanceValidation {

  public static extractThumbnail(
    buffer: ArrayBuffer,
    contentStarts: number[],
    contentLengths: number[],
    thumbStart: number, // relative to jumbf content, not whole file's offset...
    thumbLength: number
    ): Buffer {

    let index = 0;// start index for thumbnail content
    for (let i = 0; i < contentStarts.length; i++) {
      if (contentLengths[i] > thumbStart) {
        index = i;
        break;
      }
    }
    const splits = [];
    let internalOffset = thumbStart; // first loop as we're partway through, 0 otherwise to read from start of segments.
    let remainingLength = thumbLength;
    while (index < contentStarts.length) {
      const offset = contentStarts[index] + internalOffset;
      const available = contentLengths[index] - internalOffset;
      // we'll take from start ('offset') until limit of this segment
      const length = Math.min(remainingLength, available);
      remainingLength -= length;
      splits.push({offset: offset, length: length});
      internalOffset = 0;
      index++;
    }
    return Buffer.concat(
      splits.map((split) => Buffer.from(buffer).slice(split.offset, split.offset + split.length)),
      thumbLength // splits.reduce((acc, next) => acc + next.length, 0)
    )
  }

  /**
   *
   * @param fullPath Must start with self#jumbf= to be valid for use.
   * @returns
   */
   public static extractPath(fullPath: string): string {
    const chunk = fullPath.split('=')[1];
    // can't just do -3 in case it's an online path, also may not have hashlink `?hl=`
    const questionIndex = chunk.indexOf('?');
    const end = questionIndex == -1 ? chunk.length : questionIndex;
    return chunk.substr(0, end);
  }

  public static retrieveClaimByPath(boxes: (JumbfBox | Box)[], label: string): (JumbfBox | Box) {
    const labelOrder = label.split("/");
    let labelIndex = 0;
    let foundBox = -1;
    boxes.forEach((box, boxIndex) => {
      if (box.label == labelOrder[labelIndex]) {
        labelIndex++;
        if (labelIndex > labelOrder.length - 1) {
          foundBox = boxIndex;
        }
      }
    });
    return boxes[foundBox];
  }
}