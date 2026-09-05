/* Hand-rolled RIFF/PCM16 encoder — zero deps, so no wavefile/audiobuffer-to-wav
   package. Takes anything AudioBuffer-shaped ({numberOfChannels, sampleRate,
   length, getChannelData(i)}) so Node can test it against a synthetic object. */
export function encodeWav(buf) {
  const ch = buf.numberOfChannels,
    rate = buf.sampleRate,
    len = buf.length;
  const bytes = len * ch * 2,
    out = new Uint8Array(44 + bytes),
    dv = new DataView(out.buffer);
  const tag = (o, s) => {
    for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i);
  };
  tag(0, "RIFF");
  dv.setUint32(4, 36 + bytes, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, ch, true);
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * ch * 2, true);
  dv.setUint16(32, ch * 2, true);
  dv.setUint16(34, 16, true);
  tag(36, "data");
  dv.setUint32(40, bytes, true);
  const src = [];
  for (let c = 0; c < ch; c++) src.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++)
    for (let c = 0; c < ch; c++, o += 2) {
      const x = Math.max(-1, Math.min(1, src[c][i]));
      dv.setInt16(o, Math.round(x * 32767), true);
    }
  return out;
}
