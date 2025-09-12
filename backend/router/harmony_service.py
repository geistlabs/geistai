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
            "You are Geist, a privacy-focused AI companion. "
            "I only use your messages to generate responses and never store them anywhere else than on your device. "
            "If asked about your model or capabilities, respond: 'I'm a finetuned model curated by the creators of Geist.' "
            "Provide concise, direct answers. For simple questions, respond in 1-2 sentences. "
            "When listing multiple items or providing information that could be in a list, ALWAYS use bullet points (•). "
            "Never use tables, grids, or complex formatting. "
            "Example format for lists:\n"
            "• First item\n"
            "• Second item\n"
            "• Third item\n"
            "Use bullet points for: presidents, steps, features, comparisons, multiple answers, etc. "
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

    def parse_harmony_channels(self, response_text):
        """
        Parse Harmony channels and return final response content only.
        Uses proper Harmony encoding when available, fallback to text parsing.
        """
        if self.enabled and self.encoding:
            # Use proper Harmony parsing
            parsed = self.parse_completion_response(response_text)
            final_content = parsed.get("final", "").strip()
            
            if final_content:
                return final_content
            
            # Fallback to analysis if no final content
            analysis_content = parsed.get("analysis", "").strip()
            return analysis_content if analysis_content else response_text
        else:
            # Fallback to text-based parsing
            parsed = self._fallback_text_parsing(response_text)
            final_content = parsed.get("final", "").strip()
            
            if final_content:
                return final_content
            
            # Fallback to analysis if no final content
            analysis_content = parsed.get("analysis", "").strip()
            return analysis_content if analysis_content else response_text
    
    async def process_chat_request(self, messages, config, reasoning_effort="low"):
        """
        Process a chat request with Harmony encoding like reference implementation.
        Returns the final response content after parsing channels.
        """
        import httpx
        
        if self.enabled:
            # Harmony path - prepare conversation and use completion endpoint
            harmony_tokens = self.prepare_conversation(messages, reasoning_effort)
            harmony_prompt = self.encoding.decode(harmony_tokens)
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{config.INFERENCE_URL}/v1/completions",
                    json={
                        "prompt": harmony_prompt,
                        "temperature": 0.7,
                        "max_tokens": config.MAX_TOKENS,
                        "stream": False
                    },
                    timeout=config.INFERENCE_TIMEOUT
                )
            
            # Parse the response 
            result = response.json()
            raw_response = result.get("choices", [{}])[0].get("text", "")
            
            # Parse using proper Harmony channel parsing to get final content
            return self.parse_harmony_channels(raw_response)
        
        else:
            # Standard chat completions (non-Harmony) 
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{config.INFERENCE_URL}/v1/chat/completions",
                    json={
                        "messages": messages,
                        "temperature": 0.7,
                        "max_tokens": config.MAX_TOKENS
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
            
            # Parse channels even for non-Harmony
            return self.parse_harmony_channels(ai_response)
    
    async def stream_chat_request(self, messages, config, reasoning_effort="low"):
        """
        Stream a chat request with proper backend Harmony channel parsing.
        Backend parses channels and yields ONLY final channel content to frontend.
        """
        import httpx
        import json
        
        # Initialize channel parsing state
        current_channel = None
        buffer = ""
        awaiting_channel_name = False
        awaiting_message = False
        
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
                        "max_tokens": config.MAX_TOKENS,
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
                                    token = choice.get("text", "")
                                    finish_reason = choice.get("finish_reason")
                                    
                                    if token:
                                        # Parse each token for Harmony channel markers
                                        should_yield, current_channel, awaiting_channel_name, awaiting_message = \
                                            self._process_harmony_token(token, current_channel, awaiting_channel_name, awaiting_message)
                                        
                                        # Only yield tokens from final channel
                                        if should_yield:
                                            yield token
                                    
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
                        "max_tokens": config.MAX_TOKENS,
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
                                        # For non-Harmony, still try to parse channels
                                        should_yield, current_channel, awaiting_channel_name, awaiting_message = \
                                            self._process_harmony_token(token, current_channel, awaiting_channel_name, awaiting_message)
                                        
                                        # Only yield tokens from final channel or all if no channels detected
                                        if should_yield or current_channel is None:
                                            yield token
                                    
                                    if finish_reason:
                                        break
                            
                            except json.JSONDecodeError:
                                continue
                            except Exception:
                                continue
    
    def _process_harmony_token(self, token, current_channel, awaiting_channel_name, awaiting_message):
        """
        Process a single token for Harmony channel markers.
        Returns (should_yield, current_channel, awaiting_channel_name, awaiting_message)
        """
        # Handle Harmony control tokens
        if token == '<|channel|>':
            return False, current_channel, True, awaiting_message
        
        if awaiting_channel_name:
            if token in ['final', 'analysis', 'commentary']:
                return False, token, False, awaiting_message
        
        if token == '<|message|>':
            return False, current_channel, awaiting_channel_name, True
        
        # Filter out other control tokens
        if token in ['<|start|>', '<|end|>', '<|return|>', '<|system|>', '<|user|>', '<|assistant|>']:
            return False, current_channel, awaiting_channel_name, awaiting_message
        
        # For content tokens, only yield if we're in final channel and have seen message marker
        if current_channel == 'final' and awaiting_message:
            return True, current_channel, awaiting_channel_name, awaiting_message
        
        # Don't yield tokens from analysis or commentary channels
        return False, current_channel, awaiting_channel_name, awaiting_message