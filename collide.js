'use strict'
const crypto = require('crypto')

const secret = new Buffer('d80000d8', 'hex')

function bufferEq(b1, b2) {
  if (b1.length != b2.length) { return false }
  for (const [i, b] of b1.entries()) {
    if (b != b2[i]) {
      return false
    }
  }
  return true
}

let buf = new Buffer(3)
for (let i=0; i<255; i++) {
  for (let j=0; j<255; j++) {
    for (let k=0; k<255; k++) {
      [buf[0], buf[1], buf[2]] = [i, j, k]
      let hmac = crypto.createHmac('sha256', secret);
      hmac.update(buf)
      const proof = hmac.digest().slice(0,3)
      if (bufferEq(secret, proof)) {
        console.log('FAIL', i, j, k)
      }
    }
  }
}
