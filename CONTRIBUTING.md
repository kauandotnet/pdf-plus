# Contributing to pdf-plus

Thank you for your interest in contributing to pdf-plus! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- Node.js 18.0.0 or higher
- pnpm (recommended) or npm
- Git

### Getting Started

1. Fork the repository
2. Clone your fork:

   ```bash
   git clone https://github.com/your-username/pdf-plus.git
   cd pdf-plus
   ```

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Run the development setup:
   ```bash
   pnpm run dev
   ```

## Development Workflow

### Code Style

We use Biome for linting and formatting. Please ensure your code follows our style guidelines:

```bash
# Check code style
pnpm run lint

# Auto-fix issues
pnpm run lint:fix

# Format code
pnpm run format:fix
```

### Testing

We maintain comprehensive test coverage. Please add tests for new features:

```bash
# Run all tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run tests with coverage
pnpm run test:coverage

# Run specific test suites
pnpm run test:unit
pnpm run test:integration
```

### Building

```bash
# Build the library
pnpm run build

# Clean build artifacts
pnpm run clean

# Type check without building
pnpm run typecheck
```

## Contribution Guidelines

### Pull Request Process

1. Create a feature branch from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our coding standards
3. Add or update tests as needed
4. Update documentation if required
5. Ensure all checks pass:

   ```bash
   pnpm run validate
   ```

6. Commit your changes with a clear message:

   ```bash
   git commit -m "feat: add new extraction feature"
   ```

7. Push to your fork and create a pull request

### Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### Code Review

All submissions require review. We use GitHub pull requests for this purpose. Please:

- Keep PRs focused and atomic
- Write clear descriptions
- Respond to feedback promptly
- Update your branch if needed

## Project Structure

```
src/
├── core/           # Main extractor logic
├── extractors/     # Specialized extractors
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── index.ts        # Main entry point

tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
└── fixtures/       # Test fixtures

examples/           # Usage examples
docs/              # Documentation
.github/           # GitHub workflows and templates
```

## Adding New Features

### New Extraction Engines

1. Create a new engine class extending `BaseImageEngine`
2. Implement required methods
3. Add engine to `ImageEngineFactory`
4. Add comprehensive tests
5. Update documentation

### New Extraction Options

1. Add option to `ExtractionOptions` interface
2. Update validation logic
3. Implement feature in relevant extractors
4. Add tests and documentation
5. Update examples

## Reporting Issues

When reporting issues, please include:

- Node.js version
- Package version
- Operating system
- Minimal reproduction case
- Expected vs actual behavior
- Error messages and stack traces

## Questions and Support

- Check existing [issues](https://github.com/kauandotnet/pdf-plus/issues)
- Create a new issue for bugs or feature requests
- Use discussions for questions and general support

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
