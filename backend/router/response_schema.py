"""
Unified Response Schema for Agent/Orchestrator System

This module defines the structured response interfaces that all agents
(including the orchestrator) use to return text, citations, and metadata.
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import uuid
import hashlib



@dataclass
class AgentResponse:
    """Structured response from any agent (including orchestrator)"""
    text: str
    meta: Optional[Dict[str, Any]] = None
    agent_name: Optional[str] = None
    status: str = "success"  # "success", "error", "empty_response"


def merge_agent_responses(responses: List[AgentResponse]) -> AgentResponse:
    """
    Merge multiple agent responses into a single response
    
    Args:
        responses: List of agent responses to merge
        
    Returns:
        Merged AgentResponse with combined text, deduplicated citations, and merged metadata
    """
    if not responses:
        return AgentResponse(text="", meta={})
    
    # Combine text from all responses
    text_parts = []
    for response in responses:
        if response.text and response.text.strip():
            text_parts.append(response.text.strip())
    
    combined_text = "\n\n".join(text_parts)
    
    # Merge metadata
    merged_meta = {}
    for response in responses:
        if response.meta:
            merged_meta.update(response.meta)
    
    # Determine overall status
    status = "success"
    if any(r.status == "error" for r in responses):
        status = "error"
    elif any(r.status == "empty_response" for r in responses):
        status = "empty_response"
    
    return AgentResponse(
        text=combined_text,
        meta=merged_meta,
        status=status
    )
