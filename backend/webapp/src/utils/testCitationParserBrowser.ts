/**
 * Browser test for citation parser
 * Run this in the browser console to test citation parsing
 */

// Test function that can be run in browser console
export function testCitationParserInBrowser() {
  const testText = `
    The Toronto Blue Jays are performing well this season <citation source="ESPN" url="https://espn.com/mlb/bluejays" snippet="Blue Jays season performance" confidence="0.92">[1]</citation>.
    
    Their recent games show strong offensive production <citation source="MLB.com" url="https://mlb.com/bluejays/stats" snippet="Team statistics" confidence="0.89">[2]</citation>.
  `;
  
  console.log("🧪 Testing citation parser in browser...");
  console.log("Input text:", testText);
  
  // Import the citation parser functions
  import('./citationParser').then(({ extractCitationsAndCleanText }) => {
    const { cleanedText, citations } = extractCitationsAndCleanText(testText, 'test_agent');
    
    console.log("✅ Results:");
    console.log("Cleaned text:", cleanedText);
    console.log("Citations found:", citations.length);
    citations.forEach(citation => {
      console.log(`  [${citation.number}] ${citation.source} - ${citation.url}`);
    });
  });
}

// Make it available globally for browser console testing
if (typeof window !== 'undefined') {
  (window as any).testCitationParserInBrowser = testCitationParserInBrowser;
}
