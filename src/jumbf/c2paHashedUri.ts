/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
interface C2PAHashedUri {
  url: string, // full uri ref
  alg: string, // e.g. sha256
  hash: string, // base64
}