/**
 * Citation parsing utilities for the frontend
 * Parses citations from LLM responses that contain <citation> tags
 */

export interface Citation {
  id?: string;
  source: string;
  url?: string;
  snippet?: string;
  confidence?: number;
  number?: number;
  agent_name?: string;
  meta?: Record<string, any>;
}

/**
 * Parse citations from text that contains <citation> tags
 *
 * Expected format:
 * <citation source="Source Name" url="https://example.com" snippet="Relevant text" confidence="0.95">[1]</citation>
 */
export function parseCitationsFromText(
  text: string,
  agentName?: string,
): Citation[] {
  const citations: Citation[] = [];

  // Pattern to match citation tags with attributes (more flexible)
  const citationPattern = /<citation[^>]*>\[(\d+)\]<\/citation>/g;

  let match;
  while ((match = citationPattern.exec(text)) !== null) {
    const [fullMatch, numberStr] = match;

    // Extract attributes from the full match
    const attributesStr = fullMatch
      .replace(/<citation\s*/, '')
      .replace(/>\[.*$/, '');

    try {
      // Parse attributes from the citation tag
      const attributes: Record<string, string> = {};

      // Extract source
      const sourceMatch = attributesStr.match(/source="([^"]*)"/);
      if (sourceMatch) {
        attributes.source = sourceMatch[1];
      }

      // Extract url
      const urlMatch = attributesStr.match(/url="([^"]*)"/);
      if (urlMatch) {
        attributes.url = urlMatch[1];
      }

      // Extract snippet
      const snippetMatch = attributesStr.match(/snippet="([^"]*)"/);
      if (snippetMatch) {
        attributes.snippet = snippetMatch[1];
      }

      // Extract confidence
      const confidenceMatch = attributesStr.match(/confidence="([^"]*)"/);
      let confidence: number | undefined;
      if (confidenceMatch) {
        confidence = parseFloat(confidenceMatch[1]);
      }

      // Create Citation object
      const citation: Citation = {
        source: attributes.source || '',
        url: attributes.url,
        snippet: attributes.snippet,
        confidence: confidence,
        number: parseInt(numberStr),
        agent_name: agentName,
      };

      // Generate unique ID
      const content = `${attributes.url || ''}${attributes.source || ''}${attributes.snippet || ''}`;
      if (content) {
        // Simple hash function for ID generation
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
          const char = content.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash; // Convert to 32-bit integer
        }
        citation.id = Math.abs(hash).toString(16).substring(0, 12);
      } else {
        citation.id = Math.random().toString(36).substring(2, 14);
      }

      citations.push(citation);
    } catch (error) {
      continue;
    }
  }

  return citations;
}

/**
 * Returns an object with:
 *  - text: the original text, but citation tags replaced by clickable tooltips showing the citation text
 *  - citations: the array of parsed citations
 * 
 * Each citation tag in the form <citation ...>[N]</citation> is replaced by:
 *   <span class="citation-tooltip" tabindex="0">[N]<span class="citation-tooltip-content">...</span></span>
 *
 * @param text String with citation tags
 * @param agentName (optional)
 */
export function getTextWithCitationTooltips(
  text: string,
  agentName?: string
): { text: string; citations: Citation[] } {
  // Use the existing parseCitationsFromText function
  const citations = parseCitationsFromText(text, agentName);

  // Build a map by citation number for fast lookup
  const citationMap = new Map<number, Citation>();
  citations.forEach((citation) => {
    if (typeof citation.number === "number") {
      citationMap.set(citation.number, citation);
    }
  });

  // Replace citation tags with tooltip span
  const replacedText = text.replace(
    /<citation[^>]*>\[(\d+)\]<\/citation>/g,
    (_full, numberStr) => {
      const number = parseInt(numberStr, 10);
      const citation = citationMap.get(number);

      // Compose tooltip content
      let tooltipText = "";
      if (citation) {
        const items: string[] = [];
        if (citation.source) items.push(`<b>Source:</b> ${citation.source}`);
        if (citation.snippet)
          items.push(`<b>Snippet:</b> ${citation.snippet}`);
        if (citation.url)
          items.push(
            `<b>URL:</b> <a href="${citation.url}" target="_blank" rel="noopener noreferrer">${citation.url}</a>`
          );
        if (citation.confidence !== undefined)
          items.push(
            `<b>Confidence:</b> ${(
              Math.round(citation.confidence * 1000) / 10
            ).toFixed(1)}%`
          );
        tooltipText = items.join("<br/>");
        if (tooltipText === "") {
          tooltipText = "No citation details available";
        }
      } else {
        tooltipText = "Citation not found";
      }

      // HTML for tooltip using CSS classes (you must define .citation-tooltip and .citation-tooltip-content in your stylesheet)
      return `<span class="citation-tooltip" tabindex="0">[${number}]<span class="citation-tooltip-content">${tooltipText}</span></span>`;
    }
  );

  return { text: replacedText, citations };
}
