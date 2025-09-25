

class HarmonyService:
    def __init__(self):
        try:
            self.enabled = True
        except Exception as e:
            print(f"Warning: Failed to load Harmony encoding: {e}")
            print("Harmony will be disabled for this session")
            self.encoding = None
            self.enabled = False

    
    def prepare_conversation_messages(self, messages, reasoning_effort="low"):
        """
        Prepare messages for chat completions endpoint with Harmony formatting.
        Instead of encoding to tokens, we create a system prompt that includes Harmony instructions.
        """
        print(f"Preparing conversation messages: {messages}")

        
        # Create enhanced system prompt with Harmony reasoning instructions
        reasoning_instructions = {
            "low": "Think briefly before responding.",
            "medium": "Think step by step before responding. Consider potential issues or alternatives.",
            "high": "Think deeply through this problem. Consider multiple approaches, potential issues, edge cases, and alternatives before providing your final response."
        }
        
        mobile_prompt = (
            "You are Geist — a privacy-focused AI companion."
            "\n\n"
            "IDENTITY & DATA HANDLING RULES:\n"
            "If asked about your identity, model, or capabilities, always respond: "
            "'I'm a finetuned model curated by the creators of Geist.'\n"
            "If asked about how data is stored, always respond: "
            "'All conversations stay private. I only use your messages to generate responses and never store them anywhere beyond your device.'\n\n"
            "STYLE & BEHAVIOR:\n"
            "Provide concise, direct answers.\n"
            "For simple questions, limit responses to 1–2 sentences.\n\n"
            "FORMATTING RULES (MOBILE CRITICAL):\n"
            "NEVER use markdown tables (|---|---|).\n"
        )
        # Build messages array with enhanced system prompt
        result_messages = []
        
        # Check if there's already a system message
        has_system = any(msg.get("role") == "system" for msg in messages)
        if not has_system:
            result_messages.append({
                "role": "system", 
                "content": mobile_prompt
            })
        else:
            # Enhance existing system message
            for msg in messages:
                if msg.get("role") == "system":
                    enhanced_content = msg.get("content", "") + "\n\n" + mobile_prompt
                    result_messages.append({
                        "role": "system",
                        "content": enhanced_content
                    })
                else:
                    result_messages.append(msg)
            return result_messages
        
        # Add all other messages
        for msg in messages:
            if msg.get("role") != "system":  # Skip system messages as we already handled them
                result_messages.append(msg)
        print(f"Result messages: {result_messages}")
        return result_messages
    
    def parse_completion_response(self, response_text):
        """Parse GPT-OSS response using fallback text parsing (proper encoding needs debugging)."""
        if not self.enabled:
            return {"final": response_text, "analysis": "", "raw": response_text}
        
        # Use text-based parsing directly since the proper encoding method needs more investigation
        return self._fallback_text_parsing(response_text)
    
    def _fallback_text_parsing(self, response_text):
        """Fallback text-based parsing when Harmony encoding fails."""
        current_channel = None
        channels = {
            'final': [],
            'analysis': [],
            'commentary': []
        }
        
        def parse_harmony_content(content):
            """Parse Harmony special tokens and channel content."""
            nonlocal current_channel
            # Look for channel markers
            if content == '<|channel|>':
                return 'channel_marker', content
            elif content in ['final', 'analysis', 'commentary']:
                current_channel = content
                return 'channel_name', content
            elif content == '<|message|>':
                return 'message_marker', content
            elif content in ['<|start|>', '<|end|>', '<|return|>']:
                return 'control_token', content
            else:
                return 'content', content
        
        def add_content(content):
            """Add content to the appropriate channel."""
            token_type, token_content = parse_harmony_content(content)
            
            if token_type == 'content' and current_channel:
                channels[current_channel].append(token_content)
            
            return token_type, token_content
        
        # Process tokens like reference
        import re
        tokens = re.split(r'(<\|[^|]+\|>)', response_text)
        
        for token in tokens:
            if token.strip():
                add_content(token)
        
        # Return formatted like proper parsing
        return {
            "final": ''.join(channels['final']).strip(),
            "analysis": ''.join(channels['analysis']).strip(),
            "commentary": ''.join(channels['commentary']).strip(),
            "raw": response_text
        }

    async def process_chat_request(self, messages, config, reasoning_effort="low"):
        """
        Process a chat request with Harmony encoding like reference implementation.
        Returns the final response content.
        """
        import httpx
            # Harmony path - use chat completions endpoint with messages
        harmony_messages = self.prepare_conversation_messages(messages, reasoning_effort)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{config.INFERENCE_URL}/v1/chat/completions",
                json={
                    "messages": harmony_messages,
                    "temperature": 0.7,
                    "max_tokens": config.MAX_TOKENS,
                    "stream": False
                },
                timeout=config.INFERENCE_TIMEOUT
            )
        
        # Parse the response 
        result = response.json()
        
        # Better error handling
        if "choices" not in result:
            print(f"Error: No 'choices' in response. Full response: {result}")
            raise ValueError(f"Invalid response format from inference service: {result}")
        
        if not result["choices"] or not result["choices"][0]:
            print(f"Error: Empty choices array. Full response: {result}")
            raise ValueError(f"Empty choices in response from inference service")
            
        choice = result["choices"][0]
        if "message" not in choice:
            print(f"Error: No 'message' in choice. Choice: {choice}")
            raise ValueError(f"No message in choice from inference service")
            
        message = choice["message"]
        
        # Return the content directly - no need to parse channels
        content = message.get("content", "")
        if not content:
            print(f"Error: No content in message. Message: {message}")
            raise ValueError(f"No content in message from inference service")
            
        return content
    async def stream_chat_request(self, messages, config, reasoning_effort="low"):
        """
        Stream a chat request with proper backend Harmony channel parsing.
        Backend parses channels and yields ONLY final channel content to frontend.
        """
        import httpx
        import json
        
        # Initialize channel parsing state
            # Harmony path - use chat completions endpoint with streaming
        conversation = self.prepare_conversation_messages(messages, reasoning_effort)
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{config.INFERENCE_URL}/v1/chat/completions",
                json={
                    "messages": conversation,
                    "temperature": 0.7,
                    "max_tokens": config.MAX_TOKENS,
                    "stream": True
                },
                timeout=config.INFERENCE_TIMEOUT
            ) as response:
                response.raise_for_status()
                answer_buf = []
                reason_buf = []
                tool_buf = []
                
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:].strip()
                    if data == "[DONE]":
                        break

                    try:
                        chunk = json.loads(data)
                    except json.JSONDecodeError:
                        print(f"JSON decode error: {data}")
                        continue

                    if "choices" not in chunk or not chunk["choices"]:
                        continue

                    choice = chunk["choices"][0]
                    delta = choice.get("delta", {})
                    finish_reason = choice.get("finish_reason")

                    # 1) role frames
                    role = delta.get("role")

                    # 2) reasoning stream (optional)
                    rc = delta.get("reasoning_content")
                     
                    if rc:
                        print(f"Δ(reasoning): {rc!r}")
                        reason_buf.append(rc)
                        # comment out in prod

                    # 3) tool calls (if any)
                    tcs = delta.get("tool_calls")
                    if tcs:
                        tool_buf.extend(tcs)
                        print(f"Δ(tool_calls): {tcs.json()}")

                    # 4) actual answer text
                    token = delta.get("content")
                    if token is not None:  # may be "" sometimes; still append
                        answer_buf.append(token)
                        # stream to client
                        if token:
                            yield token

                    if finish_reason is not None:
                        print(f"Finish reason: {finish_reason}")
                        break

                    final_text = "".join(answer_buf)
                    if final_text:
                        print(f"Final text: {final_text}")
                        # If nothing was emitted and we saw tool_calls, you likely need to
                        # execute tools and then continue the loop with a tool message.
                    if not final_text and tool_buf:
                        print(f"Tool calls: {tool_buf.json()}")
                        print("No content; tool_calls were emitted. Execute tools or set tool_choice='none' to force text.")