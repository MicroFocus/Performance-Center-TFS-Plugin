/**
 * TestContentXmlBuilder — converts a ParsedYamlTest / SimplifiedContent into
 * the XML payloads expected by the LRE REST API.
 *
 * POST /tests  → full <Test> element  (buildTestXml)
 * PUT  /tests/{id} → <Content> element only (buildContentXml)
 *
 * Element names, attribute names, and enum string values are derived from the
 * Java reference implementation in performance-center-plugins-common, confirmed
 * against the CreateTest.xml and UpdateTest.xml test fixtures.
 *
 * XStream in Java serialises all fields as XML elements unless `useAttributeFor`
 * is called — several fields are rendered as XML attributes rather than children:
 *   - Initialize.Type, StartVusers.Type, StopVusers.Type, Duration.Type
 *   - StartNewIteration.Type  (and optional delay attributes)
 *   - ThinkTime.Type, Log.Type
 */

import { escapeXml } from '../models';
import {
    ParsedYamlTest,
    SimplifiedContent,
    SimplifiedGroup,
    SimplifiedElasticConfiguration,
    SimplifiedJavaVM,
    SimplifiedJMeter,
    SimplifiedPacing,
    SimplifiedThinkTime,
    SimplifiedSelenium
} from './SimplifiedModels';

/** Threshold constants from the Java SchedulerFactory */
const MIN_RAMP_INTERVAL_SECS = 15;

/**
 * Coerce a YAML value that may have been parsed as a string (e.g. `vusers: '2'`)
 * into a real number.  Returns `fallback` when the value is undefined, null, or NaN.
 */
function toNum(val: unknown, fallback = 0): number {
    if (val === undefined || val === null) return fallback;
    const n = Number(val);
    return isNaN(n) ? fallback : n;
}

export class TestContentXmlBuilder {

    /**
     * Build the full <Test> XML for POST /tests.
     */
    static buildTestXml(parsed: ParsedYamlTest): string {
        const contentXml = this.buildContentInner(parsed.content);
        return (
            `<Test xmlns="http://www.hp.com/PC/REST/API">` +
            `<Name>${escapeXml(parsed.testName)}</Name>` +
            `<TestFolderPath>${escapeXml(parsed.testFolderPathWithSubject)}</TestFolderPath>` +
            contentXml +
            `</Test>`
        );
    }

