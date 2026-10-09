import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ecActivitySnapshot,
  ecSnapshotCommitCount,
} from "../src/modules/ec/activity-snapshot";

test("EC activity snapshot preserves the verified September totals", () => {
  assert.equal(ecActivitySnapshot.activityThrough, "2026-09-30");
  assert.equal(ecActivitySnapshot.developers.length, 3);
  assert.equal(ecSnapshotCommitCount(), 26);
  assert.deepEqual(
    ecActivitySnapshot.developers.map((developer) => developer.githubLogin),
    ["CarryWang", "BrKDDD", "tianzeshi-study"],
  );
});
