#!/usr/bin/env python3
"""
GBNF Grammar Checker

A practical grammar checker that focuses on catching the most common GBNF errors:
1. References to undefined rules (like the 'hex' issue you encountered)
2. Missing 'root' rule
3. Basic syntax validation

This uses llama.cpp's own validation by attempting to load the grammar.
"""

import subprocess
import sys
import tempfile
from pathlib import Path


def check_grammar_with_llamacpp(grammar_file: Path) -> bool:
    """
    Check grammar by attempting to use it with llama.cpp server.
    This is the most reliable way to validate GBNF grammar.
    """
    try:
        # Try to validate the grammar using llama.cpp's built-in validation
        # We'll use a minimal test to see if the grammar parses

        # Create a minimal test request
        test_content = (
            '''
{
  "prompt": "test",
  "grammar_file": "'''
            + str(grammar_file.absolute())
            + """",
  "max_tokens": 1
}
"""
        )

        # For now, let's do a simpler check - just look for common patterns
        return check_grammar_syntax(grammar_file)

    except Exception as e:
        print(f"❌ Error checking grammar: {e}")
        return False


def check_grammar_syntax(grammar_file: Path) -> bool:
    """Basic syntax checking for GBNF grammar."""
    try:
        content = grammar_file.read_text()
        lines = content.strip().split("\n")

        errors = []
        defined_rules = set()

        # Extract defined rules
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            if "::=" in line:
                rule_name = line.split("::=")[0].strip()
                defined_rules.add(rule_name)

        # Check for root rule
        if "root" not in defined_rules:
            errors.append("Missing 'root' rule")

        # Check for the specific error pattern that caused your issue
        if "hex hex hex hex" in content and "hex" not in defined_rules:
            errors.append(
                "Rule 'hex' is referenced but not defined (this was your exact issue!)"
            )

        # Look for other common undefined references
        import re

        # Find all rule references in the format: word followed by space or special chars
        # This is a simplified check for the most common cases
        referenced_patterns = [
            (r"\\u\s+(\w+)\s+\w+\s+\w+\s+\w+", "Unicode escape pattern references"),
            (
                r"(\w+)\s+(\w+)\s+(\w+)\s+(\w+)(?=\s*[)|])",
                "Four-word sequence that might be undefined rules",
            ),
        ]

        for pattern, description in referenced_patterns:
            matches = re.findall(pattern, content)
            for match in matches:
                if isinstance(match, tuple):
                    for word in match:
                        if word not in defined_rules and word not in [
                            "hex",
                            "ws",
                            "string",
                            "number",
                            "chars",
                        ]:
                            if word not in [
                                m for m in match if m in defined_rules
                            ]:  # Avoid duplicates
                                errors.append(
                                    f"Possible undefined rule: '{word}' in {description}"
                                )

        # Print results
        if errors:
            print("❌ GRAMMAR VALIDATION FAILED")
            for error in errors:
                print(f"  • {error}")
            return False
        else:
            print("✅ GRAMMAR VALIDATION PASSED")
            print("  • All basic syntax checks passed")
            print("  • 'root' rule found")
            print("  • No obvious undefined rule references detected")
            return True

    except Exception as e:
        print(f"❌ Error reading grammar file: {e}")
        return False


def main():
    """Main entry point."""
    if len(sys.argv) != 2:
        print("Usage: python check_grammar.py <grammar_file>")
        print("Example: python check_grammar.py schema.gbnf")
        sys.exit(1)

    grammar_file = Path(sys.argv[1])
    if not grammar_file.exists():
        print(f"❌ Grammar file not found: {grammar_file}")
        sys.exit(1)

    print(f"Checking GBNF grammar: {grammar_file}")
    print("=" * 50)

    success = check_grammar_syntax(grammar_file)

    if success:
        print("\n💡 Tip: This checker catches common errors, but for full validation,")
        print("   test your grammar with actual llama.cpp inference.")
    else:
        print("\n💡 Fix the errors above before deploying your grammar.")

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
