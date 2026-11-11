/* LOGO B, PIXEL grids (appendix 8.7). Rows split on "/", "*n" repeats a row n times; bomb cells use bomb.js letters (BPAL). */
const g = (s) => s.split("/").flatMap((r) => { const [a, n] = r.split("*"); return Array(+n || 1).fill(a); });
export const G12 = Object.freeze({
  F: g(".######/#######*2/###....*2/#####..*2/###....*5"),
  U: g("###..###*9/########/.######./..####.."),
  S: g("..#####./.#######/###...##/###...../#######./.#######/..######/.....###/##...###/########/#######./.#####.."),
  E: g(".######/#######*2/###....*2/######.*2/###....*2/#######*2/.######"),
  G: g("..######./.########/###....##/###......*2/###..####*2/###...###*2/#########/.#######./..#####.."),
  R: g("#######./########*2/###..###*2/########/######../###.###.*2/###..###*3"),
  I: g("###*12"),
  D: g("######../#######./########/###..###*6/########/#######./######.."),
});
export const BOMB = Object.freeze({
  18: g("..................*1/...........oooo.../......oooooorqo.../....oorrrkkoooo.../...orrkkkkkkkko.../..orhwwkkkkkkkko../..orhwhkkkkkkkko../.orhhhkkkwkkkkkko./.orhkkkkkwkkkkkqo./.orkkkkkkwkkkkkqo./.okkkkwwwwwwwkkqo./.okkkkkkkwkkkkkqo.*2/..okkkkkkwkkkkqo../..okkkkkkkkkkqqo../...okkkkkkkqqqo.../....ookkqqqqoo..../......oooooo......"),
  11: g(".......ooo./...oooooro./.oorrkkooo./.orhwkkko../orhkkwkkko./orkkkwkkqo./okkwwwwwqo./okkkkwkkqo./.okkkwqqo../.ookqqqoo../...oooo...."),
});
export const BPAL = Object.freeze({o: "stroke", k: "bomb", r: "pow.line.outline", q: "pow.shield.outline", h: "pow.line.shadow", w: "spec"});
export const SPAL = Object.freeze({s: "spark", S: "sparkB"});
export const SPARK5 = Object.freeze([g("..s..*2/ssSss/..s..*2"), g("S...S/.s.s./..s../.s.s./S...S")]);
export const CORONET = g("h..h..h/b.bbb.b/bbbbbbb*2");
