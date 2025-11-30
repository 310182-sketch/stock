"""
GCN 模型模組 - 擴展版
包含多種圖神經網路架構和工具函數
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from typing import Optional, Tuple, List


# ============================================
# 基礎 GCN 層
# ============================================

class GraphConvLayer(nn.Module):
    """基礎圖卷積層"""
    
    def __init__(self, in_features: int, out_features: int, bias: bool = True):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        
        self.weight = nn.Parameter(torch.FloatTensor(in_features, out_features))
        if bias:
            self.bias = nn.Parameter(torch.FloatTensor(out_features))
        else:
            self.register_parameter('bias', None)
        
        self.reset_parameters()
    
    def reset_parameters(self):
        nn.init.xavier_uniform_(self.weight)
        if self.bias is not None:
            nn.init.zeros_(self.bias)
    
    def forward(self, x: torch.Tensor, adj: torch.Tensor) -> torch.Tensor:
        """
        前向傳播
        Args:
            x: 節點特徵 [N, in_features]
            adj: 鄰接矩陣 [N, N]
        Returns:
            輸出特徵 [N, out_features]
        """
        support = torch.mm(x, self.weight)
        output = torch.mm(adj, support)
        
        if self.bias is not None:
            output = output + self.bias
        
        return output


class GraphAttentionLayer(nn.Module):
    """圖注意力層 (GAT)"""
    
    def __init__(
        self, 
        in_features: int, 
        out_features: int, 
        dropout: float = 0.1,
        alpha: float = 0.2,
        concat: bool = True
    ):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.dropout = dropout
        self.alpha = alpha
        self.concat = concat
        
        self.W = nn.Parameter(torch.FloatTensor(in_features, out_features))
        self.a = nn.Parameter(torch.FloatTensor(2 * out_features, 1))
        
        self.leakyrelu = nn.LeakyReLU(self.alpha)
        self.reset_parameters()
    
    def reset_parameters(self):
        nn.init.xavier_uniform_(self.W)
        nn.init.xavier_uniform_(self.a)
    
    def forward(self, x: torch.Tensor, adj: torch.Tensor) -> torch.Tensor:
        """
        前向傳播
        Args:
            x: 節點特徵 [N, in_features]
            adj: 鄰接矩陣 [N, N]
        Returns:
            輸出特徵 [N, out_features]
        """
        N = x.size(0)
        h = torch.mm(x, self.W)  # [N, out_features]
        
        # 計算注意力係數
        a_input = torch.cat([
            h.repeat(1, N).view(N * N, -1),
            h.repeat(N, 1)
        ], dim=1).view(N, N, 2 * self.out_features)
        
        e = self.leakyrelu(torch.matmul(a_input, self.a).squeeze(2))
        
        # 遮罩非鄰接節點
        zero_vec = -9e15 * torch.ones_like(e)
        attention = torch.where(adj > 0, e, zero_vec)
        attention = F.softmax(attention, dim=1)
        attention = F.dropout(attention, self.dropout, training=self.training)
        
        h_prime = torch.matmul(attention, h)
        
        if self.concat:
            return F.elu(h_prime)
        else:
            return h_prime


# ============================================
# GCN 模型
# ============================================

class SimpleGCN(nn.Module):
    """簡單 GCN 模型（向後相容）"""
    
    def __init__(self, in_feats: int, hidden: int = 32, out_feats: int = 1):
        super().__init__()
        self.fc1 = nn.Linear(in_feats, hidden)
        self.fc2 = nn.Linear(hidden, out_feats)
    
    def forward(self, x: torch.Tensor, adj_norm: torch.Tensor) -> torch.Tensor:
        h = torch.matmul(adj_norm, x)
        h = self.fc1(h)
        h = F.relu(h)
        h = torch.matmul(adj_norm, h)
        h = self.fc2(h)
        return h.squeeze(-1)


class DeepGCN(nn.Module):
    """深層 GCN 模型"""
    
    def __init__(
        self, 
        in_feats: int, 
        hidden_dims: List[int] = [64, 32, 16],
        out_feats: int = 1,
        dropout: float = 0.2,
        use_bn: bool = True
    ):
        super().__init__()
        
        self.dropout = dropout
        self.use_bn = use_bn
        
        # 建立層
        dims = [in_feats] + hidden_dims
        self.convs = nn.ModuleList()
        self.bns = nn.ModuleList() if use_bn else None
        
        for i in range(len(dims) - 1):
            self.convs.append(GraphConvLayer(dims[i], dims[i + 1]))
            if use_bn:
                self.bns.append(nn.BatchNorm1d(dims[i + 1]))
        
        # 輸出層
        self.out_layer = nn.Linear(hidden_dims[-1], out_feats)
    
    def forward(self, x: torch.Tensor, adj: torch.Tensor) -> torch.Tensor:
        """前向傳播"""
        for i, conv in enumerate(self.convs):
            x = conv(x, adj)
            if self.use_bn:
                x = self.bns[i](x)
            x = F.relu(x)
            x = F.dropout(x, self.dropout, training=self.training)
        
        return self.out_layer(x).squeeze(-1)


class GATModel(nn.Module):
    """圖注意力網路模型"""
    
    def __init__(
        self,
        in_feats: int,
        hidden: int = 64,
        out_feats: int = 1,
        heads: int = 4,
        dropout: float = 0.2
    ):
        super().__init__()
        
        self.dropout = dropout
        
        # 多頭注意力層
        self.attention_layers = nn.ModuleList([
            GraphAttentionLayer(in_feats, hidden, dropout, concat=True)
            for _ in range(heads)
        ])
        
        # 輸出層
        self.out_attention = GraphAttentionLayer(
            hidden * heads, out_feats, dropout, concat=False
        )
    
    def forward(self, x: torch.Tensor, adj: torch.Tensor) -> torch.Tensor:
        """前向傳播"""
        x = F.dropout(x, self.dropout, training=self.training)
        
        # 多頭注意力
        x = torch.cat([att(x, adj) for att in self.attention_layers], dim=1)
        x = F.dropout(x, self.dropout, training=self.training)
        
        # 輸出
        x = self.out_attention(x, adj)
        return x.squeeze(-1)


class HybridGCN(nn.Module):
    """混合模型：結合 GCN、LSTM 和 Attention"""
    
    def __init__(
        self,
        in_feats: int,
        gcn_hidden: int = 32,
        lstm_hidden: int = 32,
        out_feats: int = 1,
        dropout: float = 0.2
    ):
        super().__init__()
        
        self.dropout = dropout
        
        # GCN 分支
        self.gcn1 = GraphConvLayer(in_feats, gcn_hidden)
        self.gcn2 = GraphConvLayer(gcn_hidden, gcn_hidden)
        
        # MLP 分支
        self.mlp = nn.Sequential(
            nn.Linear(in_feats, gcn_hidden),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(gcn_hidden, gcn_hidden)
        )
        
        # 融合層
        self.fusion = nn.Sequential(
            nn.Linear(gcn_hidden * 2, gcn_hidden),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(gcn_hidden, out_feats)
        )
        
        # 注意力權重
        self.attention = nn.Sequential(
            nn.Linear(gcn_hidden * 2, 2),
            nn.Softmax(dim=-1)
        )
    
    def forward(self, x: torch.Tensor, adj: torch.Tensor) -> torch.Tensor:
        """前向傳播"""
        # GCN 分支
        h_gcn = F.relu(self.gcn1(x, adj))
        h_gcn = F.dropout(h_gcn, self.dropout, training=self.training)
        h_gcn = self.gcn2(h_gcn, adj)
        
        # MLP 分支
        h_mlp = self.mlp(x)
        
        # 注意力加權融合
        combined = torch.cat([h_gcn, h_mlp], dim=-1)
        weights = self.attention(combined)
        
        h_fused = weights[:, 0:1] * h_gcn + weights[:, 1:2] * h_mlp
        
        # 輸出
        out = self.fusion(torch.cat([h_gcn, h_mlp], dim=-1))
        return out.squeeze(-1)


# ============================================
# 時序 GCN 模型
# ============================================

class TemporalGCN(nn.Module):
    """時序圖卷積網路：處理時間序列股票數據"""
    
    def __init__(
        self,
        in_feats: int,
        seq_len: int = 20,
        hidden: int = 32,
        out_feats: int = 1,
        num_layers: int = 2,
        dropout: float = 0.2
    ):
        super().__init__()
        
        self.seq_len = seq_len
        self.hidden = hidden
        self.dropout = dropout
        
        # 時間特徵編碼
        self.temporal_encoder = nn.LSTM(
            in_feats, hidden, num_layers,
            batch_first=True, dropout=dropout
        )
        
        # 空間 GCN
        self.gcn1 = GraphConvLayer(hidden, hidden)
        self.gcn2 = GraphConvLayer(hidden, hidden)
        
        # 時空融合
        self.fusion = nn.Sequential(
            nn.Linear(hidden * 2, hidden),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden, out_feats)
        )
    
    def forward(
        self, 
        x_seq: torch.Tensor,  # [N, T, F]
        adj: torch.Tensor      # [N, N]
    ) -> torch.Tensor:
        """前向傳播"""
        N, T, F = x_seq.shape
        
        # 時間編碼
        _, (h_n, _) = self.temporal_encoder(x_seq)
        h_temporal = h_n[-1]  # [N, hidden]
        
        # 空間聚合
        x_current = x_seq[:, -1, :]  # 取最新時間點
        h_spatial = F.relu(self.gcn1(x_current, adj))
        h_spatial = F.dropout(h_spatial, self.dropout, training=self.training)
        h_spatial = self.gcn2(h_spatial, adj)
        
        # 融合
        h_fused = torch.cat([h_temporal, h_spatial], dim=-1)
        return self.fusion(h_fused).squeeze(-1)


# ============================================
# 工具函數
# ============================================

def normalize_adjacency(adj: torch.Tensor) -> torch.Tensor:
    """
    正規化鄰接矩陣：D^(-1/2) * A * D^(-1/2)
    """
    # 加入自環
    adj = adj + torch.eye(adj.size(0), device=adj.device)
    
    # 計算度矩陣
    degree = adj.sum(dim=1)
    degree_inv_sqrt = torch.pow(degree, -0.5)
    degree_inv_sqrt[torch.isinf(degree_inv_sqrt)] = 0
    
    # 正規化
    D_inv_sqrt = torch.diag(degree_inv_sqrt)
    return torch.mm(torch.mm(D_inv_sqrt, adj), D_inv_sqrt)


def build_correlation_graph(
    returns: np.ndarray,
    threshold: float = 0.3
) -> np.ndarray:
    """
    基於相關性建立股票關係圖
    
    Args:
        returns: 報酬率矩陣 [N, T]
        threshold: 相關性閾值
    
    Returns:
        鄰接矩陣 [N, N]
    """
    # 計算相關性矩陣
    corr_matrix = np.corrcoef(returns)
    
    # 根據閾值建立鄰接矩陣
    adj = (np.abs(corr_matrix) > threshold).astype(np.float32)
    np.fill_diagonal(adj, 0)  # 移除自環
    
    return adj


def build_sector_graph(sectors: List[str]) -> np.ndarray:
    """
    基於產業類別建立股票關係圖
    
    Args:
        sectors: 每支股票的產業類別
    
    Returns:
        鄰接矩陣 [N, N]
    """
    n = len(sectors)
    adj = np.zeros((n, n), dtype=np.float32)
    
    for i in range(n):
        for j in range(i + 1, n):
            if sectors[i] == sectors[j]:
                adj[i, j] = 1
                adj[j, i] = 1
    
    return adj


def build_knn_graph(
    features: np.ndarray,
    k: int = 5
) -> np.ndarray:
    """
    基於 K 近鄰建立股票關係圖
    
    Args:
        features: 特徵矩陣 [N, F]
        k: 近鄰數量
    
    Returns:
        鄰接矩陣 [N, N]
    """
    from sklearn.neighbors import kneighbors_graph
    
    adj = kneighbors_graph(features, k, mode='connectivity', include_self=False)
    adj = adj.toarray()
    
    # 轉為無向圖
    adj = np.maximum(adj, adj.T)
    
    return adj.astype(np.float32)


# ============================================
# 損失函數
# ============================================

class RankingLoss(nn.Module):
    """排序損失：鼓勵模型學習正確的股票排序"""
    
    def __init__(self, margin: float = 0.1):
        super().__init__()
        self.margin = margin
    
    def forward(
        self, 
        predictions: torch.Tensor,  # [N]
        targets: torch.Tensor       # [N] 真實報酬
    ) -> torch.Tensor:
        """計算排序損失"""
        n = predictions.size(0)
        
        # 產生所有配對
        pred_diff = predictions.unsqueeze(1) - predictions.unsqueeze(0)  # [N, N]
        target_diff = targets.unsqueeze(1) - targets.unsqueeze(0)  # [N, N]
        
        # 計算損失
        sign = torch.sign(target_diff)
        loss = F.relu(self.margin - sign * pred_diff)
        
        # 只計算上三角（避免重複）
        mask = torch.triu(torch.ones(n, n), diagonal=1).bool().to(predictions.device)
        
        return loss[mask].mean()


class CombinedLoss(nn.Module):
    """組合損失：MSE + Ranking"""
    
    def __init__(self, alpha: float = 0.5, margin: float = 0.1):
        super().__init__()
        self.alpha = alpha
        self.mse = nn.MSELoss()
        self.ranking = RankingLoss(margin)
    
    def forward(
        self, 
        predictions: torch.Tensor,
        targets: torch.Tensor
    ) -> torch.Tensor:
        """計算組合損失"""
        mse_loss = self.mse(predictions, targets)
        rank_loss = self.ranking(predictions, targets)
        return self.alpha * mse_loss + (1 - self.alpha) * rank_loss


# ============================================
# 模型工廠
# ============================================

def create_model(
    model_type: str,
    in_feats: int,
    **kwargs
) -> nn.Module:
    """
    創建模型
    
    Args:
        model_type: 模型類型
        in_feats: 輸入特徵數
        **kwargs: 其他參數
    
    Returns:
        模型實例
    """
    models = {
        'simple': SimpleGCN,
        'deep': DeepGCN,
        'gat': GATModel,
        'hybrid': HybridGCN,
        'temporal': TemporalGCN
    }
    
    if model_type not in models:
        raise ValueError(f"Unknown model type: {model_type}")
    
    return models[model_type](in_feats, **kwargs)


# ============================================
# 模型評估
# ============================================

def evaluate_predictions(
    predictions: np.ndarray,
    targets: np.ndarray
) -> dict:
    """
    評估預測結果
    
    Args:
        predictions: 預測分數
        targets: 真實報酬
    
    Returns:
        評估指標
    """
    from scipy import stats
    
    # 排序相關性
    spearman_corr, spearman_p = stats.spearmanr(predictions, targets)
    pearson_corr, pearson_p = stats.pearsonr(predictions, targets)
    
    # 分組準確度
    n = len(predictions)
    top_k = n // 5  # Top 20%
    
    pred_top = set(np.argsort(predictions)[-top_k:])
    actual_top = set(np.argsort(targets)[-top_k:])
    
    precision = len(pred_top & actual_top) / top_k
    
    # IC (Information Coefficient)
    ic = np.corrcoef(predictions, targets)[0, 1]
    
    # RMSE
    rmse = np.sqrt(np.mean((predictions - targets) ** 2))
    
    return {
        'spearman_corr': float(spearman_corr),
        'pearson_corr': float(pearson_corr),
        'top20_precision': float(precision),
        'ic': float(ic) if not np.isnan(ic) else 0,
        'rmse': float(rmse)
    }
