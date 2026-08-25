import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { store, flushSync } from '../src/repository/store.js';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../src/config.js';

const STORE_PATH = join(config.dataDir, 'hypergriot.json');
const TMP_PATH = STORE_PATH + '.tmp';

describe('Shutdown & Persistence Safety', () => {
  beforeEach(() => {
    store.resetForTests();
    if (existsSync(STORE_PATH)) rmSync(STORE_PATH);
    if (existsSync(TMP_PATH)) rmSync(TMP_PATH);
  });

  afterEach(() => {
    if (existsSync(STORE_PATH)) rmSync(STORE_PATH);
    if (existsSync(TMP_PATH)) rmSync(TMP_PATH);
  });

  it('flushSync() persists pending data to disk atomically', () => {
    store.setWelcomeText(123, 'Hello Test');
    flushSync();
    
    expect(existsSync(STORE_PATH)).toBe(true);
    const data = JSON.parse(readFileSync(STORE_PATH, 'utf8'));
    expect(data.chats['123'].welcome.text).toBe('Hello Test');
    
    expect(existsSync(TMP_PATH)).toBe(false);
  });

  it('Data survives resetForTests -> load() cycle after flushSync()', () => {
    store.setWelcomeText(456, 'Hello Survival');
    flushSync();
    
    store.resetForTests();
    const noData = store.getWelcome(456);
    expect(noData.text).not.toBe('Hello Survival');

    store.init(); // loads from disk
    const reloaded = store.getWelcome(456);
    expect(reloaded.text).toBe('Hello Survival');
  });

  it('Recovery from .tmp file when main file is missing', () => {
    const fakeData = { chats: { '789': { welcome: { text: 'Tmp Recovery' } } } };
    writeFileSync(TMP_PATH, JSON.stringify(fakeData));
    
    expect(existsSync(STORE_PATH)).toBe(false);
    
    store.init(); // Should load from .tmp
    
    const welcome = store.getWelcome(789);
    expect(welcome.text).toBe('Tmp Recovery');
  });
});
