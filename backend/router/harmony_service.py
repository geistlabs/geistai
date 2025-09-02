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