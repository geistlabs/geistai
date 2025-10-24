from sentence_transformers import SentenceTransformer, util
import re

model = SentenceTransformer("all-MiniLM-L6-v2")

def extract_relevant_text(markdown: str, query: str, max_chars: int = 4000, max_blocks: int = 100):
    # Preprocess markdown - remove unnecessary formatting
    # Remove markdown headers (keep the text)
    markdown = re.sub(r'^#+\s*', '', markdown, flags=re.MULTILINE)
    
    # Remove markdown links but keep the text
    markdown = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', markdown)
    
    # Remove markdown bold/italic formatting
    markdown = re.sub(r'\*\*([^\*]+)\*\*', r'\1', markdown)  # **bold**
    markdown = re.sub(r'\*([^\*]+)\*', r'\1', markdown)      # *italic*
    markdown = re.sub(r'__([^_]+)__', r'\1', markdown)      # __bold__
    markdown = re.sub(r'_([^_]+)_', r'\1', markdown)        # _italic_
    
    # Remove markdown code blocks but keep the content
    markdown = re.sub(r'```[^`]*```', '', markdown, flags=re.DOTALL)  # Code blocks
    markdown = re.sub(r'`([^`]+)`', r'\1', markdown)                  # Inline code
    
    # Remove markdown lists formatting
    markdown = re.sub(r'^\s*[-*+]\s*', '', markdown, flags=re.MULTILINE)  # Bullet points
    markdown = re.sub(r'^\s*\d+\.\s*', '', markdown, flags=re.MULTILINE)  # Numbered lists
    
    # Remove markdown blockquotes
    markdown = re.sub(r'^\s*>\s*', '', markdown, flags=re.MULTILINE)
    
    # Remove horizontal rules
    markdown = re.sub(r'^[-*_]{3,}$', '', markdown, flags=re.MULTILINE)
    
    # Clean up extra whitespace
    markdown = re.sub(r'\n\s*\n\s*\n+', '\n\n', markdown)  # Multiple newlines to double
    markdown = markdown.strip()
    
    # Split into blocks
    text_blocks = re.split(r'\n\n+', markdown)
    
    # Process blocks
    all_blocks = []
    for block in text_blocks:
        block = block.strip()
        if len(block) > 50:  # Only keep meaningful blocks
            if len(block) > 500:
                # Long blocks - split by single newlines
                sub_blocks = re.split(r'\n+', block)
                all_blocks.extend([b.strip() for b in sub_blocks if len(b.strip()) > 50])
            else:
                # Regular blocks
                all_blocks.append(block)
    
    # Filter and limit blocks
    text_blocks = [block for block in all_blocks if len(block) > 50]
    if len(text_blocks) > max_blocks:
        text_blocks = text_blocks[:max_blocks]
    
    if not text_blocks:
        return ""
    
    # Compute embeddings and similarity
    query_emb = model.encode(query, convert_to_tensor=True)
    block_embs = model.encode(text_blocks, convert_to_tensor=True)
    scores = util.cos_sim(query_emb, block_embs)[0]
    
    # Rank and select
    ranked = sorted(zip(text_blocks, scores), key=lambda x: float(x[1]), reverse=True)
    selected_text = []
    total_len = 0
    
    for block, _ in ranked:
        if total_len + len(block) > max_chars:
            break
        selected_text.append(block)
        total_len += len(block)
    
    return "\n\n".join(selected_text)
