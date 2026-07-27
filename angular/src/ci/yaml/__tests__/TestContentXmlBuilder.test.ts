/**
 * Unit tests for TestContentXmlBuilder
 *
 * All tests are pure in-memory — no file system access needed.
 * We verify that the generated XML strings contain the expected
 * elements/attributes.  We deliberately avoid full snapshot tests so
 * that minor whitespace changes do not break the suite; we assert
 * on meaningful sub-strings instead.
 */

import { TestContentXmlBuilder } from '../TestContentXmlBuilder';
import type { ParsedYamlTest, SimplifiedContent } from '../SimplifiedModels';

// =============================================================================
// Helpers
// =============================================================================

function makeParsed(overrides: Partial<ParsedYamlTest> = {}): ParsedYamlTest {
    return {
        testName: 'My Test',
        testFolderPath: 'ci-tests\\api',
        testFolderPathWithSubject: 'Subject\\ci-tests\\api',
        content: makeContent(),
        ...overrides,
    };
}

function makeContent(overrides: Partial<SimplifiedContent> = {}): SimplifiedContent {
    return {
        group: [{ group_name: 'G1', vusers: 5, script_id: 42 }],
        ...overrides,
    };
}

// =============================================================================
// buildTestXml — outer envelope
// =============================================================================

describe('buildTestXml – outer envelope', () => {
    it('wraps output in <Test xmlns="..."> … </Test>', () => {
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed());
        expect(xml).toMatch(/^<Test xmlns="http:\/\/www\.hp\.com\/PC\/REST\/API">/);
        expect(xml).toMatch(/<\/Test>$/);
    });

    it('includes <Name> with the test name', () => {
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed());
        expect(xml).toContain('<Name>My Test</Name>');
    });

    it('includes <TestFolderPath> with Subject\\ prefix', () => {
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed());
        expect(xml).toContain('<TestFolderPath>Subject\\ci-tests\\api</TestFolderPath>');
    });

    it('XML-escapes special characters in test name', () => {
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed({ testName: 'Test & "Load" <prod>' }));
        expect(xml).toContain('<Name>Test &amp; &quot;Load&quot; &lt;prod&gt;</Name>');
    });

    it('includes WorkloadType with basic/by test/by number', () => {
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed());
        expect(xml).toContain(
            '<WorkloadType>' +
            '<Type>basic</Type>' +
            '<SubType>by test</SubType>' +
            '<VusersDistributionMode>by number</VusersDistributionMode>' +
            '</WorkloadType>'
        );
    });

    it('includes <MonitorProfiles/> placeholder', () => {
        expect(TestContentXmlBuilder.buildTestXml(makeParsed())).toContain('<MonitorProfiles/>');
    });

    it('includes <Diagnostics/> placeholder', () => {
        expect(TestContentXmlBuilder.buildTestXml(makeParsed())).toContain('<Diagnostics/>');
    });
});

// =============================================================================
// buildContentXml — wrapping
// =============================================================================

describe('buildContentXml – wrapping', () => {
    it('wraps output in <Content xmlns="..."> … </Content>', () => {
        const xml = TestContentXmlBuilder.buildContentXml(makeContent());
        expect(xml).toMatch(/^<Content xmlns="http:\/\/www\.hp\.com\/PC\/REST\/API">/);
        expect(xml).toMatch(/<\/Content>$/);
    });

    it('does NOT include <Test>, test-level <Name>, or <TestFolderPath>', () => {
        const xml = TestContentXmlBuilder.buildContentXml(makeContent());
        // No outer <Test> envelope
        expect(xml).not.toContain('<Test ');
        // No test-level Name/TestFolderPath (group <Name> elements are fine)
        expect(xml).not.toContain('<TestFolderPath>');
        // Verify it is not a <Test> document by checking the root tag
        expect(xml).toMatch(/^<Content xmlns=/);
    });
});

// =============================================================================
// Scheduler — ramp-up logic
// =============================================================================

