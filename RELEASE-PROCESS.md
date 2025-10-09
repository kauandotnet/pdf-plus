# Release Process Guide

This document describes the automated release process for `pdf-plus` package.

## 📋 Overview

The release process is **fully automated** via GitHub Actions. When you push a version tag, the CI/CD pipeline automatically:

1. ✅ Runs full validation (typecheck, lint, tests)
2. 🏗️ Builds the package
3. 📦 Creates a GitHub Release
4. 🚀 Publishes to npm registry

## 🔄 Release Workflow

### Step 1: Make Your Changes

1. Create a feature branch and make your changes
2. Stage your changes:
   ```bash
   git add <files>
   ```

### Step 2: Commit Your Changes

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```bash
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug"
git commit -m "docs: update documentation"
```

**Commit Types:**
- `feat:` - New features (minor version bump)
- `fix:` - Bug fixes (patch version bump)
- `docs:` - Documentation only
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test updates
- `chore:` - Maintenance tasks
- `BREAKING CHANGE:` - Breaking changes (major version bump)

### Step 3: Version Bump

Use npm's built-in version command to bump the version and create a git tag:

```bash
# For patch releases (1.2.2 → 1.2.3) - bug fixes
npm version patch -m "chore: release v%s"

# For minor releases (1.2.2 → 1.3.0) - new features
npm version minor -m "chore: release v%s"

# For major releases (1.2.2 → 2.0.0) - breaking changes
npm version major -m "chore: release v%s"
```

This command will:
- ✅ Update `package.json` version
- ✅ Create a commit with the version change
- ✅ Create a git tag (e.g., `v1.3.0`)

### Step 4: Update CHANGELOG (Optional but Recommended)

Before pushing, update `CHANGELOG.md` with the new version details:

```markdown
## [1.3.0] - 2025-10-09

### Added
- New `generatePageImages()` convenience function
- Simplified page-to-image conversion API

### Changed
- Updated README with new API documentation
```

If you update the changelog, amend the version commit:
```bash
git add CHANGELOG.md
git commit --amend --no-edit
```

### Step 5: Push to Remote

Push both the commits and the tag:

```bash
git push && git push --tags
```

**⚠️ IMPORTANT:** Pushing the tag triggers the automated release!

### Step 6: Automated Release (GitHub Actions)

Once the tag is pushed, GitHub Actions automatically:

1. **Validates the code** (`.github/workflows/release.yml`):
   - Runs `pnpm run typecheck`
   - Runs `pnpm run lint`
   - Runs `pnpm run test:unit`
   - Runs `pnpm run build`

2. **Verifies build artifacts**:
   - Checks `dist/index.js`
   - Checks `dist/index.mjs`
   - Checks `dist/index.d.ts`
   - Checks `dist/index.d.mts`

3. **Creates GitHub Release**:
   - Extracts version from tag
   - Creates release notes
   - Attaches to the tag

4. **Publishes to npm**:
   - Runs `pnpm publish --access public`
   - Uses `NPM_TOKEN` secret for authentication

## 🎯 Quick Reference

### Complete Release Command Sequence

```bash
# 1. Stage your changes
git add <files>

# 2. Commit with conventional commit message
git commit -m "feat: add new feature"

# 3. Bump version and create tag (choose one)
npm version patch -m "chore: release v%s"   # 1.2.2 → 1.2.3
npm version minor -m "chore: release v%s"   # 1.2.2 → 1.3.0
npm version major -m "chore: release v%s"   # 1.2.2 → 2.0.0

# 4. (Optional) Update CHANGELOG.md and amend
git add CHANGELOG.md
git commit --amend --no-edit

# 5. Push commits and tags (triggers automated release)
git push && git push --tags
```

### Version Bump Guidelines

| Change Type | Version Bump | Example | Command |
|-------------|--------------|---------|---------|
| Bug fixes, patches | Patch | 1.2.2 → 1.2.3 | `npm version patch` |
| New features (backward compatible) | Minor | 1.2.2 → 1.3.0 | `npm version minor` |
| Breaking changes | Major | 1.2.2 → 2.0.0 | `npm version major` |

## 🔍 Monitoring the Release

### Check GitHub Actions

1. Go to: https://github.com/kauandotnet/pdfnode/actions
2. Look for the "Release" workflow
3. Monitor the progress

### Verify npm Publication

After the workflow completes:

```bash
# Check the latest version on npm
npm view pdf-plus version

# Install the new version
npm install pdf-plus@latest
```

### Check GitHub Releases

Visit: https://github.com/kauandotnet/pdfnode/releases

## 🛠️ CI/CD Configuration

### Release Workflow (`.github/workflows/release.yml`)

**Trigger:** Push tags matching `v*` pattern

**Jobs:**
1. Checkout code
2. Setup pnpm and Node.js
3. Install dependencies
4. Run validation (typecheck, lint, test, build)
5. Verify build artifacts
6. Create GitHub Release
7. Publish to npm

**Required Secrets:**
- `NPM_TOKEN` - npm authentication token (already configured)
- `GITHUB_TOKEN` - Automatically provided by GitHub

### CI Workflow (`.github/workflows/ci.yml`)

**Trigger:** Push to `main` or `develop` branches, or pull requests

**Jobs:**
1. Test on Node.js 18.x, 20.x, 22.x
2. Build check
3. Package installation test

## 🚨 Troubleshooting

### Release Failed

1. Check GitHub Actions logs
2. Common issues:
   - Tests failing
   - Lint errors
   - Build errors
   - Missing build artifacts

### Tag Already Exists

If you need to re-release:

```bash
# Delete local tag
git tag -d v1.3.0

# Delete remote tag
git push origin :refs/tags/v1.3.0

# Create new tag
npm version <patch|minor|major> -m "chore: release v%s"

# Push again
git push && git push --tags
```

### npm Publish Failed

1. Check if `NPM_TOKEN` secret is valid
2. Verify package name is available
3. Check npm registry status

## 📝 Pre-Release Checklist

Before releasing, ensure:

- [ ] All tests pass locally (`pnpm run test`)
- [ ] Code is linted (`pnpm run lint`)
- [ ] TypeScript compiles (`pnpm run typecheck`)
- [ ] Build succeeds (`pnpm run build`)
- [ ] CHANGELOG.md is updated
- [ ] README.md reflects new changes
- [ ] Examples are updated (if needed)
- [ ] Breaking changes are documented

## 🎓 Best Practices

1. **Always test locally first**
   ```bash
   pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build
   ```

2. **Use semantic versioning correctly**
   - Patch: Bug fixes only
   - Minor: New features, backward compatible
   - Major: Breaking changes

3. **Write clear commit messages**
   - Use conventional commits format
   - Be descriptive but concise

4. **Update documentation**
   - Keep README.md current
   - Update CHANGELOG.md
   - Add examples for new features

5. **Monitor the release**
   - Watch GitHub Actions
   - Verify npm publication
   - Test the published package

## 📚 Additional Resources

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [npm version documentation](https://docs.npmjs.com/cli/v9/commands/npm-version)

## 🔗 Related Files

- `.github/workflows/release.yml` - Release automation
- `.github/workflows/ci.yml` - Continuous integration
- `CHANGELOG.md` - Version history
- `CONTRIBUTING.md` - Contribution guidelines
- `package.json` - Package configuration

