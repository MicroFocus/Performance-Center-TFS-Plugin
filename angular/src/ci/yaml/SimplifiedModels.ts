/**
 * Simplified YAML model interfaces — TypeScript equivalents of the Java
 * com.microfocus.adm.performancecenter.plugins.common.pcentities.simplifiedentities hierarchy.
 *
 * These models represent the user-facing YAML schema for LRE test creation.
 * Field names intentionally use snake_case to match the YAML keys exactly.
 */

// ─── RTS sub-models ──────────────────────────────────────────────────────────

export interface SimplifiedPacing {
    /** Must be a positive number. Default: 1 */
    number_of_iterations?: number;
    /** 'immediately' | 'fixed delay' | 'random delay' | 'fixed interval' | 'random interval' */
    type?: string;
    /** Non-negative seconds — required for fixed/random delay or interval. */
    delay?: number;
    /** Added to delay to form the upper bound for random types. */
    delay_random_range?: number;
}

export interface SimplifiedThinkTime {
    /** 'ignore' | 'replay' | 'modify' | 'random' */
    type?: string;
    min_percentage?: number;
    max_percentage?: number;
    limit_seconds?: number;
    multiply_factor?: number;
}

export interface SimplifiedJavaVM {
    jdk_home?: string;
    java_vm_parameters?: string;
    use_xboot?: boolean;
    enable_classloader_per_vuser?: boolean;
    java_env_class_paths?: string[];
}

export interface SimplifiedJMeter {
    start_measurements?: boolean;
    jmeter_home_path?: string;
    jmeter_min_port?: number;
    jmeter_max_port?: number;
    jmeter_additional_properties?: string;
}

export interface SimplifiedSelenium {
    jre_path?: string;
    class_path?: string;
    test_ng_files?: string;
}

export interface SimplifiedRTS {
    pacing?: SimplifiedPacing;
    thinktime?: SimplifiedThinkTime;
    java_vm?: SimplifiedJavaVM;
    jmeter?: SimplifiedJMeter;
    selenium?: SimplifiedSelenium;
}

// ─── Group / Content ─────────────────────────────────────────────────────────

export interface SimplifiedGroup {
    /** Default: derived from script name + index */
    group_name?: string;
    /** Number of virtual users. Default: 1 */
    vusers?: number;
    /** Script ID in LRE. Required if script_path not provided. */
    script_id?: number;
    /** Path within Subject (double backslash separators). Required if script_id not provided. */
    script_path?: string;
    /** List of LG hostnames / LG1 / DOCKER1 names. */
    lg_name?: string[];
    /** Command line applied to this group. */
    command_line?: string;
    rts?: SimplifiedRTS;

    // ── fields populated during script resolution ─────────────────────────
    /** Resolved from API when script_path is used. */
    protocol?: string;
}

export interface SimplifiedScheduler {
    /** Seconds to gradually ramp up virtual users. 0 = simultaneous start. */
    rampup?: number;
    /** Test duration in seconds. 0 = run until completion. */
    duration?: number;
}

export interface SimplifiedAutomaticTrending {
    report_id: number;
    max_runs_in_report?: number;
}

export interface SimplifiedElasticConfiguration {
    image_id: number;
    memory_limit?: number;
    cpu_limit?: number;
}

export interface SimplifiedContent {
    /** Controller hostname. Optional — LRE will auto-select one if omitted. */
    controller?: string;
    /**
     * Number of LGs to allocate to every group.
     * Not required when each group specifies its own lg_name list.
     */
    lg_amount?: number;
    /** One or more script groups. Required. */
    group: SimplifiedGroup[];
    scheduler?: SimplifiedScheduler;
    lg_elastic_configuration?: SimplifiedElasticConfiguration;
    controller_elastic_configuration?: SimplifiedElasticConfiguration;
    automatic_trending?: SimplifiedAutomaticTrending;
}

/**
 * Full test YAML when the YAML file embeds test_name and test_folder_path.
 * When the YAML contains only content-level fields (no test_name / test_folder_path),
 * treat the entire document as a SimplifiedContent.
 */
export interface SimplifiedTest {
    test_name: string;
    test_folder_path: string;
    test_content: SimplifiedContent;
}

// ─── Resolved result used internally by LreTestCreator ───────────────────────

export interface ParsedYamlTest {
    testName: string;
    /** Clean folder path without 'Subject\\' prefix — e.g. "daniel/tests" */
    testFolderPath: string;
    /** Normalised folder path with correct backslash separator and Subject\\ prefix */
    testFolderPathWithSubject: string;
    content: SimplifiedContent;
}

