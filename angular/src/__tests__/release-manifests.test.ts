import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');

interface VersionedPackage {
  version: string;
}

interface TaskManifest {
  version: { Major: number; Minor: number; Patch: number };
  execution: Record<string, { target: string }>;
}

interface Lockfile extends VersionedPackage {
  packages: Record<string, VersionedPackage>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

describe('release manifests', () => {
  const version = readJson<VersionedPackage>('vss-extension.json').version;

  test.each(['LreCiTask', 'LreWorkspaceSyncTask'])(
    '%s uses the supported task handlers and release version',
    (task) => {
      const manifest = readJson<TaskManifest>(`${task}/task.json`);
      const packageVersion = readJson<VersionedPackage>(`${task}/package.json`).version;
      const { Major, Minor, Patch } = manifest.version;

      expect(Object.keys(manifest.execution).sort()).toEqual(['Node20_1', 'Node24']);
      expect(manifest.execution.Node20_1.target).toBe('index.js');
      expect(manifest.execution.Node24.target).toBe('index.js');
      expect(`${Major}.${Minor}.${Patch}`).toBe(version);
      expect(packageVersion).toBe(version);
    },
  );

  test('the root package and lockfile use the extension version', () => {
    expect(readJson<VersionedPackage>('package.json').version).toBe(version);
    const lockfile = readJson<Lockfile>('package-lock.json');
    expect(lockfile.version).toBe(version);
    expect(lockfile.packages[''].version).toBe(version);
  });
});
