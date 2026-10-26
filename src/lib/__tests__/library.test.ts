import { describe, expect, it } from 'vitest'
import { DEFAULT_PLAYBOOK } from '../../data/defaults'
import type { Playbook } from '../../types'
import { serializeSnapbook } from '../files'
import {
  applyMergeChoice,
  clonePlaybook,
  createLibraryFile,
  mergeLibraries,
  parseLibrary,
  serializeLibrary,
  uniquePlaybookName,
} from '../library'
import { playbookHash } from '../syncLogic'

const makeBook = (id: string, name: string): Playbook => ({
  ...(JSON.parse(JSON.stringify(DEFAULT_PLAYBOOK)) as Playbook),
  id,
  name,
})

describe('playbook library files', () => {
  it('round-trips several playbooks and their ids', () => {
    const alpha = makeBook('alpha', 'Alpha')
    const beta = makeBook('beta', 'Beta')
    const parsed = parseLibrary(
      serializeLibrary([alpha, beta], '2026-01-01T00:00:00.000Z'),
    )

    expect(parsed.legacy).toBe(false)
    expect(parsed.playbooks.map((playbook) => playbook.id)).toEqual(['alpha', 'beta'])
    expect(parsed.playbooks.map((playbook) => playbook.name)).toEqual(['Alpha', 'Beta'])
    expect(playbookHash(parsed.playbooks[0])).toBe(playbookHash(alpha))
    expect(playbookHash(parsed.playbooks[1])).toBe(playbookHash(beta))
  })

  it('reads a single-playbook file written before libraries existed', () => {
    const alpha = makeBook('alpha', 'Alpha')
    const parsed = parseLibrary(serializeSnapbook(alpha))

    expect(parsed.legacy).toBe(true)
    expect(parsed.playbooks).toHaveLength(1)
    expect(parsed.playbooks[0].id).toBe('legacy-playbook')
    expect(playbookHash(parsed.playbooks[0])).toBe(playbookHash(alpha))
  })

  it('refuses damaged or ambiguous libraries', () => {
    expect(() => parseLibrary('')).toThrow()
    expect(() => parseLibrary('not json')).toThrow(/not valid JSON/)
    const duplicated = createLibraryFile([
      makeBook('same', 'Alpha'),
      makeBook('same', 'Alpha again'),
    ])
    expect(() => parseLibrary(JSON.stringify(duplicated))).toThrow(/twice/)
  })
})

describe('library merge', () => {
  const alpha = makeBook('alpha', 'Alpha')
  const beta = makeBook('beta', 'Beta')

  it('adds a playbook that only Dropbox has', () => {
    const merge = mergeLibraries({
      local: [alpha],
      remote: [alpha, beta],
      baseline: { alpha: playbookHash(alpha) },
    })

    expect(merge.conflicts).toHaveLength(0)
    expect(merge.playbooks.map((playbook) => playbook.id)).toEqual(['alpha', 'beta'])
  })

  it('keeps edits to different playbooks from both sides', () => {
    const local = [{ ...alpha, name: 'Alpha local' }, beta]
    const remote = [alpha, { ...beta, name: 'Beta remote' }]
    const merge = mergeLibraries({
      local,
      remote,
      baseline: { alpha: playbookHash(alpha), beta: playbookHash(beta) },
    })

    expect(merge.conflicts).toHaveLength(0)
    expect(merge.playbooks.map((playbook) => playbook.name)).toEqual([
      'Alpha local',
      'Beta remote',
    ])
  })

  it('reports the same playbook changed on both sides', () => {
    const local = [{ ...alpha, name: 'Alpha here' }]
    const remote = [{ ...alpha, name: 'Alpha there' }]
    const merge = mergeLibraries({
      local,
      remote,
      baseline: { alpha: playbookHash(alpha) },
    })

    expect(merge.conflicts).toHaveLength(1)
    expect(merge.conflicts[0].id).toBe('alpha')
    // Nothing is thrown away before the user decides.
    expect(merge.playbooks[0].name).toBe('Alpha here')
  })

  it('propagates a deletion when the other side did not touch the playbook', () => {
    const merge = mergeLibraries({
      local: [],
      remote: [alpha],
      baseline: { alpha: playbookHash(alpha) },
    })

    expect(merge.playbooks).toHaveLength(0)
    expect(merge.conflicts).toHaveLength(0)
  })

  it('keeps a playbook deleted here but edited on Dropbox', () => {
    const merge = mergeLibraries({
      local: [],
      remote: [{ ...alpha, name: 'Alpha edited' }],
      baseline: { alpha: playbookHash(alpha) },
    })

    expect(merge.playbooks.map((playbook) => playbook.name)).toEqual(['Alpha edited'])
  })

  it('treats identical content under different ids as the same playbook', () => {
    const firstInstall = makeBook('device-one', 'My flag playbook')
    const secondInstall = makeBook('device-two', 'My flag playbook')
    const merge = mergeLibraries({
      local: [firstInstall],
      remote: [secondInstall],
      baseline: {},
    })

    expect(merge.conflicts).toHaveLength(0)
    expect(merge.playbooks).toHaveLength(1)
    expect(merge.playbooks[0].id).toBe('device-one')
  })

  it('resolves conflicts the same way for every playbook', () => {
    const local = [{ ...alpha, name: 'Alpha here' }]
    const remote = [{ ...alpha, name: 'Alpha there' }]
    const merge = mergeLibraries({
      local,
      remote,
      baseline: { alpha: playbookHash(alpha) },
    })

    expect(applyMergeChoice(merge, 'local')[0].name).toBe('Alpha here')
    expect(applyMergeChoice(merge, 'remote')[0].name).toBe('Alpha there')
    expect(applyMergeChoice({ playbooks: [alpha], conflicts: [] }, 'remote')[0]).toBe(
      alpha,
    )
  })
})

describe('playbook copies', () => {
  it('clones content with fresh ids and remapped references', () => {
    const source = makeBook('alpha', 'Alpha')
    source.categories = [{ id: 'tag', name: 'Quick game', color: '#F4C95D' }]
    source.plays = source.plays.map((play) => ({
      ...play,
      categories: ['tag'],
    }))
    const copy = clonePlaybook(source, 'Alpha copy')

    expect(copy.id).not.toBe(source.id)
    expect(copy.name).toBe('Alpha copy')
    expect(copy.plays).toHaveLength(source.plays.length)
    expect(copy.plays[0].id).not.toBe(source.plays[0].id)
    expect(copy.formations[0].id).not.toBe(source.formations[0].id)
    expect(copy.categories[0].id).not.toBe('tag')
    // Plays still point at the formations and tags of the copy.
    expect(copy.formations.some((item) => item.id === copy.plays[0].formationId)).toBe(
      true,
    )
    expect(copy.plays[0].categories).toEqual([copy.categories[0].id])
    // Same coaching content, so the copy syncs as a distinct but equal file.
    expect(playbookHash({ ...copy, name: source.name })).toBe(playbookHash(source))
    expect(source.plays[0].id).not.toBe(copy.plays[0].id)
  })

  it('finds a free name', () => {
    expect(uniquePlaybookName('Friday', [])).toBe('Friday')
    expect(uniquePlaybookName('Friday', ['Friday'])).toBe('Friday 2')
    expect(uniquePlaybookName('Friday', ['Friday', 'Friday 2'])).toBe('Friday 3')
    expect(uniquePlaybookName('Friday', ['friday'])).toBe('Friday 2')
  })
})
