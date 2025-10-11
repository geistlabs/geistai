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
export function parseCitationsFromText(text: string, agentName?: string): Citation[] {
  const citations: Citation[] = [];
  
  console.log("🔍 Citation parser input text:", text);
  
  // Pattern to match citation tags with attributes (more flexible)
  const citationPattern = /<citation[^>]*>\[(\d+)\]<\/citation>/g;
  
  let match;
  while ((match = citationPattern.exec(text)) !== null) {
    console.log("🔍 Found citation match:", match);
    const [fullMatch, numberStr] = match;
    
    // Extract attributes from the full match
    const attributesStr = fullMatch.replace(/<citation\s*/, '').replace(/>\[.*$/, '');
    console.log("🔍 Extracted attributes string:", attributesStr);
    
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
        agent_name: agentName
      };
      
      // Generate unique ID
      const content = `${attributes.url || ''}${attributes.source || ''}${attributes.snippet || ''}`;
      if (content) {
        // Simple hash function for ID generation
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
          const char = content.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32-bit integer
        }
        citation.id = Math.abs(hash).toString(16).substring(0, 12);
      } else {
        citation.id = Math.random().toString(36).substring(2, 14);
      }
      
      citations.push(citation);
      
    } catch (error) {
      console.warn('Error parsing citation:', error);
      continue;
    }
  }
  
  console.log("🔍 Citation parser found", citations.length, "citations");
  return citations;
}

/**
 * Remove citation tags from text, replacing them with clickable numbered links
 */
export function cleanTextOfCitationTags(text: string, citations: Citation[]): string {
  // Create a map of citation numbers to their URLs for linking
  const citationMap = new Map<number, string>();
  citations.forEach(citation => {
    if (citation.number && citation.url) {
      citationMap.set(citation.number, citation.url);
    }
  });

  // Replace citation tags with clickable links
  return text.replace(/<citation[^>]*>\[(\d+)\]<\/citation>/g, (_, numberStr) => {
    const number = parseInt(numberStr);
    const url = citationMap.get(number);
    
    if (url) {
      // Create a clickable link that opens in a new tab
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: none; font-weight: 500;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">[${number}]</a>`;
    } else {
      // Fallback to plain number if no URL found
      return `[${number}]`;
    }
  });
}

/**
 * Extract citations from text and return both cleaned text and citations
 */
export function extractCitationsAndCleanText(text: string, agentName?: string): { cleanedText: string; citations: Citation[] } {
  const citations = parseCitationsFromText(text, agentName);
  const cleanedText = cleanTextOfCitationTags(text, citations);
  return { cleanedText, citations };
}

/**
 * Test the citation parsing functionality
 */
export function testCitationParsing(): void {
  const testText = `
    The current temperature in Paris is 22°C with partly cloudy skies <citation source="Weather API" url="https://weather.com/paris" snippet="Current conditions in Paris" confidence="0.95">[1]</citation>.
    
    According to recent reports <citation source="News Article" url="https://news.com/weather" snippet="Weather update for Europe" confidence="0.88">[2]</citation>, 
    the weather pattern is expected to continue.
  `;
  
  console.log('🧪 Testing citation parsing...');
  console.log('Input text:', testText);
  
  const { cleanedText, citations } = extractCitationsAndCleanText(testText, 'test_agent');
  
  console.log('✅ Found', citations.length, 'citations:');
  citations.forEach(citation => {
    console.log(`  [${citation.number}] ${citation.source} - ${citation.url}`);
  });
  
  console.log('✅ Cleaned text with clickable links:', cleanedText);
}
