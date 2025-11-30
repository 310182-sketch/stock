"""
GCN 微服務 - 擴展版
提供多種圖神經網路 API 端點
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import numpy as np
import torch
import torch.optim as optim
import torch.nn.functional as F
from model import (
    SimpleGCN, DeepGCN, GATModel, HybridGCN,
    normalize_adjacency, build_correlation_graph, build_knn_graph,
    RankingLoss, CombinedLoss, create_model, evaluate_predictions
)
import uvicorn
import logging
from datetime import datetime

# 設置日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="GCN 股票分析服務",
    description="基於圖神經網路的股票關係分析與評分服務",
    version="2.0.0"
)

# CORS 設置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# ============================================
# 請求/回應模型
# ============================================

class GCNRequest(BaseModel):
    """基本 GCN 預測請求"""
    nodes: List[str]
    features: List[List[float]]
    adjacency: List[List[int]]
    train_epochs: int = 0

class GCNResponse(BaseModel):
    """GCN 預測回應"""
    scores: Dict[str, float]
    info: Dict[str, Any]

class AdvancedGCNRequest(BaseModel):
    """進階 GCN 請求"""
    nodes: List[str]
    features: List[List[float]]
    adjacency: Optional[List[List[int]]] = None
    returns: Optional[List[List[float]]] = None  # 用於建立相關性圖
    model_type: str = Field(default="simple", description="模型類型: simple, deep, gat, hybrid")
    train_epochs: int = Field(default=50, ge=0, le=500)
    hidden_dim: int = Field(default=32, ge=8, le=256)
    dropout: float = Field(default=0.2, ge=0, le=0.5)
    learning_rate: float = Field(default=0.01, ge=0.0001, le=0.1)
    correlation_threshold: float = Field(default=0.3, ge=0, le=1)
    use_knn_graph: bool = False
    knn_k: int = Field(default=5, ge=1, le=20)

class MultiModelRequest(BaseModel):
    """多模型比較請求"""
    nodes: List[str]
    features: List[List[float]]
    adjacency: Optional[List[List[int]]] = None
    model_types: List[str] = ["simple", "deep", "gat"]
    train_epochs: int = 50
    returns: Optional[List[List[float]]] = None

class StockClusterRequest(BaseModel):
    """股票聚類請求"""
    nodes: List[str]
    features: List[List[float]]
    n_clusters: int = Field(default=5, ge=2, le=20)

class FeatureImportanceRequest(BaseModel):
    """特徵重要性分析請求"""
    nodes: List[str]
    features: List[List[float]]
    feature_names: List[str]
    adjacency: List[List[int]]

# ============================================
# 工具函數
# ============================================

def build_adj_matrix(n: int, edges: List[List[int]]) -> np.ndarray:
    """建立鄰接矩陣"""
    A = np.zeros((n, n), dtype=np.float32)
    for e in edges:
        if len(e) >= 2:
            i, j = e[0], e[1]
            if 0 <= i < n and 0 <= j < n:
                A[i, j] = 1.0
                A[j, i] = 1.0
    # 加入自環
    for i in range(n):
        A[i, i] = 1.0
    return A

def normalize_adj(A: np.ndarray) -> np.ndarray:
    """正規化鄰接矩陣"""
    D = np.sum(A, axis=1)
    D_inv_sqrt = np.where(D > 0, 1.0 / np.sqrt(D), 0.0)
    D_mat = np.diag(D_inv_sqrt)
    return D_mat @ A @ D_mat

def normalize_scores(scores: np.ndarray) -> List[float]:
    """正規化分數到 0-100"""
    s_min, s_max = float(scores.min()), float(scores.max())
    if s_max - s_min < 1e-6:
        return [50.0 for _ in scores]
    return [100.0 * (s - s_min) / (s_max - s_min) for s in scores]

def train_model(
    model: torch.nn.Module,
    x: torch.Tensor,
    adj: torch.Tensor,
    epochs: int,
    lr: float = 0.01,
    loss_type: str = "smooth"
) -> Dict[str, Any]:
    """訓練模型"""
    device = x.device
    optimizer = optim.Adam(model.parameters(), lr=lr)
    
    training_history = []
    
    for epoch in range(epochs):
        model.train()
        optimizer.zero_grad()
        out = model(x, adj)
        
        if loss_type == "smooth":
            # 平滑性損失
            n = adj.shape[0]
            loss_smooth = 0.0
            for i in range(n):
                neigh = torch.where(adj[i] > 0)[0]
                if len(neigh) > 0:
                    diffs = out[i] - out[neigh]
                    loss_smooth += diffs.pow(2).mean()
            loss_smooth = loss_smooth / max(1, n)
            
            # 方差正則化
            loss_var = -out.var()
            loss = loss_smooth + 0.1 * loss_var
            
        elif loss_type == "contrast":
            # 對比損失
            pos_mask = adj > 0
            neg_mask = adj == 0
            
            out_sim = torch.mm(out.unsqueeze(1), out.unsqueeze(0).transpose(-1, -2)).squeeze()
            
            pos_loss = -torch.log(torch.sigmoid(out_sim[pos_mask])).mean()
            neg_loss = -torch.log(1 - torch.sigmoid(out_sim[neg_mask])).mean()
            loss = pos_loss + neg_loss
        else:
            loss = out.var() * -1
        
        loss.backward()
        optimizer.step()
        
        if epoch % 10 == 0:
            training_history.append({
                "epoch": epoch,
                "loss": float(loss.item())
            })
    
    return {"final_loss": float(loss.item()), "history": training_history}

# ============================================
# API 端點
# ============================================

@app.get("/")
async def root():
    """服務首頁"""
    return {
        "service": "GCN 股票分析服務",
        "version": "2.0.0",
        "endpoints": [
            "/gcn/predict",
            "/gcn/advanced",
            "/gcn/compare",
            "/gcn/cluster",
            "/gcn/importance",
            "/health"
        ]
    }

@app.get("/health")
async def health_check():
    """健康檢查"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "torch_version": torch.__version__,
        "cuda_available": torch.cuda.is_available()
    }

