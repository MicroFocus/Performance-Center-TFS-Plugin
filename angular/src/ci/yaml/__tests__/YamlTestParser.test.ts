/**
 * Unit tests for YamlTestParser
 *
 * The `fs` module is fully mocked so tests never touch the real file system.
 * Sentinel stripping (## ... ##) is exercised via parseFile only, since
 * parseFile is the only entry-point that strips before delegating to parseString.
 */

import * as fs from 'fs';
import { YamlTestParser } from '../YamlTestParser';

// ── Mock entire fs module ─────────────────────────────────────────────────────
jest.mock('fs');

function mockFile(content: string, exists = true): void {
    (fs.existsSync as jest.Mock).mockReturnValue(exists);
    (fs.readFileSync as jest.Mock).mockReturnValue(content);
}

beforeEach(() => jest.resetAllMocks());

// =============================================================================
// parseString — Full-test YAML shape
// =============================================================================

describe('parseString – full-test YAML shape', () => {
    const fullYaml = `
test_name: "My Performance Test"
test_folder_path: "ci-tests/api"
test_content:
  group:
    - group_name: "API Load"
      vusers: 10
      script_id: 42
  scheduler:
    rampup: 60
    duration: 300
`;

    it('returns correct testName', () => {
        expect(YamlTestParser.parseString(fullYaml).testName).toBe('My Performance Test');
    });

    it('normalises forward-slash folder path to backslash', () => {
        const result = YamlTestParser.parseString(fullYaml);
        expect(result.testFolderPath).toBe('ci-tests\\api');
    });

    it('prepends Subject\\ to produce testFolderPathWithSubject', () => {
        const result = YamlTestParser.parseString(fullYaml);
        expect(result.testFolderPathWithSubject).toBe('Subject\\ci-tests\\api');
    });

    it('returns correct group content', () => {
        const result = YamlTestParser.parseString(fullYaml);
        expect(result.content.group).toHaveLength(1);
        expect(result.content.group[0]?.group_name).toBe('API Load');
        expect(result.content.group[0]?.vusers).toBe(10);
        expect(result.content.group[0]?.script_id).toBe(42);
    });

    it('returns scheduler values', () => {
        const result = YamlTestParser.parseString(fullYaml);
        expect(result.content.scheduler?.rampup).toBe(60);
        expect(result.content.scheduler?.duration).toBe(300);
    });

    it('strips a leading "Subject\\\\" prefix from test_folder_path', () => {
        const yaml = `
test_name: "T"
test_folder_path: "Subject\\\\ci-tests"
test_content:
  group:
    - script_id: 1
`;
        const result = YamlTestParser.parseString(yaml);
        expect(result.testFolderPath).toBe('ci-tests');
        expect(result.testFolderPathWithSubject).toBe('Subject\\ci-tests');
    });

    it('strips a leading "subject/" prefix (case-insensitive)', () => {
        const yaml = `
test_name: "T"
test_folder_path: "subject/ci-tests"
test_content:
  group:
    - script_id: 1
`;
        const result = YamlTestParser.parseString(yaml);
        expect(result.testFolderPathWithSubject).toBe('Subject\\ci-tests');
    });

    it('throws when test_name is blank', () => {
        const yaml = `
test_name: ""
test_folder_path: "ci-tests"
test_content:
  group:
    - script_id: 1
`;
        expect(() => YamlTestParser.parseString(yaml)).toThrow('test_name');
    });

    it('throws when test_folder_path is blank', () => {
        const yaml = `
test_name: "T"
test_folder_path: ""
test_content:
  group:
    - script_id: 1
`;
        expect(() => YamlTestParser.parseString(yaml)).toThrow('test_folder_path');
    });

    it('throws when test_content.group is empty array', () => {
        const yaml = `
test_name: "T"
test_folder_path: "ci-tests"
test_content:
  group: []
`;
        expect(() => YamlTestParser.parseString(yaml)).toThrow('group');
    });
});

// =============================================================================
// parseString — Content-only YAML shape
// =============================================================================

