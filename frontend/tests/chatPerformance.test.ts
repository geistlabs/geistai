import { ChatAPI } from '../lib/api/chat';
import { ApiClient } from '../lib/api/client';
import { TokenBatcher } from '../lib/streaming/tokenBatcher';

// Test configuration
const API_URL = 'http://localhost:8080';
const TEST_TIMEOUT = 120000; // 2 minutes

interface TestResult {
  testName: string;
  prompt: string;
  responseTime: number;
  tokenCount: number;
  firstTokenTime: number;
  averageTokenDelay: number;
  response: string;
  passed: boolean;
  error?: string;
}

class ChatPerformanceTester {
  private apiClient: ApiClient;
  private chatApi: ChatAPI;
  private results: TestResult[] = [];

  constructor() {
    this.apiClient = new ApiClient({
      baseUrl: API_URL,
      timeout: TEST_TIMEOUT,
      maxRetries: 1,
    });
    this.chatApi = new ChatAPI(this.apiClient);
  }

  async runTest(
    testName: string,
    prompt: string,
    expectedMinTokens: number = 10,
  ): Promise<TestResult> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running Test: ${testName}`);
    console.log(`Prompt: "${prompt}"`);
    console.log(`${'='.repeat(60)}`);

    const result: TestResult = {
      testName,
      prompt,
      responseTime: 0,
      tokenCount: 0,
      firstTokenTime: 0,
      averageTokenDelay: 0,
      response: '',
      passed: false,
    };

    const startTime = Date.now();
    let firstTokenTime = 0;
    const tokenTimestamps: number[] = [];
    let accumulatedResponse = '';

    try {
      // Use TokenBatcher for optimized streaming
      const batcher = new TokenBatcher({
        batchSize: 10,
        flushInterval: 100,
        onBatch: (batchedTokens: string) => {
          accumulatedResponse += batchedTokens;

          // Track timing metrics
          const currentTime = Date.now() - startTime;
          if (tokenTimestamps.length === 0) {
            firstTokenTime = currentTime;
            console.log(`✓ First tokens received at: ${firstTokenTime}ms`);
          }
          tokenTimestamps.push(currentTime);

          // Log progress
          const tokenCount = batcher.getTokenCount();
          if (tokenCount % 50 === 0) {
            console.log(
              `  Progress: ${tokenCount} tokens received (${currentTime}ms)`,
            );
          }
        },
        onComplete: () => {
          result.tokenCount = batcher.getTokenCount();
          console.log(`✓ Stream completed: ${result.tokenCount} tokens`);
        },
      });

      await this.chatApi.streamMessage(
        prompt,
        (token: string) => {
          batcher.addToken(token);
        },
        error => {
          console.error('Stream error:', error);
          result.error = error.message;
          batcher.abort();
        },
        () => {
          batcher.complete();
        },
      );

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 500));

      const endTime = Date.now();
      result.responseTime = endTime - startTime;
      result.firstTokenTime = firstTokenTime;
      result.response = accumulatedResponse;
      result.tokenCount = batcher.getTokenCount();

      // Calculate average delay between tokens
      if (tokenTimestamps.length > 1) {
        const delays = [];
        for (let i = 1; i < tokenTimestamps.length; i++) {
          delays.push(tokenTimestamps[i] - tokenTimestamps[i - 1]);
        }
        result.averageTokenDelay =
          delays.reduce((a, b) => a + b, 0) / delays.length;
      }

      // Validation
      const validations = [
        {
          check: result.tokenCount >= expectedMinTokens,
          message: `Token count (${result.tokenCount}) >= ${expectedMinTokens}`,
        },
        {
          check: result.firstTokenTime < 5000,
          message: `First token time (${result.firstTokenTime}ms) < 5000ms`,
        },
        {
          check: result.response.length > 0,
          message: `Response not empty (${result.response.length} chars)`,
        },
        { check: !result.error, message: 'No errors occurred' },
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
      console.log(
        `  Avg Token Delay: ${result.averageTokenDelay.toFixed(2)}ms`,
      );
      console.log(`  Response Length: ${result.response.length} characters`);

      console.log('\nResponse Preview:');
      console.log(
        `  "${result.response.substring(0, 200)}${result.response.length > 200 ? '...' : ''}"`,
      );
    } catch (error: any) {
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

    // Test 1: Basic Math
    await this.runTest(
      'Basic Math',
      'What is 25 * 4 + 10? Just give me the number.',
      5,
    );

    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Presidents Trivia
    await this.runTest(
      'Presidents Trivia',
      'Name the first 5 US presidents in order with one interesting fact about each.',
      50,
    );

    // Add delay between tests
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

    await this.runTest('Long-form Creative Writing', creativePrompt, 500);

    // Print summary
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
      console.log(
        `  Tokens/Second: ${(result.tokenCount / (result.responseTime / 1000)).toFixed(2)}`,
      );
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    });

    // Check for performance issues
    console.log(`\n${'='.repeat(60)}`);
    console.log('PERFORMANCE ANALYSIS');
    console.log(`${'='.repeat(60)}`);

    const longFirstToken = this.results.filter(r => r.firstTokenTime > 3000);
    if (longFirstToken.length > 0) {
      console.log('\n⚠️  Slow first token times detected:');
      longFirstToken.forEach(r => {
        console.log(`  - ${r.testName}: ${r.firstTokenTime}ms`);
      });
    }

    const slowStreaming = this.results.filter(
      r => r.tokenCount > 0 && r.tokenCount / (r.responseTime / 1000) < 10,
    );
    if (slowStreaming.length > 0) {
      console.log('\n⚠️  Slow streaming speeds detected (<10 tokens/sec):');
      slowStreaming.forEach(r => {
        console.log(
          `  - ${r.testName}: ${(r.tokenCount / (r.responseTime / 1000)).toFixed(2)} tokens/sec`,
        );
      });
    }

    if (longFirstToken.length === 0 && slowStreaming.length === 0) {
      console.log('\n✓ All tests performed within acceptable parameters!');
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new ChatPerformanceTester();
  tester.runAllTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

export { ChatPerformanceTester };
