/**
 * Quick verification script: test downloading run 16 results and trend 5 PDF
 * This helps verify that the retry mechanism works for reports that may not be immediately available
 */

import { LreClient } from '../PC.TFS.BuildTask/LreCiExtension/LreCiTask/src/lre/LreClient';
import { LreReportDownloader } from '../PC.TFS.BuildTask/LreCiExtension/LreCiTask/src/lre/LreReportDownloader';
import { Logger } from '../PC.TFS.BuildTask/LreCiExtension/LreCiTask/src/utils/Logger';
import { PropertiesLoader, IntegrationTestConfig } from './test-utils/PropertiesLoader';
import * as path from 'path';
import * as fs from 'fs';

async function verifyRun16Reports(): Promise<void> {
    if (!PropertiesLoader.hasPropertiesFile()) {
        console.error('❌ integration-tests.properties not found');
        process.exit(1);
    }

    const config = PropertiesLoader.loadConfig();
    console.log('📋 Configuration loaded');
    console.log(`   Server: ${config.lre.serverUrl}`);
    console.log(`   Project: ${config.lre.domain}/${config.lre.project}`);
    console.log(`   Run ID: 16`);
    console.log(`   Trend Report ID: ${config.trend.reportId}`);

    const artifactsDir = './integration/test-results/run16-verify';
    if (!fs.existsSync(artifactsDir)) {
        fs.mkdirSync(artifactsDir, { recursive: true });
    }

    // Create logger
    const logger = new Logger({
        logDirectory: artifactsDir,
        logFileName: 'verify-run16.log'
    });

    try {
        // Create client
        const client = new LreClient({
            serverUrl: config.lre.serverUrl,
            domain: config.lre.domain,
            project: config.lre.project,
            tenant: config.lre.tenant,
            useToken: config.auth.useToken,
            username: config.auth.username,
            password: config.auth.password,
            clientId: config.auth.clientId,
            clientSecret: config.auth.clientSecret,
            proxyUrl: config.proxy?.url,
            proxyUser: config.proxy?.username,
            proxyPassword: config.proxy?.password
        });

        // Authenticate
        console.log('\n🔐 Authenticating...');
        const authenticated = await client.authenticate();
        if (!authenticated) {
            throw new Error('Authentication failed');
        }
        console.log('✅ Authentication succeeded');

        // Create downloader with retry
        const downloader = new LreReportDownloader(client, logger);

        // Test 1: Download run 16 results with retries
        console.log('\n📥 Test 1: Downloading run 16 results (with retry)...');
        const results = await downloader.downloadRunResults(16, artifactsDir, {
            extractZips: true,
            keepZipFiles: true,
            retryAttempts: 3,
            retryDelayMs: 2000
        });

        if (results.length > 0) {
            console.log(`✅ Successfully downloaded ${results.length} result(s):`);
            results.forEach(r => {
                console.log(`   - Result ID ${r.resultId}: ${r.name}`);
                if (r.extractedPath) {
                    console.log(`     Extracted to: ${r.extractedPath}`);
                }
            });
        } else {
            console.log('⚠️  No results found for run 16 (may be normal depending on post-run action)');
        }

        // Test 2: Download trend 5 PDF with retries
        if (config.trend.reportId && config.trend.reportId > 0) {
            console.log(`\n📥 Test 2: Downloading trend report ${config.trend.reportId} PDF (with retry)...`);
            const pdfPath = await downloader.downloadTrendPdf(
                config.trend.reportId,
                16,
                artifactsDir,
                3,
                2000
            );

            if (pdfPath) {
                const fileSize = fs.statSync(pdfPath).size;
                console.log(`✅ Successfully downloaded trend PDF`);
                console.log(`   Path: ${pdfPath}`);
                console.log(`   Size: ${(fileSize / 1024).toFixed(2)} KB`);
            } else {
                console.log('⚠️  Trend PDF could not be downloaded (may be normal depending on configuration)');
            }
        }

        // Cleanup: logout
        await client.logout();
        console.log('\n✅ Logged out');
        console.log(`\n📁 Test artifacts saved to: ${artifactsDir}`);

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`\n❌ Error: ${msg}`);
        logger.error(msg);
        process.exit(1);
    }
}

verifyRun16Reports();

