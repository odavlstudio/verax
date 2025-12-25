# Test Configurations

Configuration files used for running automated tests.

## Files

### default.json
Default test configuration for basic testing scenarios.
- Base URL: the-internet.herokuapp.com
- Mode: SAFE (blocks dangerous actions)
- Max Pages: 10
- Max Depth: 2
- Allows login and form_authentication paths

### blocked.json
Test configuration with strict blocking rules.
- Base URL: the-internet.herokuapp.com
- Mode: SAFE
- Max Pages: 3
- Max Depth: 1
- Blocks login and form_authentication paths
- All form submissions blocked by default

## Usage

Reference these configurations in test scripts:

```javascript
const defaultConfig = require('./configs/default.json');
const blockedConfig = require('./configs/blocked.json');
```

## Adding New Configurations

1. Create a new `.json` file in this directory
2. Define baseUrl, mode, and safety rules
3. Reference it in your test scripts
4. Document the purpose in this README
