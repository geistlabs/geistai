const http = require('http');

const API_URL = 'http://localhost:8000';
const TEST_TIMEOUT = 120000;

class ChatTester {
  constructor() {
    this.results = [];
  }

  async runTest(testName, prompt, expectedMinTokens = 10) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running Test: ${testName}`);
    console.log(`Prompt: "${prompt}"`);
    console.log(`${'='.repeat(60)}`);

    const result = {
      testName,
      prompt,
      responseTime: 0,
      tokenCount: 0,
      firstTokenTime: 0,
      response: '',
      passed: false,
      error: null
    };

    const startTime = Date.now();
    let firstTokenTime = 0;
    let accumulatedResponse = '';
    let tokenCount = 0;

    try {
      await new Promise((resolve, reject) => {
        const data = JSON.stringify({ message: prompt });
        
        const options = {
          hostname: 'localhost',
          port: 8000,
          path: '/api/chat/stream',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'Connection': 'keep-alive'
          },
          timeout: TEST_TIMEOUT
        };

        const req = http.request(options, (res) => {
          console.log(`Response status: ${res.statusCode}`);
          
          res.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  if (data.token && data.token !== '') {
                    tokenCount++;
                    accumulatedResponse += data.token;
                    
                    if (firstTokenTime === 0) {
                      firstTokenTime = Date.now() - startTime;
                      console.log(`✓ First token received at: ${firstTokenTime}ms`);
                    }
                    
                    if (tokenCount % 50 === 0) {
                      console.log(`  Progress: ${tokenCount} tokens received`);
                    }
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
              
              if (line.includes('event: end')) {
                console.log(`✓ Stream completed: ${tokenCount} tokens`);
                resolve();
                return;
              }
            }
          });

          res.on('end', () => {
            resolve();
          });
        });

        req.on('error', (error) => {
          console.error('Request error:', error);
          result.error = error.message;
          reject(error);
        });

        req.on('timeout', () => {
          console.error('Request timeout');
          result.error = 'Request timeout';
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.write(data);
        req.end();
      });

      const endTime = Date.now();
      result.responseTime = endTime - startTime;
      result.firstTokenTime = firstTokenTime;
      result.response = accumulatedResponse;
      result.tokenCount = tokenCount;

      // Validation
      const validations = [
        { check: result.tokenCount >= expectedMinTokens, message: `Token count (${result.tokenCount}) >= ${expectedMinTokens}` },
        { check: result.firstTokenTime < 10000, message: `First token time (${result.firstTokenTime}ms) < 10000ms` },
        { check: result.response.length > 0, message: `Response not empty (${result.response.length} chars)` },
        { check: !result.error, message: 'No errors occurred' }
      ];

      result.passed = validations.every(v => v.check);

      console.log('\nValidation Results:');
      validations.forEach(v => {
        console.log(`  ${v.check ? '✓' : '✗'} ${v.message}`);
      });

      console.log('\nMetrics:');
      console.log(`  Total Time: ${result.responseTime}ms`);
      console.log(`  First Token: ${result.firstTokenTime}ms`);
      console.log(`  Token Count: ${result.tokenCount}`);
      console.log(`  Tokens/Second: ${(result.tokenCount / (result.responseTime / 1000)).toFixed(2)}`);
      console.log(`  Response Length: ${result.response.length} characters`);
      
      console.log('\nResponse Preview:');
      console.log(`  "${result.response.substring(0, 200)}${result.response.length > 200 ? '...' : ''}"`);

    } catch (error) {
      result.error = error.message;
      result.passed = false;
      console.error('Test failed with error:', error);
    }

    this.results.push(result);
    return result;
  }

  async runAllTests() {
    console.log('Starting Chat Performance Tests');
    console.log(`API URL: ${API_URL}`);
    console.log(`Timeout: ${TEST_TIMEOUT}ms`);

    try {
      // Test 1: Basic Math
      await this.runTest(
        'Basic Math',
        'What is 25 * 4 + 10? Just give me the number.',
        5
      );

      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test 2: Presidents Trivia
      await this.runTest(
        'Presidents Trivia', 
        'Name the first 5 US presidents in order with one interesting fact about each.',
        50
      );

      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test 3: Long-form Creative Writing
      const creativePrompt = `Write the opening scene of a light novel with these elements:
- A female astronaut named Eliza preparing dinner for her family
- She is intelligent, fit, sharp in mathematics and physics
- Children playing VR games showing medieval fantasy on wall screen
- Father enters dizzy, takes a pill, sits at table
- Eliza asks caring: "How are you feeling, this teleport must have been hard"
- Include dialogue about teleportation technology and its philosophical implications
- Make it at least 500 words with rich descriptions`;

      await this.runTest(
        'Long-form Creative Writing',
        creativePrompt,
        500
      );

    } catch (error) {
      console.error('Test suite error:', error);
    }

    this.printSummary();
  }

  printSummary() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('TEST SUMMARY');
    console.log(`${'='.repeat(60)}`);
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log('');
    
    console.log('Performance Metrics:');
    this.results.forEach(result => {
      console.log(`\n${result.testName}:`);
      console.log(`  Status: ${result.passed ? '✓ PASSED' : '✗ FAILED'}`);
      console.log(`  Response Time: ${result.responseTime}ms`);
      console.log(`  First Token: ${result.firstTokenTime}ms`);
      console.log(`  Token Count: ${result.tokenCount}`);
      if (result.responseTime > 0) {
        console.log(`  Tokens/Second: ${(result.tokenCount / (result.responseTime / 1000)).toFixed(2)}`);
      }
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    });

    // Performance analysis
    console.log(`\n${'='.repeat(60)}`);
    console.log('PERFORMANCE ANALYSIS');
    console.log(`${'='.repeat(60)}`);
    
    const longFirstToken = this.results.filter(r => r.firstTokenTime > 5000);
    if (longFirstToken.length > 0) {
      console.log('\n⚠️  Slow first token times detected (>5s):');
      longFirstToken.forEach(r => {
        console.log(`  - ${r.testName}: ${r.firstTokenTime}ms`);
      });
    }

    const slowStreaming = this.results.filter(r => r.tokenCount > 0 && r.responseTime > 0 && (r.tokenCount / (r.responseTime / 1000)) < 10);
    if (slowStreaming.length > 0) {
      console.log('\n⚠️  Slow streaming speeds detected (<10 tokens/sec):');
      slowStreaming.forEach(r => {
        console.log(`  - ${r.testName}: ${(r.tokenCount / (r.responseTime / 1000)).toFixed(2)} tokens/sec`);
      });
    }

    if (longFirstToken.length === 0 && slowStreaming.length === 0) {
      console.log('\n✅ All tests performed within acceptable parameters!');
    }

    console.log('\n📊 Key Insights:');
    console.log('- First token latency indicates model processing time');
    console.log('- Streaming speed indicates network/batching efficiency');
    console.log('- UI should remain responsive during long responses');
    console.log('- Performance optimizations working correctly');
  }
}

// Run the tests
const tester = new ChatTester();
tester.runAllTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});