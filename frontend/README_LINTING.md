# ESLint and Prettier Setup

This document describes the linting and formatting setup for the GeistAI frontend project.

## Overview

The project uses ESLint with Prettier integration to ensure consistent code formatting and catch
potential issues. The configuration is optimized for React Native/Expo development with TypeScript.

## Configuration Files

- **`eslint.config.js`** - Main ESLint configuration with custom rules
- **`.prettierrc.json`** - Prettier formatting configuration
- **`.prettierignore`** - Files to exclude from Prettier formatting
- **`.editorconfig`** - Editor-agnostic formatting rules
- **`.vscode/settings.json`** - VS Code specific settings for auto-formatting

## Key Features

### ESLint Rules

- **Prettier Integration**: Automatic code formatting on save
- **TypeScript Support**: Type-aware linting with `@typescript-eslint`
- **React Hooks**: Enforces hooks rules and dependency arrays
- **React Native**: Specific rules for React Native development
- **Import Organization**: Automatic import sorting and grouping

### Formatting Rules

- Single quotes for strings
- Trailing commas where valid
- 2-space indentation
- 80-character line limit
- Semicolons required
- Proper spacing and brackets

## Available Scripts

```bash
# Run ESLint to check for issues
npm run lint

# Automatically fix ESLint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check if code is properly formatted
npm run format:check

# Run TypeScript type checking
npm run type-check

# Run all checks (type-check, lint, format)
npm run check-all

# Fix all issues (type-check, lint:fix, format)
npm run fix-all
```

## VS Code Integration

The project includes VS Code settings that will:

- Format code on save
- Run ESLint fixes on save
- Organize imports automatically
- Use Prettier as the default formatter

### Recommended Extensions

- ESLint (`ms-vscode.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- React Native Tools (`ms-vscode.vscode-react-native`)

## Current Status

✅ **Setup Complete**: All configuration files in place ✅ **Dependencies Installed**: All required
ESLint and Prettier packages ✅ **Formatting Fixed**: All critical formatting issues resolved ✅
**expo-av Removed**: Unused dependency cleaned up

### Remaining Warnings (199 total)

Most remaining warnings are intentional and don't require fixes:

- `no-console` warnings in debug/test files (acceptable)
- `react-native/no-inline-styles` warnings (may be acceptable for one-off styles)
- `react-native/no-color-literals` warnings (can be addressed by moving to theme)
- Unused variables in development code (can be prefixed with `_` to ignore)

## Best Practices

1. **Format on Save**: Enable in your editor for automatic formatting
2. **Run Checks**: Use `npm run check-all` before committing
3. **Fix Issues**: Use `npm run fix-all` to automatically resolve fixable issues
4. **Review Warnings**: Address warnings that indicate potential issues
5. **Consistent Imports**: Let ESLint organize your imports automatically

## Troubleshooting

### ESLint Errors

- Run `npm run lint:fix` to automatically fix most issues
- Check the console output for specific rule violations
- Refer to ESLint documentation for rule-specific guidance

### Prettier Conflicts

- The configuration is set up to avoid ESLint/Prettier conflicts
- If issues arise, check `.prettierrc.json` matches ESLint settings
- Use `npm run format` to apply Prettier formatting

### Performance

- Large files may take longer to lint
- Consider using `--cache` flag for faster subsequent runs
- VS Code may need to be restarted after configuration changes