describe('Scheduler – ramp-up logic', () => {
    function buildWithScheduler(rampup: number, duration: number, vusers: number[] = [5]): string {
        const groups = vusers.map((v, i) => ({ script_id: i + 1, vusers: v }));
        return TestContentXmlBuilder.buildTestXml(makeParsed({
            content: makeContent({ group: groups, scheduler: { rampup, duration } }),
        }));
    }

    it('rampup=0 → StartVusers simultaneously', () => {
        expect(buildWithScheduler(0, 300)).toContain('<StartVusers Type="simultaneously"/>');
    });

    it('rampup=1 → StartVusers simultaneously (boundary)', () => {
        expect(buildWithScheduler(1, 0)).toContain('<StartVusers Type="simultaneously"/>');
    });

    it('rampup=2 → StartVusers gradually (lower mid-range boundary)', () => {
        expect(buildWithScheduler(2, 0, [1])).toContain('<StartVusers Type="gradually">');
    });

    it('rampup=60, 2 vusers → gradually, 30s interval', () => {
        // exactInterval = 60/2 = 30 ≥ 15 → vusers=1, interval=30s
        const xml = buildWithScheduler(60, 0, [1, 1]);
        expect(xml).toContain('<StartVusers Type="gradually">');
        expect(xml).toContain('<Seconds>30</Seconds>');
    });

    it('rampup=600, 10 vusers → gradually, 1-minute interval', () => {
        // exactInterval = 600/10 = 60 ≥ 15 → vusers=1, interval=60s=1min
        const xml = buildWithScheduler(600, 0, Array(10).fill(1));
        expect(xml).toContain('<StartVusers Type="gradually">');
        expect(xml).toContain('<Minutes>1</Minutes>');
    });

    it('rampup=600, 100 vusers → interval capped at 15s minimum', () => {
        // exactInterval = 600/100 = 6s < 15s → vusers=ceil(15/6)=3, interval=15s
        const xml = buildWithScheduler(600, 0, Array(100).fill(1));
        expect(xml).toContain('<StartVusers Type="gradually">');
        expect(xml).toContain('<Vusers>3</Vusers>');
        expect(xml).toContain('<Seconds>15</Seconds>');
    });

    it('duration=0 → "until completion"', () => {
        expect(buildWithScheduler(0, 0)).toContain('<Duration Type="until completion"/>');
    });

    it('duration=300 → "run for" 5 minutes', () => {
        const xml = buildWithScheduler(0, 300);
        expect(xml).toContain('<Duration Type="run for">');
        expect(xml).toContain('<Minutes>5</Minutes>');
    });

    it('duration=3660 → "run for" 1h 1min', () => {
        const xml = buildWithScheduler(0, 3660);
        expect(xml).toContain('<Hours>1</Hours>');
        expect(xml).toContain('<Minutes>1</Minutes>');
    });

    it('always emits Initialize and StopVusers actions', () => {
        const xml = buildWithScheduler(0, 0);
        expect(xml).toContain('<Initialize Type="just before vuser runs"/>');
        expect(xml).toContain('<StopVusers Type="simultaneously"/>');
    });
});

// =============================================================================
// LG Distribution
// =============================================================================

