import { describe, expect, it } from 'vitest'
import { buildDiffViewModel, findFileStats } from './git-tab-diff-model'

const PATCH = `diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1 @@
-old
+new
diff --git a/src/b.ts b/src/b.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/b.ts
@@ -0,0 +1 @@
+hello
`

describe('buildDiffViewModel', () => {
  it('turns a multi-file patch into stable CodeView diff items', () => {
    const model = buildDiffViewModel(
      [
        { filename: 'src/a.ts', status: 'modified', additions: 1, deletions: 1 },
        { filename: 'src/b.ts', status: 'added', additions: 1, deletions: 0 },
      ],
      PATCH,
    )

    expect(model.items).toHaveLength(2)
    expect(model.items.map((item) => item.id)).toEqual([
      expect.stringMatching(/^\d+:0:src\/a\.ts$/),
      expect.stringMatching(/^\d+:1:src\/b\.ts$/),
    ])
    expect(model.items.every((item) => item.type === 'diff')).toBe(true)
    expect(model.filesWithoutPatch).toEqual([])
  })

  it('changes item ids and versions when patch contents change', () => {
    const files = [{ filename: 'src/a.ts', status: 'modified', additions: 1, deletions: 1 }]
    const first = buildDiffViewModel(files, PATCH)
    const second = buildDiffViewModel(files, PATCH.replace('+new', '+newer'))

    expect(second.items[0]?.id).not.toBe(first.items[0]?.id)
    expect(second.items[0]?.version).not.toBe(first.items[0]?.version)
  })

  it('preserves metadata for files without a text patch', () => {
    const model = buildDiffViewModel(
      [
        { filename: 'src/a.ts', status: 'modified', additions: 1, deletions: 1 },
        { filename: 'assets/logo.png', status: 'modified', additions: 0, deletions: 0 },
      ],
      PATCH,
    )

    expect(model.filesWithoutPatch).toEqual([
      { filename: 'assets/logo.png', status: 'modified', additions: 0, deletions: 0 },
    ])
  })

  it('finds renamed file stats from CodeView diff metadata', () => {
    const model = buildDiffViewModel(
      [{ filename: 'src/new.ts', oldFilename: 'src/old.ts', status: 'renamed', additions: 1, deletions: 0 }],
      `diff --git a/src/old.ts b/src/new.ts
similarity index 70%
rename from src/old.ts
rename to src/new.ts
index 1111111..2222222 100644
--- a/src/old.ts
+++ b/src/new.ts
@@ -1 +1 @@
-old
+new
`,
    )

    expect(findFileStats(model.fileStatsByName, model.items[0]!)).toMatchObject({
      filename: 'src/new.ts',
      status: 'renamed',
    })
  })
})