@app.post("/gcn/predict", response_model=GCNResponse)
async def gcn_predict(req: GCNRequest):
    """基本 GCN 預測（向後相容）"""
    try:
        nodes = req.nodes
        X = np.array(req.features, dtype=np.float32)
        edges = req.adjacency
        n, f = X.shape
        
        if n == 0:
            return {"scores": {}, "info": {"error": "no nodes"}}
        
        A = build_adj_matrix(n, edges)
        A_norm = normalize_adj(A)
        
        device = torch.device('cpu')
        x = torch.from_numpy(X).to(device)
        adj_norm = torch.from_numpy(A_norm).to(device)
        
        model = SimpleGCN(in_feats=f, hidden=max(16, f * 2), out_feats=1)
        model.to(device)
        
        if req.train_epochs > 0:
            train_info = train_model(model, x, adj_norm, req.train_epochs)
        else:
            train_info = {}
        
        model.eval()
        with torch.no_grad():
            scores_tensor = model(x, adj_norm).cpu().numpy()
        
        norm_scores = normalize_scores(scores_tensor)
        scores = {nodes[i]: float(norm_scores[i]) for i in range(n)}
        
        info = {
            "n_nodes": n,
            "n_features": f,
            "train_epochs": req.train_epochs,
            "training": train_info
        }
        
        return {"scores": scores, "info": info}
        
    except Exception as e:
        logger.error(f"GCN predict error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/gcn/advanced")
