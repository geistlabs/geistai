#!/bin/bash

# Test script for 10 weather queries
echo "Starting 10 weather query tests..."

cities=("Paris" "London" "Tokyo" "New York" "Sydney" "Berlin" "Madrid" "Rome" "Barcelona" "Amsterdam")

results_file="weather_test_results.log"
echo "Date: $(date)" > $results_file
echo "Testing weather queries..." >> $results_file
echo "=================================" >> $results_file

success_count=0
fail_count=0

for i in "${!cities[@]}"; do
    city="${cities[$i]}"
    test_num=$((i + 1))

    echo -e "\n=== Test $test_num: Weather in $city ==="
    echo "=== Test $test_num: Weather in $city ===" >> $results_file

    # Make the API call and capture the full response
    response=$(curl -s -X POST http://localhost:8000/api/stream \
        -H "Content-Type: application/json" \
        -H "Origin: http://localhost:3000" \
        -d "{\"message\": \"what is the weather in $city?\"}" \
        --no-buffer)

    # Check if we got a response
    if [ $? -eq 0 ] && [ ! -z "$response" ]; then
        echo "✅ Request successful"
        echo "✅ Request successful" >> $results_file

        # Look for final response in the stream
        final_response=$(echo "$response" | grep -o '"type":"final_response".*' | head -1)
        if [ ! -z "$final_response" ]; then
            echo "✅ Got final response"
            echo "✅ Got final response" >> $results_file
            success_count=$((success_count + 1))
        else
            echo "⚠️  No final response found in stream"
            echo "⚠️  No final response found in stream" >> $results_file
            fail_count=$((fail_count + 1))
        fi

        # Check for tool calls
        tool_calls=$(echo "$response" | grep "tool_call_event" | wc -l)
        echo "Tool calls made: $tool_calls"
        echo "Tool calls made: $tool_calls" >> $results_file

    else
        echo "❌ Request failed or empty response"
        echo "❌ Request failed or empty response" >> $results_file
        fail_count=$((fail_count + 1))
    fi

    echo "Response length: ${#response} characters" >> $results_file
    sleep 2  # Small delay between requests
done

echo -e "\n================================="
echo "=================================" >> $results_file
echo "Test Summary:"
echo "Test Summary:" >> $results_file
echo "Successful: $success_count"
echo "Successful: $success_count" >> $results_file
echo "Failed: $fail_count"
echo "Failed: $fail_count" >> $results_file
echo "Total: $((success_count + fail_count))"
echo "Total: $((success_count + fail_count))" >> $results_file

echo -e "\nResults saved to: $results_file"
