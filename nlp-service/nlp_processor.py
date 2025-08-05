import asyncio
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from sentence_transformers import SentenceTransformer
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
from bertopic import BERTopic
from sklearn.metrics.pairwise import cosine_similarity
import spacy
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NLPProcessor:
    def __init__(self):
        """Initialize Czech NLP models and processors"""
        self.initialized = False
        self._init_models()
    
    def _init_models(self):
        """Initialize all Czech NLP models"""
        try:
            logger.info("Initializing Czech NLP models...")
            
            # Load Czech sentence transformer for semantic analysis
            self.sentence_model = SentenceTransformer('seznam/czert-base')
            
            # Load Czech sentiment analysis model
            self.sentiment_model = pipeline(
                "sentiment-analysis",
                model="seznam/czert-base",
                tokenizer="seznam/czert-base"
            )
            
            # Load spaCy Czech model for text preprocessing
            try:
                self.nlp = spacy.load("cs_core_news_sm")
            except OSError:
                logger.warning("Czech spaCy model not found. Installing...")
                import subprocess
                subprocess.run(["python", "-m", "spacy", "download", "cs_core_news_sm"])
                self.nlp = spacy.load("cs_core_news_sm")
            
            # Initialize BERTopic for topic modeling
            self.topic_model = BERTopic(
                embedding_model=self.sentence_model,
                language="czech",
                calculate_probabilities=True,
                verbose=True
            )
            
            self.initialized = True
            logger.info("Czech NLP models initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing NLP models: {e}")
            raise
    
    async def analyze_topics(
        self, 
        texts: List[str], 
        num_topics: int = 10
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Perform topic modeling on Czech texts"""
        if not self.initialized:
            raise RuntimeError("NLP models not initialized")
        
        try:
            # Preprocess texts
            processed_texts = await self._preprocess_texts(texts)
            
            # Fit topic model
            topics, probs = self.topic_model.fit_transform(processed_texts)
            
            # Get topic information
            topic_info = self.topic_model.get_topic_info()
            
            # Format topics
            formatted_topics = []
            for _, row in topic_info.head(num_topics).iterrows():
                topic_words = self.topic_model.get_topic(row['Topic'])
                formatted_topics.append({
                    'topic_id': int(row['Topic']),
                    'count': int(row['Count']),
                    'words': [word for word, _ in topic_words[:10]],
                    'weights': [weight for _, weight in topic_words[:10]]
                })
            
            # Format article-topic assignments
            article_topics = []
            for i, (topic_id, prob) in enumerate(zip(topics, probs)):
                article_topics.append({
                    'article_index': i,
                    'primary_topic': int(topic_id),
                    'topic_probabilities': prob.tolist()[:num_topics],
                    'confidence': float(np.max(prob))
                })
            
            return formatted_topics, article_topics
            
        except Exception as e:
            logger.error(f"Error in topic modeling: {e}")
            raise
    
    async def analyze_semantics(
        self, 
        texts: List[str], 
        query: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], Optional[List[float]]]:
        """Perform semantic analysis on Czech texts"""
        if not self.initialized:
            raise RuntimeError("NLP models not initialized")
        
        try:
            # Preprocess texts
            processed_texts = await self._preprocess_texts(texts)
            
            # Generate embeddings
            embeddings = self.sentence_model.encode(processed_texts)
            
            # Format embeddings
            formatted_embeddings = []
            for i, embedding in enumerate(embeddings):
                formatted_embeddings.append({
                    'article_index': i,
                    'embedding': embedding.tolist(),
                    'text_length': len(processed_texts[i])
                })
            
            # Calculate similarities if query provided
            similarities = None
            if query:
                query_embedding = self.sentence_model.encode([query])
                similarities = cosine_similarity(
                    query_embedding, 
                    embeddings
                )[0].tolist()
            
            return formatted_embeddings, similarities
            
        except Exception as e:
            logger.error(f"Error in semantic analysis: {e}")
            raise
    
    async def analyze_sentiment(self, texts: List[str]) -> List[Dict[str, Any]]:
        """Perform sentiment analysis on Czech texts"""
        if not self.initialized:
            raise RuntimeError("NLP models not initialized")
        
        try:
            # Preprocess texts
            processed_texts = await self._preprocess_texts(texts)
            
            # Analyze sentiment
            sentiments = []
            for i, text in enumerate(processed_texts):
                # Use a simple approach for Czech sentiment
                # In production, you'd use a Czech-specific sentiment model
                sentiment_result = await self._analyze_czech_sentiment(text)
                
                sentiments.append({
                    'article_index': i,
                    'sentiment': sentiment_result['sentiment'],
                    'confidence': sentiment_result['confidence'],
                    'polarity': sentiment_result['polarity'],
                    'subjectivity': sentiment_result['subjectivity']
                })
            
            return sentiments
            
        except Exception as e:
            logger.error(f"Error in sentiment analysis: {e}")
            raise
    
    async def batch_analysis(self, texts: List[str]) -> Dict[str, Any]:
        """Perform all NLP analyses in one batch"""
        if not self.initialized:
            raise RuntimeError("NLP models not initialized")
        
        try:
            # Run all analyses concurrently
            tasks = [
                self.analyze_topics(texts, 10),
                self.analyze_semantics(texts),
                self.analyze_sentiment(texts)
            ]
            
            results = await asyncio.gather(*tasks)
            
            return {
                'topics': results[0][0],
                'article_topics': results[0][1],
                'embeddings': results[1][0],
                'sentiments': results[2]
            }
            
        except Exception as e:
            logger.error(f"Error in batch analysis: {e}")
            raise
    
    async def _preprocess_texts(self, texts: List[str]) -> List[str]:
        """Preprocess Czech texts using spaCy"""
        processed_texts = []
        
        for text in texts:
            # Basic preprocessing
            doc = self.nlp(text)
            
            # Extract lemmatized tokens, remove stopwords and punctuation
            tokens = [
                token.lemma_.lower() 
                for token in doc 
                if not token.is_stop and not token.is_punct and token.is_alpha
            ]
            
            processed_text = " ".join(tokens)
            processed_texts.append(processed_text)
        
        return processed_texts
    
    async def _analyze_czech_sentiment(self, text: str) -> Dict[str, Any]:
        """Analyze sentiment for Czech text"""
        # This is a simplified Czech sentiment analysis
        # In production, you'd use a proper Czech sentiment model
        
        # Czech sentiment indicators
        positive_words = [
            'dobrý', 'výborný', 'skvělý', 'úžasný', 'pozitivní', 
            'úspěšný', 'prospěšný', 'nadějný', 'optimistický'
        ]
        negative_words = [
            'špatný', 'horší', 'katastrofický', 'negativní', 
            'problém', 'krize', 'neúspěch', 'pesimistický'
        ]
        
        text_lower = text.lower()
        
        # Count positive and negative words
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        # Calculate sentiment
        total_words = len(text.split())
        if total_words == 0:
            return {
                'sentiment': 'neutral',
                'confidence': 0.5,
                'polarity': 0.0,
                'subjectivity': 0.0
            }
        
        polarity = (positive_count - negative_count) / total_words
        
        if polarity > 0.01:
            sentiment = 'positive'
            confidence = min(0.9, abs(polarity) * 10)
        elif polarity < -0.01:
            sentiment = 'negative'
            confidence = min(0.9, abs(polarity) * 10)
        else:
            sentiment = 'neutral'
            confidence = 0.5
        
        subjectivity = (positive_count + negative_count) / total_words
        
        return {
            'sentiment': sentiment,
            'confidence': confidence,
            'polarity': polarity,
            'subjectivity': min(1.0, subjectivity)
        } 