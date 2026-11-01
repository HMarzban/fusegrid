/* The tile checks live in src/core/featchecks.js since #18 (genBoard3 gates
   BOOSTER placement with them); the balance tools keep this path. Importing
   board3.js registers gen 3, so anything that reads the checks can deal its boards. */
import "../../src/core/board3.js";
export * from "../../src/core/featchecks.js";
