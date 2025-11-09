import logging
import os
from functools import lru_cache

import numpy as np
from optimum.onnxruntime import ORTModelForFeatureExtraction
from transformers import AutoTokenizer

EMBED_MODEL_ID = os.getenv("EMBED_MODEL", "BAAI/bge-small-en-v1.5")
logger = logging.getLogger("redix.embed")


@lru_cache(maxsize=1)
def _load_model():
    try:
        model = ORTModelForFeatureExtraction.from_pretrained(
            EMBED_MODEL_ID,
            provider="CPUExecutionProvider",
        )
        tokenizer = AutoTokenizer.from_pretrained(EMBED_MODEL_ID)
        logger.info("Embedding model loaded", extra={"model_id": EMBED_MODEL_ID})
        return model, tokenizer
    except Exception as exc:
        logger.exception("Failed to load embedding model", extra={"model_id": EMBED_MODEL_ID, "error": str(exc)})
        raise


def embed_text(text: str) -> list[float]:
    model, tokenizer = _load_model()
    tokens = tokenizer(
        text,
        return_tensors="np",
        padding=True,
        truncation=True,
        max_length=512,
    )
    outputs = model(**tokens)
    # CLS pooling
    vector = outputs.last_hidden_state[:, 0, :].squeeze(0)
    norm = np.linalg.norm(vector)
    if norm == 0:
        logger.warning("Encountered zero-norm embedding vector; returning zeros")
        return np.zeros(vector.shape, dtype=np.float32).tolist()
    vector = vector / norm
    return vector.tolist()