describe('LG Distribution', () => {
    it('all groups have lg_name → manual distribution (no Amount)', () => {
        const content = makeContent({
            group: [
                { script_id: 1, vusers: 5, lg_name: ['LG1'] },
                { script_id: 2, vusers: 5, lg_name: ['LG2', 'LG3'] },
            ],
        });
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed({ content }));
        expect(xml).toContain('<LGDistribution><Type>manual</Type></LGDistribution>');
    });

    it('lg_amount set → "all to each group" with specified amount', () => {
        const content = makeContent({ lg_amount: 3 });
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed({ content }));
        expect(xml).toContain('<LGDistribution><Type>all to each group</Type><Amount>3</Amount></LGDistribution>');
    });

    it('lg_amount set wins over group lg_name list', () => {
        const content = makeContent({
            lg_amount: 2,
            group: [{ script_id: 1, vusers: 1, lg_name: ['LG1'] }],
        });
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed({ content }));
        expect(xml).toContain('<Type>all to each group</Type>');
        expect(xml).toContain('<Amount>2</Amount>');
    });

    it('one group missing lg_name → "all to each group" with amount=1', () => {
        const content = makeContent({
            group: [
                { script_id: 1, vusers: 5, lg_name: ['LG1'] },
                { script_id: 2, vusers: 5 }, // no lg_name
            ],
        });
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed({ content }));
        expect(xml).toContain('<Type>all to each group</Type>');
        expect(xml).toContain('<Amount>1</Amount>');
    });
});

// =============================================================================
// Host type detection
// =============================================================================

describe('Host type detection', () => {
    function buildWithHosts(lgNames: string[]): string {
        const content = makeContent({
            group: [{ script_id: 1, vusers: 1, lg_name: lgNames }],
        });
        return TestContentXmlBuilder.buildTestXml(makeParsed({ content }));
    }

    it('LG1 → automatch', () => {
        expect(buildWithHosts(['LG1'])).toContain('<Type>automatch</Type>');
    });

    it('LG99 → automatch', () => {
        expect(buildWithHosts(['LG99'])).toContain('<Type>automatch</Type>');
    });

    it('lg2 (lowercase) → automatch (case-insensitive)', () => {
        expect(buildWithHosts(['lg2'])).toContain('<Type>automatch</Type>');
    });

    it('DOCKER1 → dynamic', () => {
        expect(buildWithHosts(['DOCKER1'])).toContain('<Type>dynamic</Type>');
    });

    it('docker5 (lowercase) → dynamic (case-insensitive)', () => {
        expect(buildWithHosts(['docker5'])).toContain('<Type>dynamic</Type>');
    });

    it('myhost.example.com → specific', () => {
        expect(buildWithHosts(['myhost.example.com'])).toContain('<Type>specific</Type>');
    });

    it('192.168.1.10 → specific', () => {
        expect(buildWithHosts(['192.168.1.10'])).toContain('<Type>specific</Type>');
    });

    it('multiple hosts are all emitted', () => {
        const xml = buildWithHosts(['LG1', 'DOCKER2', 'myhost']);
        expect(xml).toContain('<Name>LG1</Name>');
        expect(xml).toContain('<Name>DOCKER2</Name>');
        expect(xml).toContain('<Name>myhost</Name>');
    });
});

// =============================================================================
// RTS defaults and overrides
// =============================================================================

describe('RTS – defaults and overrides', () => {
    it('emits default pacing (1 iteration / immediately) when rts is omitted', () => {
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed());
        expect(xml).toContain('<NumberOfIterations>1</NumberOfIterations>');
        expect(xml).toContain('<StartNewIteration Type="immediately"/>');
    });

    it('always emits a disabled Log element', () => {
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed());
        expect(xml).toContain('<Log Type="disable">');
        expect(xml).toContain('<ParametersSubstituion>false</ParametersSubstituion>');
    });
});

// =============================================================================
// Pacing types
// =============================================================================

