from bs4 import BeautifulSoup
from sentence_transformers import SentenceTransformer, util
import re

model = SentenceTransformer("all-MiniLM-L6-v2")

def extract_relevant_text(html: str, url: str, query: str, max_chars: int = 4000):
    soup = BeautifulSoup(html, "html.parser")

    # Remove non-visible elements
    for tag in soup(["script", "style", "noscript", "header", "footer", "svg", "nav"]):
        tag.decompose()

    # Extract readable text
    text_blocks = [t.strip() for t in soup.stripped_strings if len(t.strip()) > 50]

    # Compute embeddings
    query_emb = model.encode(query, convert_to_tensor=True)
    block_embs = model.encode(text_blocks, convert_to_tensor=True)

    # Compute semantic similarity
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