    /**
     * Build the standalone <Content> XML for PUT /tests/{id}.
     */
    static buildContentXml(content: SimplifiedContent): string {
        return (
            `<Content xmlns="http://www.hp.com/PC/REST/API">` +
            this.buildContentInner(content).replace(/^<Content>|<\/Content>$/g, '') +
            `</Content>`
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Content
    // ─────────────────────────────────────────────────────────────────────────

    private static buildContentInner(content: SimplifiedContent): string {
        const isManual = this.isManualLgDistribution(content);
        const lgAmount = isManual ? 0 : (content.lg_amount || 1);

        const parts: string[] = [];
        parts.push('<Content>');

        if (content.controller) {
            parts.push(`<Controller>${escapeXml(content.controller)}</Controller>`);
        }

        parts.push(this.buildWorkloadType());
        parts.push(this.buildLGDistribution(isManual, lgAmount));
        parts.push('<MonitorProfiles/>');
        parts.push(this.buildGroups(content, isManual));
        parts.push(this.buildScheduler(content));
        parts.push('<Diagnostics/>');

        if (content.automatic_trending) {
            parts.push(this.buildAutomaticTrending(
                content.automatic_trending.report_id,
                content.automatic_trending.max_runs_in_report ?? 10
            ));
        }

        if (content.lg_elastic_configuration) {
            parts.push(this.buildElasticLGConfig(content.lg_elastic_configuration));
        }

        if (content.controller_elastic_configuration) {
            parts.push(this.buildElasticControllerConfig(content.controller_elastic_configuration));
        }

        const globalCmdLine = this.buildGlobalCommandLine(content.group);
        if (globalCmdLine) parts.push(globalCmdLine);

        parts.push('</Content>');
        return parts.join('');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // WorkloadType
    // ─────────────────────────────────────────────────────────────────────────

    private static buildWorkloadType(): string {
        return (
            `<WorkloadType>` +
            `<Type>basic</Type>` +
            `<SubType>by test</SubType>` +
            `<VusersDistributionMode>by number</VusersDistributionMode>` +
            `</WorkloadType>`
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LG Distribution
    // ─────────────────────────────────────────────────────────────────────────

    private static isManualLgDistribution(content: SimplifiedContent): boolean {
        if (content.lg_amount && content.lg_amount > 0) return false;
        return content.group.every(g => g.lg_name && g.lg_name.length > 0);
    }

    private static buildLGDistribution(isManual: boolean, amount: number): string {
        if (isManual) {
            return `<LGDistribution><Type>manual</Type></LGDistribution>`;
        }
        return (
            `<LGDistribution>` +
            `<Type>all to each group</Type>` +
            `<Amount>${amount}</Amount>` +
            `</LGDistribution>`
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Groups
    // ─────────────────────────────────────────────────────────────────────────

    private static buildGroups(content: SimplifiedContent, isManual: boolean): string {
        const groupXmls = content.group.map((g, idx) =>
            this.buildGroup(g, idx + 1, isManual)
        );
        return `<Groups>${groupXmls.join('')}</Groups>`;
    }

    private static buildGroup(g: SimplifiedGroup, idx: number, isManual: boolean): string {
        const name = g.group_name || `Group_${idx}`;
        const vusers = Math.max(1, toNum(g.vusers, 1));
        const scriptId = toNum(g.script_id, 0);

        const parts: string[] = [];
        parts.push('<Group>');
        parts.push(`<Name>${escapeXml(name)}</Name>`);
        parts.push(`<Vusers>${vusers}</Vusers>`);
        parts.push(`<Script><ID>${scriptId}</ID></Script>`);

        if (isManual && g.lg_name && g.lg_name.length > 0) {
            parts.push(this.buildHosts(g.lg_name));
        }

        parts.push(this.buildRTS(g));

        // Reference to GlobalCommandLine section (just the group name)
        if (g.command_line) {
            parts.push(`<GlobalCommandLine>${escapeXml(name)}</GlobalCommandLine>`);
        }

        parts.push('</Group>');
        return parts.join('');
    }

    private static buildHosts(lgNames: string[]): string {
        const hosts = lgNames.map(lg => {
            let hostType: string;
            if (/^LG\d+$/i.test(lg)) {
                hostType = 'automatch';
            } else if (/^DOCKER\d+$/i.test(lg)) {
                hostType = 'dynamic';
            } else {
                hostType = 'specific';
            }
            return `<Host><Name>${escapeXml(lg)}</Name><Type>${hostType}</Type></Host>`;
        });
        return `<Hosts>${hosts.join('')}</Hosts>`;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RTS
    // ─────────────────────────────────────────────────────────────────────────

    private static buildRTS(g: SimplifiedGroup): string {
        const rts = g.rts;
        const parts: string[] = ['<RTS>'];

        // Pacing
        if (rts?.pacing) {
            const p = this.buildPacing(rts.pacing);
            if (p) parts.push(p);
        } else {
            // Default: 1 iteration, immediately
            parts.push(
                `<Pacing>` +
                `<NumberOfIterations>1</NumberOfIterations>` +
                `<StartNewIteration Type="immediately"/>` +
                `</Pacing>`
            );
        }

        // ThinkTime
        if (rts?.thinktime) {
            const tt = this.buildThinkTime(rts.thinktime);
            if (tt) parts.push(tt);
        }

        // Log (always add a default disable log)
        parts.push(
            `<Log Type="disable">` +
            `<ParametersSubstituion>false</ParametersSubstituion>` +
            `<DataReturnedByServer>false</DataReturnedByServer>` +
            `<AdvanceTrace>false</AdvanceTrace>` +
            `</Log>`
        );

        // JavaVM
        if (rts?.java_vm) parts.push(this.buildJavaVM(rts.java_vm));

        // JMeter
        if (rts?.jmeter) parts.push(this.buildJMeter(rts.jmeter));

        // Selenium
        if (rts?.selenium) parts.push(this.buildSelenium(rts.selenium));

        parts.push('</RTS>');
        return parts.join('');
    }

    private static buildPacing(p: SimplifiedPacing): string | null {
        const iterations = Math.max(1, toNum(p.number_of_iterations, 1));
        if (iterations <= 0) return null;

        const type = (p.type || 'immediately').toLowerCase();
        const delay = toNum(p.delay, 0);
        const delayRange = toNum(p.delay_random_range, 0);
        let startNewIteration: string;

        if (
            (type === 'fixed delay' || type === 'fixed interval') &&
            delay > 0
        ) {
            startNewIteration = `<StartNewIteration Type="${escapeXml(type)}" DelayAtRangeOf="${delay}"/>`;
        } else if (
            (type === 'random delay' || type === 'random interval') &&
            delay > 0 &&
            delayRange > 0
        ) {
            const from = delay;
            const to = delay + delayRange;
            startNewIteration =
                `<StartNewIteration Type="${escapeXml(type)}" DelayAtRangeOf="${from}" DelayAtRangeTo="${to}"/>`;
        } else {
            startNewIteration = `<StartNewIteration Type="immediately"/>`;
        }

        return (
            `<Pacing>` +
            `<NumberOfIterations>${iterations}</NumberOfIterations>` +
            startNewIteration +
            `</Pacing>`
        );
    }

    private static buildThinkTime(tt: SimplifiedThinkTime): string | null {
        const type = (tt.type || 'ignore').toLowerCase();

        switch (type) {
            case 'ignore':
                return `<ThinkTime Type="ignore"/>`;
            case 'replay':
                return tt.limit_seconds
                    ? `<ThinkTime Type="replay"><LimitSeconds>${toNum(tt.limit_seconds)}</LimitSeconds></ThinkTime>`
                    : `<ThinkTime Type="replay"/>`;
            case 'modify':
                return (
                    `<ThinkTime Type="modify">` +
                    (tt.limit_seconds ? `<LimitSeconds>${tt.limit_seconds}</LimitSeconds>` : '') +
                    (tt.multiply_factor ? `<MultiplyFactor>${tt.multiply_factor}</MultiplyFactor>` : '') +
                    `</ThinkTime>`
                );
            case 'random':
                return (
                    `<ThinkTime Type="random">` +
                    (tt.min_percentage ? `<MinPercentage>${tt.min_percentage}</MinPercentage>` : '') +
                    (tt.max_percentage ? `<MaxPercentage>${tt.max_percentage}</MaxPercentage>` : '') +
                    (tt.limit_seconds ? `<LimitSeconds>${tt.limit_seconds}</LimitSeconds>` : '') +
                    `</ThinkTime>`
                );
            default:
                return `<ThinkTime Type="ignore"/>`;
        }
    }

    private static buildJavaVM(jvm: SimplifiedJavaVM): string {
        const parts: string[] = ['<JavaVM>'];

        if (jvm.jdk_home) {
            parts.push(
                `<UserSpecifiedJdk>true</UserSpecifiedJdk>` +
                `<JdkHome>${escapeXml(jvm.jdk_home)}</JdkHome>`
            );
        } else {
            parts.push(`<UserSpecifiedJdk>false</UserSpecifiedJdk>`);
        }

        if (jvm.java_vm_parameters) {
            parts.push(`<JavaVmParameters>${escapeXml(jvm.java_vm_parameters)}</JavaVmParameters>`);
        }

        parts.push(`<UseXboot>${jvm.use_xboot ? 'true' : 'false'}</UseXboot>`);
        parts.push(`<EnableClassloaderPerVuser>${jvm.enable_classloader_per_vuser ? 'true' : 'false'}</EnableClassloaderPerVuser>`);

        if (jvm.java_env_class_paths && jvm.java_env_class_paths.length > 0) {
            const paths = jvm.java_env_class_paths
                .map(p => `<JavaEnvClassPath>${escapeXml(p)}</JavaEnvClassPath>`)
                .join('');
            parts.push(`<JavaEnvClassPaths>${paths}</JavaEnvClassPaths>`);
        }

        parts.push('</JavaVM>');
        return parts.join('');
    }

    private static buildJMeter(jm: SimplifiedJMeter): string {
        const useDefaultPort = !(
            jm.jmeter_min_port && jm.jmeter_max_port &&
            jm.jmeter_min_port > 0 && jm.jmeter_max_port > jm.jmeter_min_port
        );

        const parts: string[] = ['<JMeter>'];
        parts.push(`<StartMeasurements>${jm.start_measurements ? 'true' : 'false'}</StartMeasurements>`);

        if (jm.jmeter_home_path) {
            parts.push(`<JMeterHomePath>${escapeXml(jm.jmeter_home_path)}</JMeterHomePath>`);
        }

        parts.push(`<UseDefaultPort>${useDefaultPort ? 'true' : 'false'}</UseDefaultPort>`);

        if (!useDefaultPort) {
            parts.push(`<MinPort>${jm.jmeter_min_port}</MinPort>`);
            parts.push(`<MaxPort>${jm.jmeter_max_port}</MaxPort>`);
        }

        if (jm.jmeter_additional_properties) {
            parts.push(`<UseJMeterAdditionalProperties>true</UseJMeterAdditionalProperties>`);
            parts.push(`<JMeterAdditionalProperties>${escapeXml(jm.jmeter_additional_properties)}</JMeterAdditionalProperties>`);
        } else {
            parts.push(`<UseJMeterAdditionalProperties>false</UseJMeterAdditionalProperties>`);
        }

        parts.push('</JMeter>');
        return parts.join('');
    }

    private static buildSelenium(sel: SimplifiedSelenium): string {
        return (
            `<Selenium>` +
            (sel.jre_path ? `<JrePath>${escapeXml(sel.jre_path)}</JrePath>` : '') +
            (sel.class_path ? `<ClassPath>${escapeXml(sel.class_path)}</ClassPath>` : '') +
            (sel.test_ng_files ? `<TestNGFiles>${escapeXml(sel.test_ng_files)}</TestNGFiles>` : '') +
            `</Selenium>`
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scheduler
    // ─────────────────────────────────────────────────────────────────────────

    private static buildScheduler(content: SimplifiedContent): string {
        const rampup = toNum(content.scheduler?.rampup, 0);
        const duration = toNum(content.scheduler?.duration, 0);

        const initAction = `<Action><Initialize Type="just before vuser runs"/></Action>`;
        const startAction = this.buildStartVusersAction(rampup, content.group);
        const durationAction = this.buildDurationAction(duration);
        const stopAction = `<Action><StopVusers Type="simultaneously"/></Action>`;

        return (
            `<Scheduler><Actions>` +
            initAction +
            startAction +
            durationAction +
            stopAction +
            `</Actions></Scheduler>`
        );
    }

    private static buildStartVusersAction(rampup: number, groups: SimplifiedGroup[]): string {
        if (rampup > 30) {
            const totalVusers = groups.reduce((sum, g) => sum + Math.max(1, toNum(g.vusers, 1)), 0);
            const exactInterval = rampup / totalVusers;

            let vusers = 1;
            let intervalSecs = Math.floor(exactInterval);

            if (exactInterval < MIN_RAMP_INTERVAL_SECS && exactInterval > 0) {
                vusers = Math.ceil(MIN_RAMP_INTERVAL_SECS / exactInterval);
                intervalSecs = MIN_RAMP_INTERVAL_SECS;
            }

            const ti = this.secondsToTimeInterval(intervalSecs);
            return (
                `<Action><StartVusers Type="gradually">` +
                `<Ramp>` +
                `<Vusers>${vusers}</Vusers>` +
                this.buildTimeInterval(ti) +
                `</Ramp>` +
                `</StartVusers></Action>`
            );
        } else if (rampup > 1) {
            const totalVusers = groups.reduce((sum, g) => sum + Math.max(1, toNum(g.vusers, 1)), 0);
            const intervalSecs = Math.floor(rampup / 2);
            const vusers = Math.ceil(totalVusers / 2);
            const ti = this.secondsToTimeInterval(intervalSecs);
            return (
                `<Action><StartVusers Type="gradually">` +
                `<Ramp>` +
                `<Vusers>${vusers}</Vusers>` +
                this.buildTimeInterval(ti) +
                `</Ramp>` +
                `</StartVusers></Action>`
            );
        } else {
            return `<Action><StartVusers Type="simultaneously"/></Action>`;
        }
    }

    private static buildDurationAction(durationSecs: number): string {
        if (durationSecs > 0) {
            const ti = this.secondsToTimeInterval(durationSecs);
            return (
                `<Action><Duration Type="run for">` +
                this.buildTimeInterval(ti) +
                `</Duration></Action>`
            );
        }
        return `<Action><Duration Type="until completion"/></Action>`;
    }

    private static secondsToTimeInterval(totalSeconds: number): {
        days: number; hours: number; minutes: number; seconds: number;
    } {
        const days    = Math.floor(totalSeconds / 86400);
        const hours   = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return { days, hours, minutes, seconds };
    }

    private static buildTimeInterval(ti: { days: number; hours: number; minutes: number; seconds: number }): string {
        return (
            `<TimeInterval>` +
            `<Days>${ti.days}</Days>` +
            `<Hours>${ti.hours}</Hours>` +
            `<Minutes>${ti.minutes}</Minutes>` +
            `<Seconds>${ti.seconds}</Seconds>` +
            `</TimeInterval>`
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AutomaticTrending / Elastic / GlobalCommandLine
    // ─────────────────────────────────────────────────────────────────────────

    private static buildAutomaticTrending(reportId: number, maxRuns: number): string {
        return (
            `<AutomaticTrending>` +
            `<ReportId>${reportId}</ReportId>` +
            `<MaxRunsInReport>${maxRuns}</MaxRunsInReport>` +
            `<TrendRangeType>CompleteRun</TrendRangeType>` +
            `<MaxRunsReachedOption>DeleteFirstSetNewBaseline</MaxRunsReachedOption>` +
            `</AutomaticTrending>`
        );
    }

    private static buildElasticLGConfig(cfg: SimplifiedElasticConfiguration): string {
        return (
            `<ElasticLoadGeneratorConfiguration>` +
            `<ImageId>${cfg.image_id}</ImageId>` +
            (cfg.memory_limit ? `<MemoryLimit>${cfg.memory_limit}</MemoryLimit>` : '') +
            (cfg.cpu_limit ? `<CpuLimit>${cfg.cpu_limit}</CpuLimit>` : '') +
            `</ElasticLoadGeneratorConfiguration>`
        );
    }

    private static buildElasticControllerConfig(cfg: SimplifiedElasticConfiguration): string {
        return (
            `<ElasticControllerConfiguration>` +
            `<ImageId>${cfg.image_id}</ImageId>` +
            (cfg.memory_limit ? `<MemoryLimit>${cfg.memory_limit}</MemoryLimit>` : '') +
            (cfg.cpu_limit ? `<CpuLimit>${cfg.cpu_limit}</CpuLimit>` : '') +
            `</ElasticControllerConfiguration>`
        );
    }

    private static buildGlobalCommandLine(groups: SimplifiedGroup[]): string | null {
        const withCmd = groups.filter(g => g.command_line);
        if (withCmd.length === 0) return null;

        const lines = withCmd.map(g =>
            `<CommandLine>` +
            `<Name>${escapeXml(g.group_name ?? '')}</Name>` +
            `<Value>${escapeXml(g.command_line ?? '')}</Value>` +
            `</CommandLine>`
        );

        return `<GlobalCommandLine>${lines.join('')}</GlobalCommandLine>`;
    }
}

