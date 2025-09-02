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