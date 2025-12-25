# Guardian Configuration

This directory contains all Guardian configuration files.

## Structure

```
config/
├── guardian.config.json    # Main Guardian configuration
├── guardian.policy.json    # Testing policy and failure thresholds
└── profiles/               # Pre-configured profiles for different use cases
    ├── docs.yaml           # Documentation site profile
    ├── ecommerce.yaml      # E-commerce/Shop profile
    ├── landing-demo.yaml   # Landing page profile
    ├── marketing.yaml      # Marketing site profile
    └── saas.yaml           # SaaS application profile
```

## Files

### guardian.config.json
Main configuration file that controls:
- Base URL for testing
- Test mode (SAFE/NORMAL)
- Page crawling limits (maxPages, maxDepth)
- Performance thresholds
- Safety rules (URL patterns, selectors to avoid)
- Artifact output directory

### guardian.policy.json
Defines testing policies:
- Failure severity thresholds
- Maximum allowed warnings/errors
- Regression detection settings
- Baseline requirements

### Profiles (profiles/*.yaml)
Pre-configured profiles for specific website types:
- **docs.yaml**: For documentation sites (40 pages, 5 depth)
- **ecommerce.yaml**: For e-commerce (35 pages, 4 depth, with revenue tracking)
- **landing-demo.yaml**: For landing pages (20 pages, 2 depth)
- **marketing.yaml**: For marketing sites (20 pages, 3 depth)
- **saas.yaml**: For SaaS apps (25 pages, 3 depth, with auth)

## Usage

Guardian automatically discovers these files in the following order:
1. `config/guardian.policy.json` (preferred)
2. `guardian.policy.json` (legacy)
3. `.odavl-guardian/guardian.policy.json` (CI/CD)

## Customization

Edit these files to:
- Adjust safety rules and URL patterns
- Change policy severity thresholds
- Modify performance baselines
- Configure auth requirements
- Set revenue tracking paths