async def gcn_advanced(req: AdvancedGCNRequest):
    """進階 GCN 預測"""
    try:
        nodes = req.nodes
        X = np.array(req.features, dtype=np.float32)
        n, f = X.shape
        
        if n == 0:
            raise HTTPException(status_code=400, detail="No nodes provided")
        
        # 建立圖結構
        if req.adjacency:
            A = build_adj_matrix(n, req.adjacency)
        elif req.returns:
            returns = np.array(req.returns, dtype=np.float32)
            A = build_correlation_graph(returns, req.correlation_threshold)
            A = A + np.eye(n)  # 加入自環
        elif req.use_knn_graph:
            A = build_knn_graph(X, req.knn_k)
            A = A + np.eye(n)
        else:
            # 全連接圖
            A = np.ones((n, n), dtype=np.float32)
        
        A_norm = normalize_adj(A)
        
        device = torch.device('cpu')
        x = torch.from_numpy(X).to(device)
        adj = torch.from_numpy(A_norm).to(device)
        
        # 建立模型
        model = create_model(
            req.model_type,
            in_feats=f,
            hidden=req.hidden_dim if req.model_type == "simple" else None,
            hidden_dims=[req.hidden_dim, req.hidden_dim // 2] if req.model_type == "deep" else None,
            dropout=req.dropout
        )
        model.to(device)
        
        # 訓練
        train_info = {}
        if req.train_epochs > 0:
            train_info = train_model(
                model, x, adj, req.train_epochs, req.learning_rate
            )
        
        # 預測
        model.eval()
        with torch.no_grad():
            scores_tensor = model(x, adj).cpu().numpy()
        
        norm_scores = normalize_scores(scores_tensor)
        scores = {nodes[i]: float(norm_scores[i]) for i in range(n)}
        
        # 排序
        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        
        return {
            "scores": scores,
            "ranking": [{"rank": i + 1, "node": k, "score": v} for i, (k, v) in enumerate(ranked)],
            "model_type": req.model_type,
            "info": {
                "n_nodes": n,
                "n_features": f,
                "n_edges": int(A.sum() - n),
                "train_epochs": req.train_epochs,
                "training": train_info
            }
        }
        
    except Exception as e:
        logger.error(f"Advanced GCN error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/gcn/compare")
async def gcn_compare(req: MultiModelRequest):
    """多模型比較"""
    try:
        nodes = req.nodes
        X = np.array(req.features, dtype=np.float32)
        n, f = X.shape
        
        if n == 0:
            raise HTTPException(status_code=400, detail="No nodes provided")
        
        # 建立圖
        if req.adjacency:
            A = build_adj_matrix(n, req.adjacency)
        elif req.returns:
            returns = np.array(req.returns, dtype=np.float32)
            A = build_correlation_graph(returns, 0.3)
            A = A + np.eye(n)
        else:
            A = np.ones((n, n), dtype=np.float32)
        
        A_norm = normalize_adj(A)
        
        device = torch.device('cpu')
        x = torch.from_numpy(X).to(device)
        adj = torch.from_numpy(A_norm).to(device)
        
        results = {}
        
        for model_type in req.model_types:
            try:
                model = create_model(model_type, in_feats=f)
                model.to(device)
                
                if req.train_epochs > 0:
                    train_model(model, x, adj, req.train_epochs)
                
                model.eval()
                with torch.no_grad():
                    scores = model(x, adj).cpu().numpy()
                
                norm_scores = normalize_scores(scores)
                results[model_type] = {
                    "scores": {nodes[i]: float(norm_scores[i]) for i in range(n)},
                    "top5": sorted(
                        [(nodes[i], norm_scores[i]) for i in range(n)],
                        key=lambda x: x[1], reverse=True
                    )[:5]
                }
            except Exception as e:
                results[model_type] = {"error": str(e)}
        
        # 計算模型間一致性
        if len(results) >= 2:
            score_lists = [
                [r["scores"][n] for n in nodes] 
                for r in results.values() 
                if "scores" in r
            ]
            if len(score_lists) >= 2:
                from scipy.stats import spearmanr
                correlations = []
                model_names = [k for k in results.keys() if "scores" in results[k]]
                for i in range(len(score_lists)):
                    for j in range(i + 1, len(score_lists)):
                        corr, _ = spearmanr(score_lists[i], score_lists[j])
                        correlations.append({
                            "model1": model_names[i],
                            "model2": model_names[j],
                            "spearman": float(corr)
                        })
                results["model_agreement"] = correlations
        
        return {
            "results": results,
            "n_nodes": n,
            "n_features": f
        }
        
    except Exception as e:
        logger.error(f"Compare error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/gcn/cluster")
async def gcn_cluster(req: StockClusterRequest):
    """股票聚類分析"""
    try:
        from sklearn.cluster import KMeans
        from sklearn.decomposition import PCA
        
        nodes = req.nodes
        X = np.array(req.features, dtype=np.float32)
        n, f = X.shape
        
        if n < req.n_clusters:
            raise HTTPException(
                status_code=400, 
                detail=f"節點數 {n} 小於聚類數 {req.n_clusters}"
            )
        
        # K-Means 聚類
        kmeans = KMeans(n_clusters=req.n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X)
        
        # PCA 降維用於視覺化
        if f > 2:
            pca = PCA(n_components=2)
            coords = pca.fit_transform(X)
            explained_var = pca.explained_variance_ratio_.tolist()
        else:
            coords = X
            explained_var = [1.0, 0.0]
        
        # 整理結果
        clusters = {}
        for i, label in enumerate(labels):
            label_str = str(label)
            if label_str not in clusters:
                clusters[label_str] = []
            clusters[label_str].append({
                "node": nodes[i],
                "x": float(coords[i, 0]),
                "y": float(coords[i, 1])
            })
        
        # 計算每個聚類的中心
        cluster_centers = []
        for i in range(req.n_clusters):
            center = kmeans.cluster_centers_[i]
            cluster_centers.append({
                "cluster": i,
                "center": center.tolist(),
                "size": len(clusters.get(str(i), []))
            })
        
        return {
            "clusters": clusters,
            "cluster_centers": cluster_centers,
            "node_labels": {nodes[i]: int(labels[i]) for i in range(n)},
            "pca_explained_variance": explained_var,
            "n_clusters": req.n_clusters
        }
        
    except Exception as e:
        logger.error(f"Cluster error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/gcn/importance")
async def feature_importance(req: FeatureImportanceRequest):
    """特徵重要性分析"""
    try:
        nodes = req.nodes
        X = np.array(req.features, dtype=np.float32)
        n, f = X.shape
        
        if len(req.feature_names) != f:
            raise HTTPException(
                status_code=400,
                detail=f"特徵名稱數量 {len(req.feature_names)} 與特徵數 {f} 不符"
            )
        
        A = build_adj_matrix(n, req.adjacency)
        A_norm = normalize_adj(A)
        
        device = torch.device('cpu')
        x = torch.from_numpy(X).to(device)
        adj = torch.from_numpy(A_norm).to(device)
        
        model = SimpleGCN(in_feats=f, hidden=32, out_feats=1)
        model.to(device)
        
        # 訓練模型
        train_model(model, x, adj, epochs=100)
        
        # 特徵重要性（梯度方法）
        model.eval()
        x.requires_grad = True
        out = model(x, adj)
        out.sum().backward()
        
        gradients = x.grad.abs().mean(dim=0).cpu().numpy()
        
        # 正規化
        importance = gradients / gradients.sum()
        
        feature_importance = [
            {"feature": req.feature_names[i], "importance": float(importance[i])}
            for i in range(f)
        ]
        feature_importance.sort(key=lambda x: x["importance"], reverse=True)
        
        return {
            "feature_importance": feature_importance,
            "top_features": feature_importance[:5],
            "method": "gradient_based"
        }
        
    except Exception as e:
        logger.error(f"Importance error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# 啟動服務
# ============================================

if __name__ == '__main__':
    logger.info("🚀 啟動 GCN 微服務...")
    uvicorn.run(
        app, 
        host='0.0.0.0', 
        port=8000,
        log_level="info"
    )
