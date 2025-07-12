"""
Enhanced SHAP utilities for explainability.
"""
import base64
import io
import json
from typing import Dict, List, Any, Optional, Tuple
import pandas as pd
import numpy as np
import warnings
from functools import lru_cache

# Suppress matplotlib warnings
warnings.filterwarnings('ignore')

# Try to import matplotlib and shap with better error handling
try:
    import matplotlib.pyplot as plt
    import seaborn as sns
except ImportError as e:
    plt = None
    sns = None

try:
    import shap
    from shap import TreeExplainer, KernelExplainer
except ImportError as e:
    shap = None
    TreeExplainer = None
    KernelExplainer = None

class SHAPExplainer:
    """Enhanced SHAP explainer with visualization and formatting capabilities."""
    
    def __init__(self, model=None):
        self.model = model
        self.explainer = None
        self.feature_names = [
            'Age', 'SystolicBP', 'DiastolicBP', 'BS', 'BodyTemp', 'HeartRate'
        ]
        self.feature_descriptions = {
            'Age': 'Patient age in years',
            'SystolicBP': 'Systolic blood pressure (mmHg)',
            'DiastolicBP': 'Diastolic blood pressure (mmHg)',
            'BS': 'Blood sugar level (mmol/L)',
            'BodyTemp': 'Body temperature (°F)',
            'HeartRate': 'Heart rate (beats per minute)'
        }
        self._initialize_explainer()
    
    def _initialize_explainer(self):
        """Initialize the appropriate SHAP explainer for the model."""
        if self.model is None or shap is None:
            return
        
        try:
            # Handle MaternalRiskPipeline model
            if hasattr(self.model, 'model'):
                # This is a pipeline model, get the underlying model
                underlying_model = self.model.model
                
                # For calibrated XGBoost, try to access the base estimator
                if hasattr(underlying_model, 'base_estimator'):
                    # CalibratedClassifierCV wraps the base estimator
                    base_estimator = underlying_model.base_estimator
                    if hasattr(base_estimator, 'feature_importances_'):
                        try:
                            self.explainer = TreeExplainer(base_estimator)
                            print("Using TreeExplainer with calibrated XGBoost base estimator")
                            return
                        except Exception as e:
                
                # Try TreeExplainer directly on the calibrated model
                if hasattr(underlying_model, 'feature_importances_'):
                    try:
                        self.explainer = TreeExplainer(underlying_model)
                        print("Using TreeExplainer with calibrated model")
                        return
                    except Exception as e:
                
                # Fallback to KernelExplainer for other models
                # Create background data for KernelExplainer
                background_data = np.array([
                    [25, 120, 80, 8, 98.6, 70],
                    [30, 130, 85, 9, 99.0, 75],
                    [35, 140, 90, 10, 99.5, 80],
                    [40, 150, 95, 11, 100.0, 85]
                ])
                background_df = pd.DataFrame(background_data, columns=pd.Index(self.feature_names))
                
                # Use the pipeline's predict method with proper data format
                def predict_wrapper(data):
                    if self.model is None:
                        return np.zeros(1)
                    df = self._to_feature_df(data)
                    # Get the full prediction result from pipeline
                    result = self.model.predict(df)
                    # Extract just the predicted risk level indices for SHAP
                    # The pipeline returns a list of dicts, we need to extract the risk level
                    if isinstance(result, list) and len(result) > 0:
                        # Get the predicted risk level from each result
                        risk_mapping = {'high risk': 2, 'mid risk': 1, 'low risk': 0}
                        risk_indices = []
                        for res in result:
                            risk_level = res.get('predicted_risk_level', 'low risk')
                            risk_indices.append(risk_mapping.get(risk_level, 0))
                        return np.array(risk_indices)
                    else:
                        return np.zeros(df.shape[0])
                
                try:
                    self.explainer = KernelExplainer(predict_wrapper, background_df)
                    print("Using KernelExplainer (fallback)")
                except Exception as e:
                    self.explainer = None
            else:
                # Direct model
                if hasattr(self.model, 'feature_importances_'):
                    try:
                        self.explainer = TreeExplainer(self.model)
                        print("Using TreeExplainer with direct model")
                    except Exception as e:
                        self.explainer = None
                else:
                    # Fallback to KernelExplainer
                    background_data = np.array([
                        [25, 120, 80, 8, 98.6, 70],
                        [30, 130, 85, 9, 99.0, 75],
                        [35, 140, 90, 10, 99.5, 80],
                        [40, 150, 95, 11, 100.0, 85]
                    ])
                    background_df = pd.DataFrame(background_data, columns=pd.Index(self.feature_names))
                    
                    # Use the model's predict method with proper data format
                    def predict_wrapper_direct(data):
                        if self.model is None:
                            return np.zeros(1)
                        df = self._to_feature_df(data)
                        # Get the full prediction result from pipeline
                        result = self.model.predict(df)
                        # Extract just the predicted risk level indices for SHAP
                        if isinstance(result, list) and len(result) > 0:
                            # Get the predicted risk level from each result
                            risk_mapping = {'high risk': 2, 'mid risk': 1, 'low risk': 0}
                            risk_indices = []
                            for res in result:
                                risk_level = res.get('predicted_risk_level', 'low risk')
                                risk_indices.append(risk_mapping.get(risk_level, 0))
                            return np.array(risk_indices)
                        else:
                            return np.zeros(df.shape[0])
                    
                    try:
                        self.explainer = KernelExplainer(predict_wrapper_direct, background_df)
                        print("Using KernelExplainer (fallback)")
                    except Exception as e:
                        self.explainer = None
        except Exception as e:
            self.explainer = None
    
    def _to_feature_df(self, data):
        """Convert input to DataFrame with correct columns and shape for the model."""
        cols = self.feature_names
        if isinstance(data, pd.DataFrame):
            df = data.copy()
        elif isinstance(data, dict):
            df = pd.DataFrame([data])
        elif isinstance(data, (list, np.ndarray)):
            arr = np.array(data)
            if arr.ndim == 1:
                df = pd.DataFrame([arr], columns=pd.Index(cols))
            elif arr.ndim == 2 and arr.shape[1] == len(cols):
                df = pd.DataFrame(arr, columns=pd.Index(cols))
            elif isinstance(data, list) and all(isinstance(x, dict) for x in data):
                df = pd.DataFrame(data)
            else:
                df = pd.DataFrame(arr)
        else:
            df = pd.DataFrame(data)
        # Ensure correct columns and order
        df = df.reindex(columns=cols)
        return df
    
    @lru_cache(maxsize=32)
    def _get_cached_shap_values(self, sample_size: int, seed: int = 42):
        """Get cached SHAP values for summary plots to avoid recomputation."""
        if self.explainer is None:
            return None, None
        
        try:
            # Use fixed seed for reproducible results
            np.random.seed(seed)
            sample_data = pd.DataFrame({
                'Age': np.random.uniform(20, 45, sample_size),
                'SystolicBP': np.random.uniform(90, 180, sample_size),
                'DiastolicBP': np.random.uniform(60, 110, sample_size),
                'BS': np.random.uniform(6, 15, sample_size),
                'BodyTemp': np.random.uniform(97, 102, sample_size),
                'HeartRate': np.random.uniform(60, 100, sample_size)
            })
            
            # Get SHAP values
            if isinstance(self.explainer, TreeExplainer):
                shap_values = self.explainer.shap_values(sample_data)
                if isinstance(shap_values, list):
                    shap_values = shap_values[0]
            else:
                shap_values = self.explainer.shap_values(sample_data)
            
            return shap_values, sample_data
        except Exception as e:
            return None, None
    
    def get_individual_explanation(self, features: Dict[str, float]) -> List[Dict[str, Any]]:
        """Get SHAP explanation for individual prediction with improved formatting."""
        if self.explainer is None:
            return []
        
        try:
            # Prepare features for SHAP
            feature_df = pd.DataFrame([features])
            
            # Get SHAP values
            if isinstance(self.explainer, TreeExplainer):
                shap_values = self.explainer.shap_values(feature_df)
                if isinstance(shap_values, list):
                    shap_values = shap_values[0]  # Take first class for binary/multiclass
            else:
                shap_values = self.explainer.shap_values(feature_df)
            
            # Format explanation
            explanations = []
            for i, feature in enumerate(self.feature_names):
                if feature in features:
                    # Handle different SHAP value formats
                    if isinstance(shap_values, np.ndarray):
                        if shap_values.ndim == 2:
                            shap_value = float(shap_values[0, i])
                        elif shap_values.ndim == 1:
                            shap_value = float(shap_values[i])
                        else:
                            continue
                    else:
                        continue
                    
                    explanations.append({
                        "feature": feature,
                        "feature_description": self.feature_descriptions[feature],
                        "value": features[feature],
                        "shap_value": shap_value,
                        "abs_shap_value": abs(shap_value),
                        "impact": "positive" if shap_value > 0 else "negative",
                        "importance_rank": 0  # Will be set after sorting
                    })
            
            # Sort by absolute SHAP value (importance)
            explanations.sort(key=lambda x: x["abs_shap_value"], reverse=True)
            
            # Add importance rank
            for i, exp in enumerate(explanations):
                exp["importance_rank"] = i + 1
            
            return explanations
            
        except Exception as e:
            return []
    
    def get_global_feature_importance(self, sample_size: int = 100) -> Dict[str, Any]:
        """Get global feature importance using SHAP values."""
        if self.explainer is None:
            return {"error": "SHAP explainer not available"}
        
        try:
            # Use cached SHAP values for better performance
            shap_values, sample_data = self._get_cached_shap_values(sample_size)
            if shap_values is None:
                return {"error": "Could not compute SHAP values"}
            
            # Calculate mean absolute SHAP values
            mean_abs_shap = np.mean(np.abs(shap_values), axis=0)
            
            # Create feature importance ranking
            feature_importance = []
            for i, feature in enumerate(self.feature_names):
                feature_importance.append({
                    "feature": feature,
                    "description": self.feature_descriptions[feature],
                    "mean_abs_shap": float(mean_abs_shap[i]),
                    "rank": 0
                })
            
            # Sort by importance and add ranks
            feature_importance.sort(key=lambda x: x["mean_abs_shap"], reverse=True)
            for i, feature in enumerate(feature_importance):
                feature["rank"] = i + 1
            
            return {
                "feature_importance": feature_importance,
                "sample_size": sample_size,
                "total_features": len(self.feature_names)
            }
            
        except Exception as e:
            return {"error": f"Could not compute global feature importance: {str(e)}"}
    
    def create_shap_summary_plot(self, sample_size: int = 50) -> str:
        """Create SHAP summary plot and return as base64 image."""
        if self.explainer is None or plt is None:
            print("Warning: SHAP explainer or matplotlib not available for summary plot")
            return ""
        
        try:
            # Use cached SHAP values for better performance
            shap_values, sample_data = self._get_cached_shap_values(sample_size)
            if shap_values is None:
                return ""
            
            # Create plot
            plt.figure(figsize=(10, 6))
            shap.summary_plot(shap_values, sample_data, show=False)
            plt.title("SHAP Feature Importance Summary", fontsize=14, fontweight='bold')
            plt.tight_layout()
            
            # Convert to base64
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.getvalue()).decode()
            plt.close()
            
            return image_base64
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return ""
    
    def create_shap_force_plot(self, features: Dict[str, float]) -> str:
        """Create SHAP force plot for individual prediction."""
        if self.explainer is None or plt is None:
            print("Warning: SHAP explainer or matplotlib not available for force plot")
            return ""
        
        try:
            feature_df = pd.DataFrame([features])
            
            # Get SHAP values
            if isinstance(self.explainer, TreeExplainer):
                shap_values = self.explainer.shap_values(feature_df)
                if isinstance(shap_values, list):
                    shap_values = shap_values[0]
            else:
                shap_values = self.explainer.shap_values(feature_df)
            
            # Create force plot
            plt.figure(figsize=(12, 4))
            shap.force_plot(
                self.explainer.expected_value if hasattr(self.explainer, 'expected_value') else 0,
                shap_values[0, :],
                feature_df.iloc[0],
                show=False
            )
            plt.title("SHAP Force Plot - Individual Prediction", fontsize=14, fontweight='bold')
            plt.tight_layout()
            
            # Convert to base64
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.getvalue()).decode()
            plt.close()
            
            return image_base64
            
        except Exception as e:
            return ""
    
    def get_explanation_summary(self, features: Dict[str, float]) -> Dict[str, Any]:
        """Get comprehensive explanation summary for a prediction."""
        individual_explanation = self.get_individual_explanation(features)
        
        if not individual_explanation:
            return {"error": "Could not generate explanation"}
        
        # Calculate summary statistics
        positive_features = [exp for exp in individual_explanation if exp["impact"] == "positive"]
        negative_features = [exp for exp in individual_explanation if exp["impact"] == "negative"]
        
        summary = {
            "top_contributing_features": individual_explanation[:3],
            "positive_contributors": positive_features,
            "negative_contributors": negative_features,
            "total_positive_impact": sum(exp["shap_value"] for exp in positive_features),
            "total_negative_impact": sum(exp["shap_value"] for exp in negative_features),
            "most_important_feature": individual_explanation[0] if individual_explanation else None,
            "explanation_quality": "high" if len(individual_explanation) >= 4 else "medium"
        }
        
        return summary

# Global SHAP explainer instance
shap_explainer = None

def set_shap_model(model):
    """Set the model for SHAP explainer."""
    global shap_explainer
    if model is not None:
        shap_explainer = SHAPExplainer(model)
    else:
        print("Warning: Model is None, SHAP explainer will not be available")
        shap_explainer = SHAPExplainer()

def get_shap_explainer():
    """Get the global SHAP explainer instance."""
    global shap_explainer
    if shap_explainer is None:
        # Import model from app (this will be set when model loads)
        try:
            import sys
            if 'app' in sys.modules:
                from app import model
                if model is not None:
                    shap_explainer = SHAPExplainer(model)
                else:
                    print("Warning: Model not loaded, SHAP explainer will not be available")
                    shap_explainer = SHAPExplainer()
            else:
                print("Warning: App module not loaded yet, creating empty SHAP explainer")
                shap_explainer = SHAPExplainer()
        except Exception as e:
            shap_explainer = SHAPExplainer()
    return shap_explainer 