describe('parseString – content-only YAML shape', () => {
    const contentOnlyYaml = `
group:
  - group_name: "Smoke"
    vusers: 5
    script_path: "scripts\\\\smoke\\\\login"
scheduler:
  duration: 120
`;

    it('derives testName from source file basename (no extension)', () => {
        const result = YamlTestParser.parseString(contentOnlyYaml, '/workspace/tests/login-smoke.yaml', '/workspace');
        expect(result.testName).toBe('login-smoke');
    });

    it('derives testFolderPath from relative directory', () => {
        const result = YamlTestParser.parseString(contentOnlyYaml, '/workspace/tests/login-smoke.yaml', '/workspace');
        expect(result.testFolderPath).toBe('tests');
        expect(result.testFolderPathWithSubject).toBe('Subject\\tests');
    });

    it('falls back to "LreTest" and dirname when no sourceFilePath', () => {
        const result = YamlTestParser.parseString(contentOnlyYaml);
        expect(result.testName).toBe('LreTest');
    });

    it('returns group content', () => {
        const result = YamlTestParser.parseString(contentOnlyYaml, '/ws/t.yaml', '/ws');
        expect(result.content.group[0]?.script_path).toBe('scripts\\smoke\\login');
    });

    it('returns scheduler values', () => {
        const result = YamlTestParser.parseString(contentOnlyYaml, '/ws/t.yaml', '/ws');
        expect(result.content.scheduler?.duration).toBe(120);
    });

    it('handles nested source file path correctly', () => {
        const result = YamlTestParser.parseString(
            contentOnlyYaml,
            '/workspace/perf/api/my-test.yml',
            '/workspace'
        );
        expect(result.testName).toBe('my-test');
        expect(result.testFolderPath).toBe('perf\\api');
    });
});

// =============================================================================
// parseString — Group validation
// =============================================================================

describe('parseString – group validation', () => {
    it('throws when a group has neither script_id nor script_path', () => {
        const yaml = `
group:
  - group_name: "Bad Group"
    vusers: 5
`;
        expect(() => YamlTestParser.parseString(yaml)).toThrow(/script_id|script_path/);
    });

    it('accepts a group with only script_id (no script_path)', () => {
        const yaml = `
group:
  - script_id: 7
    vusers: 1
`;
        expect(() => YamlTestParser.parseString(yaml, '/ws/t.yaml', '/ws')).not.toThrow();
    });

    it('accepts a group with only script_path (no script_id)', () => {
        const yaml = `
group:
  - script_path: "scripts\\\\my_script"
    vusers: 1
`;
        expect(() => YamlTestParser.parseString(yaml, '/ws/t.yaml', '/ws')).not.toThrow();
    });

    it('throws when the group list is absent entirely', () => {
        expect(() => YamlTestParser.parseString('foo: bar')).toThrow('Invalid YAML structure');
    });
});

// =============================================================================
// parseString — Error cases
// =============================================================================

describe('parseString – error cases', () => {
    it('throws on empty string', () => {
        expect(() => YamlTestParser.parseString('')).toThrow();
    });

    it('throws when YAML parses to a scalar', () => {
        expect(() => YamlTestParser.parseString('just a scalar string')).toThrow();
    });

    it('throws when YAML parses to a list (not an object)', () => {
        expect(() => YamlTestParser.parseString('- item1\n- item2')).toThrow();
    });

    it('throws with descriptive message for unrecognised shape', () => {
        expect(() => YamlTestParser.parseString('foo: bar\nbaz: 42')).toThrow('Invalid YAML structure');
    });
});

// =============================================================================
// parseFile — file system interaction
// =============================================================================

describe('parseFile', () => {
    it('reads file content and parses a full-test YAML', () => {
        const yaml = `
test_name: "File Test"
test_folder_path: "folder"
test_content:
  group:
    - script_id: 7
`;
        mockFile(yaml);
        const result = YamlTestParser.parseFile('/fake/test.yaml');
        expect(result.testName).toBe('File Test');
        expect(result.testFolderPath).toBe('folder');
    });

    it('reads file content and parses a content-only YAML', () => {
        const yaml = `
group:
  - script_id: 3
    vusers: 2
`;
        mockFile(yaml);
        const result = YamlTestParser.parseFile('/workspace/tests/my-load.yaml', '/workspace');
        expect(result.testName).toBe('my-load');
        expect(result.testFolderPath).toBe('tests');
    });

    it('throws a descriptive error when the file does not exist', () => {
        mockFile('', false);
        expect(() => YamlTestParser.parseFile('/not/found.yaml')).toThrow('not found');
    });

    it('strips ## sentinel comment lines before parsing', () => {
        const yaml = `## This is a sentinel comment ##
test_name: "Sentinel Test"
test_folder_path: "ci-tests"
## Middle sentinel line ##
test_content:
  group:
    - script_id: 1
## End ##`;
        mockFile(yaml);
        const result = YamlTestParser.parseFile('/fake/test.yaml');
        expect(result.testName).toBe('Sentinel Test');
    });

    it('strips sentinel lines that wrap content-only YAML', () => {
        const yaml = `## SENTINEL START ##
group:
  - script_id: 5
    vusers: 1
## SENTINEL END ##`;
        mockFile(yaml);
        const result = YamlTestParser.parseFile('/workspace/tests/perf.yaml', '/workspace');
        expect(result.content.group[0]?.script_id).toBe(5);
    });
});

