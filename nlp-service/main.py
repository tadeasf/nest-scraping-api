from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uvicorn
from nlp_processor import NLPProcessor

app = FastAPI(
    title="Czech NLP Service",
    description="NLP microservice for Czech language processing",
    version="1.0.0"
)

# CORS middleware for NestJS integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize NLP processor
nlp_processor = NLPProcessor()

class ArticleData(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    content: Optional[str] = None

class TopicModelingRequest(BaseModel):
    articles: List[ArticleData]
    num_topics: int = 10

class SemanticAnalysisRequest(BaseModel):
    articles: List[ArticleData]
    query: Optional[str] = None

class SentimentAnalysisRequest(BaseModel):
    articles: List[ArticleData]

class TopicModelingResponse(BaseModel):
    topics: List[Dict[str, Any]]
    article_topics: List[Dict[str, Any]]

class SemanticAnalysisResponse(BaseModel):
    embeddings: List[Dict[str, Any]]
    similarities: Optional[List[float]] = None

class SentimentAnalysisResponse(BaseModel):
    sentiments: List[Dict[str, Any]]

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "czech-nlp"}

@app.post("/topics", response_model=TopicModelingResponse)
async def analyze_topics(request: TopicModelingRequest):
    """Perform topic modeling on Czech articles"""
    try:
        # Extract text from articles
        texts = []
        for article in request.articles:
            text_parts = [article.title]
            if article.description:
                text_parts.append(article.description)
            if article.content:
                text_parts.append(article.content)
            texts.append(" ".join(text_parts))
        
        # Perform topic modeling
        topics, article_topics = await nlp_processor.analyze_topics(
            texts, request.num_topics
        )
        
        return TopicModelingResponse(
            topics=topics,
            article_topics=article_topics
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/semantic", response_model=SemanticAnalysisResponse)
async def analyze_semantics(request: SemanticAnalysisRequest):
    """Perform semantic analysis on Czech articles"""
    try:
        # Extract text from articles
        texts = []
        for article in request.articles:
            text_parts = [article.title]
            if article.description:
                text_parts.append(article.description)
            texts.append(" ".join(text_parts))
        
        # Perform semantic analysis
        embeddings, similarities = await nlp_processor.analyze_semantics(
            texts, request.query
        )
        
        return SemanticAnalysisResponse(
            embeddings=embeddings,
            similarities=similarities
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/sentiment", response_model=SentimentAnalysisResponse)
async def analyze_sentiment(request: SentimentAnalysisRequest):
    """Perform sentiment analysis on Czech articles"""
    try:
        # Extract text from articles
        texts = []
        for article in request.articles:
            text_parts = [article.title]
            if article.description:
                text_parts.append(article.description)
            if article.content:
                text_parts.append(article.content)
            texts.append(" ".join(text_parts))
        
        # Perform sentiment analysis
        sentiments = await nlp_processor.analyze_sentiment(texts)
        
        return SentimentAnalysisResponse(sentiments=sentiments)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/batch-analysis")
async def batch_analysis(request: List[ArticleData]):
    """Perform all NLP analyses in one request"""
    try:
        # Extract text from articles
        texts = []
        for article in request:
            text_parts = [article.title]
            if article.description:
                text_parts.append(article.description)
            if article.content:
                text_parts.append(article.content)
            texts.append(" ".join(text_parts))
        
        # Perform all analyses
        results = await nlp_processor.batch_analysis(texts)
        
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001) 