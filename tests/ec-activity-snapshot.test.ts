import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ecActivitySnapshot,
  ecSnapshotCommitCount,
} from "../src/modules/ec/activity-snapshot";

test("EC activity snapshot preserves the latest verified totals", () => {
  assert.equal(ecActivitySnapshot.snapshotVersion, "20261025T125843");
  assert.equal(ecActivitySnapshot.activityThrough, "2026-10-17");
  assert.equal(ecActivitySnapshot.developers.length, 13);
  assert.equal(ecSnapshotCommitCount(), 71);
  assert.deepEqual(
    ecActivitySnapshot.developers
      .slice(0, 3)
      .map((developer) => developer.githubLogin),
    ["CarryWang", "BrKDDD", "tianzeshi-study"],
  );
});
