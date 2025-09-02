from openai_harmony import (
      load_harmony_encoding,
      HarmonyEncodingName,
      Role,
      Message,
      Conversation,
      ReasoningEffort,
      RenderConversationConfig,
  )

class HarmonyService:
    def __init__(self):
        try:
            self.encoding = load_harmony_encoding(HarmonyEncodingName.HARMONY_GPT_OSS)
            self.enabled = True
        except Exception as e:
            print(f"Warning: Failed to load Harmony encoding: {e}")
            print("Harmony will be disabled for this session")
            self.encoding = None
            self.enabled = False

    def prepare_conversation(self, messages, reasoning_effort="low"):
        if not self.enabled or not self.encoding:
            return None
        
        # Step 1: Create mobile-optimized system prompt
        mobile_prompt = (
            "You are an AI assistant optimized for mobile chat. "
            "Provide concise, direct answers. For simple questions, respond in 1-2 sentences. "
            "Prioritize clarity and brevity."
        )
        
        # Step 2: Convert messages to Harmony format
        harmony_messages = []
        
        # Add system message if not present
        has_system = any(msg.get("role") == "system" for msg in messages)
        if not has_system:
            system_message = Message.from_role_and_content(Role.SYSTEM, mobile_prompt)
            harmony_messages.append(system_message)
        
        # Convert each message
        for msg in messages:
            role_str = msg.get("role", "user")
            content = msg.get("content", "")
            
            # Map roles (system, user, assistant)
            if role_str == "system":
                role = Role.SYSTEM
            elif role_str == "user":
                role = Role.USER
            elif role_str == "assistant":
                role = Role.ASSISTANT
            else:
                role = Role.USER
            
            # Create Harmony message and append
            harmony_message = Message.from_role_and_content(role, content)
            harmony_messages.append(harmony_message)
        
        # Step 3: Create conversation and render
        conversation = Conversation.from_messages(harmony_messages)
        
        # Map reasoning_effort string to ReasoningEffort enum
        effort_mapping = {
            "low": ReasoningEffort.LOW,
            "medium": ReasoningEffort.MEDIUM,
            "high": ReasoningEffort.HIGH
        }
        effort = effort_mapping.get(reasoning_effort, ReasoningEffort.LOW)
        
        # Configure and render
        config = RenderConversationConfig(reasoning_effort=effort)
        tokens = self.encoding.render_conversation_for_completion(
            conversation, 
            Role.ASSISTANT,
            config=config
        )
        
        return tokens
    def parse_completion_response(self, response_text):
        """Parse GPT-OSS response with channel markers using reference implementation logic."""
        
        # Copy exact logic from decode_harmony_response.py
        current_channel = None
        channels = {
            'final': [],
            'analysis': [],
            'commentary': []
        }
        
        def parse_harmony_content(content):
            """Parse Harmony special tokens and channel content - copied from reference."""
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
            """Add content to the appropriate channel - copied from reference."""
            token_type, token_content = parse_harmony_content(content)
            
            if token_type == 'content' and current_channel:
                channels[current_channel].append(token_content)
            
            return token_type, token_content
        
        # Process response character by character or token by token like reference
        import re
        # Split on harmony markers while keeping them - same as reference approach
        tokens = re.split(r'(<\|[^|]+\|>)', response_text)
        
        for token in tokens:
            if token.strip():
                add_content(token)
        
        # Return in same format as reference expects
        result = {
            "final": ''.join(channels['final']).strip(),
            "analysis": ''.join(channels['analysis']).strip(),
            "raw": response_text
        }
        
        return result
    
    def parse_harmony_channels(self, response_text):
        """
        Parse Harmony channel markers - exact copy of reference decode_harmony_response.py logic.
        Moved from main.py for better organization.
        """
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
        
        # Return final channel content like reference get_final_response()
        final_content = ''.join(channels['final'])
        if final_content:
            return final_content
        
        # Fallback to analysis like reference
        analysis_content = ''.join(channels['analysis'])
        return analysis_content if analysis_content else response_text
    
    async def process_chat_request(self, messages, config, reasoning_effort="low"):
        """
        Process a chat request with Harmony encoding if enabled, or fallback to standard chat.
        Handles all the HTTP client logic that was in main.py.
        """
        import httpx
        
        if self.enabled:
            # Harmony path - use completion endpoint
            harmony_tokens = self.prepare_conversation(messages, reasoning_effort)
            harmony_prompt = self.encoding.decode(harmony_tokens)
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{config.INFERENCE_URL}/v1/completions",
                    json={
                        "prompt": harmony_prompt,
                        "temperature": 0.7,
                        "max_tokens": 100,
                        "stream": False
                    },
                    timeout=config.INFERENCE_TIMEOUT
                )
            
            # Parse the response
            result = response.json()
            raw_response = result.get("choices", [{}])[0].get("text", "")
            
            # Parse Harmony format to extract final message
            parsed = self.parse_completion_response(raw_response)
            return parsed["final"] if parsed["final"] else raw_response
        
        else:
            # Standard chat completions (non-Harmony) 
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{config.INFERENCE_URL}/v1/chat/completions",
                    json={
                        "messages": messages,
                        "temperature": 0.7,
                        "max_tokens": 100
                    },
                    timeout=config.INFERENCE_TIMEOUT
                )
            
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
                
            if "content" not in choice["message"]:
                print(f"Error: No 'content' in message. Message: {choice['message']}")
                raise ValueError(f"No content in message from inference service")
                
            ai_response = choice["message"]["content"]
            
            # Parse GPT-OSS Harmony channels (based on reference decoder)
            return self.parse_harmony_channels(ai_response)
    
    async def stream_chat_request(self, messages, config, reasoning_effort="low"):
        """
        Stream a chat request with real-time Harmony channel parsing.
        Yields individual tokens from the 'final' channel only.
        """
        import httpx
        import json
        import re
        
        if self.enabled:
            # Harmony path - use completion endpoint with streaming
            harmony_tokens = self.prepare_conversation(messages, reasoning_effort)
            harmony_prompt = self.encoding.decode(harmony_tokens)
            
            async with httpx.AsyncClient() as client:
                async with client.stream(
                    "POST",
                    f"{config.INFERENCE_URL}/v1/completions",
                    json={
                        "prompt": harmony_prompt,
                        "temperature": 0.7,
                        "max_tokens": 500,
                        "stream": True  # Enable streaming
                    },
                    timeout=config.INFERENCE_TIMEOUT
                ) as response:
                    response.raise_for_status()
                    
                    current_channel = None
                    buffer = ""
                    
                    async for line in response.aiter_lines():
                        # Parse SSE format: lines starting with "data: "
                        if line.startswith("data: "):
                            data = line[6:]  # Remove "data: " prefix
                            
                            # Check for completion
                            if data.strip() == "[DONE]":
                                break
                            
                            try:
                                # Parse JSON chunk from llama.cpp
                                chunk_data = json.loads(data)
                                
                                if "choices" in chunk_data and chunk_data["choices"]:
                                    choice = chunk_data["choices"][0]
                                    token = choice.get("text", "")
                                    finish_reason = choice.get("finish_reason")
                                    
                                    if token:  # Only process non-empty tokens
                                        buffer += token
                                        
                                        # Parse tokens for channel markers and content
                                        for parsed_token in self._parse_streaming_token(buffer):
                                            if parsed_token["type"] == "content" and parsed_token["channel"] == "final":
                                                yield parsed_token["content"]
                                            elif parsed_token["type"] == "channel_change":
                                                current_channel = parsed_token["channel"]
                                        
                                        # Keep unprocessed part in buffer
                                        buffer = self._get_remaining_buffer(buffer)
                                    
                                    # Check if this is the final chunk
                                    if finish_reason:
                                        break
                            
                            except json.JSONDecodeError:
                                continue
                            except Exception:
                                continue
        else:
            # Standard chat completions streaming (non-Harmony)
            async with httpx.AsyncClient() as client:
                async with client.stream(
                    "POST",
                    f"{config.INFERENCE_URL}/v1/chat/completions",
                    json={
                        "messages": messages,
                        "temperature": 0.7,
                        "max_tokens": 500,
                        "stream": True
                    },
                    timeout=config.INFERENCE_TIMEOUT
                ) as response:
                    response.raise_for_status()
                    
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            
                            if data.strip() == "[DONE]":
                                break
                            
                            try:
                                chunk_data = json.loads(data)
                                
                                if "choices" in chunk_data and chunk_data["choices"]:
                                    choice = chunk_data["choices"][0]
                                    delta = choice.get("delta", {})
                                    token = delta.get("content", "")
                                    finish_reason = choice.get("finish_reason")
                                    
                                    if token:
                                        # For non-Harmony, parse channels from accumulated tokens
                                        for parsed_token in self._parse_streaming_token(token):
                                            if parsed_token["type"] == "content" and parsed_token["channel"] == "final":
                                                yield parsed_token["content"]
                                    
                                    if finish_reason:
                                        break
                            
                            except json.JSONDecodeError:
                                continue
                            except Exception:
                                continue
    
    def _parse_streaming_token(self, token_buffer):
        """
        Parse streaming tokens for Harmony channel markers.
        Returns list of parsed token objects with type and content.
        """
        results = []
        current_channel = getattr(self, '_current_channel', 'final')  # Default to final
        
        # Look for channel markers in the buffer
        import re
        
        # Split on harmony markers while keeping them
        parts = re.split(r'(<\|[^|]+\|>)', token_buffer)
        
        for part in parts:
            if not part.strip():
                continue
                
            if part == '<|channel|>':
                results.append({"type": "marker", "content": part})
            elif part in ['final', 'analysis', 'commentary']:
                current_channel = part
                self._current_channel = current_channel
                results.append({"type": "channel_change", "channel": current_channel})
            elif part == '<|message|>':
                results.append({"type": "marker", "content": part})
            elif part in ['<|start|>', '<|end|>', '<|return|>']:
                results.append({"type": "control", "content": part})
            else:
                # Regular content - only yield if we're in the final channel
                if current_channel == 'final':
                    results.append({
                        "type": "content", 
                        "content": part, 
                        "channel": current_channel
                    })
        
        return results
    
    def _get_remaining_buffer(self, buffer):
        """
        Keep unprocessed part of buffer for next iteration.
        This is a simple implementation - you might need more sophisticated buffering.
        """
        # For now, clear buffer after processing
        # In production, you'd want to keep partial tokens
        return ""