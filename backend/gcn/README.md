GCN microservice

This microservice provides a simple Graph Convolutional Network (GCN) endpoint for scoring stocks.

Quick start (inside dev container):

1. Create a Python virtualenv (recommended):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Run the service:

```bash
uvicorn app:app --host 0.0.0.0 --port 8000
```

3. POST `/gcn/predict` with payload { nodes: [...], features: [[...],...], adjacency: [[i,j],...] }

The service returns normalized scores (0-100) per node.
