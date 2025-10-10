"""
Unified Response Schema for Agent/Orchestrator System

This module defines the structured response interfaces that all agents
(including the orchestrator) use to return text, citations, and metadata.
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class Citation:
    """Represents a citation with source information"""
    id: Optional[str] = None
    source: str = ""
    url: Optional[str] = None
    snippet: Optional[str] = None
    confidence: Optional[float] = None
    number: Optional[int] = None  # For numbered citations like [1], [2]
    name: Optional[str] = None    # Display name for the source


@dataclass
class AgentResponse:
    """Structured response from any agent (including orchestrator)"""
    text: str
    citations: Optional[List[Citation]] = None
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
        return AgentResponse(text="", citations=[], meta={})
    
    # Combine text from all responses
    text_parts = []
    for response in responses:
        if response.text and response.text.strip():
            text_parts.append(response.text.strip())
    
    combined_text = "\n\n".join(text_parts)
    
    # Deduplicate citations
    all_citations = []
    seen_citations = set()
    
    for response in responses:
        if response.citations:
            for citation in response.citations:
                # Create a unique key for deduplication
                citation_key = (
                    citation.url or citation.source.lower(),
                    citation.number
                )
                if citation_key not in seen_citations:
                    all_citations.append(citation)
                    seen_citations.add(citation_key)
    
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
        citations=all_citations,
        meta=merged_meta,
        status=status
    )


def convert_legacy_citations(legacy_citations: List[Dict[str, Any]]) -> List[Citation]:
    """
    Convert legacy citation format to new Citation objects
    
    Args:
        legacy_citations: List of dictionaries with citation data
        
    Returns:
        List of Citation objects
    """
    citations = []
    for legacy in legacy_citations:
        citation = Citation(
            id=legacy.get("id"),
            source=legacy.get("source", ""),
            url=legacy.get("url"),
            snippet=legacy.get("snippet"),
            confidence=legacy.get("confidence"),
            number=legacy.get("number"),
            name=legacy.get("name")
        )
        citations.append(citation)
    return citations


def convert_to_legacy_citations(citations: List[Citation]) -> List[Dict[str, Any]]:
    """
    Convert Citation objects back to legacy format for backward compatibility
    
    Args:
        citations: List of Citation objects
        
    Returns:
        List of dictionaries in legacy format
    """
    legacy_citations = []
    for citation in citations:
        legacy = {}
        if citation.id:
            legacy["id"] = citation.id
        if citation.source:
            legacy["source"] = citation.source
        if citation.url:
            legacy["url"] = citation.url
        if citation.snippet:
            legacy["snippet"] = citation.snippet
        if citation.confidence is not None:
            legacy["confidence"] = citation.confidence
        if citation.number is not None:
            legacy["number"] = citation.number
        if citation.name:
            legacy["name"] = citation.name
        legacy_citations.append(legacy)
    return legacy_citations