describe('Pacing types', () => {
    function buildWithPacing(type: string, delay = 0, range = 0, iters = 5): string {
        const content = makeContent({
            group: [{
                script_id: 1,
                vusers: 1,
                rts: { pacing: { number_of_iterations: iters, type, delay, delay_random_range: range } },
            }],
        });
        return TestContentXmlBuilder.buildTestXml(makeParsed({ content }));
    }

    it('type=immediately', () => {
        expect(buildWithPacing('immediately')).toContain('<StartNewIteration Type="immediately"/>');
    });

    it('type=fixed delay with delay=30', () => {
        expect(buildWithPacing('fixed delay', 30))
            .toContain('<StartNewIteration Type="fixed delay" DelayAtRangeOf="30"/>');
    });

    it('type=fixed interval with delay=60', () => {
        expect(buildWithPacing('fixed interval', 60))
            .toContain('<StartNewIteration Type="fixed interval" DelayAtRangeOf="60"/>');
    });

    it('type=random delay with delay=10, range=20 → from=10, to=30', () => {
        expect(buildWithPacing('random delay', 10, 20))
            .toContain('DelayAtRangeOf="10" DelayAtRangeTo="30"');
    });

    it('type=random interval with delay=5, range=15 → from=5, to=20', () => {
        expect(buildWithPacing('random interval', 5, 15))
            .toContain('DelayAtRangeOf="5" DelayAtRangeTo="20"');
    });

    it('falls back to immediately when type is unrecognised', () => {
        expect(buildWithPacing('unknown-type')).toContain('<StartNewIteration Type="immediately"/>');
    });

    it('NumberOfIterations reflects configured value', () => {
        expect(buildWithPacing('immediately', 0, 0, 10)).toContain('<NumberOfIterations>10</NumberOfIterations>');
    });
});

// =============================================================================
// ThinkTime types
// =============================================================================

describe('ThinkTime types', () => {
    function buildWithThinkTime(type: string, extra: Record<string, number> = {}): string {
        const content = makeContent({
            group: [{
                script_id: 1,
                vusers: 1,
                rts: { thinktime: { type, ...extra } },
            }],
        });
        return TestContentXmlBuilder.buildTestXml(makeParsed({ content }));
    }

    it('type=ignore → <ThinkTime Type="ignore"/>', () => {
        expect(buildWithThinkTime('ignore')).toContain('<ThinkTime Type="ignore"/>');
    });

    it('type=replay without limit_seconds → <ThinkTime Type="replay"/>', () => {
        expect(buildWithThinkTime('replay')).toContain('<ThinkTime Type="replay"/>');
    });

    it('type=replay with limit_seconds → includes <LimitSeconds>', () => {
        const xml = buildWithThinkTime('replay', { limit_seconds: 30 });
        expect(xml).toContain('<ThinkTime Type="replay">');
        expect(xml).toContain('<LimitSeconds>30</LimitSeconds>');
    });

    it('type=modify emits LimitSeconds and MultiplyFactor', () => {
        const xml = buildWithThinkTime('modify', { limit_seconds: 30, multiply_factor: 2 });
        expect(xml).toContain('<ThinkTime Type="modify">');
        expect(xml).toContain('<LimitSeconds>30</LimitSeconds>');
        expect(xml).toContain('<MultiplyFactor>2</MultiplyFactor>');
    });

    it('type=random emits MinPercentage and MaxPercentage', () => {
        const xml = buildWithThinkTime('random', { min_percentage: 50, max_percentage: 150 });
        expect(xml).toContain('<ThinkTime Type="random">');
        expect(xml).toContain('<MinPercentage>50</MinPercentage>');
        expect(xml).toContain('<MaxPercentage>150</MaxPercentage>');
    });
});

// =============================================================================
// Optional content sections
// =============================================================================

