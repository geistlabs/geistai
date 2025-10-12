"""
Answer Mode - Forces LLM to generate final answer without calling tools

This is a simplified implementation for MVP that wraps the existing
agent system and adds a firewall to prevent infinite tool loops.
"""

import httpx
from typing import AsyncIterator, List, Dict
import json


async def answer_mode_stream(
    query: str,
    findings: str,
    inference_url: str = "http://host.docker.internal:8080"
) -> AsyncIterator[str]:
    """
    Generate final answer from tool findings with firewall

    Args:
        query: Original user question
        findings: Text summary of tool results
        inference_url: Which model to use (Qwen or GPT-OSS URL)

    Yields:
        Content chunks to stream to user
    """

    # Direct prompt for clean, concise answers
    messages = [
        {
            "role": "user",
            "content": (
                f"{query}\n\n"
                f"Here is relevant information:\n{findings}\n\n"
                f"Please provide a brief answer (2-3 sentences) and list the source URLs."
            )
        }
    ]

    client = httpx.AsyncClient(timeout=30.0)
    full_response = ""  # Accumulate full response for post-processing

    try:
        async with client.stream(
            "POST",
            f"{inference_url}/v1/chat/completions",
            json={
                "messages": messages,
                "tools": [],  # NO TOOLS - completely disabled
                "stream": True,
                "max_tokens": 120,  # Optimized for fast summaries
                "temperature": 0.8   # Fast sampling
            }
        ) as response:

            content_seen = False

            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    if line.strip() == "data: [DONE]":
                        break

                    try:
                        data = json.loads(line[6:])

                        if "choices" in data and len(data["choices"]) > 0:
                            choice = data["choices"][0]
                            delta = choice.get("delta", {})

                            # FIREWALL: Drop any hallucinated tool calls
                            if "tool_calls" in delta:
                                print(f"⚠️  Answer-mode firewall: Dropped tool_call (this shouldn't happen!)")
                                continue

                            # Accumulate content
                            if "content" in delta and delta["content"]:
                                content_seen = True
                                full_response += delta["content"]

                            # Stop on finish
                            finish_reason = choice.get("finish_reason")
                            if finish_reason in ["stop", "length"]:
                                break

                    except json.JSONDecodeError:
                        continue

            # Post-process: Clean up response
            # GPT-OSS may use Harmony format or plain text - handle both

            import re

            # Try to extract final channel if present
            if "<|channel|>final<|message|>" in full_response:
                parts = full_response.split("<|channel|>final<|message|>")
                if len(parts) > 1:
                    final_content = parts[1].split("<|end|>")[0] if "<|end|>" in parts[1] else parts[1]
                    yield final_content.strip()
                    return

            # If no final channel, clean up Harmony markers from analysis
            if "<|channel|>" in full_response:
                cleaned = full_response

                # Remove all Harmony control markers
                cleaned = re.sub(r'<\|[^|]+\|>', '', cleaned)
                cleaned = re.sub(r'\{[^}]*"cursor"[^}]*\}', '', cleaned)  # Remove JSON tool calls

                # Remove meta-commentary patterns
                cleaned = re.sub(r'We need to (answer|check|provide|browse)[^.]*\.', '', cleaned)
                cleaned = re.sub(r'The user (asks|wants|needs|provided)[^.]*\.', '', cleaned)
                cleaned = re.sub(r'Let\'s (open|browse|check)[^.]*\.', '', cleaned)

                # Clean up whitespace
                cleaned = re.sub(r'\s+', ' ', cleaned).strip()

                if len(cleaned) > 20:
                    yield cleaned
                else:
                    # Fallback: provide simple answer from findings
                    yield f"Based on the search results, please visit the sources for details.\n\nSources:\n{findings[:100]}"
            else:
                # No Harmony format - yield clean response
                yield full_response

            # Fallback if no content generated
            if not content_seen:
                print(f"❌ Answer mode produced no content - using fallback")
                yield f"\n\nBased on the search results: {findings[:200]}..."

    finally:
        await client.aclose()
