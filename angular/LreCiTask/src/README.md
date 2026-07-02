# TypeScript Source Directory

This directory contains the pure TypeScript implementation of the LRE Azure DevOps extension.

## Structure

```
src/
├── lre/                      # LRE-specific client modules
│   ├── LreClient.ts         # HTTP client for LRE REST API
│   ├── LreAuthenticator.ts  # Authentication logic
│   ├── LreTestRunner.ts     # Test execution orchestration
│   └── LreReportDownloader.ts # Report download & extraction
├── models/                   # TypeScript interfaces
│   └── index.ts             # All LRE entity types
├── utils/                    # Utility modules
│   ├── Logger.ts            # Logging wrapper
│   ├── ArtifactManager.ts   # File/artifact handling
│   └── XmlUtils.ts          # XML serialization
└── task.ts                   # Main task entry (future)
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode
npm run watch

# Run tests
npm test

# Lint
npm lint
```