describe('Optional content sections', () => {
    it('emits <Controller> when controller is set', () => {
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed({
            content: makeContent({ controller: 'ctrl-host.example.com' }),
        }));
        expect(xml).toContain('<Controller>ctrl-host.example.com</Controller>');
    });

    it('does NOT emit <Controller> when omitted', () => {
        expect(TestContentXmlBuilder.buildTestXml(makeParsed())).not.toContain('<Controller>');
    });

    it('emits AutomaticTrending with default max_runs_in_report=10 when not specified', () => {
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed({
            content: makeContent({ automatic_trending: { report_id: 99 } }),
        }));
        expect(xml).toContain('<ReportId>99</ReportId>');
        expect(xml).toContain('<MaxRunsInReport>10</MaxRunsInReport>');
    });

    it('emits AutomaticTrending with custom max_runs_in_report', () => {
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed({
            content: makeContent({ automatic_trending: { report_id: 5, max_runs_in_report: 10 } }),
        }));
        expect(xml).toContain('<MaxRunsInReport>10</MaxRunsInReport>');
    });

    it('emits ElasticLoadGeneratorConfiguration', () => {
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed({
            content: makeContent({ lg_elastic_configuration: { image_id: 7, memory_limit: 512 } }),
        }));
        expect(xml).toContain('<ElasticLoadGeneratorConfiguration>');
        expect(xml).toContain('<ImageId>7</ImageId>');
        expect(xml).toContain('<MemoryLimit>512</MemoryLimit>');
    });

    it('emits ElasticControllerConfiguration', () => {
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed({
            content: makeContent({ controller_elastic_configuration: { image_id: 3 } }),
        }));
        expect(xml).toContain('<ElasticControllerConfiguration>');
        expect(xml).toContain('<ImageId>3</ImageId>');
    });

    it('emits GlobalCommandLine when group has command_line', () => {
        const content = makeContent({
            group: [{ group_name: 'G1', script_id: 1, vusers: 1, command_line: '-param value' }],
        });
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed({ content }));
        expect(xml).toContain('<GlobalCommandLine>');
        // Java CommandLine class uses <Name> + <Value>, NOT <GroupName>/<CommandLine>
        expect(xml).toContain('<Name>G1</Name>');
        expect(xml).toContain('<Value>-param value</Value>');
        expect(xml).not.toContain('<GroupName>');
    });

    it('does NOT emit GlobalCommandLine when no group has command_line', () => {
        expect(TestContentXmlBuilder.buildTestXml(makeParsed())).not.toContain('<GlobalCommandLine>');
    });
});

// =============================================================================
// Group element content
// =============================================================================

describe('Group element content', () => {
    it('uses default group name "Group_1" when group_name is omitted', () => {
        const content = makeContent({ group: [{ script_id: 1, vusers: 2 }] });
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed({ content }));
        expect(xml).toContain('<Name>Group_1</Name>');
    });

    it('defaults vusers to 1 when vusers is 0', () => {
        const content = makeContent({ group: [{ script_id: 1, vusers: 0 }] });
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed({ content }));
        expect(xml).toContain('<Vusers>1</Vusers>');
    });

    it('emits Script ID', () => {
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed());
        expect(xml).toContain('<Script><ID>42</ID></Script>');
    });
});

// =============================================================================
// Quoted-number coercion (YAML values written as strings, e.g. vusers: '2')
// =============================================================================

describe('Quoted-number coercion', () => {
    it('vusers as quoted string "5" → <Vusers>5</Vusers>', () => {
        // Cast through unknown to simulate what js-yaml returns for quoted values
        const content = makeContent({ group: [{ script_id: 1, vusers: '5' as unknown as number }] });
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed({ content }));
        expect(xml).toContain('<Vusers>5</Vusers>');
    });

    it('rampup as quoted string "45" still produces a ramp schedule', () => {
        const content = makeContent({
            group: [{ script_id: 1, vusers: '50' as unknown as number }],
            scheduler: { rampup: '45' as unknown as number, duration: '300' as unknown as number },
        });
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed({ content }));
        // rampup 45 > 30 → gradual start; duration 300 → "run for"
        expect(xml).toContain('<StartVusers Type="gradually">');
        expect(xml).toContain('<Duration Type="run for">');
    });

    it('pacing number_of_iterations as quoted string "3" → NumberOfIterations>3', () => {
        const content = makeContent({
            group: [{
                script_id: 1,
                vusers: 1,
                rts: { pacing: { number_of_iterations: '3' as unknown as number, type: 'immediately' } },
            }],
        });
        const xml = TestContentXmlBuilder.buildTestXml(makeParsed({ content }));
        expect(xml).toContain('<NumberOfIterations>3</NumberOfIterations>');
    });
});

