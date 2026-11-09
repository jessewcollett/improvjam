import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { incomingWouldWipe, listsArePoorer, profileSyncPlan } from './profile.js';

const richSet = {
  id: 'set_1',
  name: 'Performance',
  items: [
    { type: 'game', id: 'jam-hockey' },
    { type: 'game', id: 'jam-harold' },
    { type: 'game', id: 'jam-la-ronde' },
  ],
  games: ['jam-hockey', 'jam-harold', 'jam-la-ronde'],
};

const shortSet = {
  id: 'set_1',
  name: 'Performance',
  items: [
    { type: 'game', id: 'jam-hockey' },
    { type: 'game', id: 'jam-harold' },
  ],
  games: ['jam-hockey', 'jam-harold'],
};

const folder = { id: 'folder_1', name: 'Improv Fall 2026' };

const rich = {
  lists: {
    favorites: [],
    toPlay: [],
    played: [],
    learned: [],
    customSets: [{ ...richSet, folderId: folder.id }],
    setFolders: [folder],
  },
};

const poor = {
  lists: {
    favorites: [],
    toPlay: [],
    played: [],
    learned: [],
    customSets: [shortSet],
    setFolders: [],
  },
};

const empty = { lists: { favorites: [], toPlay: [], played: [], learned: [], customSets: [], setFolders: [] } };

describe('listsArePoorer', () => {
  it('treats missing folders and a shorter rundown as poorer', () => {
    assert.equal(listsArePoorer(rich, poor), true);
    assert.equal(listsArePoorer(poor, rich), false);
  });
});

describe('incomingWouldWipe', () => {
  it('blocks an empty set list from replacing sets', () => {
    assert.equal(incomingWouldWipe(rich, empty), true);
    assert.equal(incomingWouldWipe(empty, rich), false);
  });

  it('does not treat a shorter rundown as an empty wipe', () => {
    assert.equal(incomingWouldWipe(rich, poor), false);
  });
});

describe('profileSyncPlan', () => {
  it('applies a newer sheet even when local Stage/SFX is dirty', () => {
    assert.equal(profileSyncPlan({
      localPayload: poor,
      remotePayload: rich,
      localAt: 100,
      remoteAt: 200,
      listsDirty: false,
      profileDirty: true,
    }), 'apply-remote');
  });

  it('applies an equal-age richer sheet instead of pushing a poorer local list', () => {
    assert.equal(profileSyncPlan({
      localPayload: poor,
      remotePayload: rich,
      localAt: 100,
      remoteAt: 100,
      listsDirty: true,
      profileDirty: true,
    }), 'apply-remote');
  });

  it('force-pulls the sheet and does not push', () => {
    assert.equal(profileSyncPlan({
      force: true,
      localPayload: poor,
      remotePayload: rich,
      localAt: 300,
      remoteAt: 100,
      listsDirty: true,
      profileDirty: true,
    }), 'apply-remote');
  });

  it('does not force-load a poorer sheet over a richer phone', () => {
    assert.equal(profileSyncPlan({
      force: true,
      localPayload: rich,
      remotePayload: poor,
      localAt: 300,
      remoteAt: 100,
      listsDirty: true,
      profileDirty: true,
    }), 'keep-local');
  });

  it('keeps local on force-pull when the sheet would wipe sets', () => {
    assert.equal(profileSyncPlan({
      force: true,
      localPayload: rich,
      remotePayload: empty,
      localAt: 100,
      remoteAt: 200,
      listsDirty: true,
      profileDirty: true,
    }), 'keep-local');
  });

  it('pushes when this phone is newer and lists actually changed', () => {
    assert.equal(profileSyncPlan({
      localPayload: rich,
      remotePayload: poor,
      localAt: 200,
      remoteAt: 100,
      listsDirty: true,
      profileDirty: true,
    }), 'push-local');
  });

  it('does not let a poorer local list replace a newer sheet', () => {
    assert.equal(profileSyncPlan({
      localPayload: poor,
      remotePayload: rich,
      localAt: 50,
      remoteAt: 400,
      listsDirty: true,
      profileDirty: true,
    }), 'apply-remote');
  });
});
