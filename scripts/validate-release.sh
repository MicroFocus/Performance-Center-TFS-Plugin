#!/bin/bash
#
# Validates the release/deploy.txt file format
# Usage: ./scripts/validate-release.sh
#

DEPLOY_FILE="release/deploy.txt"

if [ ! -f "$DEPLOY_FILE" ]; then
    echo "❌ Error: $DEPLOY_FILE not found!"
    exit 1
fi

echo "📋 Validating $DEPLOY_FILE..."
echo ""

# Extract values
ENABLED=$(grep "^enabled=" "$DEPLOY_FILE" | cut -d'=' -f2 | tr -d ' ')
VERSION=$(grep "^version=" "$DEPLOY_FILE" | cut -d'=' -f2 | tr -d ' ')

# Validate enabled exists
if [ -z "$ENABLED" ]; then
    echo "❌ Error: 'enabled' property not found"
    exit 1
else
    echo "✅ enabled = $ENABLED"
fi

# Validate version exists
if [ -z "$VERSION" ]; then
    echo "❌ Error: 'version' property not found"
    exit 1
else
    echo "✅ version = $VERSION"
fi

# Validate version format (semantic versioning X.Y.Z)
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "❌ Error: Version '$VERSION' is not in semantic versioning format (X.Y.Z)"
    exit 1
else
    echo "✅ Version format is valid (semantic versioning)"
fi

# Validate enabled value
if [ "$ENABLED" != "true" ] && [ "$ENABLED" != "false" ]; then
    echo "❌ Error: 'enabled' must be 'true' or 'false', got '$ENABLED'"
    exit 1
else
    echo "✅ Enabled value is valid"
fi

echo ""
if [ "$ENABLED" = "true" ]; then
    echo "⚠️  WARNING: Release is enabled! When you push this file, a release will be created."
    echo "   Version: $VERSION"
else
    echo "ℹ️  Release is disabled (enabled=false)"
fi

echo ""
echo "✅ All validations passed!"
exit 0

