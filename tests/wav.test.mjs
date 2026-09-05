import { encodeWav } from "../tools/bounce/wav.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log(
    (cond ? "  PASS " : "  FAIL ") +
      name +
      (detail !== undefined ? " -> " + detail : ""),
  );
}
const mkBuf = (chans, len, rate) => ({
  numberOfChannels: chans.length,
  sampleRate: rate,
  length: len,
  getChannelData: (i) => chans[i],
});

{
  const L = Float32Array.from([0, 0.5, -0.5, 1]);
  const R = Float32Array.from([0, -1, 2, -2]);
  const w = encodeWav(mkBuf([L, R], 4, 44100));
  const dv = new DataView(w.buffer, w.byteOffset, w.byteLength);
  const str = (o, n) => String.fromCharCode(...w.slice(o, o + n));
  check(
    "RIFF / WAVE / fmt  / data chunk ids",
    str(0, 4) === "RIFF" &&
      str(8, 4) === "WAVE" &&
      str(12, 4) === "fmt " &&
      str(36, 4) === "data",
    str(0, 4) + str(8, 4) + str(12, 4) + str(36, 4),
  );
  check(
    "44-byte header + 2ch x 4 frames x 2 bytes",
    w instanceof Uint8Array && w.length === 44 + 16,
    w.length,
  );
  check(
    "RIFF size = total - 8, fmt size 16, data size = payload",
    dv.getUint32(4, true) === w.length - 8 &&
      dv.getUint32(16, true) === 16 &&
      dv.getUint32(40, true) === 16,
    dv.getUint32(4, true) + "/" + dv.getUint32(40, true),
  );
  check(
    "PCM16 stereo @44100: blockAlign 4, byteRate 176400",
    dv.getUint16(20, true) === 1 &&
      dv.getUint16(22, true) === 2 &&
      dv.getUint32(24, true) === 44100 &&
      dv.getUint32(28, true) === 176400 &&
      dv.getUint16(32, true) === 4 &&
      dv.getUint16(34, true) === 16,
  );
  check(
    "frames interleave L,R,L,R",
    dv.getInt16(44, true) === 0 &&
      dv.getInt16(46, true) === 0 &&
      dv.getInt16(48, true) === 16384 &&
      dv.getInt16(50, true) === -32767 &&
      dv.getInt16(52, true) === -16383,
    [44, 46, 48, 50, 52].map((o) => dv.getInt16(o, true)).join(","),
  );
  check(
    "out-of-range samples clamp to +/-32767",
    dv.getInt16(54, true) === 32767 && dv.getInt16(58, true) === -32767,
    dv.getInt16(54, true) + "," + dv.getInt16(58, true),
  );
}
{
  const M = Float32Array.from([0.25, -0.25]);
  const w = encodeWav(mkBuf([M], 2, 22050));
  const dv = new DataView(w.buffer, w.byteOffset, w.byteLength);
  check(
    "mono @22050: 1 channel, blockAlign 2, byteRate 44100, 4 payload bytes",
    w.length === 44 + 4 &&
      dv.getUint16(22, true) === 1 &&
      dv.getUint32(24, true) === 22050 &&
      dv.getUint32(28, true) === 44100 &&
      dv.getUint16(32, true) === 2,
    w.length,
  );
}

console.log("\n  WAV RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
