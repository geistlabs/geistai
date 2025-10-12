"""
Query Router - Determines which model to use for each query
"""

import re
from typing import Literal

ModelChoice = Literal["qwen_tools", "qwen_direct", "gpt_oss"]


class QueryRouter:
    """Routes queries to appropriate model based on intent"""

    def __init__(self):
        # Tool-required keywords (need web search/current info)
        self.tool_keywords = [
            r"\bweather\b", r"\btemperature\b", r"\bforecast\b",
            r"\bnews\b", r"\btoday\b", r"\blatest\b", r"\bcurrent\b",
            r"\bsearch for\b", r"\bfind out\b", r"\blookup\b",
            r"\bwhat'?s happening\b", r"\bright now\b"
        ]

        # Creative/conversational keywords
        self.creative_keywords = [
            r"\bwrite a\b", r"\bcreate a\b", r"\bgenerate\b",
            r"\bpoem\b", r"\bstory\b", r"\bhaiku\b", r"\bessay\b",
            r"\btell me a\b", r"\bjoke\b", r"\bimagine\b"
        ]

        # Code/technical keywords
        self.code_keywords = [
            r"\bcode\b", r"\bfunction\b", r"\bclass\b",
            r"\bbug\b", r"\berror\b", r"\bfix\b", r"\bdebug\b",
            r"\bimplement\b", r"\brefactor\b"
        ]

    def route(self, query: str) -> ModelChoice:
        """
        Determine which model to use

        Returns:
            "qwen_tools": Two-pass flow with web search/fetch
            "qwen_direct": Qwen for complex tasks, no tools
            "gpt_oss": GPT-OSS for simple/creative
        """
        query_lower = query.lower()

        # Priority 1: Tool-required queries
        for pattern in self.tool_keywords:
            if re.search(pattern, query_lower):
                return "qwen_tools"

        # Priority 2: Code/technical queries
        for pattern in self.code_keywords:
            if re.search(pattern, query_lower):
                return "qwen_direct"

        # Priority 3: Creative/simple queries
        for pattern in self.creative_keywords:
            if re.search(pattern, query_lower):
                return "gpt_oss"

        # Priority 4: Simple explanations
        if any(kw in query_lower for kw in ["what is", "define", "explain", "how does"]):
            # If asking about current events → needs tools
            if any(kw in query_lower for kw in ["latest", "current", "today", "now"]):
                return "qwen_tools"
            else:
                return "gpt_oss"  # Historical/general knowledge

        # Default: Use Qwen (more capable)
        if len(query.split()) > 30:  # Long query → complex
            return "qwen_direct"
        else:
            return "gpt_oss"  # Short query → probably simple


# Singleton instance
router = QueryRouter()


def route_query(query: str) -> ModelChoice:
    """Helper function to route a query"""
    return router.route(query)
