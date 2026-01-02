#!/bin/bash
# Guardian CLI Usage Examples (Production-Grade)

# 1. Run Guardian on a target URL (basic reality test)
node bin/guardian.js reality --url https://shop.example.com

# 2. Run Guardian and export evidence to a custom directory
node bin/guardian.js reality --url https://saas.example.com --artifacts-dir ./artifacts/saas-latest

# 3. Run Guardian in quiet mode (for CI logs)
node bin/guardian.js reality --url https://docs.example.com --quiet

# 4. Run Guardian and check exit code for gating
node bin/guardian.js reality --url https://dashboard.example.com
status=$?
if [ $status -eq 2 ]; then
  echo "Guardian verdict: DO_NOT_LAUNCH. Blocking deploy."
  exit 1
elif [ $status -eq 1 ]; then
  echo "Guardian verdict: FRICTION. Review required."
  # Optionally: exit 1 to block, or continue
else
  echo "Guardian verdict: READY. Proceeding."
fi
