# GBNF Grammar Validation

This directory contains tools to validate GBNF (Grammar BNF) files used by llama.cpp for structured output generation.

## The Problem

GBNF grammar files can have subtle syntax errors that only surface at runtime when llama.cpp tries to parse them. The most common error is **undefined rule references**, like the `hex` rule issue that caused:

```
{
    "error": {
        "code": 400,
        "message": "Failed to parse grammar",
        "type": "invalid_request_error"
    }
}
```

## Solution: Grammar Validation Tools

### 1. Quick Grammar Checker (`check_grammar.py`)

A lightweight validator that catches the most common GBNF errors:

```bash
# Check a specific grammar file
python check_grammar.py schema.gbnf

# Example output for valid grammar:
✅ GRAMMAR VALIDATION PASSED
  • All basic syntax checks passed
  • 'root' rule found
  • No obvious undefined rule references detected

# Example output for invalid grammar:
❌ GRAMMAR VALIDATION FAILED
  • Rule 'hex' is referenced but not defined (this was your exact issue!)
```

### 2. Pre-commit Hook Integration

Install pre-commit hooks to catch grammar errors before they reach production:

```bash
# Install pre-commit (if not already installed)
pip install pre-commit

# Install the hooks
pre-commit install

# Now grammar files are automatically validated on commit
git add schema.gbnf
git commit -m "Update grammar"  # Will run validation automatically
```

### 3. Manual Validation

```bash
# Validate the current schema
cd backend/memory_extraction
python check_grammar.py schema.gbnf

# Test with a broken grammar (for testing)
python check_grammar.py test_broken_grammar.gbnf
```

## Common GBNF Errors Caught

1. **Undefined Rule References** (like the `hex` issue)
   - References to rules that aren't defined
   - Typos in rule names

2. **Missing Root Rule**
   - Every GBNF grammar must have a `root` rule

3. **Basic Syntax Errors**
   - Malformed rule definitions
   - Missing `::=` operators

## Files

- `schema.gbnf` - The main grammar file for memory extraction
- `check_grammar.py` - Grammar validation script
- `test_broken_grammar.gbnf` - Test case with intentional errors
- `validate_grammar.py` - More comprehensive validator (experimental)
- `validate_grammar_simple.py` - Alternative simple validator

## Integration with CI/CD

Add this to your GitHub Actions workflow:

```yaml
- name: Validate GBNF Grammar
  run: |
    cd backend/memory_extraction
    python check_grammar.py schema.gbnf
```

## The Original Issue

The error you encountered was caused by this line in `schema.gbnf`:

```gbnf
chars  ::= ("\\" ["\\/bfnrt]) | ("\\u" hex hex hex hex) | [^"\\]
```

The grammar referenced `hex` four times but never defined what `hex` is. The fix was adding:

```gbnf
hex    ::= [0-9a-fA-F]
```

## Best Practices

1. **Always validate grammar files** before deploying
2. **Use the pre-commit hook** to catch errors early
3. **Test with actual llama.cpp** for full validation
4. **Keep grammar files simple** and well-documented
5. **Version control grammar changes** carefully

## Rebuilding After Grammar Changes

When you update `schema.gbnf`, remember to rebuild the Docker container:

```bash
# Rebuild the memory extraction service
cd backend/memory_extraction
docker build -f Dockerfile.cpu -t geist-memory:latest .

# Restart the Kubernetes deployment
kubectl rollout restart deployment geist-memory
```

## Future Improvements

- Integration with llama.cpp's native validation
- More sophisticated rule dependency analysis  
- Automated testing with sample inputs
- Grammar visualization tools
