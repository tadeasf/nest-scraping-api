# Czech NLP Microservice

This Python microservice provides Czech language processing capabilities for the NestJS scraping API.

## Features

- **Topic Modeling**: Extract topics from Czech articles using BERTopic
- **Semantic Analysis**: Generate embeddings and find similar articles
- **Sentiment Analysis**: Analyze sentiment (positive/negative/neutral) in Czech text
- **Batch Processing**: Process multiple articles efficiently

## Czech Language Models Used

- **Czert**: Czech BERT model for language representation
- **spaCy Czech**: For text preprocessing and tokenization
- **BERTopic**: For topic modeling with Czech embeddings
- **Sentence Transformers**: For semantic similarity

## Setup

### Prerequisites

- Python 3.11+
- Docker (optional)

### Local Development

1. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Download spaCy Czech model:
```bash
python -m spacy download cs_core_news_sm
```

4. Run the service:
```bash
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### Docker

```bash
docker build -t czech-nlp-service .
docker run -p 8001:8001 czech-nlp-service
```

## API Endpoints

### Health Check
```
GET /health
```

### Topic Modeling
```
POST /topics
{
  "articles": [
    {
      "id": 1,
      "title": "Článek o politice",
      "description": "Popis článku",
      "content": "Obsah článku"
    }
  ],
  "num_topics": 10
}
```

### Semantic Analysis
```
POST /semantic
{
  "articles": [...],
  "query": "optional search query"
}
```

### Sentiment Analysis
```
POST /sentiment
{
  "articles": [...]
}
```

### Batch Analysis
```
POST /batch-analysis
[
  {
    "id": 1,
    "title": "Článek",
    "description": "Popis",
    "content": "Obsah"
  }
]
```

## Integration with NestJS

The NestJS API connects to this service via HTTP. Set the environment variable:

```bash
NLP_SERVICE_URL=http://localhost:8001
```

## Performance Considerations

- **Memory**: Czech NLP models require significant RAM (2-4GB recommended)
- **Processing Time**: Topic modeling can take 10-30 seconds for 100 articles
- **Batch Size**: Limit batch processing to 100 articles for optimal performance
- **Caching**: Consider caching results for frequently analyzed articles

## Czech Language Specifics

### Text Preprocessing
- Lemmatization using spaCy Czech model
- Stopword removal for Czech language
- Punctuation and special character handling

### Sentiment Analysis
- Czech-specific sentiment indicators
- Polarity and subjectivity scoring
- Confidence levels for predictions

### Topic Modeling
- Czech word embeddings
- Domain-specific topic extraction
- Hierarchical topic clustering

## Troubleshooting

### Model Loading Issues
```bash
# Reinstall spaCy Czech model
python -m spacy download cs_core_news_sm --force
```

### Memory Issues
- Increase Docker memory limits
- Process articles in smaller batches
- Use lighter models for development

### Performance Issues
- Use GPU acceleration if available
- Implement result caching
- Optimize batch sizes

## Development

### Adding New Models
1. Update `requirements.txt`
2. Modify `nlp_processor.py`
3. Add new endpoints in `main.py`
4. Update tests

### Testing
```bash
# Run tests (when implemented)
python -m pytest tests/
```

## License

This service is part of the NestJS Scraping API project. 