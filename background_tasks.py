"""
Background tasks for performance optimization.
"""
import asyncio
from typing import Dict, Any, List
from datetime import datetime
import pandas as pd
from fastapi import BackgroundTasks
from cache import get_cache_manager
from logger import log_audit

class BackgroundTaskManager:
    """Manages background tasks for heavy operations."""
    
    def __init__(self):
        self.cache_manager = get_cache_manager()
    
    async def process_model_prediction_async(self, features: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Process model prediction asynchronously with caching."""
        try:
            # Check cache first
            cached_result = self.cache_manager.get_cached_prediction(features)
            if cached_result:
                return cached_result
            
            # Import here to avoid circular imports
            from app import ml_model, model
            
            # Perform prediction
            risk_level, confidence = ml_model.predict_risk(features)
            recommendations = ml_model.get_recommendations(risk_level, features)
            
            # SHAP explanation (if model is available)
            explanation = []
            try:
                if model is not None and hasattr(model, 'predict'):
                    features_for_shap = {
                        'Age': features['age'],
                        'SystolicBP': features['systolic_bp'],
                        'DiastolicBP': features['diastolic_bp'],
                        'BS': features['blood_sugar'],
                        'BodyTemp': features['body_temp'],
                        'HeartRate': features['heart_rate']
                    }
                    pred_results = model.predict(pd.DataFrame([features_for_shap]))
                    if pred_results and isinstance(pred_results, list) and 'explanation' in pred_results[0]:
                        explanation = pred_results[0]['explanation']
            except Exception as e:
                print(f"SHAP explanation error: {e}")
            
            # Prepare result
            result = {
                "risk_level": risk_level.value,
                "confidence": confidence,
                "recommendations": recommendations,
                "explanation": explanation,
                "cached_at": datetime.now().isoformat()
            }
            
            # Cache the result
            self.cache_manager.cache_model_prediction(features, result)
            
            return result
            
        except Exception as e:
            print(f"Background prediction error: {e}")
            return {"error": "Prediction failed", "details": str(e)}
    
    async def process_bulk_assessments_async(self, assessments: List[Dict[str, Any]], user_id: str) -> List[Dict[str, Any]]:
        """Process multiple assessments asynchronously."""
        tasks = []
        for assessment in assessments:
            features = {
                'age': assessment['age'],
                'systolic_bp': assessment['systolic_bp'],
                'diastolic_bp': assessment['diastolic_bp'],
                'blood_sugar': assessment['blood_sugar'],
                'body_temp': assessment['body_temp'],
                'heart_rate': assessment['heart_rate']
            }
            task = self.process_model_prediction_async(features, user_id)
            tasks.append(task)
        
        # Execute all predictions concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return results
    
    async def generate_shap_explanations_async(self, features_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate SHAP explanations for multiple predictions asynchronously."""
        try:
            from app import model
            import pandas as pd
            
            explanations = []
            for features in features_list:
                try:
                    if model is not None and hasattr(model, 'predict'):
                        features_for_shap = {
                            'Age': features['age'],
                            'SystolicBP': features['systolic_bp'],
                            'DiastolicBP': features['diastolic_bp'],
                            'BS': features['blood_sugar'],
                            'BodyTemp': features['body_temp'],
                            'HeartRate': features['heart_rate']
                        }
                        pred_results = model.predict(pd.DataFrame([features_for_shap]))
                        if pred_results and isinstance(pred_results, list) and 'explanation' in pred_results[0]:
                            explanations.append(pred_results[0]['explanation'])
                        else:
                            explanations.append([])
                    else:
                        explanations.append([])
                except Exception as e:
                    print(f"SHAP explanation error for features {features}: {e}")
                    explanations.append([])
            
            return explanations
            
        except Exception as e:
            print(f"Bulk SHAP explanation error: {e}")
            return [[] for _ in features_list]
    
    async def cache_user_data_async(self, user_id: str, user_data: Dict[str, Any]):
        """Cache user data asynchronously."""
        try:
            self.cache_manager.cache_user_session(user_id, user_data)
        except Exception as e:
            print(f"User data caching error: {e}")
    
    async def invalidate_cache_async(self, pattern: str):
        """Invalidate cache entries asynchronously."""
        try:
            keys = self.cache_manager.redis_client.keys(pattern)
            if keys:
                self.cache_manager.redis_client.delete(*keys)
        except Exception as e:
            print(f"Cache invalidation error: {e}")

# Global background task manager
background_task_manager = BackgroundTaskManager()

def get_background_task_manager() -> BackgroundTaskManager:
    """Get the global background task manager instance."""
    return background_task_manager 